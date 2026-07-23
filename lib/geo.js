/* The bridge to the device's GPS. One job: turn the browser's Geolocation API
   into the plain shape the rest of the app speaks — lat, lng, km/h, heading —
   and hand back a stop() so a screen can always turn the sensor off when it
   leaves. Speed arrives in metres per second (or null when standing still);
   we present km/h, because that is the number on a rider's clocks. */

export function isGeoAvailable() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
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
