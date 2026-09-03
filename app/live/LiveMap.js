'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { rideStatus, statusColor, DEFAULT_STATUS } from '@/lib/rideStatus'
import styles from './live.module.css'

/* The street map. Leaflet is loaded from its CDN on demand — it never ships in
   the app bundle, so a rider who never opens Live never downloads a map engine.
   Same posture as the app's <img> tags: heavy assets come from the network, not
   the build. The map is driven imperatively (add/move/remove markers) rather than
   re-rendered, because tearing down and rebuilding a Leaflet map on every GPS
   tick would flicker and lose the viewport. */

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

let leafletPromise = null
function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[data-leaflet]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      link.dataset.leaflet = '1'
      document.head.appendChild(link)
    }
    const s = document.createElement('script')
    s.src = LEAFLET_JS
    s.async = true
    s.onload = () => resolve(window.L)
    s.onerror = () => {
      leafletPromise = null
      reject(new Error('Map failed to load. Check your connection.'))
    }
    document.body.appendChild(s)
  })
  return leafletPromise
}

// A pin is a coloured disc with initials, and a speed tag underneath. When the
// rider is moving and the fix knows their heading, a small arrow rides the rim
// pointing the way they're travelling. Built as raw HTML because Leaflet renders
// markers in its own panes, out of reach of the CSS-module scope.
function pinHtml({ initials, tint, speedKmh, heading, status, isMe }) {
  const color = isMe ? '#ff6a2b' : tint || '#5b8def'
  const ring = isMe
    ? 'box-shadow:0 0 0 3px rgba(255,106,43,.35),0 4px 12px rgba(0,0,0,.5);'
    : 'box-shadow:0 4px 12px rgba(0,0,0,.5);'
  // Heading arrow only when actually moving with a known bearing — a stationary
  // rider has no direction, and a north-snapped arrow would be a lie.
  const arrow =
    heading != null && speedKmh > 0
      ? `<div style="position:absolute;top:-9px;left:50%;width:0;height:0;
          border-left:5px solid transparent;border-right:5px solid transparent;
          border-bottom:8px solid ${color};transform:translateX(-50%) rotate(${heading}deg);
          transform-origin:50% 26px;"></div>`
      : ''

  // The tag under the pin is the STATUS when there is one to report — the whole
  // point of the feature: you see WHY someone stopped, not just that they did.
  // Plain riders fall back to their speed.
  const s = rideStatus(status)
  const tag =
    status && status !== DEFAULT_STATUS
      ? `<div style="margin-top:3px;padding:1px 7px;border-radius:6px;background:${statusColor(status)};
          color:#0a0c10;font:700 10px/1.4 var(--display,sans-serif);white-space:nowrap;">
          ${s.icon} ${s.tag}</div>`
      : `<div style="margin-top:3px;padding:1px 6px;border-radius:6px;background:rgba(10,12,16,.86);
          color:#fff;font:600 10px/1.4 var(--mono,monospace);white-space:nowrap;letter-spacing:.02em;">
          ${speedKmh} km/h</div>`

  return `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
      <div style="position:relative;width:34px;height:34px;border-radius:50%;background:${color};color:#fff;
        display:flex;align-items:center;justify-content:center;font:700 13px/1 var(--display,sans-serif);
        border:2px solid #fff;${ring}">${initials}${arrow}</div>
      ${tag}
    </div>`
}

