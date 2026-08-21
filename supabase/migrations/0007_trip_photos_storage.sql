-- ===========================================================================
-- ZURVO — storage for organiser trip cover photos
-- Run after 0006_name_from_onboarding.sql.
--
-- Organisers upload a cover photo when they create a trip (app/create). The file
-- goes to a PUBLIC bucket `trip-photos` and its public URL is stored on the trip
-- row (trips.photo). Public read is intentional: a trip card is shown to everyone
-- browsing before they sign up, exactly like the photo column has always been.
--
-- Uploads are namespaced by the organiser's profile id: the object path is
-- `<profile_id>/<file>`. The write policy checks that the first path segment is a
-- profile the caller owns, so a signed-in rider can only ever write under their
-- own folder — never overwrite someone else's cover.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- The bucket. `public = true` makes getPublicUrl() links readable without a
-- token, which is what the trip card needs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------------
-- Read: anyone may read objects in this bucket (public cards).
-- ---------------------------------------------------------------------------
drop policy if exists "trip photos are public" on storage.objects;
create policy "trip photos are public"
  on storage.objects for select
  using (bucket_id = 'trip-photos');

-- ---------------------------------------------------------------------------
-- Write: a signed-in user may upload only under a folder named for a profile
-- they own. (storage.foldername(name))[1] is the first path segment.
-- ---------------------------------------------------------------------------
drop policy if exists "organisers upload own trip photos" on storage.objects;
create policy "organisers upload own trip photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid()
    )
  );

-- Let an organiser replace/remove a cover they uploaded (same ownership rule).
drop policy if exists "organisers manage own trip photos" on storage.objects;
create policy "organisers manage own trip photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists "organisers delete own trip photos" on storage.objects;
create policy "organisers delete own trip photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid()
    )
  );
