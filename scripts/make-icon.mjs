/* Extracts the Zurvo mark from the source screenshot, masks the squircle corners
   transparent, and emits the app icon set. Run: node scripts/make-icon.mjs */
import sharp from 'sharp'
import { mkdirSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = (f) => path.join(ROOT, 'public', f)
mkdirSync(OUT(''), { recursive: true })

// The macOS screenshot filename contains a narrow no-break space (U+202F), so it
// cannot be hardcoded reliably — find it instead.
const found = readdirSync(ROOT).find((f) => /^Screenshot .*\.png$/.test(f))
if (!found) throw new Error('logo screenshot not found in project root')
const SRC = path.join(ROOT, found)
console.log('source:', found)

// 1. locate the orange squircle by scanning for pixels where red dominates blue
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels
    const r = data[i], b = data[i + 2]
    if (r > 150 && r - b > 60) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
console.log('found mark at', box)

const S = 512
const RADIUS = Math.round(S * 0.2237) // matches the source squircle curvature

// 2. crop to the mark, square it up, then punch the rounded corners out
const mask = Buffer.from(
  `<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
)

const mark = await sharp(SRC)
  .extract(box)
  .resize(S, S, { fit: 'fill' })
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer()

// 3. emit the set
await sharp(mark).toFile(OUT('icon.png'))                              // 512, in-app + PWA
await sharp(mark).resize(192, 192).toFile(OUT('icon-192.png'))         // PWA
await sharp(mark).resize(180, 180).toFile(OUT('apple-touch-icon.png')) // iOS home screen
await sharp(mark).resize(32, 32).toFile(OUT('favicon.png'))            // browser tab

console.log('wrote public/icon.png, icon-192.png, apple-touch-icon.png, favicon.png')
