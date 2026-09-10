/* THE SHARE CARD RENDERER.
   Turns a finished ride into a single 1080×1920 image (Instagram-story ratio)
   that a rider is proud to post: the route they rode drawn Strava-style, with the
   numbers that make a ride worth bragging about.

   Two looks, chosen by whether a background photo is supplied:
     • PHOTO MODE (the Strava look): the ride's photo full-bleed, darkened top and
       bottom so text reads, with the route line — white-cased so it pops on any
       image — laid over it and glassy stat tiles along the bottom.
     • PANEL MODE (fallback): the brand dark theme with the route on a faint map
       grid. Used when there's no photo, or a cross-origin photo can't be drawn.

   The route line itself comes from a real recorded GPS trail when there is one,
   or a stable generated path seeded off the trip id when there isn't — so every
   finished ride gets a card, and a real ride gets its true shape. */

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
    y = 0.92,
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
  const total = Math.round(ms / 60000)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

// Draw an image so it covers the whole canvas (object-fit: cover), centered.
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

// Load an image for the canvas. Cross-origin is requested so the result can be
// exported; returns null on any failure so the caller falls back to panel mode.
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

/* ---- the render -------------------------------------------------------- */

export async function renderTripStory({ trip, track = [], stats, riderName, bg = null }) {
  const accent = ACCENT[trip?.vertical] || ACCENT.rides
  const verticalLabel = (trip?.vertical || 'ride').toUpperCase()

  try {
    await Promise.all([
      document.fonts.load('800 64px Outfit'),
      document.fonts.load('700 44px Outfit'),
      document.fonts.load('500 26px "Plus Jakarta Sans"'),
      document.fonts.load('500 40px "JetBrains Mono"'),
    ])
    await document.fonts.ready
  } catch {
    /* system fallback */
  }

  // bg may arrive as a ready <img>, or as a URL string we load here.
  let bgImg = bg && bg.width ? bg : null
  if (!bgImg && typeof bg === 'string') bgImg = await loadImage(bg)
  const photo = !!bgImg

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const P = 84

  /* ---- background ---- */
  ctx.fillStyle = BG_0
  ctx.fillRect(0, 0, W, H)

  if (photo) {
    drawCover(ctx, bgImg)
    // A whole-frame darken plus heavier scrims top and bottom, so the wordmark
    // and the stats stay legible over any photo.
    ctx.fillStyle = hexA('#05050A', 0.32)
    ctx.fillRect(0, 0, W, H)
    const top = ctx.createLinearGradient(0, 0, 0, 420)
    top.addColorStop(0, hexA('#05050A', 0.8))
    top.addColorStop(1, hexA('#05050A', 0))
    ctx.fillStyle = top
    ctx.fillRect(0, 0, W, 420)
    const bot = ctx.createLinearGradient(0, H - 900, 0, H)
    bot.addColorStop(0, hexA('#05050A', 0))
    bot.addColorStop(0.55, hexA('#05050A', 0.82))
    bot.addColorStop(1, hexA('#05050A', 0.96))
    ctx.fillStyle = bot
    ctx.fillRect(0, H - 900, W, 900)
  }
  // No-photo mode is deliberately bare: a solid surface and nothing behind the
  // line — the route itself is the whole picture.

  /* ---- header: wordmark + vertical pill ---- */
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = T_1
  ctx.font = '800 46px Outfit, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ZURVO', P, 150)

  ctx.font = '700 24px Outfit, sans-serif'
  const pillW = ctx.measureText(verticalLabel).width + 44
  roundRect(ctx, W - P - pillW, 116, pillW, 46, 23)
  ctx.fillStyle = photo ? hexA('#000000', 0.35) : hexA(accent, 0.16)
  ctx.fill()
  if (photo) {
    ctx.lineWidth = 1.5
    ctx.strokeStyle = hexA(accent, 0.6)
    ctx.stroke()
  }
  ctx.fillStyle = accent
  ctx.textAlign = 'center'
  ctx.fillText(verticalLabel, W - P - pillW / 2, 148)

  /* ---- route ---- */
  // Where the line lives: over the photo it floats in the upper-middle; on the
  // panel it fills a bordered map card with a faint grid.
  // Over a photo the line floats in the upper-middle; with no photo it gets the
  // whole upper canvas to itself — no card, no grid, just the line.
  const routeBox = photo
    ? { x: P - 10, y: 300, w: W - (P - 10) * 2, h: 780 }
    : { x: P, y: 230, w: W - P * 2, h: 1000 }

  const hasTrack = Array.isArray(track) && track.length >= 2
  const raw = hasTrack ? projectTrack(track) : generatedPath(trip?.id || trip?.title || 'zurvo')
  const pts = fit(raw, routeBox, 84)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (photo) {
    // Dark drop-shadow, white casing, then the accent core — reads on any image.
    ctx.strokeStyle = hexA('#000000', 0.5)
    ctx.lineWidth = 24
    strokePath(ctx, pts)
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 18
    strokePath(ctx, pts)
    ctx.strokeStyle = accent
    ctx.lineWidth = 9
    strokePath(ctx, pts)
  } else {
    ctx.shadowColor = hexA(accent, 0.55)
    ctx.shadowBlur = 28
    ctx.strokeStyle = accent
    ctx.lineWidth = 16
    strokePath(ctx, pts)
    ctx.shadowBlur = 0
    ctx.lineWidth = 10
    strokePath(ctx, pts)
  }

  const start = pts[0]
  const end = pts[pts.length - 1]
  dot(ctx, start.x, start.y, 16, '#FFFFFF', photo ? '#0A0A0F' : BG_0)
  dot(ctx, end.x, end.y, 18, accent, '#FFFFFF')

  if (!hasTrack && !photo) {
    ctx.fillStyle = T_3
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Route illustration', routeBox.x + 34, routeBox.y + routeBox.h - 30)
  }

  /* ---- title + place/date ---- */
  ctx.textAlign = 'left'
  ctx.fillStyle = T_1
  ctx.font = '800 68px Outfit, sans-serif'
  const titleLines = wrap(ctx, trip?.title || 'My ride', W - P * 2, 2)
  // Photo mode anchors the whole bottom stack a fixed distance above the footer,
  // computed from the number of title lines, so title→place→tiles→rider never
  // slide down into the tagline. Panel mode flows below the map card.
  let y = photo ? H - 586 - (titleLines.length - 1) * 80 : routeBox.y + routeBox.h + 96
  for (const l of titleLines) {
    ctx.fillText(l, P, y)
    y += 80
  }

  ctx.fillStyle = photo ? hexA('#FFFFFF', 0.82) : T_2
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
    ctx.fillStyle = photo ? hexA('#12121A', 0.62) : BG_1
    ctx.fill()
    ctx.lineWidth = photo ? 1.5 : 2
    ctx.strokeStyle = photo ? hexA('#FFFFFF', 0.12) : LINE
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = accent
    ctx.font = '500 62px "JetBrains Mono", monospace'
    ctx.fillText(t.value, tx + tileW / 2, tileY + 92)

    if (t.unit) {
      ctx.fillStyle = photo ? hexA('#FFFFFF', 0.7) : T_2
      ctx.font = '500 26px "JetBrains Mono", monospace'
      ctx.fillText(t.unit, tx + tileW / 2, tileY + 126)
    }

    ctx.fillStyle = photo ? hexA('#FFFFFF', 0.5) : T_3
    ctx.font = '600 24px Outfit, sans-serif'
    ctx.fillText(t.label.toUpperCase(), tx + tileW / 2, tileY + tileH - 22)
  })

  /* ---- rider line ---- */
  const name = riderName || 'A Zurvo rider'
  const ry = tileY + tileH + 110
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
  ctx.fillStyle = photo ? hexA('#FFFFFF', 0.7) : T_2
  ctx.font = '500 26px "Plus Jakarta Sans", sans-serif'
  ctx.fillText('finished this ride on Zurvo', P + av + 24, ry + 12)

  /* ---- footer ---- */
  ctx.textAlign = 'center'
  ctx.fillStyle = photo ? hexA('#FFFFFF', 0.55) : T_3
  ctx.font = '600 28px Outfit, sans-serif'
  ctx.fillText('Ride with people. Not with strangers.', W / 2, H - 96)
  ctx.fillStyle = accent
  ctx.font = '700 30px Outfit, sans-serif'
  ctx.fillText('zurvo.app', W / 2, H - 52)

  return canvas
}

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

function hexA(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.95))
}
