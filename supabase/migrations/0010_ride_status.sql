-- ===========================================================================
-- ZURVO — a rider's live status on the group map
-- Run after 0009_trip_updates_and_finish.sql. Needs 0002 (ride_positions).
--
-- The group-ride headache: someone stops and everyone else is left guessing —
-- catch up to the front, or wait for the back? A rider now carries a STATUS on
-- their live pin ("refuelling", "fell behind", "need help"), so the reason for a
-- stop travels with the pin and nobody has to ask.
--
-- It rides on the row that already exists (ride_positions, 0002): same table,
-- same RLS (participants read, you write only your own), same realtime channel —
-- so a status change reaches every rider exactly the way a moved pin already does.
-- ===========================================================================

alter table public.ride_positions
  add column if not exists status text not null default 'riding'
  check (status in ('riding', 'refuel', 'break', 'waiting', 'behind', 'help'));
