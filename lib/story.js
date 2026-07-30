/* THE SHARE CARD RENDERER.
   Turns a finished ride into a single 1080×1920 image (Instagram-story ratio)
   that a rider is proud to post: the route they rode drawn Strava-style, over
   Zurvo's dark theme, with the numbers that make a ride worth bragging about.

   Why a hand-drawn canvas and not a real map screenshot: the route line is the
   hero, map tiles are noise around it, and capturing live tiles cleanly (CORS,
   async image loads) is fragile. Drawing the polyline ourselves onto the brand
   background needs no tiles, no API key, and always looks like Zurvo.

   Two sources feed the same drawing code:
     • a real recorded GPS trail (ride_tracks) — the true path, projected;
     • when none exists yet (rides finished before tracking shipped), a stable
       generated route seeded off the trip id, so the card still reads as a map. */

// The layout never changes between verticals — only the accent does (same rule
// as globals.css). Kept as hex here because a canvas can't read a CSS variable.
const ACCENT = {
  rides: '#FF6B35',
  trails: '#34D399',
  offroad: '#FBBF24',
  camps: '#A78BFA',
  paddle: '#38BDF8',
  cycles: '#F472B6',
}
const BG_0 = '#0A0A0F'
const BG_1 = '#14141C'
const LINE = '#2A2A38'
const T_1 = '#F5F5F7'
const T_2 = '#9C9CAC'
const T_3 = '#5A5A6E'

const W = 1080
const H = 1920

/* ---- route geometry ---------------------------------------------------- */

// Web-Mercator project real lat/lng so the drawn line keeps its true shape.
function projectTrack(track) {
  return track.map((p) => {
    const x = (p.lng + 180) / 360
    const latRad = (p.lat * Math.PI) / 180
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
    return { x, y }
  })
}

// A deterministic, natural-looking wandering path from a seed string, so a trip
// with no recorded GPS still gets a stable, believable route (same every time).
function generatedPath(seed) {
  let s = 2166136261
  for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i)
    s = Math.imul(s, 16777619)
  }
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const pts = []
  let x = 0.5,
    y = 0.92,
    ang = -Math.PI / 2 + (rand() - 0.5)
  for (let i = 0; i < 150; i++) {
    ang += (rand() - 0.5) * 0.95
    const step = 0.011 + rand() * 0.007
    x += Math.cos(ang) * step
    y += Math.sin(ang) * step * 0.82 - 0.0015 // gentle upward drift
    x = Math.min(0.98, Math.max(0.02, x))
    y = Math.min(0.98, Math.max(0.02, y))
    pts.push({ x, y })
  }
  return pts
}

// Fit any point cloud into a rect, preserving aspect ratio and centering it.
function fit(points, box, pad) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs),
    maxX = Math.max(...xs)
  const minY = Math.min(...ys),
    maxY = Math.max(...ys)
  const spanX = maxX - minX || 1e-6
  const spanY = maxY - minY || 1e-6
  const iw = box.w - pad * 2
  const ih = box.h - pad * 2
  const scale = Math.min(iw / spanX, ih / spanY)
  const offX = box.x + pad + (iw - spanX * scale) / 2
  const offY = box.y + pad + (ih - spanY * scale) / 2
  return points.map((p) => ({
    x: offX + (p.x - minX) * scale,
    y: offY + (p.y - minY) * scale,
  }))
}

/* ---- small canvas helpers ---------------------------------------------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines - 1) break
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) lines.length = maxLines
  return lines
}

function fmtDuration(ms) {
  const total = Math.round(ms / 60000) // minutes
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

/* ---- the render -------------------------------------------------------- */

