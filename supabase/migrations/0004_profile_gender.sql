-- ===========================================================================
-- ZURVO — rider gender (drives the helmet avatar variant)
-- Run after 0003_ride_tracks.sql.
--
-- The profile avatar is a front-facing helmet rendered in code (components/
-- RiderAvatar.js), and it reads male vs female at a glance. That needs one fact
-- we did not collect before: how the rider rides. It is optional — 'other' (or
-- null, for accounts made before this migration) renders a neutral grey helmet,
-- so nothing breaks and no one is forced to answer.
-- ===========================================================================

alter table public.profiles
  add column if not exists gender text
    check (gender is null or gender in ('male', 'female', 'other'));
