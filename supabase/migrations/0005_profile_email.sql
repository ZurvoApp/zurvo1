-- ===========================================================================
-- ZURVO — the rider's email address on their profile
-- Run after 0004_profile_gender.sql.
--
-- The address lives in auth.users, which no client can read and which the table
-- editor won't join for you. So a copy lands on the profile: one place to look
-- at a rider, name and email together.
--
-- A COPY IS A LIABILITY UNLESS IT'S LOCKED. "profiles are public" (0001) means
-- every row of this table is readable by anyone holding the anon key — and that
-- key ships inside the browser bundle, so "anyone" is the internet. Add a plain
-- email column and this table becomes a public mailing list of every rider who
-- ever signed up: one request, every address.
--
-- Row-level security cannot help here; it decides which ROWS you may read, never
-- which columns. Column privileges can. So the blanket table-level SELECT is
-- withdrawn from the public roles and handed back column by column, with email
-- left out. The dashboard (postgres) and the service role are unaffected and
-- still see everything, which is where looking at emails belongs.
--
-- The app never needs this column: a signed-in rider's own address is already in
-- their session (supabase.auth.getUser()), and nobody else's is anyone's business.
--
-- NOTE — because the public roles now hold column-level grants, `select *` from
-- the browser fails with "permission denied for column email". Client reads name
-- their columns explicitly (see PROFILE_COLUMNS in lib/api.js). Any column added
-- to this table from here on must be added to the grant below AND to that list,
-- or it will simply be missing in the app.
-- ===========================================================================

alter table public.profiles
  add column if not exists email text;

-- ---------------------------------------------------------------------------
-- Backfill everyone who signed up before this migration.
-- ---------------------------------------------------------------------------
update public.profiles p
   set email = u.email
  from auth.users u
 where p.user_id = u.id
   and p.email is distinct from u.email;

-- ---------------------------------------------------------------------------
-- New accounts: carry the address across at sign-up.
-- Replaces the version in 0001_init.sql — same behaviour, plus the email.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, initials, avatar_seed, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Rider'),
    upper(left(coalesce(new.raw_user_meta_data->>'name', 'R'), 1)),
    new.id::text,
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep the copy honest. A rider who changes their address in auth would
-- otherwise leave a stale one sitting here forever — and a stale contact address
-- is worse than none, because it looks current.
-- ---------------------------------------------------------------------------
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Close the column to the public roles.
--
-- Order matters: a table-level SELECT grant covers every column, present and
-- future, and revoking one column out of it does nothing. The table grant has to
-- go first, then the columns are handed back individually.
-- ---------------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;

grant select (
  id, user_id, name, handle, initials, avatar_seed, tint, bike, city, since,
  verified, trust_score, km, rides, city_rank, city_riders, states,
  rating, reviews, rides_hosted, replies_in, gender, is_demo, created_at
) on public.profiles to anon, authenticated;
