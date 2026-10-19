import * as THREE from 'three'
import { mat, printedMat } from '../../three/materials'
import { drawnTexture, rng } from '../../three/textures'
import { group, panelOn } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

/** Things hung on the wall: posters and framed art. */

// ---- Art ----------------------------------------------------------------------------------------

const ARTS = {
  shapes: 'ゆるい図形',
  arches: 'アーチ',
  sunset: '夕焼けの海',
  mountains: '山の風景',
  botanical: '植物の線画',
  geometric: '幾何学',
  type: '文字のポスター',
} as const
type Art = keyof typeof ARTS

const PALETTES = {
  warm: { label: 'あたたかい', bg: '#f3ece0', ink: ['#e9b65a', '#e48a5a', '#c8553d', '#2f7f74', '#24414f'] },
  earth: { label: 'アースカラー', bg: '#efe6d8', ink: ['#a65d3f', '#d9a066', '#6b7f5a', '#3e3a35', '#c9b79c'] },
  cool: { label: 'すずしい', bg: '#eef1f3', ink: ['#8fa9bf', '#3d5a80', '#98c1d9', '#c9dbe3', '#293241'] },
  pastel: { label: 'パステル', bg: '#fbf6ef', ink: ['#f2bfb8', '#bcd9bc', '#c3d0ec', '#f4dc94', '#d4c1e6'] },
  mono: { label: 'モノトーン', bg: '#f2f0ec', ink: ['#1f1f1f', '#6b6b6b', '#a9a6a1', '#d4cfc7', '#3a3a3a'] },
  vivid: { label: 'ビビッド', bg: '#fbf8f2', ink: ['#e63946', '#f4a300', '#1d6fd1', '#1b998b', '#14213d'] },
} as const
type Palette = keyof typeof PALETTES

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rnd: () => number) {
  const n = 7
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const rr = r * (0.75 + rnd() * 0.45)
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]
  })
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % n]
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    if (i === 0) ctx.moveTo(mx, my)
    else ctx.quadraticCurveTo(x0, y0, mx, my)
  }
  const [x0, y0] = pts[0]
  const [x1, y1] = pts[1]
  ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  ctx.fill()
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.35, -len * 0.5, 0, -len)
  ctx.quadraticCurveTo(-len * 0.35, -len * 0.5, 0, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -len * 0.9)
  ctx.stroke()
  ctx.restore()
}

