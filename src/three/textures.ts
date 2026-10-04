import * as THREE from 'three'

/**
 * Procedural textures generated on <canvas>. Everything is deterministic (seeded) so
 * screenshots are stable, and tileable so it can repeat across large surfaces.
 */

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Periodic value noise: tiles seamlessly every `period` lattice cells. */
function makeNoise(seed: number, period: number) {
  const r = rng(seed)
  const grid = new Float32Array(period * period)
  for (let i = 0; i < grid.length; i++) grid[i] = r()
  const at = (x: number, y: number) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)]
  const fade = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = fade(x - xi)
    const yf = fade(y - yi)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
}

/** Fractal noise in [0,1], tileable over a canvas of `size` px when `cells` divides evenly. */
function fbm(seed: number, cells: number, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, i) => makeNoise(seed + i * 101, cells << i))
  return (u: number, v: number) => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (let i = 0; i < octaves; i++) {
      const s = cells << i
      sum += layers[i](u * s, v * s) * amp
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
}

function canvas(w: number, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function toTexture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

function grayCanvas(size: number, f: (u: number, v: number) => number) {
  const c = canvas(size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const g = Math.max(0, Math.min(255, f(x / size, y / size) * 255))
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

const cache = new Map<string, THREE.Texture>()
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key)
  if (!t) {
    t = make()
    cache.set(key, t)
  }
  return t
}

/**
 * Wood grain tint map: near-white with darker growth lines running along U.
 * Multiply with material.color to get any wood tone. Covers 1 m per repeat.
 */
export function woodGrain() {
  return cached('woodGrain', () => {
    const warp = fbm(11, 4, 4)
    const fine = fbm(12, 64, 2)
    const knots = fbm(13, 3, 3)
    const c = grayCanvas(1024, (u, v) => {
      const w = warp(u, v * 0.25)
      const rings = Math.sin((v * 34 + w * 6 + knots(u, v) * 2.5) * Math.PI * 2)
      const streak = Math.pow(Math.abs(rings), 6)
      return 0.95 - streak * 0.13 - fine(u * 0.15, v) * 0.1 + w * 0.06
    })
    return toTexture(c, true)
  })
}

/** Woven fabric pattern, used both as tint and bump. Repeat it ~8× per metre. */
export function fabricWeave() {
  return cached('fabricWeave', () => {
    const n = fbm(21, 16, 3)
    const c = grayCanvas(256, (u, v) => {
      const threads = 24
      const a = Math.sin(u * threads * Math.PI * 2)
      const b = Math.sin(v * threads * Math.PI * 2)
      const checker = Math.floor(u * threads) % 2 === Math.floor(v * threads) % 2
      const weave = checker ? a * 0.5 + 0.5 : b * 0.5 + 0.5
      return 0.82 + weave * 0.12 + (n(u, v) - 0.5) * 0.12
    })
    const t = toTexture(c, true)
    t.repeat.set(8, 8)
    return t
  })
}

/** Soft blotchy noise in linear space, good for subtle bump/roughness variation. */
export function softNoise() {
  return cached('softNoise', () => {
    const n = fbm(31, 8, 5)
    const t = toTexture(grayCanvas(512, (u, v) => n(u, v)), false)
    t.repeat.set(2, 2)
    return t
  })
}

/** Fine embossed-wallpaper noise (linear) for walls. */
export function wallpaper() {
  return cached('wallpaper', () => {
    const n = fbm(41, 32, 4)
    const t = toTexture(grayCanvas(512, (u, v) => n(u, v)), false)
    return t
  })
}

/** Leaves / generic organic tint. */
export function leafVein() {
  return cached('leafVein', () => {
    const n = fbm(51, 8, 3)
    const c = grayCanvas(256, (u, v) => {
      const vein = Math.exp(-Math.pow((u - 0.5) * 40, 2)) * 0.25
      const side = Math.exp(-Math.pow(((v * 6 + Math.abs(u - 0.5) * 4) % 1) - 0.5, 2) * 200) * 0.08
      return 0.85 + vein + side - n(u, v) * 0.12
    })
    return toTexture(c, true)
  })
}

// ---------------------------------------------------------------------------
// Floors

export interface FloorTextures {
  map: THREE.Texture
  roughnessMap: THREE.Texture
  bumpMap?: THREE.Texture
  /** Physical size covered by one repeat, in mm. */
  size: number
  roughness: number
}

const hsl = (c: THREE.Color) => {
  const o = { h: 0, s: 0, l: 0 }
  c.getHSL(o, THREE.SRGBColorSpace)
  return o
}

function cssHsl(h: number, s: number, l: number) {
  return `hsl(${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(Math.max(0, Math.min(1, l)) * 100).toFixed(1)}%)`
}

export const FLOOR_PRESETS: Record<string, { label: string; color: string }> = {
  oak: { label: 'オーク', color: '#b8875a' },
  walnut: { label: 'ウォルナット', color: '#6b4a34' },
  birch: { label: 'バーチ', color: '#d9bc93' },
  whiteOak: { label: 'ホワイトオーク', color: '#d8c8b0' },
  tile: { label: 'タイル', color: '#d9d5cf' },
  carpet: { label: 'カーペット', color: '#9a958c' },
  tatami: { label: '畳', color: '#b9b47a' },
  concrete: { label: 'コンクリート', color: '#a8a6a2' },
}

function planks(color: string, seed: number): FloorTextures {
  const size = 2048
  const mm = 1820 // one repeat = 1820 mm, plank width 130 mm → 14 planks
  const plankW = size / 14
  const base = hsl(new THREE.Color(color))
  const r = rng(seed)
  const grain = fbm(seed + 1, 8, 4)
  const fine = fbm(seed + 2, 128, 2)

  const c = canvas(size)
  const ctx = c.getContext('2d')!
  const rc = canvas(size)
  const rctx = rc.getContext('2d')!
  rctx.fillStyle = '#8a8a8a'
  rctx.fillRect(0, 0, size, size)

  // Draw planks column by column; each column has staggered butt joints, wrapping vertically.
  for (let col = 0; col < 14; col++) {
    const x0 = col * plankW
    const y0 = -r() * size
    let y = y0
    while (y < y0 + size - 1) {
      const len = Math.min(size * (0.45 + r() * 0.5), y0 + size - y)
      ctx.fillStyle = cssHsl(base.h + (r() - 0.5) * 0.008, base.s + (r() - 0.5) * 0.08, base.l + (r() - 0.5) * 0.09)
      const g = 120 + r() * 40
      rctx.fillStyle = `rgb(${g},${g},${g})`
      for (const yy of [y, y + size]) {
        ctx.fillRect(x0, yy, plankW, len)
        rctx.fillRect(x0, yy, plankW, len)
      }
      // Butt joint
      ctx.fillStyle = 'rgba(40,25,15,0.35)'
      rctx.fillStyle = '#f0f0f0'
      for (const yy of [y, y + size]) {
        ctx.fillRect(x0, yy, plankW, 2)
        rctx.fillRect(x0, yy, plankW, 2)
      }
      y += len
    }
    ctx.fillStyle = 'rgba(40,25,15,0.4)'
    ctx.fillRect(x0, 0, 2, size)
    rctx.fillStyle = '#f0f0f0'
    rctx.fillRect(x0, 0, 2, size)
  }

  // Grain overlay (multiply-ish via per-pixel lightness modulation).
  const img = ctx.getImageData(0, 0, size, size)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size
      const v = py / size
      const g = grain(u * 3, v * 0.5)
      const rings = Math.pow(Math.abs(Math.sin((u * 14 * 9 + g * 5) * Math.PI)), 8)
      const k = 1 - rings * 0.12 - (fine(u, v * 0.2) - 0.5) * 0.12 + (g - 0.5) * 0.1
      const i = (py * size + px) * 4
      img.data[i] *= k
      img.data[i + 1] *= k
      img.data[i + 2] *= k
    }
  }
  ctx.putImageData(img, 0, 0)

  return { map: toTexture(c, true), roughnessMap: toTexture(rc, false), size: mm, roughness: 0.62 }
}

