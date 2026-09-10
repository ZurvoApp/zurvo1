-- ===========================================================================
-- 0011 — let an organiser DELETE a trip they own
-- ===========================================================================
-- RLS is on for `trips` and there was no DELETE policy, so every delete was
-- denied. This grants exactly the same ownership check the UPDATE policy uses.
--
-- Every table that references trips does so ON DELETE CASCADE
-- (trip_riders, bookings, ride_positions, ride_tracks, trip_messages,
-- trip_updates), so deleting a trip row cleanly takes its dependents with it.
--
-- The app refuses to delete a trip that already has riders — their escrow must
-- be refunded first — but that is a product guard in the client, not a security
-- boundary. If you ever need a hard server-side rule, add a check here.

drop policy if exists "organiser deletes own trip" on trips;
create policy "organiser deletes own trip" on trips for delete using (
  organiser_id in (select id from profiles where user_id = auth.uid())
);
