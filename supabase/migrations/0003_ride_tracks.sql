-- ===========================================================================
-- ZURVO — ride tracks (the recorded route line)
-- Run after 0002_live_positions.sql.
--
-- 0002's ride_positions is EPHEMERAL: one latest pin per rider, deleted the
-- moment they stop. That is right for a live map, but it means the path a rider
-- actually took is thrown away. This table is the opposite: an APPEND-ONLY
-- breadcrumb trail, one row per GPS fix kept while sharing, so that after a ride
-- finishes we can draw the route the rider rode — the map on the shareable
-- Instagram-story card, Strava-style.
--
-- A point is appended roughly every few seconds / every ~25 m of movement (the
-- client throttles), not on the raw GPS firehose, so a long ride stays a few
-- thousand rows, not tens of thousands.
--
-- Visibility follows the same trust rule as live pins: you may read a trip's
-- track only if you belong to that trip, and you may write only your own points.
-- ===========================================================================

create table if not exists ride_tracks (
  id          bigint generated always as identity primary key,
  trip_id     text not null references trips (id) on delete cascade,
  rider_id    uuid not null references profiles (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  speed_kmh   int not null default 0,
  recorded_at timestamptz not null default now()
);

-- The one query this table serves: "give me rider R's points on trip T, in
-- order." A composite index makes that a range scan instead of a sort.
create index if not exists ride_tracks_lookup
  on ride_tracks (trip_id, rider_id, recorded_at);

-- ---------------------------------------------------------------------------
-- Row-Level Security — reuses the helpers defined in 0002.
--   my_profile_id()            -> the caller's own profile id (or null)
--   is_trip_participant(t, p)  -> does profile p belong to trip t
-- ---------------------------------------------------------------------------
alter table ride_tracks enable row level security;

-- Read the trail of anyone on a trip you belong to (co-riders can replay the
-- group's route; you can always read your own).
create policy "participants read tracks" on ride_tracks for select
  using (is_trip_participant(trip_id, my_profile_id()));

-- Append only your OWN points, and only on a trip you belong to.
create policy "append own track" on ride_tracks for insert
  with check (rider_id = my_profile_id() and is_trip_participant(trip_id, my_profile_id()));

-- Clear your own trail (e.g. a mistaken recording). Never anyone else's.
create policy "delete own track" on ride_tracks for delete
  using (rider_id = my_profile_id());