function tiles(color: string, seed: number): FloorTextures {
  const size = 1024
  const n = 4 // 4×300mm tiles per repeat
  const t = size / n
  const base = hsl(new THREE.Color(color))
  const r = rng(seed)
  const noise = fbm(seed, 16, 4)
  const c = canvas(size)
  const ctx = c.getContext('2d')!
  const rc = canvas(size)
  const rctx = rc.getContext('2d')!
  ctx.fillStyle = cssHsl(base.h, base.s * 0.6, base.l * 0.78)
  ctx.fillRect(0, 0, size, size)
  rctx.fillStyle = '#e0e0e0'
  rctx.fillRect(0, 0, size, size)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = cssHsl(base.h, base.s, base.l + (r() - 0.5) * 0.04)
      ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6)
      rctx.fillStyle = '#404040'
      rctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6)
    }
  const img = ctx.getImageData(0, 0, size, size)
  for (let p = 0; p < size * size; p++) {
    const k = 0.96 + noise((p % size) / size, Math.floor(p / size) / size) * 0.08
    img.data[p * 4] *= k
    img.data[p * 4 + 1] *= k
    img.data[p * 4 + 2] *= k
  }
  ctx.putImageData(img, 0, 0)
  return { map: toTexture(c, true), roughnessMap: toTexture(rc, false), size: 1200, roughness: 0.35 }
}

