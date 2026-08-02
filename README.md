<div align="center">

# Zurvo

**Discover, join, and organise group adventure trips across India — with your money held in escrow until the trip is over.**

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](https://web.dev/progressive-web-apps/)
[![Status](https://img.shields.io/badge/status-in%20development-orange)]()

</div>

---

## Overview

Zurvo is a mobile-first app for discovering, joining, and organising group
adventure trips across India — starting with motorcycle rides. A rider opens the
app, sees trips out of their city, and joins one; an organiser runs a trip and
gets paid once it's finished. The whole product is built around one promise: the
rider's money is held in escrow and never sits with a stranger.

## Table of contents

- [The trust model](#the-trust-model)
- [Adventure verticals](#adventure-verticals)
- [Tech stack](#tech-stack)
- [App structure](#app-structure)
- [Live location](#live-location)
- [Data model](#data-model)
- [Design language](#design-language)
- [Getting started](#getting-started)
- [Project layout](#project-layout)
- [Status](#status)

## The trust model

Every screen exists to answer a rider's real doubts, in the order they surface:

| Doubt | How the app answers it |
| --- | --- |
| **Who is taking my money?** | Organisers are ID-verified, shown with their rating, rides hosted, and how fast they reply. |
| **Who am I riding with?** | Riders going are shown by name and bike. "Riders you know" is a real relationship, so it only appears when it's true. |
| **What will it actually be like?** | The route, dates, distance, difficulty, and exactly what the price does and doesn't cover. |
| **What if it goes wrong?** | Money is held by Zurvo until 24 hours after the trip finishes; cancel in time and it comes back in full. |

Scarcity, familiar-rider highlights, and the live indicator only render when the
underlying fact is true — the app never manufactures urgency. Scarcity has a
floor: a trip has to be genuinely filling up before the interface says so.

## Adventure verticals

The same layout serves six worlds, each with its own accent colour and vocabulary
— a trek is never called "a ride":

**Rides · Trails · Offroad · Camps · Paddle · Cycles**

A vertical owns a noun, a plural, a verb, the word for a seat, and its own
difficulty ladder, all declared in one place. Switching a vertical repaints the
interface through a single design token and swaps the wording; the structure never
changes between them. Adding a world is an entry in that object and a colour
block — never a new screen.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) + React 18, server-rendered, installable as a PWA |
| Backend | Supabase — Postgres, Auth (phone OTP, Google, email magic link), Storage, Realtime, row-level security |
| Payments | Razorpay — bookings and a one-time ₹99 organiser verification, signatures verified server-side |
| Styling | Pure CSS Modules over design tokens; no CSS framework |
| Maps | Leaflet, loaded from CDN only when the Live tab is opened |
| Media | Trip photos from Unsplash; rider avatars are inline SVG helmets (male/female/neutral) |
| Type | Outfit (display), Plus Jakarta Sans (body), JetBrains Mono (numbers) |

Pages render on demand rather than being statically exported, because organisers
publish trips at any time.

Data reaches the screens through one seam, `lib/api.js`, so a component never
sees a database column name — it receives the exact shape it renders.
`lib/data.js` holds only pure helpers and config (the city list, price
formatting, seat maths); all trip and profile content lives in the database.

## App structure

Bottom navigation has five tabs — **Discover, Search, Live, My Rides, Me**.
Creating a trip isn't a tab; it's an Organiser mode reached by the Rider /
Organiser switch at the top of Discover — a nav slot is for a place you return
to, and organising is a hat you put on.

| Route | What it is |
| --- | --- |
| `/` | **Discover** — one hero trip, then rails ("Riders you know", "Filling up"), the escrow explainer, organisers near you, and the full index |
| `/search` | **Search** — every trip in a vertical, filtered by place, city, or difficulty |
| `/live` | **Live** — the trips you're on the road with right now, and a map of everyone sharing their position |
| `/rides` | **My Rides** — the trips you've booked, and how much Zurvo is holding for you |
| `/me` | **Me** — your identity card: stats, trust score, badges, and settings |
| `/trip/[id]` | **Trip detail** — the full trip, ordered by the sequence of doubt above, with a book / request-to-join action |
| `/create` | **Create** — the organiser flow: pick a vertical, describe the trip, publish. First-timers pass a one-time ₹99 ID verification |
| `/booking/[id]` | **Booking** — the post-payment confirmation, where the escrow promise is the whole screen |

Shared pieces live in `components/`: the top bar and city picker, bottom nav, the
mode switch, vertical tabs, trip cards, the trust components, the launch splash,
the settings panel, and the front door — an auth provider holding the session and
profile for the whole app, and a gate that routes a visitor to sign-in, to a
one-time onboarding (name, home city, bike), or into the app.

## Live location

The Live tab answers the one question the other tabs can't: where is everyone
right now. It is ephemeral state, not history — a rider's position row exists
only while they are sharing, and is deleted the moment they stop. Sharing is
opt-in and per person: tap Go Live to appear, stop to vanish. Zurvo never puts
someone on a map they didn't switch on.

Who may see whom is enforced in the database, not the client: a rider sees the
pins on a trip only if they belong to it — its organiser, someone who joined, or
someone holding a live booking — and can write only their own pin. Pins move on
co-riders' maps through Supabase Realtime.

## Data model

| Table | Holds |
| --- | --- |
| `profiles` | Riders and organisers, linked to an auth user on sign-up |
| `trips` | Everything a trip card and trip page render, with vertical and difficulty guarded so adding a world is a one-line change |
| `trip_riders` | Who is going on each trip |
| `bookings` | A rider's paid seat and its status |
| `organiser_verifications` | The one-time ₹99 fee record |
| `preferences` | A rider's settings toggles |
| `ride_positions` | The live pins — one row per rider currently sharing |

Trips and profiles are publicly readable so people can browse before signing up;
everything a person writes is restricted to them by row-level security. Payments
are verified server-side before any paid row is written.

## Design language

- **Dark ground** (`--bg-0` … `--bg-2`), one accent per vertical (`--accent`), and
  semantic colours reserved for meaning — green for escrow and verified, amber for
  genuine scarcity.
- **Type** — Outfit for display and prices, Plus Jakarta Sans for body, JetBrains
  Mono for numbers and stats.
- **Icons** state the current tab twice — filled shape and white ink — because on a
  dark nav, colour alone is the first thing lost to a bright street. An icon's
  geometry never changes between its rest and active forms, so it can't appear to
  shift.
- **Motion** — content arrives rather than appears; one decelerating easing curve
  does most of the work, with a gentle spring reserved for things that "land".
  Everything animates transform and opacity only, and honours reduced-motion.

## Getting started

**Requirements:** Node.js 18.17+ and a Supabase project.

```bash
git clone https://github.com/<your-username>/zurvo.git
cd zurvo
npm install
```

Copy the example environment file and fill in your Supabase keys:

```bash
cp .env.local.example .env.local
```

```ini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never prefixed NEXT_PUBLIC
```

Apply the database migrations in `supabase/migrations/` to your project, in
order (`0001_init.sql`, then `0002_live_positions.sql`), via the Supabase SQL
editor or CLI. Then:

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # serve the production build
npm run lint     # lint
```

`.env.local` is gitignored — real keys must never be committed.

## Project layout

```
app/                 routes (Discover, Search, Live, My Rides, Me, trip, create, booking, auth)
components/          shared UI — nav, top bar, trip cards, trust, auth gate, onboarding, settings
lib/
  api.js             the single data seam to Supabase
  data.js            pure helpers and config (cities, pricing, seat maths)
  geo.js             browser Geolocation → the app's lat/lng/speed/heading shape
  supabase.js        client setup
  verticals.js       the six worlds, each with its own vocabulary and difficulty ladder
supabase/migrations/ SQL schema and row-level security policies
public/              icons and PWA manifest
```

## Status

Zurvo is moving from prototype to production. Discovery — the home feed, search,
and trip detail — reads live from Supabase, as do the user-specific screens.
Authentication and onboarding are in place, and live location works end to end.
Real Razorpay payments, for both bookings and the organiser verification fee, are
the remaining piece.
