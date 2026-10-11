import * as THREE from 'three'
import { mat, printedMat } from '../../three/materials'
import { drawnTexture, rng } from '../../three/textures'
import { box, boxOn, cyl, deg, group, lathe, merged, panelOn } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

/** Boxes, organisers and other small things. */

// ---- Cardboard and paper boxes -------------------------------------------------------------

const PRINTS = { none: 'なし', fragile: '取扱注意', moving: '引越し', shipping: '通販（伝票つき）', snack: 'お菓子の箱', stripes: '帯（ストライプ）' } as const
type Print = keyof typeof PRINTS

/** A print for one face of a box, drawn to the face's aspect ratio. */
function printTexture(kind: Exclude<Print, 'none'>, base: string, ink: string, aspect: number) {
  const a = Math.round(Math.min(4, Math.max(0.25, aspect)) * 4) / 4
  const w = 512
  const h = Math.round(512 / a)
  return drawnTexture(`box-${kind}-${base}-${ink}-${a}`, w, h, (ctx) => {
    const fill = kind === 'snack' || kind === 'stripes'
    ctx.fillStyle = base
    ctx.fillRect(0, 0, w, h)
    if (!fill) ctx.clearRect(0, 0, w, h)
    const s = Math.min(w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const font = (px: number, weight = 900) => `${weight} ${Math.round(px)}px "Zen Maru Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif`
    if (kind === 'fragile') {
      ctx.strokeStyle = ink
      ctx.fillStyle = ink
      ctx.lineWidth = s * 0.02
      ctx.strokeRect(w * 0.08, h * 0.12, w * 0.4, h * 0.6)
      // Wine glass
      const gx = w * 0.28
      const gy = h * 0.42
      ctx.beginPath()
      ctx.moveTo(gx - s * 0.09, gy - s * 0.16)
      ctx.quadraticCurveTo(gx - s * 0.09, gy + s * 0.02, gx, gy + s * 0.03)
      ctx.quadraticCurveTo(gx + s * 0.09, gy + s * 0.02, gx + s * 0.09, gy - s * 0.16)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(gx - s * 0.008, gy, s * 0.016, s * 0.13)
      ctx.fillRect(gx - s * 0.06, gy + s * 0.13, s * 0.12, s * 0.02)
      ctx.font = font(s * 0.13)
      ctx.fillText('取扱注意', w * 0.72, h * 0.32)
      ctx.font = font(s * 0.09, 700)
      ctx.fillText('FRAGILE', w * 0.72, h * 0.52)
      // Arrows: this way up.
      for (const x of [w * 0.66, w * 0.8]) {
        ctx.beginPath()
        ctx.moveTo(x, h * 0.66)
        ctx.lineTo(x - s * 0.04, h * 0.74)
        ctx.lineTo(x + s * 0.04, h * 0.74)
        ctx.fill()
        ctx.fillRect(x - s * 0.012, h * 0.74, s * 0.024, s * 0.08)
      }
    } else if (kind === 'moving') {
      ctx.fillStyle = ink
      ctx.fillRect(0, h * 0.06, w, h * 0.1)
      ctx.font = font(s * 0.22)
      ctx.fillText('引越し', w * 0.5, h * 0.48)
      ctx.font = font(s * 0.07, 700)
      ctx.fillText('ていねいに運びます', w * 0.5, h * 0.7)
      ctx.strokeStyle = ink
      ctx.lineWidth = s * 0.012
      ctx.strokeRect(w * 0.12, h * 0.8, w * 0.76, h * 0.12)
    } else if (kind === 'shipping') {
      // Logo band and a shipping label with a barcode.
      ctx.fillStyle = ink
      ctx.font = font(s * 0.1)
      ctx.fillText('はやい便', w * 0.25, h * 0.15)
      ctx.fillRect(w * 0.08, h * 0.24, w * 0.34, s * 0.012)
      ctx.fillStyle = '#fbfbf8'
      ctx.fillRect(w * 0.5, h * 0.18, w * 0.42, h * 0.62)
      ctx.fillStyle = '#3b3f45'
      for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.54, h * 0.26 + i * h * 0.07, w * (0.2 + (i % 3) * 0.06), h * 0.025)
      const r = rng(7)
      let x = w * 0.54
      while (x < w * 0.88) {
        const bw = 1 + Math.floor(r() * 4)
        ctx.fillRect(x, h * 0.64, bw, h * 0.1)
        x += bw + 1 + Math.floor(r() * 3)
      }
    } else if (kind === 'snack') {
      // Polka dots, a ribbon band and a brand name.
      const r = rng(base.length + ink.length)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (let i = 0; i < 40; i++) {
        ctx.beginPath()
        ctx.arc(r() * w, r() * h, s * (0.02 + r() * 0.03), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = ink
      ctx.fillRect(0, h * 0.38, w, h * 0.26)
      ctx.fillStyle = '#fffaf0'
      ctx.font = font(s * 0.16)
      ctx.fillText('おかし', w * 0.5, h * 0.51)
      ctx.font = font(s * 0.06, 700)
      ctx.fillStyle = ink
      ctx.fillText('MADE WITH LOVE', w * 0.5, h * 0.82)
    } else {
      ctx.fillStyle = ink
      for (let i = 0; i < 3; i++) ctx.fillRect(0, h * (0.2 + i * 0.25), w, h * 0.08)
    }
  })
}

/** A print as a thin decal over a box face (`w` × `h`, facing +Z, centred on the origin). */
function decal(kind: Exclude<Print, 'none'>, base: string, ink: string, w: number, h: number, glossy: boolean) {
  const tex = printTexture(kind, base, ink, w / h)
  const m = printedMat(`box-${kind}-${base}-${ink}-${Math.round((w / h) * 4)}`, tex, glossy ? 'gloss' : 'paper')
  if (m instanceof THREE.MeshPhysicalMaterial && kind !== 'snack' && kind !== 'stripes') {
    m.transparent = true
    m.alphaTest = 0.4
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
  mesh.receiveShadow = true
  return mesh
}

type BoxParams = { width: number; depth: number; height: number; style: string; lid: string; material: string; color: string; print: string; printColor: string }

function boxThickness(q: BoxParams) {
  return q.material === 'board' ? 1.5 : 5
}

/** Whether the box is shut, so things can be stacked on it. */
function boxClosed(q: BoxParams) {
  return (q.style === 'flaps' && q.lid === 'closed') || (q.style === 'lid' && q.lid !== 'open')
}

export const cardboardBox = defineAsset({
  type: 'cardboardBox',
  label: '段ボール・箱',
  category: 'small',
  description: '段ボール箱、かぶせ蓋の紙箱（お菓子・贈答品）、トレー。フタの開き具合と印刷を選べる。閉じていれば上に積み重ねられ、開いていれば中に物を入れられる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 120, 800, 400),
    depth: p.mm('奥行き', 100, 600, 300),
    height: p.mm('高さ', 40, 600, 300),
    style: p.select('形', { flaps: '段ボール（フラップ）', lid: 'かぶせ蓋', tray: 'トレー（フタなし）' }, 'flaps', { group: '形' }),
    lid: p.select('フタ', { closed: '閉じる（テープ）', half: '半開き', open: '全開' }, 'closed', { group: '形' }),
    material: p.select('材質', { corrugated: '段ボール', board: '厚紙（印刷つき）' }, 'corrugated', { group: '色・素材' }),
    color: p.color('色', '#c8a172', { swatches: ['#c8a172', '#b98d5f', '#f4f2ee', '#2b2b2e', '#c5687a', '#e8c76a', '#9fb5a5', '#3d5a80'] }),
    print: p.select('印刷', PRINTS, 'none', { group: '色・素材' }),
    printColor: p.color('印刷の色', '#c4372f', { swatches: ['#c4372f', '#1d3f8f', '#2f7d4f', '#20242a', '#e8835c', '#fffaf0'] }),
  },
  presets: [
    { name: '引越しの段ボール', params: { print: 'moving', printColor: '#1d3f8f' } },
    { name: '開いた段ボール', params: { lid: 'open', width: 450, height: 280 } },
    { name: '通販の箱', params: { width: 320, depth: 240, height: 120, print: 'shipping', printColor: '#20242a' } },
    { name: '割れ物注意', params: { print: 'fragile' } },
    { name: 'お菓子の箱', params: { style: 'lid', material: 'board', width: 260, depth: 180, height: 60, color: '#f2b8c6', print: 'snack', printColor: '#c4372f' } },
    { name: '書類トレー', params: { style: 'tray', material: 'board', width: 330, depth: 240, height: 60, color: '#f4f2ee' } },
  ],
  body: ({ width: W, depth: D, height: H }) => ({ min: { x: -W / 2, y: 0, z: -D / 2 }, max: { x: W / 2, y: H, z: D / 2 } }),
  surfaces: (q) => {
    const t = boxThickness(q)
    if (boxClosed(q)) {
      const top = q.height + (q.style === 'flaps' ? t * 2 : t)
      return [{ y: top, minX: -q.width / 2, maxX: q.width / 2, minZ: -q.depth / 2, maxZ: q.depth / 2, label: 'フタの上' }]
    }
    return [{ y: t, minX: -q.width / 2 + t, maxX: q.width / 2 - t, minZ: -q.depth / 2 + t, maxZ: q.depth / 2 - t, clearance: q.height, label: '箱の中' }]
  },
  build(q) {
    const { width: W, depth: D, height: H, style, lid, material, color, print, printColor } = q
    const g = group()
    const t = boxThickness(q)
    const corrugated = material === 'corrugated'
    const m = corrugated ? mat('cardboard', color) : mat('paper', color, { roughness: 0.55 })
    // Inside is unprinted kraft (or plain white for paper boxes).
    const inner = corrugated ? mat('cardboard', '#b99062') : mat('paper', '#f4f1ea')
    const e = corrugated ? 1.2 : 0.5
    const bodyH = style === 'lid' ? H - Math.min(H * 0.3, 60) * 0.15 : H
    g.add(panelOn(W, t, D, m, 0, 0, 0, { edge: e }))
    for (const s of [-1, 1]) {
      g.add(panelOn(W, bodyH - t, t, m, 0, t, s * (D / 2 - t / 2), { edge: e }))
      g.add(panelOn(t, bodyH - t, D - t * 2, m, s * (W / 2 - t / 2), t, 0, { edge: e }))
    }
    g.add(boxOn(W - t * 2 - 1, 0.6, D - t * 2 - 1, inner, 0, t, 0))
    if (style === 'flaps') {
      const angle = lid === 'closed' ? 0 : lid === 'half' ? deg(50) : deg(112)
      const inAngle = lid === 'closed' ? 0 : lid === 'half' ? deg(70) : deg(100)
      // Outer flaps on the long sides (front/back) meet in the middle; inner flaps on the short sides.
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group()
        pivot.position.set(0, H + (lid === 'closed' ? t : 0), s * D / 2)
        const f = panelOn(W, t, D / 2 - 1, m, 0, 0, -s * (D / 4), { edge: e })
        pivot.add(f)
        pivot.rotation.x = s * angle
        g.add(pivot)
        const side = new THREE.Group()
        side.position.set(s * W / 2, H, 0)
        side.add(panelOn(Math.min(W / 2, D / 2) - 4, t, D - t * 2 - 4, m, -s * (Math.min(W / 2, D / 2) / 2), 0, 0, { edge: e }))
        side.rotation.z = -s * inAngle
        g.add(side)
      }
      if (lid === 'closed') {
        // Packing tape along the seam and down the front and back.
        const tape = mat('plastic', '#cbb08a', { roughness: 0.25 })
        g.add(boxOn(48, 0.6, D + 2, tape, 0, H + t * 2, 0))
        for (const s of [-1, 1]) g.add(boxOn(48, 70, 0.6, tape, 0, H + t * 2 - 70, s * (D / 2 + 0.6)))
      }
    } else if (style === 'lid') {
      // A slightly larger lid over the top quarter; open leans it against the back.
      const lh = Math.min(H * 0.3, 60)
      const lidG = new THREE.Group()
      lidG.add(panelOn(W + t * 2 + 2, t, D + t * 2 + 2, m, 0, lh - t, 0, { edge: e }))
      for (const s of [-1, 1]) {
        lidG.add(panelOn(W + t * 2 + 2, lh - t, t, m, 0, 0, s * (D / 2 + t / 2 + 1), { edge: e }))
        lidG.add(panelOn(t, lh - t, D + 2, m, s * (W / 2 + t / 2 + 1), 0, 0, { edge: e }))
      }
      if (lid === 'open') {
        // Stood on its edge behind the box, top facing back.
        lidG.rotation.x = -Math.PI / 2
        lidG.position.set(0, D / 2 + t + 1, -D / 2 - t - 2)
      } else lidG.position.y = H + t - lh + (lid === 'half' ? 30 : 0)
      if (lid === 'half') lidG.rotation.z = deg(6)
      g.add(lidG)
      if (print !== 'none') {
        const d = decal(print as Exclude<Print, 'none'>, color, printColor, W, D, !corrugated)
        d.rotation.x = -Math.PI / 2
        d.position.y = lh + 0.4
        if (lid !== 'open') lidG.add(d)
      }
    }
    if (print !== 'none' && style !== 'lid') {
      const glossy = !corrugated
      const front = decal(print as Exclude<Print, 'none'>, color, printColor, W - 4, bodyH - 6, glossy)
      front.position.set(0, bodyH / 2, D / 2 + 0.4)
      const side = decal(print as Exclude<Print, 'none'>, color, printColor, D - 4, bodyH - 6, glossy)
      side.position.set(W / 2 + 0.4, bodyH / 2, 0)
      side.rotation.y = Math.PI / 2
      g.add(front, side)
    }
    return g
  },
})

// ---- Organisers ----------------------------------------------------------------------------

export const organizer = defineAsset({
  type: 'organizer',
  label: '小物入れ',
  category: 'small',
  description: '仕切りのある小物入れ・ペン立て・引き出しの中のトレー。仕切りの数と中身を選べる。机や棚に置く',
  placement: 'onTop',
  surfaces: () => [],
  params: {
    width: p.mm('幅', 60, 400, 240),
    depth: p.mm('奥行き', 60, 300, 160),
    height: p.mm('高さ', 20, 150, 50),
    cols: p.number({ label: '横の仕切り', min: 1, max: 6, step: 1, default: 3, group: '形' }),
    rows: p.number({ label: '縦の仕切り', min: 1, max: 4, step: 1, default: 2, group: '形' }),
    material: p.select('素材', { plastic: 'プラスチック', wood: '木', acrylic: 'アクリル', steel: 'スチール' }, 'plastic', { group: '色・素材' }),
    color: p.color('色', '#f4f4f2', { swatches: ['#f4f4f2', '#2b2b2e', '#c4c6c8', '#b8875a', '#9fb5a5', '#f2d3c0', '#cfe0e8'] }),
    contents: p.select('中身', { none: 'からっぽ', stationery: '文房具いろいろ', pens: 'ペン立て' }, 'stationery', { group: '形' }),
  },
  presets: [
    { name: 'ペン立て', params: { width: 90, depth: 90, height: 100, cols: 1, rows: 1, contents: 'pens' } },
    { name: '木のトレー', params: { material: 'wood', color: '#b8875a', cols: 4, rows: 1, height: 40 } },
    { name: 'アクリルケース', params: { material: 'acrylic', color: '#eef3f4', cols: 2, rows: 2, height: 80 } },
  ],
  build({ width: W, depth: D, height: H, cols, rows, material, color, contents }) {
    const g = group()
    const m = material === 'wood' ? mat('wood', color) : material === 'acrylic' ? mat('acrylic', color, { opacity: 0.4 }) : material === 'steel' ? mat('powder', color) : mat('plastic', color, { roughness: 0.45 })
    const t = material === 'wood' ? 6 : material === 'steel' ? 1.5 : 2.5
    const walls: THREE.Mesh[] = []
    walls.push(box(W, t, D, m, [0, t / 2, 0]))
    for (const s of [-1, 1]) {
      walls.push(box(W, H, t, m, [0, H / 2, s * (D / 2 - t / 2)]))
      walls.push(box(t, H, D - t * 2, m, [s * (W / 2 - t / 2), H / 2, 0]))
    }
    const nc = Math.round(cols)
    const nr = Math.round(rows)
    const dh = H * 0.85
    for (let i = 1; i < nc; i++) walls.push(box(t * 0.8, dh, D - t * 2, m, [-W / 2 + (W * i) / nc, dh / 2, 0]))
    for (let i = 1; i < nr; i++) walls.push(box(W - t * 2, dh, t * 0.8, m, [0, dh / 2, -D / 2 + (D * i) / nr]))
    g.add(merged(walls, m))
    if (contents === 'none') return g
    const r = rng(nc * 13 + nr * 7 + Math.round(W))
    const PEN = ['#20242a', '#c4372f', '#1d3f8f', '#2f7d4f', '#e8c76a', '#f4f4f2']
    if (contents === 'pens') {
      // Pens, a ruler and scissors standing up, leaning outwards.
      const n = Math.max(4, Math.round((W * D) / 1800))
      for (let i = 0; i < n; i++) {
        const len = 140 + r() * 30
        const pen = cyl(4.5, 4.5, len, mat('plastic', PEN[Math.floor(r() * PEN.length)], { roughness: 0.35 }), [0, len / 2, 0], { segments: 10 })
        const grp = group(pen)
        grp.position.set((r() - 0.5) * (W - 24), t, (r() - 0.5) * (D - 24))
        grp.rotation.set((r() - 0.5) * 0.35, 0, (r() - 0.5) * 0.35)
        g.add(grp)
      }
      const ruler = boxOn(3, 170, 24, mat('acrylic', '#dfe9ee', { opacity: 0.55 }), W * 0.2, t, -D * 0.15)
      ruler.rotation.z = -0.12
      g.add(ruler)
      return g
    }
    // Stationery spread over the compartments.
    const cw = W / nc
    const cd = D / nr
    for (let i = 0; i < nc; i++)
      for (let j = 0; j < nr; j++) {
        const x = -W / 2 + cw * (i + 0.5)
        const z = -D / 2 + cd * (j + 0.5)
        const kind = Math.floor(r() * 4)
        if (kind === 0) {
          // Pens lying along the compartment.
          const along = cw > cd
          const L = Math.min(140, (along ? cw : cd) - 10)
          for (let k = 0; k < 3; k++) {
            const pen = cyl(4.5, 4.5, L, mat('plastic', PEN[Math.floor(r() * PEN.length)], { roughness: 0.35 }), [0, 0, 0], { rot: along ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], segments: 10 })
            pen.position.set(x + (along ? 0 : (k - 1) * 10), t + 5 + (k % 2) * 7, z + (along ? (k - 1) * 10 : 0))
            g.add(pen)
          }
        } else if (kind === 1) {
          const c = ['#ffe680', '#ffb3c7', '#a8e6cf', '#9bd0ff'][Math.floor(r() * 4)]
          const sz = Math.min(75, cw - 10, cd - 10)
          g.add(boxOn(sz, Math.min(30, H - 5), sz, mat('paper', c), x, t, z)) // sticky notes
        } else if (kind === 2) {
          g.add(boxOn(Math.min(40, cw - 10), 12, Math.min(20, cd - 8), mat('plastic', '#f4f4f2', { roughness: 0.7 }), x, t, z)) // eraser
          g.add(boxOn(Math.min(26, cw - 10), 13, Math.min(18, cd - 8), mat('paper', '#1d3f8f'), x, t + 0.5, z)) // its sleeve
        } else {
          for (let k = 0; k < 4; k++) {
            const clip = new THREE.Mesh(new THREE.TorusGeometry(6, 0.9, 4, 12), mat('chrome', '#cfd2d5'))
            clip.scale.set(1, 2, 1)
            clip.position.set(x + (r() - 0.5) * (cw - 24), t + 1, z + (r() - 0.5) * (cd - 24))
            clip.rotation.set(Math.PI / 2, 0, r() * Math.PI)
            g.add(clip)
          }
        }
      }
    return g
  },
})

