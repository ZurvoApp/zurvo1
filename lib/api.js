/* THE DATA SEAM.
   Every screen reads its data through this module and nowhere else. It talks only
   to Supabase now — there is no mock fallback. Pure helpers (rupees, fill, …) and
   the city list still live in lib/data.js; everything with rows behind it is here.

   Shapes returned here match what the components render (camelCase, nested
   organiser + riders), so a page never sees a database column name. */

import { supabase } from './supabase'
import { CITIES } from './data'

/* Every column of `profiles` the browser is allowed to read — which is all of
   them except `email`. Migration 0005 withdrew the blanket table grant and handed
   the columns back one by one, so `select('*')` now fails outright: the address
   is for the dashboard and the service role, not for a table that anyone with the
   anon key can read end to end.

   The cost of that is this list. A column added to the table has to be added here
   AND to the grant in 0005, or it will quietly come back undefined. */
export const PROFILE_COLUMNS = `
  id, user_id, name, handle, initials, avatar_seed, tint, bike, city, since,
  verified, trust_score, km, rides, city_rank, city_riders, states,
  rating, reviews, rides_hosted, replies_in, gender, is_demo, created_at
`

const TRIP_SELECT = `
  id, vertical, city, title, photo, days, distance_km, difficulty, dates, price,
  covers, covers_full, seats_total, seats_taken, closes_on, cancel_free_until,
  organiser_id, meet_at, meet_on, route,
  organiser:profiles!organiser_id(id,name,initials,verified,rating,reviews,rides_hosted,replies_in),
  riders:trip_riders(rider:profiles(id,name,bike,tint))
`

function requireDb() {
  if (!supabase) throw new Error('Supabase is not configured — set NEXT_PUBLIC_SUPABASE_* in .env.local')
  return supabase
}

// snake_case trip row -> the camelCase shape every component already renders.
function mapTrip(row) {
  if (!row) return null
  const o = row.organiser
  return {
    id: row.id,
    vertical: row.vertical,
    city: row.city,
    title: row.title,
    photo: row.photo,
    days: row.days,
    distanceKm: row.distance_km,
    difficulty: row.difficulty,
    dates: row.dates,
    price: row.price,
    covers: row.covers,
    coversFull: row.covers_full ?? [],
    seatsTotal: row.seats_total,
    seatsTaken: row.seats_taken,
    closesOn: row.closes_on,
    cancelFreeUntil: row.cancel_free_until,
    meetAt: row.meet_at,
    meetOn: row.meet_on,
    route: row.route ?? [],
    organiser: o
      ? {
          id: o.id,
          name: o.name,
          initials: o.initials,
          verified: o.verified,
          rating: o.rating,
          reviews: o.reviews,
          ridesHosted: o.rides_hosted,
          repliesIn: o.replies_in,
        }
      : null,
    riders: (row.riders ?? []).map((r) => ({
      id: r.rider?.id,
      name: r.rider?.name,
      bike: r.rider?.bike,
      tint: r.rider?.tint,
      // A (viewer, rider) relationship we don't have yet — false until ride
      // history exists, so "Riders you know" simply doesn't render.
      knownToMe: false,
    })),
  }
}

function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    initials: row.initials,
    avatarSeed: row.avatar_seed,
    gender: row.gender,
    city: row.city,
    since: row.since,
    bike: row.bike,
    verified: row.verified,
    trustScore: row.trust_score,
    km: row.km,
    rides: row.rides,
    cityRank: row.city_rank,
    cityRiders: row.city_riders,
    states: row.states,
    badges: [], // no badge system yet; new riders start with none
  }
}

/* ----- trips (public reads) ----- */

export async function getTrips({ vertical, city } = {}) {
  let q = requireDb().from('trips').select(TRIP_SELECT).eq('status', 'live')
  if (vertical) q = q.eq('vertical', vertical)
  if (city) q = q.eq('city', city)
  const { data, error } = await q
  if (error) throw error
  return data.map(mapTrip)
}