function noiseFloor(color: string, seed: number, kind: 'carpet' | 'concrete'): FloorTextures {
  const size = 1024
  const base = new THREE.Color(color)
  const big = fbm(seed, 4, 5)
  const fine = fbm(seed + 7, 256, 1)
  const c = canvas(size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const rgb = base.clone().convertLinearToSRGB()
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const k =
        kind === 'carpet'
          ? 0.85 + fine(u, v) * 0.3 + (big(u, v) - 0.5) * 0.08
          : 0.9 + (big(u, v) - 0.5) * 0.3 + (fine(u, v) - 0.5) * 0.06
      const i = (y * size + x) * 4
      img.data[i] = Math.min(255, rgb.r * 255 * k)
      img.data[i + 1] = Math.min(255, rgb.g * 255 * k)
      img.data[i + 2] = Math.min(255, rgb.b * 255 * k)
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  const rough = toTexture(
    grayCanvas(256, (u, v) => (kind === 'carpet' ? 0.95 : 0.6 + big(u, v) * 0.35)),
    false,
  )
  return {
    map: toTexture(c, true),
    roughnessMap: rough,
    bumpMap: kind === 'carpet' ? toTexture(c, false) : undefined,
    size: kind === 'carpet' ? 800 : 2400,
    roughness: kind === 'carpet' ? 1 : 0.8,
  }
}

function tatamiFloor(color: string, seed: number): FloorTextures {
  // One repeat = two mats side by side (1760 × 1760 mm), each 880 × 1760 with a cloth border (heri).
  const size = 1024
  const base = hsl(new THREE.Color(color))
  const noise = fbm(seed, 8, 3)
  const c = canvas(size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const half = size / 2
  const heri = Math.round((size / 1760) * 30)
  const heriColor = new THREE.Color().setHSL(0.6, 0.15, 0.18, THREE.SRGBColorSpace).convertLinearToSRGB()
  const straw = new THREE.Color().setHSL(base.h, base.s, base.l, THREE.SRGBColorSpace).convertLinearToSRGB()
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const lx = x % half
      const i = (y * size + x) * 4
      const isHeri = lx < heri || lx >= half - heri
      const isEnd = y < 3 || y > size - 4
      let r: number, g: number, b: number
      if (isHeri) {
        ;[r, g, b] = [heriColor.r, heriColor.g, heriColor.b]
      } else {
        // Woven rows run across the mat (along x within each mat).
        const row = Math.sin((y / size) * 280 * Math.PI) * 0.5 + 0.5
        const k = 0.88 + row * 0.1 + (noise(x / size, y / size) - 0.5) * 0.1 - (isEnd ? 0.25 : 0)
        ;[r, g, b] = [straw.r * k, straw.g * k, straw.b * k]
      }
      img.data[i] = Math.min(255, r * 255)
      img.data[i + 1] = Math.min(255, g * 255)
      img.data[i + 2] = Math.min(255, b * 255)
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  const rough = toTexture(grayCanvas(64, () => 0.85), false)
  return { map: toTexture(c, true), roughnessMap: rough, bumpMap: toTexture(c, false), size: 1760, roughness: 0.85 }
}

export function floorTextures(material: string, color?: string): FloorTextures {
  const col = color ?? FLOOR_PRESETS[material]?.color ?? '#b8875a'
  const key = `floor:${material}:${col}`
  const hit = floorCache.get(key)
  if (hit) return hit
  let out: FloorTextures
  switch (material) {
    case 'tile':
      out = tiles(col, 5)
      break
    case 'carpet':
      out = noiseFloor(col, 6, 'carpet')
      break
    case 'concrete':
      out = noiseFloor(col, 7, 'concrete')
      break
    case 'tatami':
      out = tatamiFloor(col, 8)
      break
    default:
      out = planks(col, material.length * 13)
  }
  floorCache.set(key, out)
  return out
}
const floorCache = new Map<string, FloorTextures>()

/** Sky seen through windows: soft blue gradient with a hint of clouds and distant rooftops. */
export function skyView() {
  return cached('skyView', () => {
    const w = 512
    const h = 512
    const c = canvas(w, h)
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#8fb8e0')
    g.addColorStop(0.55, '#cfe2f1')
    g.addColorStop(0.75, '#eef3f2')
    g.addColorStop(1, '#e9e4d8')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const r = rng(77)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    for (let i = 0; i < 14; i++) {
      const x = r() * w
      const y = 40 + r() * h * 0.35
      ctx.beginPath()
      ctx.ellipse(x, y, 40 + r() * 70, 8 + r() * 12, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // Distant buildings
    let x = 0
    while (x < w) {
      const bw = 30 + r() * 70
      const bh = 30 + r() * 90
      ctx.fillStyle = `rgba(${150 + r() * 30},${160 + r() * 25},${175 + r() * 20},0.55)`
      ctx.fillRect(x, h * 0.8 - bh, bw, bh + h * 0.2)
      x += bw + r() * 10
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}
