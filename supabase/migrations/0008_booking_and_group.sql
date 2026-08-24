-- ===========================================================================
-- ZURVO — a booking that actually exists, and the group behind it
-- Run after 0007_trip_photos_storage.sql. Needs 0002 (my_profile_id,
-- is_trip_participant).
--
-- Until now "Request to join" was a link. It navigated to the confirmation
-- screen and wrote nothing: no booking, no seat taken, no rider on the trip. So
-- the confirmation congratulated people on something that had not happened, the
-- face pile said "0 riders going" to someone who had just joined, and the live
-- map — which decides who may see whom from exactly these rows — had no way to
-- know they belonged there.
--
-- Two things land here. A booking that is written properly, and the group
-- conversation the confirmation screen has been offering since the beginning.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Booking a seat.
--
-- Three rows have to move together — the booking, the rider on the trip, and the
-- seat count — and a rider is allowed to write only the first two. Handing out
-- UPDATE on trips so the count could be incremented client-side would also hand
-- out the ability to rewrite anyone's price, dates, or seats. So the whole thing
-- happens in here, security definer, as one statement the caller cannot take
-- apart.
--
-- SELECT ... FOR UPDATE is what makes the last seat safe: two riders tapping at
-- the same moment queue instead of both reading "1 left" and both being sold it.
--
-- Idempotent by design. Tapping twice, a double-fired click, a retried request —
-- all return the existing booking rather than raising, because the honest answer
-- to "book this seat" from someone who already has it is their seat.
-- ---------------------------------------------------------------------------
create or replace function public.book_trip(p_trip_id text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  me      uuid := my_profile_id();
  t       record;
  booking uuid;
begin
  if me is null then
    raise exception 'Sign in to book a seat.';
  end if;

  select id, status, seats_total, seats_taken, organiser_id
    into t
    from trips
   where id = p_trip_id
     for update;

  if not found then
    raise exception 'That trip no longer exists.';
  end if;

  if t.organiser_id = me then
    raise exception 'You are running this trip — you do not need a seat on it.';
  end if;

  -- An existing seat wins over every check below it: someone who already booked
  -- must still be able to reach their booking after the trip fills or closes.
  select id into booking from bookings where trip_id = p_trip_id and rider_id = me;
  if booking is not null then
    return booking;
  end if;

  if t.status is distinct from 'live' then
    raise exception 'This trip is closed to new riders.';
  end if;

  if t.seats_total > 0 and t.seats_taken >= t.seats_total then
    raise exception 'This trip is full.';
  end if;

  insert into bookings (trip_id, rider_id, status)
       values (p_trip_id, me, 'pending')
    returning id into booking;

  insert into trip_riders (trip_id, rider_id)
       values (p_trip_id, me)
  on conflict do nothing;

  update trips set seats_taken = seats_taken + 1 where id = p_trip_id;

  return booking;
end;
$$;

revoke all on function public.book_trip(text) from public, anon;
grant execute on function public.book_trip(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Giving up a seat.
--
-- The confirmation screen promises "cancel free until —" and a promise with no
-- code behind it is just a sentence. The seat goes back to the trip so the next
-- rider can have it; the booking is kept and marked cancelled rather than
-- deleted, because a refund needs something to point at.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_trip_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me    uuid := my_profile_id();
  found_booking record;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  select id, status into found_booking
    from bookings
   where trip_id = p_trip_id and rider_id = me
     for update;

  if not found then
    raise exception 'You do not have a booking on this trip.';
  end if;

  if found_booking.status = 'cancelled' then
    return; -- already gone; saying so twice helps nobody
  end if;

  update bookings set status = 'cancelled' where id = found_booking.id;
  delete from trip_riders where trip_id = p_trip_id and rider_id = me;
  update trips set seats_taken = greatest(seats_taken - 1, 0) where id = p_trip_id;
end;
$$;

revoke all on function public.cancel_booking(text) from public, anon;
grant execute on function public.cancel_booking(text) to authenticated;

-- A rider has to be able to mark their own booking cancelled through the
-- function above; nothing else about a booking is theirs to rewrite.
drop policy if exists "cancel own booking" on bookings;
create policy "cancel own booking" on bookings for update
  using  (rider_id = my_profile_id())
  with check (rider_id = my_profile_id());

-- Leaving a trip removes the rider row. Joining was already allowed (0001).
drop policy if exists "leave a trip as self" on trip_riders;
create policy "leave a trip as self" on trip_riders for delete
  using (rider_id = my_profile_id());

-- ---------------------------------------------------------------------------
-- The group.
--
-- "Say hi to the group" is the first thing the confirmation screen offers, and
-- it is the thing that turns a paid seat into a ride someone doesn't cancel.
--
-- Who can read it is the same rule the live map already uses: you see a trip's
-- messages only if you belong to that trip. That is is_trip_participant() from
-- 0002, so the group and the map can never disagree about who is on a ride.
-- ---------------------------------------------------------------------------
create table if not exists trip_messages (
  id         uuid primary key default gen_random_uuid(),
  trip_id    text not null references trips (id) on delete cascade,
  sender_id  uuid not null references profiles (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists trip_messages_trip_idx on trip_messages (trip_id, created_at);

alter table trip_messages enable row level security;

drop policy if exists "participants read messages" on trip_messages;
create policy "participants read messages" on trip_messages for select
  using (is_trip_participant(trip_id, my_profile_id()));

-- You may only ever speak as yourself, and only in a group you belong to.
drop policy if exists "participants send messages" on trip_messages;
create policy "participants send messages" on trip_messages for insert
  with check (sender_id = my_profile_id() and is_trip_participant(trip_id, my_profile_id()));

drop policy if exists "delete own message" on trip_messages;
create policy "delete own message" on trip_messages for delete
  using (sender_id = my_profile_id());

-- Messages arrive on everyone's screen without a refresh, the same way pins do.
do $$
begin
  alter publication supabase_realtime add table trip_messages;
exception
  when duplicate_object then null;
end;
$$;