export async function getTripById(id) {
  const { data, error } = await requireDb().from('trips').select(TRIP_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return mapTrip(data)
}

export async function getOrganisers({ vertical, city } = {}) {
  const trips = await getTrips({ vertical, city })
  const map = new Map()
  for (const t of trips) {
    if (!t.organiser) continue
    const o = map.get(t.organiser.id) ?? { ...t.organiser, tripCount: 0 }
    o.tripCount += 1
    map.set(o.id, o)
  }
  return [...map.values()].sort((a, b) => (b.ridesHosted ?? 0) - (a.ridesHosted ?? 0))
}

export async function getCities() {
  return CITIES
}

// Count of live trips per city for a vertical — powers the city picker labels.
export async function getCityCounts(vertical) {
  const { data, error } = await requireDb()
    .from('trips')
    .select('city')
    .eq('status', 'live')
    .eq('vertical', vertical)
  if (error) throw error
  const counts = Object.fromEntries(CITIES.map((c) => [c, 0]))
  for (const r of data) if (r.city in counts) counts[r.city] += 1
  return counts
}

/* ----- the signed-in rider ----- */

async function myProfileRow() {
  const db = requireDb()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null
  const { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return data
}

// The live map writes a position several times a minute; it must not fetch the
// profile every time. The id is stable for a session, so cache it once.
let _cachedProfileId = null
async function myId() {
  if (_cachedProfileId) return _cachedProfileId
  const row = await myProfileRow()
  _cachedProfileId = row?.id ?? null
  return _cachedProfileId
}

export async function getMyId() {
  return myId()
}

export async function getMe() {
  return mapProfile(await myProfileRow())
}

export async function getMyRides() {
  const me = await myProfileRow()
  if (!me) return { upcoming: [], past: [] }
  const { data, error } = await requireDb()
    .from('bookings')
    .select(`status, paid, created_at, trip:trips(${TRIP_SELECT})`)
    .eq('rider_id', me.id)
  if (error) throw error
  const rows = (data ?? []).map((b) => ({ status: b.status, paid: b.paid, trip: mapTrip(b.trip) }))
  return {
    upcoming: rows.filter((r) => r.status !== 'finished' && r.status !== 'cancelled'),
    past: rows.filter((r) => r.status === 'finished'),
  }
}

/* ----- writes ----- */

export async function createTrip(input) {
  const me = await myProfileRow()
  if (!me) throw new Error('Sign in to publish a trip')
  const slug =
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  const row = {
    id: slug,
    vertical: input.vertical,
    city: input.city,
    title: input.title,
    difficulty: input.difficulty,
    dates: input.dates,
    days: Number(input.days) || 1,
    distance_km: Number(input.distanceKm) || 0,
    price: Number(input.price) || 0,
    covers: input.covers,
    seats_total: Number(input.seatsTotal) || 0,
    organiser_id: me.id,
    status: 'live',
  }
  const { data, error } = await requireDb().from('trips').insert(row).select(TRIP_SELECT).single()
  if (error) throw error
  return mapTrip(data)
}

/* ----- live location ----- */

/* The trips you could turn a live map on for: the ones you organise and the ones
   you've booked a seat on. Each is tagged with how many riders are broadcasting
   on it right now, so the Live tab can say "2 riders live" before you open it. */
export async function getLiveTrips() {
  const me = await myProfileRow()
  if (!me) return []
  const db = requireDb()

  const [organised, booked] = await Promise.all([
    db.from('trips').select(TRIP_SELECT).eq('organiser_id', me.id).neq('status', 'closed'),
    db
      .from('bookings')
      .select(`trip:trips(${TRIP_SELECT})`)
      .eq('rider_id', me.id)
      .in('status', ['pending', 'confirmed', 'awaiting']),
  ])
  if (organised.error) throw organised.error
  if (booked.error) throw booked.error

  // One trip can arrive from both queries (you organise it AND booked it) — dedupe.
  const byId = new Map()
  for (const row of organised.data ?? []) byId.set(row.id, mapTrip(row))
  for (const b of booked.data ?? []) if (b.trip) byId.set(b.trip.id, mapTrip(b.trip))
  const trips = [...byId.values()]
  if (trips.length === 0) return []

  // How many pins are live on each, in one query (RLS lets you see only yours).
  const { data: pins } = await db
    .from('ride_positions')
    .select('trip_id')
    .in('trip_id', trips.map((t) => t.id))
  const counts = {}
  for (const p of pins ?? []) counts[p.trip_id] = (counts[p.trip_id] ?? 0) + 1

  return trips.map((t) => ({ ...t, liveCount: counts[t.id] ?? 0 }))
}

// Everyone currently broadcasting on a trip, joined to who they are.
export async function getTripPositions(tripId) {
  const { data, error } = await requireDb()
    .from('ride_positions')
    .select('rider_id, lat, lng, speed_kmh, heading, updated_at, rider:profiles!rider_id(id,name,initials,tint,bike)')
    .eq('trip_id', tripId)
  if (error) throw error
  return (data ?? []).map((p) => ({
    riderId: p.rider_id,
    lat: p.lat,
    lng: p.lng,
    speedKmh: p.speed_kmh,
    heading: p.heading,
    updatedAt: p.updated_at,
    name: p.rider?.name ?? 'Rider',
    initials: p.rider?.initials ?? 'R',
    tint: p.rider?.tint ?? null,
    bike: p.rider?.bike ?? null,
  }))
}

// Push (or refresh) my own pin. Upsert on the (trip, rider) key.
export async function sharePosition(tripId, { lat, lng, speedKmh = 0, heading = null }) {
  const id = await myId()
  if (!id) throw new Error('Sign in to share your location.')
  const { error } = await requireDb()
    .from('ride_positions')
    .upsert(
      {
        trip_id: tripId,
        rider_id: id,
        lat,
        lng,
        speed_kmh: Math.round(speedKmh) || 0,
        heading,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'trip_id,rider_id' },
    )
  if (error) throw error
}

// Stop sharing = remove my LIVE pin so I vanish from every co-rider's map at
// once. The recorded trail (ride_tracks) is deliberately left untouched — that
// history is what the finished-ride share card is drawn from.
export async function stopSharing(tripId) {
  const id = await myId()
  if (!id) return
  await requireDb().from('ride_positions').delete().eq('trip_id', tripId).eq('rider_id', id)
}

/* ----- recorded route trail (append-only history, powers the share card) ----- */

// Drop one breadcrumb on my trail for this trip. Called far less often than the
// live pin write — the Live screen only appends once the rider has actually
// moved a little — so the trail stays a clean line, not a jitter of GPS noise.
export async function appendTrackPoint(tripId, { lat, lng, speedKmh = 0 }) {
  const id = await myId()
  if (!id) return
  const { error } = await requireDb().from('ride_tracks').insert({
    trip_id: tripId,
    rider_id: id,
    lat,
    lng,
    speed_kmh: Math.round(speedKmh) || 0,
  })
  if (error) throw error
}

// The full ordered trail a rider rode on a trip. Defaults to my own trail (what
// the share card needs); pass a riderId to replay a co-rider's route.
export async function getRideTrack(tripId, riderId) {
  const id = riderId ?? (await myId())
  if (!id) return []
  const { data, error } = await requireDb()
    .from('ride_tracks')
    .select('lat, lng, speed_kmh, recorded_at')
    .eq('trip_id', tripId)
    .eq('rider_id', id)
    .order('recorded_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    speedKmh: p.speed_kmh,
    recordedAt: p.recorded_at,
  }))
}

// Live feed of a trip's pins. `onChange` fires on any insert/update/delete;
// returns an unsubscribe to tear the channel down when the map closes.
export function subscribeToPositions(tripId, onChange) {
  const db = requireDb()
  const channel = db
    .channel(`ride:${tripId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_positions', filter: `trip_id=eq.${tripId}` },
      onChange,
    )
    .subscribe()
  return () => db.removeChannel(channel)
}