// ---- Wall clock ----------------------------------------------------------------------------

function clockFace(style: string, faceColor: string, ink: string) {
  return drawnTexture(`clock-${style}-${faceColor}-${ink}`, 512, 512, (ctx, w) => {
    const c = w / 2
    ctx.fillStyle = faceColor
    ctx.fillRect(0, 0, w, w)
    ctx.fillStyle = ink
    ctx.strokeStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const major = i % 5 === 0
      if (style === 'minimal' && !major) continue
      ctx.lineWidth = major ? 9 : 3
      const r0 = major ? 0.8 : 0.86
      ctx.beginPath()
      ctx.moveTo(c + Math.sin(a) * c * r0 * 0.98, c - Math.cos(a) * c * r0 * 0.98)
      ctx.lineTo(c + Math.sin(a) * c * 0.92, c - Math.cos(a) * c * 0.92)
      if (style !== 'numbers' || !major) ctx.stroke()
    }
    if (style === 'numbers') {
      ctx.font = `700 ${Math.round(w * 0.11)}px "Zen Maru Gothic", "Hiragino Sans", sans-serif`
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.fillText(String(i), c + Math.sin(a) * c * 0.74, c - Math.cos(a) * c * 0.74)
      }
    }
  })
}

export const wallClock = defineAsset({
  type: 'wallClock',
  label: '壁掛け時計',
  category: 'decor',
  description: '壁に掛ける時計。針は画面の時間帯スライダーの時刻を指す',
  placement: 'wall',
  elevation: 1750,
  contactShadow: false,
  surfaces: () => [],
  params: {
    diameter: p.mm('直径', 200, 450, 300),
    shape: p.select('形', { round: '丸', square: '四角' }, 'round', { group: '形' }),
    frame: p.select('枠', { plastic: '樹脂', wood: '木', metal: '金属', none: '枠なし' }, 'wood', { group: '色・素材' }),
    frameColor: p.color('枠の色', '#b8875a', { swatches: ['#b8875a', '#6b4a34', '#f4f4f2', '#2b2b2e', '#c9a86a', '#c9ccd0'] }),
    face: p.select('文字盤', { numbers: '数字', bars: '線', minimal: 'シンプル' }, 'numbers', { group: '形' }),
    faceColor: p.color('文字盤の色', '#fbfaf6', { swatches: ['#fbfaf6', '#2b2b2e', '#e8e2d6', '#cfe0e8', '#d9e4d3'] }),
    hour: p.number({ label: '時刻', min: 0, max: 24, step: 0.25, default: 10.15, group: 'その他', hidden: true }),
  },
  live: ({ hour }) => ({ hour }),
  presets: [
    { name: '駅の時計風', params: { frame: 'metal', frameColor: '#2b2b2e', face: 'bars', diameter: 350 } },
    { name: '黒い文字盤', params: { faceColor: '#2b2b2e', frame: 'none', face: 'minimal' } },
    { name: '四角い木の時計', params: { shape: 'square', frame: 'wood', face: 'bars' } },
  ],
  build({ diameter: Dm, shape, frame, frameColor, face, faceColor, hour }) {
    const g = group()
    const R = Dm / 2
    const depth = 45
    const dark = new THREE.Color(faceColor).getHSL({ h: 0, s: 0, l: 0 }).l < 0.4
    const ink = dark ? '#f4f2ee' : '#20242a'
    const frameM = frame === 'wood' ? mat('wood', frameColor) : frame === 'metal' ? mat('powder', frameColor) : mat('plastic', frameColor, { roughness: 0.35 })
    const rim = frame === 'none' ? 3 : frame === 'wood' ? 22 : 14
    const faceR = R - rim
    // Case (origin: bottom centre; centred on depth). The face sits 8 mm behind the rim.
    const faceZ = depth / 2 - 8
    if (shape === 'round') {
      g.add(cyl(R - 1, R - 1, depth - 8, frameM, [0, R, -4], { rot: [Math.PI / 2, 0, 0], segments: 64 }))
      const rimG = lathe(
        [
          [faceR, 0],
          [R, 0],
          [R, 8],
          [faceR, 8],
          [faceR, 0],
        ],
        frameM,
        [0, R, faceZ],
        { segments: 64 },
      )
      rimG.rotation.x = Math.PI / 2
      g.add(rimG)
    } else {
      g.add(panelOn(Dm, Dm, depth - 8, frameM, 0, 0, -4, { edge: frame === 'wood' ? 4 : 3 }))
      for (const s of [-1, 1]) {
        g.add(panelOn(Dm, rim, 8, frameM, 0, s > 0 ? Dm - rim : 0, faceZ + 4, { edge: 2 }))
        g.add(panelOn(rim, Dm - rim * 2, 8, frameM, s * (Dm / 2 - rim / 2), rim, faceZ + 4, { edge: 2 }))
      }
    }
    const faceMat = printedMat(`clock-${face}-${faceColor}`, clockFace(face, faceColor, ink), 'paper', { roughness: 0.6 })
    const faceMesh = new THREE.Mesh(shape === 'round' ? new THREE.CircleGeometry(faceR, 64) : new THREE.PlaneGeometry(faceR * 2, faceR * 2), faceMat)
    faceMesh.position.set(0, R, faceZ + 0.3)
    g.add(faceMesh)
    // Hands: hour, minute, and a thin red second hand.
    const h12 = ((hour % 12) + 12) % 12
    const handM = mat('powder', ink)
    const hands: [number, number, number, THREE.Material, number][] = [
      [(h12 / 12) * Math.PI * 2, faceR * 0.5, 7, handM, 1],
      [((hour % 1) * 60 / 60) * Math.PI * 2, faceR * 0.78, 4.5, handM, 2.2],
      [deg(200), faceR * 0.85, 1.4, mat('powder', '#c4372f'), 3.4],
    ]
    for (const [a, len, w, m, z] of hands) {
      const hand = box(w, len + faceR * 0.12, 1.2, m, [0, (len - faceR * 0.12) / 2, 0])
      const pivot = group(hand)
      pivot.position.set(0, R, faceZ + z)
      pivot.rotation.z = -a
      g.add(pivot)
    }
    g.add(cyl(6, 6, 6, mat('powder', ink), [0, R, faceZ + 4], { rot: [Math.PI / 2, 0, 0], segments: 16 }))
    // Glass cover.
    if (frame !== 'none') {
      const glass = new THREE.Mesh(shape === 'round' ? new THREE.CircleGeometry(faceR, 64) : new THREE.PlaneGeometry(faceR * 2, faceR * 2), mat('glass', '#ffffff', { opacity: 0.08 }))
      glass.position.set(0, R, depth / 2 - 1)
      g.add(glass)
    }
    return g
  },
})
