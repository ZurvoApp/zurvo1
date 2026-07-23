/* Pure helpers and app config only. All trip/rider/profile DATA now lives in the
   database and is read through lib/api.js — there is no mock content here anymore.
   These functions operate on a trip object's own fields, so they work the same
   whether that trip came from Supabase or anywhere else. */

// The markets Zurvo operates in. Config, not data — a fixed list, not rows.
export const CITIES = [
  'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Goa', 'Kochi', 'Jaipur', 'Kolkata',
]

// Scarcity is only shown when it is real: below this fill fraction, it does not exist.
export const SCARCITY_FLOOR = 0.6
export const fill = (t) => t.seatsTaken / t.seatsTotal
export const seatsLeft = (t) => t.seatsTotal - t.seatsTaken
export const showScarcity = (t) => fill(t) >= SCARCITY_FLOOR

// Riders the viewer has ridden with before — a real relationship, empty until it exists.
export const knownRiders = (t) => t.riders.filter((r) => r.knownToMe)

export const rupees = (n) => (n === 0 ? 'Free' : '₹' + n.toLocaleString('en-IN'))
