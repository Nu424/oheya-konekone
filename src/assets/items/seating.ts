import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { boxOn, cyl, deg, group, lathe, rbox, sphere, tube } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

export const sofa = defineAsset({
  type: 'sofa',
  label: 'ソファ',
  category: 'sofa',
  description: 'ソファ。幅で1〜3人掛けを表現。ひじ掛けや脚の形、布の色を変えられる。座る側が正面',
  placement: 'floor',
  params: {
    width: p.mm('幅', 700, 2400, 1600, { hint: '1人掛け≈800、2人掛け≈1400〜1600、3人掛け≈1900以上' }),
    depth: p.mm('奥行き', 650, 1000, 800),
    seatHeight: p.mm('座面の高さ', 250, 480, 400, { hint: 'ローソファは300前後' }),
    arms: p.select('ひじ掛け', { square: '角型', round: '丸型', thin: '細め', none: 'なし' }, 'square'),
    legs: p.select('脚', { wood: '木の脚', metal: '金属の脚', none: '脚なし' }, 'wood'),
    fabric: p.color('布の色', '#b9b0a3', { swatches: SWATCHES.fabric }),
    legColor: p.color('脚の色', '#6b4a34', { swatches: [...SWATCHES.wood, ...SWATCHES.metal] }),
    cushions: p.bool('クッション', true),
    cushionColor: p.color('クッションの色', '#e8c76a', { swatches: SWATCHES.fabric }),
  },
  presets: [
    { name: '1人掛け', params: { width: 850 } },
    { name: '2人掛け', params: { width: 1450 } },
    { name: '3人掛け', params: { width: 2000, depth: 880 } },
    { name: 'ローソファ', params: { width: 1300, seatHeight: 300, legs: 'none', arms: 'round', fabric: '#8fa9bf' } },
  ],
  build({ width: W, depth: D, seatHeight: sh, arms, legs, fabric, legColor, cushions, cushionColor }) {
    const fab = mat('fabric', fabric)
    const g = group()
    const legH = legs === 'none' ? 0 : Math.min(160, sh * 0.35)
    const armW = arms === 'none' ? 0 : arms === 'thin' ? 70 : 170
    const backT = 200
    const baseH = sh - legH - 130 // frame height below the seat cushions
    const baseY = legH
    const armH = sh + 200 - legH
    const backH = sh + 420 - legH

    // Base frame
    g.add(rbox(W - 10, baseH, D - 10, 30, fab, [0, baseY + baseH / 2, 0]))
    // Back
    g.add(rbox(W - armW * 2 + (arms === 'none' ? 0 : 40), backH, backT, 60, fab, [0, baseY + backH / 2, -D / 2 + backT / 2]))
    // Arms
    if (arms !== 'none') {
      const r = arms === 'round' ? Math.min(armW / 2, 80) : arms === 'thin' ? 30 : 40
      for (const s of [-1, 1]) g.add(rbox(armW, armH, D, r, fab, [s * (W / 2 - armW / 2), baseY + armH / 2, 0]))
    }
    // Seat cushions
    const inner = W - armW * 2 - 10
    const n = Math.max(1, Math.min(3, Math.round(inner / 650)))
    const cw = inner / n
    const cd = D - backT - 10
    for (let i = 0; i < n; i++) {
      const x = -inner / 2 + cw * (i + 0.5)
      g.add(rbox(cw - 8, 150, cd, 50, fab, [x, sh - 70, D / 2 - cd / 2 - 5]))
      // Back cushions
      g.add(rbox(cw - 12, Math.min(460, backH - baseH - 60), 170, 70, fab, [x, sh + 200, -D / 2 + backT + 60], { rot: [deg(-10), 0, 0] }))
    }
    // Throw cushions
    if (cushions) {
      const cm = mat('fabric', cushionColor)
      const xs = n === 1 ? [0] : [-inner / 2 + 230, inner / 2 - 230]
      xs.forEach((x, i) => g.add(rbox(400, 400, 130, 60, cm, [x, sh + 180, -D / 2 + backT + 170], { rot: [deg(-14), deg(i ? -12 : 12), 0] })))
    }
    // Legs
    if (legs !== 'none') {
      const lm = legs === 'wood' ? mat('wood', legColor) : mat('metal', legColor, { roughness: 0.35 })
      const ix = W / 2 - 60
      const iz = D / 2 - 60
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          if (legs === 'wood') g.add(cyl(20, 14, legH, lm, [sx * ix, legH / 2, sz * iz], { rot: [sz * deg(6), 0, -sx * deg(6)] }))
          else g.add(boxOn(16, legH, 40, lm, sx * ix, 0, sz * iz))
        }
    }
    return g
  },
})