export async function renderTripStory({ trip, track = [], stats, riderName }) {
  const accent = ACCENT[trip?.vertical] || ACCENT.rides
  const verticalLabel = (trip?.vertical || 'ride').toUpperCase()

  // Make the brand fonts available to the canvas before we draw any text.
  try {
    await Promise.all([
      document.fonts.load('800 64px Outfit'),
      document.fonts.load('700 44px Outfit'),
      document.fonts.load('500 26px "Plus Jakarta Sans"'),
      document.fonts.load('500 40px "JetBrains Mono"'),
    ])
    await document.fonts.ready
  } catch {
    /* fonts fall back to system — the card still renders */
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background: near-black with a faint accent glow up top so it isn't flat.
  ctx.fillStyle = BG_0
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 900)
  glow.addColorStop(0, hexA(accent, 0.14))
  glow.addColorStop(1, hexA(accent, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const P = 84

  /* ---- header: wordmark + vertical pill ---- */
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = T_1
  ctx.font = '800 46px Outfit, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ZURVO', P, 150)

  ctx.font = '700 24px Outfit, sans-serif'
  const pillText = verticalLabel
  const pillW = ctx.measureText(pillText).width + 44
  roundRect(ctx, W - P - pillW, 116, pillW, 46, 23)
  ctx.fillStyle = hexA(accent, 0.16)
  ctx.fill()
  ctx.fillStyle = accent
  ctx.textAlign = 'center'
  ctx.fillText(pillText, W - P - pillW / 2, 148)

  /* ---- the map panel with the route ---- */
  const map = { x: P, y: 210, w: W - P * 2, h: 1020 }
  roundRect(ctx, map.x, map.y, map.w, map.h, 40)
  ctx.fillStyle = BG_1
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = LINE
  ctx.stroke()

  // Clip a faint grid inside the panel so it reads as a map, not a card.
  ctx.save()
  roundRect(ctx, map.x, map.y, map.w, map.h, 40)
  ctx.clip()
  ctx.strokeStyle = hexA('#FFFFFF', 0.04)
  ctx.lineWidth = 1
  const grid = 96
  for (let gx = map.x; gx <= map.x + map.w; gx += grid) {
    ctx.beginPath()
    ctx.moveTo(gx, map.y)
    ctx.lineTo(gx, map.y + map.h)
    ctx.stroke()
  }
  for (let gy = map.y; gy <= map.y + map.h; gy += grid) {
    ctx.beginPath()
    ctx.moveTo(map.x, gy)
    ctx.lineTo(map.x + map.w, gy)
    ctx.stroke()
  }

  // Build the line: real trail if we have one, else a stable generated route.
  const hasTrack = Array.isArray(track) && track.length >= 2
  const raw = hasTrack ? projectTrack(track) : generatedPath(trip?.id || trip?.title || 'zurvo')
  const pts = fit(raw, map, 96)

  // Glow underlay, then the crisp accent line on top.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.shadowColor = hexA(accent, 0.55)
  ctx.shadowBlur = 28
  ctx.strokeStyle = accent
  ctx.lineWidth = 16
  strokePath(ctx, pts)
  ctx.shadowBlur = 0
  ctx.lineWidth = 10
  strokePath(ctx, pts)

  // Start (white) and end (accent) markers.
  const start = pts[0]
  const end = pts[pts.length - 1]
  dot(ctx, start.x, start.y, 15, '#FFFFFF', BG_0)
  dot(ctx, end.x, end.y, 17, accent, '#FFFFFF')
  ctx.restore()

  if (!hasTrack) {
    // Be honest that this is an illustrated route, not a GPS trace.
    ctx.fillStyle = T_3
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Route illustration', map.x + 34, map.y + map.h - 30)
  }

  /* ---- title + place/date ---- */
  let y = map.y + map.h + 96
  ctx.textAlign = 'left'
  ctx.fillStyle = T_1
  ctx.font = '800 68px Outfit, sans-serif'
  const titleLines = wrap(ctx, trip?.title || 'My ride', W - P * 2, 2)
  for (const l of titleLines) {
    ctx.fillText(l, P, y)
    y += 80
  }

  ctx.fillStyle = T_2
  ctx.font = '500 30px "Plus Jakarta Sans", sans-serif'
  const place = [trip?.city, trip?.dates].filter(Boolean).join('  ·  ')
  if (place) {
    ctx.fillText(place, P, y + 6)
    y += 20
  }

  /* ---- stat tiles ---- */
  const tiles = statTiles({ trip, stats })
  const tileY = y + 54
  const tileH = 168
  const gap = 22
  const tileW = (W - P * 2 - gap * (tiles.length - 1)) / tiles.length
  tiles.forEach((t, i) => {
    const tx = P + i * (tileW + gap)
    roundRect(ctx, tx, tileY, tileW, tileH, 26)
    ctx.fillStyle = BG_1
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = LINE
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = accent
    ctx.font = '500 62px "JetBrains Mono", monospace'
    ctx.fillText(t.value, tx + tileW / 2, tileY + 92)

    ctx.fillStyle = t.unit ? T_2 : 'transparent'
    ctx.font = '500 26px "JetBrains Mono", monospace'
    if (t.unit) ctx.fillText(t.unit, tx + tileW / 2, tileY + 92 + 34)

    ctx.fillStyle = T_3
    ctx.font = '600 24px Outfit, sans-serif'
    ctx.fillText(t.label.toUpperCase(), tx + tileW / 2, tileY + tileH - 22)
  })

  /* ---- rider line ---- */
  const name = riderName || 'A Zurvo rider'
  const ry = tileY + tileH + 116
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const av = 64
  const avx = P + av / 2
  ctx.beginPath()
  ctx.arc(avx, ry - 18, av / 2, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()
  ctx.fillStyle = '#0A0A0F'
  ctx.font = '800 28px Outfit, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials || 'Z', avx, ry - 17)
  ctx.textBaseline = 'alphabetic'

  ctx.textAlign = 'left'
  ctx.fillStyle = T_1
  ctx.font = '700 34px Outfit, sans-serif'
  ctx.fillText(name, P + av + 24, ry - 24)
  ctx.fillStyle = T_2
  ctx.font = '500 26px "Plus Jakarta Sans", sans-serif'
  ctx.fillText('finished this ride on Zurvo', P + av + 24, ry + 12)

  /* ---- footer tagline ---- */
  ctx.textAlign = 'center'
  ctx.fillStyle = T_3
  ctx.font = '600 28px Outfit, sans-serif'
  ctx.fillText('Ride with people. Not with strangers.', W / 2, H - 96)
  ctx.fillStyle = accent
  ctx.font = '700 30px Outfit, sans-serif'
  ctx.fillText('zurvo.app', W / 2, H - 52)

  return canvas
}

// Which three numbers to show. A real trail gives the brag-worthy GPS figures;
// without one we fall back to the trip's planned facts so the card never lies.
function statTiles({ trip, stats }) {
  if (stats?.hasTrack) {
    return [
      { value: String(Math.round(stats.distanceKm)), unit: 'km', label: 'Distance' },
      { value: fmtDuration(stats.durationMs), unit: '', label: 'Moving time' },
      { value: String(Math.round(stats.topSpeedKmh)), unit: 'km/h', label: 'Top speed' },
    ]
  }
  const tiles = [{ value: String(trip?.distanceKm ?? '—'), unit: 'km', label: 'Distance' }]
  if (trip?.days) tiles.push({ value: String(trip.days), unit: trip.days === 1 ? 'day' : 'days', label: 'Duration' })
  if (trip?.difficulty) tiles.push({ value: trip.difficulty, unit: '', label: 'Grade' })
  return tiles.slice(0, 3)
}

function strokePath(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

function dot(ctx, x, y, r, fill, ring) {
  ctx.beginPath()
  ctx.arc(x, y, r + 5, 0, Math.PI * 2)
  ctx.fillStyle = ring
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

// #RRGGBB + alpha -> rgba() string.
function hexA(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// Canvas -> PNG Blob (promise form; toBlob has no promise API).
export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.95))
}
