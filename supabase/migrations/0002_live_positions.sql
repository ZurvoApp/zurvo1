-- ===========================================================================
-- ZURVO — live location sharing
-- Run after 0001_init.sql.
--
-- One row per (trip, rider) that is CURRENTLY sharing. It is ephemeral state,
-- not history: a rider upserts their fix every couple of seconds while riding,
-- and the row is DELETED the moment they stop. So the table only ever holds the
-- people live on the road right now.
--
-- Who may see whom is the whole point of the feature: you see the live pins of a
-- trip ONLY if you belong to that trip (its organiser, someone who joined it, or
-- someone with a live booking on it). That rule is enforced here in RLS, not in
-- the client, so a crafted request can't read a stranger's location.
-- ===========================================================================

create table if not exists ride_positions (
  trip_id    text not null references trips (id) on delete cascade,
  rider_id   uuid not null references profiles (id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  speed_kmh  int  not null default 0,
  heading    int,                              -- 0–359 degrees, null if unknown
  updated_at timestamptz not null default now(),
  primary key (trip_id, rider_id)
);
create index if not exists ride_positions_trip_idx on ride_positions (trip_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so RLS policies can consult other tables safely)
-- ---------------------------------------------------------------------------

-- The caller's own profile id, or null when signed out.
create or replace function public.my_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from profiles where user_id = auth.uid() limit 1
$$;

-- Does profile p belong to trip t? Organiser, joined rider, or live booking.
create or replace function public.is_trip_participant(t text, p uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p is not null and (
       exists (select 1 from trips        where id = t and organiser_id = p)
    or exists (select 1 from trip_riders  where trip_id = t and rider_id = p)
    or exists (select 1 from bookings     where trip_id = t and rider_id = p
                                            and status <> 'cancelled')
  )
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table ride_positions enable row level security;

-- Read every pin on a trip you belong to.
create policy "participants read positions" on ride_positions for select
  using (is_trip_participant(trip_id, my_profile_id()));

-- Write only your OWN pin, and only on a trip you belong to.
create policy "share own position" on ride_positions for insert
  with check (rider_id = my_profile_id() and is_trip_participant(trip_id, my_profile_id()));

create policy "update own position" on ride_positions for update
  using  (rider_id = my_profile_id())
  with check (rider_id = my_profile_id());

-- Stop sharing = delete your pin. Only ever your own.
create policy "stop own position" on ride_positions for delete
  using (rider_id = my_profile_id());

-- ---------------------------------------------------------------------------
-- Realtime: co-riders' maps update the instant a pin moves.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table ride_positions;