export const floorChair = defineAsset({
  type: 'floorChair',
  label: '座椅子',
  category: 'sofa',
  description: '床に置く座椅子。背もたれの角度を変えられる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 450, 700, 550),
    recline: p.number({ label: '背もたれの角度', min: 95, max: 160, step: 1, default: 110, unit: '°', group: '形' }),
    arms: p.bool('ひじ掛け', false),
    fabric: p.color('布の色', '#4d4f53', { swatches: SWATCHES.fabric }),
  },
  build({ width: W, recline, arms, fabric }) {
    const fab = mat('fabric', fabric)
    const g = group()
    const seatD = 520
    g.add(rbox(W, 110, seatD, 40, fab, [0, 55, 60]))
    const back = new THREE.Group()
    back.add(rbox(W - 20, 560, 90, 40, fab, [0, 280, 0]))
    back.add(rbox(W - 80, 140, 60, 30, fab, [0, 560, 30])) // head cushion
    back.position.set(0, 70, 60 - seatD / 2 + 20)
    back.rotation.x = -deg(recline - 90)
    g.add(back)
    if (arms) for (const s of [-1, 1]) g.add(rbox(90, 160, 380, 35, fab, [s * (W / 2 + 30), 160, 40]))
    return g
  },
})

export const beanbag = defineAsset({
  type: 'beanbag',
  label: 'ビーズクッション',
  category: 'sofa',
  description: '体が沈み込む大きなビーズクッション',
  placement: 'floor',
  params: {
    size: p.mm('直径', 500, 1100, 750),
    height: p.mm('高さ', 300, 700, 450),
    color: p.color('布の色', '#d8a48f', { swatches: SWATCHES.fabric }),
  },
  build({ size, height, color }) {
    const fab = mat('fabric', color, { roughness: 0.85 })
    // Squashed blob with a dent on top: lathe profile.
    const r = size / 2
    const h = height
    const pts: [number, number][] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const a = -Math.PI / 2 + t * Math.PI
      const rr = r * Math.cos(a) * (1 + 0.08 * Math.sin(t * Math.PI))
      const yy = (Math.sin(a) * 0.5 + 0.5) * h
      const dent = t > 0.8 ? (t - 0.8) * 5 * h * 0.12 : 0
      pts.push([Math.max(0.5, rr), yy - dent])
    }
    pts.push([0.5, h * 0.86])
    const m = lathe(pts, fab, [0, 0, 0], { segments: 48 })
    m.scale.set(1, 1, 0.92)
    return group(m)
  },
})

export const officeChair = defineAsset({
  type: 'officeChair',
  label: 'オフィスチェア',
  category: 'work',
  description: 'キャスター付きのデスクチェア。座る人が正面(+Z)を向く',
  placement: 'floor',
  params: {
    seatHeight: p.mm('座面の高さ', 380, 520, 450),
    back: p.select('背もたれ', { mesh: 'メッシュ', fabric: 'ファブリック', high: 'ハイバック' }, 'mesh'),
    arms: p.bool('ひじ掛け', true),
    color: p.color('座面・背もたれ', '#3a3b3e', { swatches: SWATCHES.fabric }),
    frameColor: p.color('フレーム', '#2b2b2b', { swatches: ['#2b2b2b', '#d7d9dc', '#f2efe9'] }),
  },
  presets: [
    { name: 'ゲーミング風', params: { back: 'high', color: '#c5687a' } },
    { name: 'ホワイト', params: { color: '#e7e2da', frameColor: '#f2efe9' } },
  ],
  build({ seatHeight: sh, back, arms, color, frameColor }) {
    const g = group()
    const frame = mat('plastic', frameColor, { roughness: 0.35 })
    const chrome = mat('metal', '#c9ccd0', { roughness: 0.2 })
    const seatM = mat('fabric', color)
    // Five-star base with casters
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const leg = boxOn(300, 30, 50, frame, 0, 45, 0)
      leg.position.set(Math.cos(a) * 150, 60, Math.sin(a) * 150)
      leg.rotation.y = -a
      g.add(leg)
      g.add(sphere(28, mat('rubber', '#1e1e1e'), [Math.cos(a) * 290, 28, Math.sin(a) * 290], { segments: 16 }))
    }
    g.add(cyl(35, 35, 40, frame, [0, 70, 0]))
    g.add(cyl(22, 22, sh - 160, chrome, [0, 60 + (sh - 160) / 2, 0]))
    // Seat
    g.add(rbox(490, 80, 480, 35, seatM, [0, sh - 20, 20]))
    g.add(boxOn(260, 40, 240, frame, 0, sh - 100, 0))
    // Back
    const backH = back === 'high' ? 820 : 540
    const bm = back === 'mesh' ? mat('fabric', color, { roughness: 0.7, opacity: 1 }) : seatM
    const backG = new THREE.Group()
    backG.add(rbox(460, backH, 60, 40, bm, [0, backH / 2, 0]))
    if (back === 'mesh') backG.add(rbox(480, backH + 20, 30, 15, frame, [0, backH / 2, -30]))
    if (back === 'high') backG.add(rbox(300, 160, 90, 45, seatM, [0, backH - 60, 30]))
    backG.position.set(0, sh + 50, -230)
    backG.rotation.x = deg(-8)
    g.add(backG)
    g.add(boxOn(60, 160, 40, frame, 0, sh - 60, -230))
    if (arms) {
      for (const s of [-1, 1]) {
        g.add(tube([[s * 230, sh - 40, -40], [s * 250, sh + 120, -60], [s * 250, sh + 200, 40]], 14, frame))
        g.add(rbox(70, 30, 240, 14, mat('rubber', '#2b2b2b'), [s * 250, sh + 210, 30]))
      }
    }
    return g
  },
})

