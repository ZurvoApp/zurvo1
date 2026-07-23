'use client'

import { useEffect, useRef, useState } from 'react'

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

// A pin is a coloured disc with initials, and a speed tag underneath. Built as
// raw HTML because Leaflet renders markers in its own panes, out of reach of the
// CSS-module scope — inline styles are the reliable way to reach them.
function pinHtml({ initials, tint, speedKmh, isMe }) {
  const color = isMe ? '#ff6a2b' : tint || '#5b8def'
  const ring = isMe ? 'box-shadow:0 0 0 3px rgba(255,106,43,.35),0 4px 12px rgba(0,0,0,.5);' : 'box-shadow:0 4px 12px rgba(0,0,0,.5);'
  return `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
      <div style="width:34px;height:34px;border-radius:50%;background:${color};color:#fff;
        display:flex;align-items:center;justify-content:center;font:700 13px/1 var(--display,sans-serif);
        border:2px solid #fff;${ring}">${initials}</div>
      <div style="margin-top:3px;padding:1px 6px;border-radius:6px;background:rgba(10,12,16,.86);
        color:#fff;font:600 10px/1.4 var(--mono,monospace);white-space:nowrap;letter-spacing:.02em;">
        ${speedKmh} km/h</div>
    </div>`
}

export default function LiveMap({ positions, onError }) {
  const holder = useRef(null)
  const map = useRef(null)
  const markers = useRef(new Map()) // riderId -> Leaflet marker
  const fitted = useRef(false)
  const L = useRef(null)
  // Map readiness is STATE, not just a ref: the map loads async (CDN), and the
  // marker effect below must re-run the moment it's live — otherwise pins that
  // arrived while the map was still loading would never be drawn.
  const [ready, setReady] = useState(false)
  // onError is passed as an inline arrow by the parent — a new reference every
  // render. Keep it in a ref so the build effect can depend on NOTHING and run
  // exactly once per mount, instead of tearing the map down on every re-render.
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

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
        map.current = m
        // A map created inside an element that was sized after mount needs a nudge.
        // Cancelled on unmount: firing this against a removed map would throw.
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
      const icon = lib.divIcon({
        html: pinHtml(p),
        className: '',
        iconSize: [40, 52],
        iconAnchor: [20, 26],
      })
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

  return <div ref={holder} style={{ position: 'absolute', inset: 0 }} aria-label="Live map" />
}
