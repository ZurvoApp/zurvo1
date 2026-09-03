/* The bridge to the device's GPS. One job: turn the browser's Geolocation API
   into the plain shape the rest of the app speaks — lat, lng, km/h, heading —
   and hand back a stop() so a screen can always turn the sensor off when it
   leaves. Speed arrives in metres per second (or null when standing still);
   we present km/h, because that is the number on a rider's clocks. */

export function isGeoAvailable() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

/* Great-circle distance between two {lat,lng} in kilometres (haversine). Used
   both to decide when a moving rider has travelled far enough to drop another
   breadcrumb, and to total up the length of a finished ride from its trail. */
export function haversineKm(a, b) {
  if (!a || !b) return 0
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/* Initial bearing from a to b, in degrees (0 = north, 90 = east). */
export function bearing(a, b) {
  if (!a || !b) return 0
  const toRad = (d) => (d * Math.PI) / 180
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat))
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng))
  return (Math.atan2(y, x) * 180) / Math.PI
}

/* Is `them` ahead of or behind `me`, given the way I'm facing? Compares my
   heading to the bearing from me to them: within a quarter-turn either side of
   where I'm pointing is "ahead", otherwise "behind". Returns null when I don't
   have a heading yet (stationary) — then the group can only be told the distance,
   not the direction, which is honest rather than guessing. */
export function relativePosition(me, them, myHeading) {
  if (myHeading == null || !me || !them) return null
  const b = bearing(me, them)
  let diff = Math.abs(((b - myHeading + 540) % 360) - 180) // 0 = dead ahead, 180 = directly behind
  return diff <= 90 ? 'ahead' : 'behind'
}

/* Turn a recorded trail (ordered [{lat,lng,speedKmh,recordedAt}]) into the
   numbers a rider brags about: how far, how long, how fast. Returns nulls when
   there's no real trail, so the card can fall back to the trip's planned figures. */
export function trackStats(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return { distanceKm: 0, durationMs: 0, topSpeedKmh: 0, avgSpeedKmh: 0, hasTrack: false }
  }
  let distanceKm = 0
  let topSpeedKmh = 0
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(points[i - 1], points[i])
    topSpeedKmh = Math.max(topSpeedKmh, points[i].speedKmh || 0)
  }
  const start = new Date(points[0].recordedAt).getTime()
  const end = new Date(points[points.length - 1].recordedAt).getTime()
  const durationMs = Math.max(0, end - start)
  const hours = durationMs / 3.6e6
  const avgSpeedKmh = hours > 0 ? distanceKm / hours : 0
  return { distanceKm, durationMs, topSpeedKmh, avgSpeedKmh, hasTrack: true }
}

// Start following the device. Returns a stop() that releases the GPS watch.
export function watchPosition(onUpdate, onError) {
  if (!isGeoAvailable()) {
    onError?.(new Error('This device can’t share location.'))
    return () => {}
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, speed, heading } = pos.coords
      onUpdate({
        lat: latitude,
        lng: longitude,
        // speed is null/negative when the fix can't tell — that reads as stopped.
        speedKmh: speed != null && speed >= 0 ? Math.round(speed * 3.6) : 0,
        // heading is null while stationary; keep it null rather than snapping north.
        heading: heading != null && !Number.isNaN(heading) ? Math.round(heading) : null,
      })
    },
    (err) => onError?.(err),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 },
  )

  return () => navigator.geolocation.clearWatch(id)
}
