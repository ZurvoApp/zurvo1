-- ===========================================================================
-- ZURVO — the name is chosen in onboarding, not guessed from the email
-- Run after 0005_profile_email.sql.
--
-- Until now the sign-up trigger set a new rider's name to the local part of their
-- email (zurvoapp@gmail.com -> "zurvoapp"). Onboarding then asked them to type a
-- real name and overwrote it — but for the moment before that, and anywhere the
-- overwrite didn't reach, the rider wore a name they never chose.
--
-- This drops the email-prefix guess. A brand-new email account starts as a plain
-- "Rider" placeholder; onboarding's first step ("What should other riders call
-- you?") is where the real name is set. A Google account still keeps the name
-- Google gave us — that one the rider actually chose — and onboarding pre-fills it
-- so they only confirm.
--
-- Only the name line changes. Email copy, initials and avatar seed are exactly as
-- 0005 left them.
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, initials, avatar_seed, email)
  values (
    new.id,
    -- a real provider name (Google) is kept; an email sign-up gets a placeholder,
    -- NOT the email prefix — onboarding collects the real one.
    coalesce(new.raw_user_meta_data->>'name', 'Rider'),
    upper(left(coalesce(new.raw_user_meta_data->>'name', 'R'), 1)),
    new.id::text,
    new.email
  );
  return new;
end;
$$;

-- Trigger definition is unchanged; re-created only so this file is self-contained
-- and safe to run on its own.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
