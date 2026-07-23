-- ===========================================================================
-- ZURVO — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`) once, on a fresh project.
--
-- Design notes:
--  * A profile is decoupled from an auth user (user_id is nullable). This lets us
--    seed demo organisers and riders who have no login, while real users get a
--    profile linked to their auth uid on sign-up (see the trigger at the bottom).
--  * Trips are publicly readable — people browse before they sign up. Writes are
--    locked to the owner via RLS.
--  * Vertical and difficulty are free text guarded by checks, so adding a vertical
--    is a one-line change here, mirroring lib/verticals.js.
-- ===========================================================================

-- ---------- profiles ----------
create table if not exists profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users (id) on delete set null,
  name         text not null,
  handle       text,
  initials     text,
  avatar_seed  text,                         -- DiceBear seed; URL built in code
  tint         text,                         -- rider face colour in the face-pile
  bike         text,
  city         text,
  since        text,
  verified     boolean not null default false,
  trust_score  int    not null default 0,
  km           int    not null default 0,
  rides        int    not null default 0,
  city_rank    int,
  city_riders  int,
  states       int    not null default 0,
  -- organiser-side stats (null for pure riders)
  rating       numeric(2,1),
  reviews      int,
  rides_hosted int,
  replies_in   text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- trips ----------
create table if not exists trips (
  id                text primary key,          -- human slug, e.g. 'blr-ooty'
  vertical          text not null check (vertical in ('rides','trails','offroad','camps','paddle','cycles')),
  city              text not null,
  title             text not null,
  photo             text,
  days              int  not null default 1,
  distance_km       int  not null default 0,
  difficulty        text not null,
  dates             text,
  price             int  not null default 0,   -- rupees; 0 = free
  covers            text,
  covers_full       text[] default '{}',
  seats_total       int  not null default 0,
  seats_taken       int  not null default 0,
  closes_on         text,
  cancel_free_until text,
  organiser_id      uuid references profiles (id) on delete set null,
  meet_at           text,
  meet_on           text,
  route             jsonb default '[]',        -- [{ place, when, kind }]
  status            text not null default 'live' check (status in ('draft','live','closed')),
  created_at        timestamptz not null default now()
);
create index if not exists trips_vertical_city_idx on trips (vertical, city, status);
create index if not exists trips_organiser_idx on trips (organiser_id);

-- ---------- who is going on a trip ----------
create table if not exists trip_riders (
  trip_id   text not null references trips (id) on delete cascade,
  rider_id  uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, rider_id)
);

-- ---------- bookings (a rider's paid seat) ----------
create table if not exists bookings (
  id         uuid primary key default gen_random_uuid(),
  trip_id    text not null references trips (id) on delete cascade,
  rider_id   uuid not null references profiles (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','confirmed','awaiting','cancelled','finished')),
  paid       int  not null default 0,
  payment_id text,                              -- Razorpay payment id, verified server-side
  created_at timestamptz not null default now(),
  unique (trip_id, rider_id)
);
create index if not exists bookings_rider_idx on bookings (rider_id);

-- ---------- one-time organiser verification (the ₹99 fee) ----------
create table if not exists organiser_verifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique not null references profiles (id) on delete cascade,
  fee_paid    int  not null default 99,
  payment_id  text,                             -- verified server-side before insert
  verified_at timestamptz not null default now()
);

-- ---------- per-user preferences (settings toggles) ----------
create table if not exists preferences (
  profile_id uuid primary key references profiles (id) on delete cascade,
  prefs      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table profiles                enable row level security;
alter table trips                   enable row level security;
alter table trip_riders             enable row level security;
alter table bookings                enable row level security;
alter table organiser_verifications enable row level security;
alter table preferences             enable row level security;

-- profiles: public rider cards; you may only edit your own
create policy "profiles are public"        on profiles       for select using (true);
create policy "update own profile"         on profiles       for update using (user_id = auth.uid());

-- trips & who's going: public to browse; only the organiser writes their trips
create policy "trips are public"           on trips          for select using (true);
create policy "organiser inserts own trip" on trips          for insert with check (
  organiser_id in (select id from profiles where user_id = auth.uid())
);
create policy "organiser edits own trip"   on trips          for update using (
  organiser_id in (select id from profiles where user_id = auth.uid())
);
create policy "trip_riders are public"     on trip_riders    for select using (true);
create policy "join a trip as self"        on trip_riders    for insert with check (
  rider_id in (select id from profiles where user_id = auth.uid())
);

-- bookings & verification & prefs: strictly your own
create policy "read own bookings"          on bookings       for select using (
  rider_id in (select id from profiles where user_id = auth.uid())
);
create policy "create own booking"         on bookings       for insert with check (
  rider_id in (select id from profiles where user_id = auth.uid())
);
create policy "read own verification"      on organiser_verifications for select using (
  profile_id in (select id from profiles where user_id = auth.uid())
);
create policy "read own prefs"             on preferences    for select using (
  profile_id in (select id from profiles where user_id = auth.uid())
);
create policy "write own prefs"            on preferences    for all using (
  profile_id in (select id from profiles where user_id = auth.uid())
) with check (
  profile_id in (select id from profiles where user_id = auth.uid())
);

-- Note: inserts into organiser_verifications and paid bookings happen server-side
-- (a Supabase Edge Function using the service role), AFTER Razorpay signature
-- verification. No client-side insert policy is granted for the fee on purpose.

-- ===========================================================================
-- Give every new auth user a profile automatically
-- ===========================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, initials, avatar_seed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Rider'),
    upper(left(coalesce(new.raw_user_meta_data->>'name', 'R'), 1)),
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