const LiveMap = forwardRef(function LiveMap({ positions, onError }, ref) {
  const holder = useRef(null)
  const map = useRef(null)
  const markers = useRef(new Map()) // riderId -> Leaflet marker
  const fitted = useRef(false)
  const L = useRef(null)
  const [ready, setReady] = useState(false)
  const [locating, setLocating] = useState(false)
  // "Follow me" keeps the map centred on my pin as I move, like navigation mode.
  // A ref shadows the state so the one-time map listeners can read it live.
  const [following, setFollowing] = useState(false)
  const followingRef = useRef(false)
  followingRef.current = following
  // The view controls read positions inside click handlers, so keep the latest
  // array in a ref rather than closing over a stale render's copy.
  const positionsRef = useRef(positions)
  positionsRef.current = positions

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const myPin = () => positionsRef.current.find((p) => p.isMe && p.lat != null && p.lng != null)
  const allPts = () => positionsRef.current.filter((p) => p.lat != null && p.lng != null).map((p) => [p.lat, p.lng])

  // Build the map once.
  useEffect(() => {
    let dead = false
    let sizeTimer = null
    loadLeaflet()
      .then((lib) => {
        if (dead || !holder.current || map.current) return
        L.current = lib
        const m = lib.map(holder.current, { zoomControl: false, attributionControl: false }).setView([20.5, 78.9], 5)
        lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m)
        lib.control.attribution({ prefix: false, position: 'bottomright' }).addAttribution('© OpenStreetMap').addTo(m)
        // Grabbing the map by hand means "I want to look somewhere else" — so a
        // manual pan or a pinch-zoom quietly switches follow-me off.
        m.on('dragstart', () => followingRef.current && setFollowing(false))
        map.current = m
        sizeTimer = setTimeout(() => m.invalidateSize(), 0)
        setReady(true)
      })
      .catch((e) => !dead && onErrorRef.current?.(e))
    return () => {
      dead = true
      if (sizeTimer) clearTimeout(sizeTimer)
      setReady(false)
      if (map.current) {
        map.current.remove()
        map.current = null
        markers.current.clear()
        fitted.current = false
      }
    }
  }, [])

  // Reconcile markers whenever positions change OR the map becomes ready.
  useEffect(() => {
    const lib = L.current
    const m = map.current
    if (!lib || !m || !ready) return

    const seen = new Set()
    for (const p of positions) {
      if (p.lat == null || p.lng == null) continue
      seen.add(p.riderId)
      const icon = lib.divIcon({ html: pinHtml(p), className: '', iconSize: [40, 52], iconAnchor: [20, 26] })
      const existing = markers.current.get(p.riderId)
      if (existing) {
        existing.setLatLng([p.lat, p.lng])
        existing.setIcon(icon)
      } else {
        markers.current.set(p.riderId, lib.marker([p.lat, p.lng], { icon }).addTo(m))
      }
    }

    // Drop anyone who stopped sharing.
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        m.removeLayer(marker)
        markers.current.delete(id)
      }
    }

    // Frame everyone once, the first time we have someone to frame. After that we
    // leave the viewport to the rider so the map doesn't yank around under them.
    const pts = positions.filter((p) => p.lat != null).map((p) => [p.lat, p.lng])
    if (!fitted.current && pts.length > 0) {
      fitted.current = true
      if (pts.length === 1) m.setView(pts[0], 15)
      else m.fitBounds(pts, { padding: [60, 60], maxZoom: 16 })
    }
  }, [positions, ready])

  // While following, ride the map along with my pin on every fresh fix.
  useEffect(() => {
    const m = map.current
    if (!m || !ready || !following) return
    const me = myPin()
    if (me) m.setView([me.lat, me.lng], Math.max(m.getZoom(), 15), { animate: true })
  }, [positions, ready, following])

  const fitAll = () => {
    const m = map.current
    if (!m) return
    const pts = allPts()
    if (pts.length === 0) return
    setFollowing(false)
    if (pts.length === 1) m.setView(pts[0], 15, { animate: true })
    else m.fitBounds(pts, { padding: [60, 60], maxZoom: 16, animate: true })
  }

  // The roster taps this to jump the map onto one rider.
  useImperativeHandle(ref, () => ({
    focusRider(riderId) {
      const m = map.current
      if (!m) return
      const p = positionsRef.current.find((x) => x.riderId === riderId && x.lat != null && x.lng != null)
      if (!p) return
      setFollowing(false) // centring someone else is not the same as following me
      m.setView([p.lat, p.lng], Math.max(m.getZoom(), 15), { animate: true })
    },
    fitAll,
  }))

  /* Locate / follow. Already following → stop. Otherwise, if my pin is on the map
     (I'm sharing), snap to it and start following. If it isn't, ask the device
     directly for a one-off fix — which also covers the map having drifted. */
  const locate = () => {
    const m = map.current
    if (!m) return

    if (following) {
      setFollowing(false)
      return
    }

    const me = myPin()
    if (me) {
      m.setView([me.lat, me.lng], Math.max(m.getZoom(), 15), { animate: true })
      setFollowing(true)
      return
    }

    if (!('geolocation' in navigator)) {
      onErrorRef.current?.(new Error('Location isn’t available on this device.'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], 15, { animate: true })
      },
      (err) => {
        setLocating(false)
        onErrorRef.current?.(
          new Error(err?.code === 1 ? 'Location permission denied. Allow it to find you.' : 'Couldn’t get your location.'),
        )
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
    )
  }

  const manyLive = positions.filter((p) => p.lat != null).length > 1

  return (
    <>
      <div ref={holder} style={{ position: 'absolute', inset: 0 }} aria-label="Live map" />

      <div className={styles.mapControls}>
        {/* Frame everyone — only offered when there's more than one pin to frame. */}
        {manyLive && (
          <button type="button" className={styles.mapBtn} onClick={fitAll} aria-label="Show everyone" title="Show everyone">
            <FitAllIcon />
          </button>
        )}
        {/* Locate / follow me. Tints accent and stays lit while following. */}
        <button
          type="button"
          className={styles.mapBtn}
          data-active={following || undefined}
          onClick={locate}
          disabled={locating}
          aria-busy={locating}
          aria-pressed={following}
          aria-label={following ? 'Stop following me' : 'Recenter on my location'}
          title={following ? 'Following you — tap to stop' : 'Recenter on my location'}
        >
          {locating ? <span className={styles.mapBtnSpin} aria-hidden="true" /> : <LocateIcon />}
        </button>
      </div>
    </>
  )
})

export default LiveMap

function LocateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FitAllIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  )
}
