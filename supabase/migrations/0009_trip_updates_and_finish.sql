-- ===========================================================================
-- ZURVO — organiser live updates, and finishing a ride
-- Run after 0008_booking_and_group.sql. Needs 0002 (my_profile_id,
-- is_trip_participant).
--
-- Two things close the loop between an organiser and their riders:
--
--  1. LIVE UPDATES. A one-to-many channel the organiser broadcasts on — "leaving
--     in 10", "fuel stop at the next petrol pump", "rain ahead, ride safe". It is
--     NOT the group chat (0008): that is everyone talking; this is the organiser
--     announcing, and it shows to riders on their Live trip screen. Same
--     who-can-see rule as the map and the chat: participants only.
--
--  2. FINISHING. A ride has to be able to end. Until it does, a booking never
--     becomes 'finished', so it never lands in "My rides → Finished" and the
--     Strava-style share card has nothing to hang off. The organiser marks the
--     ride done; every seat on it becomes finished in one statement.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Live updates from the organiser.
-- ---------------------------------------------------------------------------
create table if not exists trip_updates (
  id           uuid primary key default gen_random_uuid(),
  trip_id      text not null references trips (id) on delete cascade,
  organiser_id uuid not null references profiles (id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 1000),
  created_at   timestamptz not null default now()
);
create index if not exists trip_updates_trip_idx on trip_updates (trip_id, created_at desc);

alter table trip_updates enable row level security;

-- Read: anyone on the trip (organiser + riders), same rule as the map and chat.
drop policy if exists "participants read updates" on trip_updates;
create policy "participants read updates" on trip_updates for select
  using (is_trip_participant(trip_id, my_profile_id()));

-- Write: ONLY the organiser of that trip, speaking as themselves.
drop policy if exists "organiser posts updates" on trip_updates;
create policy "organiser posts updates" on trip_updates for insert
  with check (
    organiser_id = my_profile_id()
    and exists (select 1 from trips where id = trip_id and organiser_id = my_profile_id())
  );

drop policy if exists "organiser deletes own updates" on trip_updates;
create policy "organiser deletes own updates" on trip_updates for delete
  using (organiser_id = my_profile_id());

-- Updates arrive on riders' screens without a refresh, like pins and messages.
do $$
begin
  alter publication supabase_realtime add table trip_updates;
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finishing a ride.
--
-- Organiser-only, and only their own trip. Closes the trip (it leaves Discover)
-- and turns every live seat into a finished one — which is what surfaces the ride
-- under "My rides → Finished" for each rider, with the share card behind it.
-- Cancelled bookings are left alone; a seat someone gave up did not "finish".
-- Idempotent: finishing an already-finished trip is a no-op, not an error.
-- ---------------------------------------------------------------------------
create or replace function public.finish_trip(p_trip_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := my_profile_id();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  if not exists (select 1 from trips where id = p_trip_id and organiser_id = me) then
    raise exception 'Only the organiser can finish this trip.';
  end if;

  update trips set status = 'closed' where id = p_trip_id;

  update bookings
     set status = 'finished'
   where trip_id = p_trip_id
     and status not in ('cancelled', 'finished');
end;
$$;

revoke all on function public.finish_trip(text) from public, anon;
grant execute on function public.finish_trip(text) to authenticated;
