/* THE SHARE CARD RENDERER — Strava-style.
   A 1080×1920 story graphic: a thin white route line, place labels, and a grid of
   white stats (distance in km, moving time, speeds…). It is built to sit OVER a
   photo, exactly like Strava's share overlay, so it works two ways:

     • OVERLAY (default): transparent background. Saved as a PNG with alpha, the
       rider drops it on top of their own photo/video in the Instagram Story
       editor. White ink + soft shadow keeps it legible on any image.
     • COMPOSITED: pass a background image and the same white structure is drawn
       over it, producing one finished shareable picture.

   The route line is a real recorded GPS trail when there is one, or a stable
   generated path seeded off the trip id when there isn't. */

const W = 1080
const H = 1920

/* ---- route geometry ---------------------------------------------------- */

function projectTrack(track) {
  return track.map((p) => {
    const x = (p.lng + 180) / 360
    const latRad = (p.lat * Math.PI) / 180
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
    return { x, y }
  })
}

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
    y = 0.9,
    ang = -Math.PI / 2 + (rand() - 0.5)
  for (let i = 0; i < 150; i++) {
    ang += (rand() - 0.5) * 0.95
    const step = 0.011 + rand() * 0.007
    x += Math.cos(ang) * step
    y += Math.sin(ang) * step * 0.82 - 0.0015
    x = Math.min(0.98, Math.max(0.02, x))
    y = Math.min(0.98, Math.max(0.02, y))
    pts.push({ x, y })
  }
  return pts
}

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
  return points.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }))
}

/* ---- helpers ----------------------------------------------------------- */

function fmtClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${h}:${pad(m)}:${pad(ss)}`
}

function drawCover(ctx, img) {
  const ir = img.width / img.height
  const cr = W / H
  let dw, dh, dx, dy
  if (ir > cr) {
    dh = H
    dw = H * ir
    dx = (W - dw) / 2
    dy = 0
  } else {
    dw = W
    dh = W / ir
    dx = 0
    dy = (H - dh) / 2
  }
  ctx.drawImage(img, dx, dy, dw, dh)
}

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Turn track + trip into the labelled stats the grid shows (metric).
function statCells({ trip, stats, ridersCount }) {
  if (stats?.hasTrack) {
    const cells = [
      { label: 'Distance', value: `${stats.distanceKm.toFixed(1)} km` },
      { label: 'Moving Time', value: fmtClock(stats.durationMs) },
      { label: 'Avg Speed', value: `${stats.avgSpeedKmh.toFixed(1)} km/h` },
      { label: 'Top Speed', value: `${Math.round(stats.topSpeedKmh)} km/h` },
    ]
    if (trip?.dates) cells.push({ label: 'Date', value: trip.dates })
    if (ridersCount) cells.push({ label: 'Riders', value: String(ridersCount) })
    return cells
  }
  const cells = [{ label: 'Distance', value: `${trip?.distanceKm ?? '—'} km` }]
  if (trip?.days) cells.push({ label: 'Duration', value: `${trip.days} ${trip.days === 1 ? 'day' : 'days'}` })
  if (trip?.difficulty) cells.push({ label: 'Grade', value: trip.difficulty })
  if (trip?.dates) cells.push({ label: 'Date', value: trip.dates })
  return cells
}

/* ---- the render -------------------------------------------------------- */

export async function renderTripStory({
  trip,
  track = [],
  stats,
  riderName,
  bg = null,
  startLabel,
  endLabel,
  ridersCount,
}) {
  try {
    await Promise.all([
      document.fonts.load('800 64px Outfit'),
      document.fonts.load('700 44px Outfit'),
      document.fonts.load('500 28px "Plus Jakarta Sans"'),
    ])
    await document.fonts.ready
  } catch {
    /* system fallback */
  }

  let bgImg = bg && bg.width ? bg : null
  if (!bgImg && typeof bg === 'string') bgImg = await loadImage(bg)
  const composited = !!bgImg

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const P = 84

  // Background: a photo when compositing, otherwise LEFT TRANSPARENT so the PNG
  // can be laid over the rider's own story.
  if (composited) {
    drawCover(ctx, bgImg)
    ctx.fillStyle = 'rgba(5,6,12,0.30)'
    ctx.fillRect(0, 0, W, H)
    const bot = ctx.createLinearGradient(0, H - 820, 0, H)
    bot.addColorStop(0, 'rgba(5,6,12,0)')
    bot.addColorStop(1, 'rgba(5,6,12,0.72)')
    ctx.fillStyle = bot
    ctx.fillRect(0, H - 820, W, 820)
  }

  // Everything below is white with a soft dark shadow so it reads on any image.
  const shadow = () => {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 2
  }
  const noShadow = () => {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }
  const WHITE = '#FFFFFF'
  const DIM = 'rgba(255,255,255,0.72)'

  /* ---- wordmark ---- */
  shadow()
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = WHITE
  ctx.font = '800 40px Outfit, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ZURVO', P, 132)

  /* ---- route line ---- */
  const routeBox = { x: P, y: 200, w: W - P * 2, h: 900 }
  const hasTrack = Array.isArray(track) && track.length >= 2
  const raw = hasTrack ? projectTrack(track) : generatedPath(trip?.id || trip?.title || 'zurvo')
  const pts = fit(raw, routeBox, 96)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  shadow()
  ctx.strokeStyle = WHITE
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  // Start / end markers + place labels (Strava labels the towns).
  const start = pts[0]
  const end = pts[pts.length - 1]
  const marker = (pt, filled) => {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2)
    ctx.fillStyle = filled ? WHITE : 'rgba(0,0,0,0.35)'
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = WHITE
    ctx.stroke()
  }
  marker(start, false)
  marker(end, true)

  const sLabel = startLabel || trip?.route?.[0]?.place || trip?.city
  const eLabel = endLabel || trip?.route?.[trip.route.length - 1]?.place
  ctx.font = '700 30px Outfit, sans-serif'
  if (sLabel) {
    ctx.textAlign = start.x < W / 2 ? 'left' : 'right'
    ctx.fillStyle = WHITE
    ctx.fillText(sLabel, start.x + (start.x < W / 2 ? 22 : -22), start.y + 44)
  }
  if (eLabel) {
    ctx.textAlign = end.x < W / 2 ? 'left' : 'right'
    ctx.fillStyle = WHITE
    ctx.fillText(eLabel, end.x + (end.x < W / 2 ? 22 : -22), end.y - 22)
  }

  /* ---- ride title ---- */
  let y = 1240
  ctx.textAlign = 'left'
  ctx.fillStyle = WHITE
  ctx.font = '800 56px Outfit, sans-serif'
  ctx.fillText(trip?.title || 'My ride', P, y)

  /* ---- stat grid (2 columns) ---- */
  const cells = statCells({ trip, stats, ridersCount })
  const colX = [P, W / 2 + 6]
  const rowH = 150
  const gridTop = y + 66
  cells.forEach((c, i) => {
    const cx = colX[i % 2]
    const cy = gridTop + Math.floor(i / 2) * rowH
    ctx.textAlign = 'left'
    ctx.fillStyle = DIM
    ctx.font = '600 26px Outfit, sans-serif'
    ctx.fillText(c.label.toUpperCase(), cx, cy)
    ctx.fillStyle = WHITE
    ctx.font = '800 58px Outfit, sans-serif'
    ctx.fillText(c.value, cx, cy + 62)
  })

  /* ---- footer ---- */
  ctx.textAlign = 'center'
  ctx.fillStyle = DIM
  ctx.font = '600 28px Outfit, sans-serif'
  const who = riderName ? `${riderName} · zurvo.app` : 'zurvo.app'
  ctx.fillText(who, W / 2, H - 64)
  noShadow()

  return canvas
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.95))
}