export const diningChair = defineAsset({
  type: 'diningChair',
  label: 'チェア',
  category: 'table',
  description: 'ダイニングチェアやスツール。座る人が正面(+Z)を向く',
  placement: 'floor',
  params: {
    style: p.select('スタイル', { wood: '木製', cafe: 'カフェ（金属）', stool: 'スツール' }, 'wood'),
    seatHeight: p.mm('座面の高さ', 380, 750, 440, { hint: 'カウンタースツールなら650前後' }),
    frameColor: p.color('フレーム', '#b8875a', { swatches: [...SWATCHES.wood, ...SWATCHES.metal] }),
    seatColor: p.color('座面', '#d9d2c5', { swatches: SWATCHES.fabric }),
  },
  build({ style, seatHeight: sh, frameColor, seatColor }) {
    const g = group()
    if (style === 'stool') {
      const w = mat('wood', frameColor)
      g.add(cyl(170, 170, 35, mat('wood', frameColor), [0, sh - 18, 0], { segments: 40 }))
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        g.add(cyl(14, 16, sh - 30, w, [Math.cos(a) * 120, (sh - 30) / 2, Math.sin(a) * 120], { rot: [Math.sin(a) * deg(-6), 0, Math.cos(a) * deg(6)] }))
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(135, 8, 8, 40), w)
      ring.rotation.x = Math.PI / 2
      ring.position.y = sh * 0.33
      ring.castShadow = true
      g.add(ring)
      return g
    }
    const isWood = style === 'wood'
    const fm = isWood ? mat('wood', frameColor) : mat('metal', frameColor, { roughness: 0.4 })
    const W = 420
    const D = 440
    const legT = isWood ? 34 : 18
    const seat = isWood ? rbox(W, 40, D, 15, mat('fabric', seatColor), [0, sh - 20, 0]) : rbox(W, 25, D, 10, mat('wood', seatColor === '#d9d2c5' ? '#b8875a' : seatColor), [0, sh - 12, 0])
    g.add(seat)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const h = sz < 0 ? sh + 400 : sh - 30
        g.add(boxOn(legT, h, legT, fm, sx * (W / 2 - legT / 2 - 5), 0, sz * (D / 2 - legT / 2 - 5)))
      }
    if (isWood) {
      g.add(boxOn(W - 20, 90, 22, fm, 0, sh + 280, -D / 2 + 22))
      g.add(boxOn(W - 20, 40, 22, fm, 0, sh + 120, -D / 2 + 22))
      for (const sz of [-1, 1]) g.add(boxOn(W - 60, 30, 20, fm, 0, sh * 0.35, sz * (D / 2 - 22)))
    } else {
      g.add(rbox(W - 10, 140, 18, 8, mat('wood', seatColor === '#d9d2c5' ? '#b8875a' : seatColor), [0, sh + 300, -D / 2 + 10]))
      for (const sx of [-1, 1]) g.add(boxOn(12, 12, D - 40, fm, sx * (W / 2 - 14), sh * 0.3, 0))
    }
    return g
  },
})