/** Draw one artwork filling (w, h). Everything comes from code: no images. */
function drawArt(ctx: CanvasRenderingContext2D, w: number, h: number, art: Art, palette: Palette, seed: number, text: string) {
  const P = PALETTES[palette]
  const rnd = rng(seed * 97 + art.length * 13 + palette.length)
  const pick = () => P.ink[Math.floor(rnd() * P.ink.length)]
  const m = Math.min(w, h)
  ctx.fillStyle = P.bg
  ctx.fillRect(0, 0, w, h)
  switch (art) {
    case 'shapes': {
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = pick()
        blob(ctx, w * (0.2 + rnd() * 0.6), h * (0.2 + rnd() * 0.6), m * (0.14 + rnd() * 0.16), rnd)
      }
      ctx.strokeStyle = P.ink[4]
      ctx.lineWidth = m * 0.012
      ctx.beginPath()
      ctx.arc(w * (0.3 + rnd() * 0.4), h * (0.3 + rnd() * 0.4), m * 0.08, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'arches': {
      const cx = w / 2
      const base = h * 0.82
      const bands = 5
      const R = Math.min(w * 0.42, h * 0.6)
      for (let i = 0; i < bands; i++) {
        const r = R * (1 - i / bands)
        ctx.fillStyle = P.ink[(i + seed) % P.ink.length]
        ctx.beginPath()
        ctx.moveTo(cx - r, base)
        ctx.arc(cx, base, r, Math.PI, 0)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = P.bg
      ctx.fillRect(0, base, w, h - base)
      ctx.fillStyle = P.ink[(seed + 2) % P.ink.length]
      ctx.beginPath()
      ctx.arc(w * (0.2 + rnd() * 0.6), h * 0.16, m * 0.06, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'sunset': {
      const horizon = h * (0.55 + rnd() * 0.1)
      const sky = ctx.createLinearGradient(0, 0, 0, horizon)
      sky.addColorStop(0, P.ink[2])
      sky.addColorStop(0.6, P.ink[1])
      sky.addColorStop(1, P.ink[0])
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, horizon)
      ctx.fillStyle = P.bg
      ctx.beginPath()
      ctx.arc(w * (0.35 + rnd() * 0.3), horizon, m * 0.16, Math.PI, 0)
      ctx.fill()
      const sea = ctx.createLinearGradient(0, horizon, 0, h)
      sea.addColorStop(0, P.ink[3])
      sea.addColorStop(1, P.ink[4])
      ctx.fillStyle = sea
      ctx.fillRect(0, horizon, w, h - horizon)
      ctx.strokeStyle = P.bg
      ctx.globalAlpha = 0.5
      ctx.lineWidth = m * 0.008
      for (let i = 0; i < 6; i++) {
        const y = horizon + ((h - horizon) * (i + 1)) / 7
        const x = w * (0.3 + rnd() * 0.3)
        ctx.beginPath()
        ctx.moveTo(x - m * 0.1, y)
        ctx.lineTo(x + m * 0.1, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    }
    case 'mountains': {
      ctx.fillStyle = P.ink[0]
      ctx.beginPath()
      ctx.arc(w * (0.25 + rnd() * 0.5), h * 0.28, m * 0.09, 0, Math.PI * 2)
      ctx.fill()
      for (let layer = 0; layer < 4; layer++) {
        ctx.fillStyle = P.ink[(layer + 1) % P.ink.length]
        const top = h * (0.38 + layer * 0.13)
        ctx.beginPath()
        ctx.moveTo(0, h)
        let x = 0
        ctx.lineTo(0, top + rnd() * h * 0.1)
        while (x < w) {
          const step = w * (0.12 + rnd() * 0.2)
          ctx.lineTo(x + step / 2, top - rnd() * h * 0.14)
          x += step
          ctx.lineTo(x, top + rnd() * h * 0.06)
        }
        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'botanical': {
      ctx.strokeStyle = P.ink[4]
      ctx.lineWidth = m * 0.012
      ctx.lineCap = 'round'
      ctx.fillStyle = P.ink[(seed + 1) % P.ink.length]
      ctx.globalAlpha = 0.6
      blob(ctx, w * 0.55, h * 0.5, m * 0.3, rnd)
      ctx.globalAlpha = 1
      const stems = 2 + Math.floor(rnd() * 2)
      for (let s = 0; s < stems; s++) {
        const x0 = w * (0.4 + s * 0.12)
        const y0 = h * 0.88
        const len = h * (0.5 + rnd() * 0.2)
        const bend = (rnd() - 0.5) * w * 0.2
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.quadraticCurveTo(x0 + bend, y0 - len * 0.5, x0 + bend * 0.6, y0 - len)
        ctx.stroke()
        for (let k = 1; k < 7; k++) {
          const t = k / 7
          const x = x0 + bend * (2 * t * (1 - t)) + bend * 0.6 * t * t
          const y = y0 - len * t
          leaf(ctx, x, y, m * (0.12 - t * 0.05), (k % 2 ? 1 : -1) * (0.6 + rnd() * 0.3))
        }
      }
      break
    }
    case 'geometric': {
      const cols = w > h * 1.2 ? 3 : 2
      const rows = Math.max(2, Math.round((cols * h) / w))
      const cw = w / cols
      const ch = h / rows
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * cw
          const y = r * ch
          ctx.fillStyle = pick()
          ctx.fillRect(x, y, cw, ch)
          ctx.fillStyle = pick()
          const k = Math.floor(rnd() * 4)
          ctx.beginPath()
          if (k === 0) ctx.arc(x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.38, 0, Math.PI * 2)
          else if (k === 1) {
            ctx.moveTo(x, y + ch)
            ctx.arc(x, y + ch, Math.min(cw, ch), -Math.PI / 2, 0)
          } else if (k === 2) {
            ctx.moveTo(x, y + ch)
            ctx.lineTo(x + cw / 2, y)
            ctx.lineTo(x + cw, y + ch)
          } else {
            ctx.moveTo(x + cw / 2, y + ch)
            ctx.arc(x + cw / 2, y + ch, Math.min(cw / 2, ch), Math.PI, 0)
          }
          ctx.closePath()
          ctx.fill()
        }
      break
    }
    case 'type': {
      ctx.fillStyle = P.ink[(seed + 1) % P.ink.length]
      ctx.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.56)
      ctx.fillStyle = P.bg
      ctx.beginPath()
      ctx.arc(w * 0.5, h * 0.36, Math.min(w * 0.3, h * 0.2), 0, Math.PI * 2)
      ctx.fill()
      const label = text.trim() || 'hello'
      ctx.fillStyle = P.ink[4]
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let size = Math.round(h * 0.11)
      const font = (s: number) => `700 ${s}px "Zen Maru Gothic", "Hiragino Sans", sans-serif`
      ctx.font = font(size)
      while (ctx.measureText(label).width > w * 0.84 && size > 8) ctx.font = font((size -= 2))
      ctx.fillText(label, w / 2, h * 0.76)
      ctx.font = font(Math.max(8, Math.round(h * 0.03)))
      ctx.globalAlpha = 0.7
      ctx.fillText('OHEYA KONEKONE  ·  2026', w / 2, h * 0.88)
      ctx.globalAlpha = 1
      break
    }
  }
  // A whisper of paper grain so flat colour does not look like a screen.
  const g = rng(seed + 7)
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = g() > 0.5 ? '#ffffff' : '#000000'
    ctx.fillRect(g() * w, g() * h, 1.5, 1.5)
  }
  ctx.globalAlpha = 1
}

function artTexture(art: Art, palette: Palette, seed: number, aspect: number, text: string) {
  const a = Math.round(Math.min(4, Math.max(0.25, aspect)) * 8) / 8
  const w = a >= 1 ? 640 : Math.round(640 * a)
  const h = a >= 1 ? Math.round(640 / a) : 640
  return drawnTexture(`art-${art}-${palette}-${seed}-${a}-${art === 'type' ? text : ''}`, w, h, (ctx) => drawArt(ctx, w, h, art, palette, seed, text))
}

const FRAMES = {
  none: 'なし（テープで貼る）',
  hanger: 'ポスターハンガー',
  thin: '細い金属の枠',
  wood: '木の枠',
  box: '厚みのある額',
  canvas: 'キャンバス（枠なし）',
} as const
type Frame = keyof typeof FRAMES

/** Depth (mm) of one piece off the wall. */
function artDepth(frame: Frame) {
  return frame === 'none' ? 2 : frame === 'hanger' ? 16 : frame === 'thin' ? 14 : frame === 'wood' ? 22 : frame === 'box' ? 40 : 30
}

type ArtParams = { width: number; height: number; count: number; arrange: string; gap: number }

/** Columns and rows of a set of pieces. */
function grid(q: ArtParams) {
  const n = Math.max(1, Math.round(q.count))
  const cols = q.arrange === 'grid' ? Math.ceil(n / Math.max(1, Math.floor(Math.sqrt(n)))) : n
  const rows = Math.ceil(n / cols)
  return { n, cols, rows, W: cols * q.width + (cols - 1) * q.gap, H: rows * q.height + (rows - 1) * q.gap }
}

export const wallArt = defineAsset({
  type: 'wallArt',
  label: 'ポスター・アート',
  category: 'decor',
  description: '壁に飾るポスター・額入りのアート・キャンバス。絵柄はコードで描く。何枚かを横並びや格子に並べたギャラリーにもできる',
  placement: 'wall',
  // The centre of the set at eye level (about 1450 mm), never lower than a sofa back.
  elevation: (q) => Math.max(900, Math.round(1450 - grid(q).H / 2)),
  contactShadow: false,
  surfaces: () => [],
  params: {
    width: p.mm('幅（1 枚）', 150, 1200, 420, { hint: 'A4 210×297 / A3 297×420 / A2 420×594 / B2 515×728 / B1 728×1030' }),
    height: p.mm('高さ（1 枚）', 150, 1500, 594),
    frame: p.select('枠', FRAMES, 'wood', { group: '形' }),
    frameColor: p.color('枠の色', '#b8875a', { swatches: ['#e4cfa8', '#b8875a', '#6b4a34', '#2b2b2e', '#f4f4f2', '#c9a86a', '#a7aaae'] }),
    mat: p.bool('余白（マット）', true, { hint: '額の中の白い余白。枠なし・キャンバスでは使わない' }),
    art: p.select('絵柄', ARTS, 'shapes', { group: '絵柄' }),
    palette: p.select('色の雰囲気', Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, v.label])) as Record<Palette, string>, 'warm', { group: '絵柄' }),
    seed: p.number({ label: 'バリエーション', min: 1, max: 30, step: 1, default: 1, group: '絵柄', hint: '数字を変えると同じ絵柄の別の絵になる' }),
    text: p.text('文字', 'hello', { group: '絵柄', hint: '絵柄が「文字のポスター」のときに表示する', maxLength: 16 }),
    count: p.number({ label: '枚数', min: 1, max: 6, step: 1, default: 1, group: '並べ方' }),
    arrange: p.select('並べ方', { row: '横一列', grid: '格子' }, 'row', { group: '並べ方' }),
    gap: p.mm('すき間', 20, 300, 60, { group: '並べ方' }),
  },
  presets: [
    { name: 'A3 の額', params: { width: 297, height: 420, frame: 'thin', frameColor: '#2b2b2e', art: 'mountains', palette: 'cool' } },
    { name: 'B2 ポスター（テープ）', params: { width: 515, height: 728, frame: 'none', art: 'type', palette: 'vivid', text: 'GOOD DAY' } },
    { name: 'ポスターハンガー', params: { width: 500, height: 700, frame: 'hanger', frameColor: '#b8875a', art: 'botanical', palette: 'earth' } },
    { name: '大きなキャンバス', params: { width: 900, height: 600, frame: 'canvas', art: 'sunset', palette: 'warm' } },
    { name: '3 枚並べ', params: { width: 300, height: 400, count: 3, frame: 'wood', frameColor: '#e4cfa8', art: 'arches', palette: 'earth' } },
    { name: 'ギャラリー（2×2）', params: { width: 300, height: 300, count: 4, arrange: 'grid', gap: 40, frame: 'box', frameColor: '#f4f4f2', art: 'geometric', palette: 'pastel' } },
  ],
  body: (q) => {
    const g = grid(q)
    const d = artDepth(q.frame)
    return { min: { x: -g.W / 2, y: 0, z: -d / 2 }, max: { x: g.W / 2, y: g.H, z: d / 2 } }
  },
  build(q) {
    const root = group()
    const { n, cols, W, H } = grid(q)
    const frame = q.frame
    const d = artDepth(frame)
    const back = -d / 2
    for (let i = 0; i < n; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const g = group()
      g.position.set(-W / 2 + q.width / 2 + col * (q.width + q.gap), H - q.height - row * (q.height + q.gap), 0)
      root.add(g)
      const w = q.width
      const h = q.height
      // Frame profile and the picture window inside it.
      const rim = frame === 'thin' ? 10 : frame === 'wood' ? 24 : frame === 'box' ? 32 : 0
      const framed = rim > 0
      const matW = framed && q.mat ? Math.round(Math.min(w, h) * 0.11) : 0
      const pw = w - 2 * (rim + matW)
      const ph = h - 2 * (rim + matW)
      const tex = artTexture(q.art, q.palette, q.seed + i, pw / Math.max(1, ph), q.text)
      const glossy = frame === 'none' || frame === 'hanger'
      const artM = printedMat(`art-${q.art}-${q.palette}-${q.seed + i}-${Math.round((pw / Math.max(1, ph)) * 8)}-${q.art === 'type' ? q.text : ''}-${glossy}`, tex, glossy ? 'gloss' : 'paper', glossy ? { roughness: 0.45 } : {})
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), artM)
      if (frame === 'none') {
        // A sheet of paper flat on the wall, taped at the corners.
        pic.position.set(0, h / 2, back + 1.2)
        g.add(panelOn(w, h, 1, mat('paper', '#f7f4ee'), 0, 0, back + 0.5, { edge: 0 }))
        const tape = mat('acrylic', '#f3ead2', { opacity: 0.7 })
        for (const sx of [-1, 1])
          for (const sy of [0, 1]) {
            const t = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), tape)
            t.position.set(sx * (w / 2 - 14), sy * h + (sy ? -14 : 14), back + 1.6)
            t.rotation.z = sx * (sy ? 1 : -1) * 0.75
            t.userData.noShadow = true
            g.add(t)
          }
      } else if (frame === 'hanger') {
        // Poster clamped between two wooden bars, hung from a cord.
        pic.position.set(0, h / 2, back + 4)
        const wood = mat('wood', q.frameColor)
        for (const y of [0, h - 18]) g.add(panelOn(w + 30, 18, 12, wood, 0, y, back + 6, { edge: 2 }))
        const cord = mat('fabric', '#2b2622')
        for (const s of [-1, 1]) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, Math.hypot(w * 0.3, 90), 6), cord)
          c.position.set((s * w * 0.3) / 2, h + 45, back + 6)
          c.rotation.z = s * Math.atan2(w * 0.3, 90)
          g.add(c)
        }
      } else if (frame === 'canvas') {
        // Stretched canvas: the picture wraps around a 30 mm deep stretcher.
        g.add(panelOn(w, h, d - 1, mat('fabric', PALETTES[q.palette].bg), 0, 0, back + (d - 1) / 2, { edge: 1.5 }))
        pic.position.set(0, h / 2, d / 2 + 0.2)
      } else {
        const fm = frame === 'thin' ? mat('powder', q.frameColor) : mat('wood', q.frameColor)
        const fd = d
        const e = frame === 'thin' ? 1 : 2
        g.add(panelOn(w, rim, fd, fm, 0, 0, 0, { edge: e }), panelOn(w, rim, fd, fm, 0, h - rim, 0, { edge: e }))
        g.add(panelOn(rim, h - rim * 2, fd, fm, -w / 2 + rim / 2, rim, 0, { edge: e }), panelOn(rim, h - rim * 2, fd, fm, w / 2 - rim / 2, rim, 0, { edge: e }))
        // Backing board; the mat sits a little behind the frame's face, the picture just behind the mat.
        const inset = frame === 'box' ? d - 10 : 6
        const face = d / 2 - inset
        g.add(panelOn(w - rim * 2, h - rim * 2, 3, mat('matte', '#f7f5f0', { roughness: 0.9 }), 0, rim, face - 1.5, { edge: 0 }))
        pic.position.set(0, h / 2, face + 0.4)
        if (matW > 0) {
          // Bevelled-looking mat: four strips slightly proud of the picture.
          const mm = mat('matte', '#fbfaf6', { roughness: 0.92 })
          const iw = w - rim * 2
          g.add(panelOn(iw, matW, 2, mm, 0, rim, face + 1.2, { edge: 0.5 }), panelOn(iw, matW, 2, mm, 0, h - rim - matW, face + 1.2, { edge: 0.5 }))
          g.add(panelOn(matW, ph, 2, mm, -pw / 2 - matW / 2, rim + matW, face + 1.2, { edge: 0.5 }), panelOn(matW, ph, 2, mm, pw / 2 + matW / 2, rim + matW, face + 1.2, { edge: 0.5 }))
        }
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - rim * 2, h - rim * 2), mat('glass', '#ffffff', { opacity: 0.06 }))
        glass.position.set(0, h / 2, d / 2 - 3)
        glass.userData.noShadow = true
        g.add(glass)
      }
      pic.receiveShadow = true
      g.add(pic)
    }
    return root
  },
})
