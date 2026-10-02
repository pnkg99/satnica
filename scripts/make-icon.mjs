/**
 * Pravi build/icon.png (1024x1024) iz logotipa sa dizajna: zaobljen kvadrat
 * u accent boji + beli sat. Bez eksternih zavisnosti — PNG se pise rucno.
 * electron-builder iz ovog fajla sam izvede .icns (macOS) i .ico (Windows).
 *
 *   node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const S = 1024
const ACCENT = [0x1f, 0x6f, 0x5c]
const WHITE = [0xff, 0xff, 0xff]
const SS = 3 // supersampling po osi, zbog glatkih ivica

/** Pokrivenost zaobljenog kvadrata. */
function inSquircle(x, y) {
  const pad = S * 0.08
  const r = S * 0.225
  const x0 = pad
  const y0 = pad
  const x1 = S - pad
  const y1 = S - pad
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

/** Debljina linija sata, prema 24px gridu originalnog SVG-a. */
const U = S / 24
const STROKE = 2.2 * U * 0.62

function nearSegment(px, py, ax, ay, bx, by, w) {
  const vx = bx - ax
  const vy = by - ay
  const len2 = vx * vx + vy * vy
  let t = len2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / len2
  t = Math.min(1, Math.max(0, t))
  const dx = px - (ax + t * vx)
  const dy = py - (ay + t * vy)
  return dx * dx + dy * dy <= (w / 2) * (w / 2)
}

/** Sat: krug r=8 u (12,13), kazaljke, i gornja crtica. */
function inClock(x, y) {
  // skaliramo 24x24 vektor na 60% povrsine ikone, centrirano
  const scale = 0.58
  const ox = S / 2 - 12 * U * scale
  const oy = S / 2 - 12.5 * U * scale
  const gx = (x - ox) / scale
  const gy = (y - oy) / scale
  const w = STROKE / scale

  const dx = gx - 12 * U
  const dy = gy - 13 * U
  const d = Math.hypot(dx, dy)
  if (Math.abs(d - 8 * U) <= w / 2) return true // obod
  if (nearSegment(gx, gy, 12 * U, 9 * U, 12 * U, 13 * U, w)) return true // velika kazaljka
  if (nearSegment(gx, gy, 12 * U, 13 * U, 14.5 * U, 15 * U, w)) return true // mala kazaljka
  if (nearSegment(gx, gy, 10 * U, 2 * U, 14 * U, 2 * U, w)) return true // crtica gore
  return false
}

const raw = Buffer.alloc(S * (S * 4 + 1))

for (let y = 0; y < S; y++) {
  const rowStart = y * (S * 4 + 1)
  raw[rowStart] = 0 // filter: none
  for (let x = 0; x < S; x++) {
    let bgHits = 0
    let fgHits = 0
    const total = SS * SS
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS
        const py = y + (sy + 0.5) / SS
        if (!inSquircle(px, py)) continue
        bgHits++
        if (inClock(px, py)) fgHits++
      }
    }
    const alpha = bgHits / total
    const mix = bgHits === 0 ? 0 : fgHits / bgHits
    const o = rowStart + 1 + x * 4
    for (let c = 0; c < 3; c++) {
      raw[o + c] = Math.round(ACCENT[c] * (1 - mix) + WHITE[c] * mix)
    }
    raw[o + 3] = Math.round(alpha * 255)
  }
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`${out} — ${S}x${S}, ${png.length} B`)
