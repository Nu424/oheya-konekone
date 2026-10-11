import * as THREE from 'three'
import { mat, printedMat, SWATCHES } from '../../three/materials'
import { drawnTexture, rng } from '../../three/textures'
import { box, boxOn, cyl, deg, group, merged, panel, panelOn, rbox, tube } from '../kit'
import { p } from '../params'
import { adjuster, caster, drawer, GAP, SEAM } from '../parts'
import { defineAsset } from '../types'

/** Office furniture and equipment. */

const TOPS = ['#f4f4f2', '#e6e3dc', '#c4c6c8', '#d2ad7c', '#b8875a', '#6b4a34', '#2a2b2e']
const FRAMES = ['#f4f4f2', '#c4c6c8', '#8e9196', '#4d5055', '#2a2b2e']

export const officeDesk = defineAsset({
  type: 'officeDesk',
  label: 'オフィスデスク',
  category: 'office',
  description: 'スチール脚の事務机（コクヨの S シリーズ風）。奥の幕板、片袖・両袖の引き出し、センター引き出しを選べる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 1000, 1800, 1200),
    depth: p.mm('奥行き', 600, 800, 700),
    height: p.mm('高さ', 700, 740, 720),
    legs: p.select('脚', { panel: 'パネル脚', frame: '4 本脚（角）', tleg: 'T 字脚' }, 'panel', { group: '形' }),
    modesty: p.select('幕板（奥のパネル）', { none: 'なし', half: '半分', full: '床まで' }, 'half', { group: '形' }),
    pedestal: p.select('袖（引き出し）', { none: 'なし', left: '左', right: '右', both: '両袖' }, 'right', { group: '形' }),
    pedDrawers: p.select('袖の段', { three: '3 段', file: '2 段（A4 ファイル）' }, 'three', { group: '形' }),
    center: p.bool('センター引き出し', true),
    edge: p.select('天板の縁', { soft: 'ソフトエッジ', square: '角', wood: '木口' }, 'soft', { group: '形' }),
    open: p.number({ label: '引き出しを開ける', min: 0, max: 1, step: 0.05, default: 0, group: '形' }),
    topColor: p.color('天板', '#e6e3dc', { swatches: TOPS }),
    frameColor: p.color('脚・袖', '#f4f4f2', { swatches: FRAMES }),
  },
  presets: [
    { name: '片袖デスク', params: {} },
    { name: '平机（引き出しなし）', params: { pedestal: 'none', center: false, modesty: 'half' } },
    { name: '両袖デスク', params: { width: 1600, pedestal: 'both' } },
    { name: '木目の天板・黒脚', params: { topColor: '#b8875a', frameColor: '#2a2b2e', legs: 'frame', edge: 'wood', modesty: 'none', pedestal: 'none' } },
  ],
  surfaces: ({ width: W, depth: D, height: H }) => [{ y: H, minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2, label: '天板' }],
  build({ width: W, depth: D, height: H, legs, modesty, pedestal, pedDrawers, center, edge, open, topColor, frameColor }) {
    const g = group()
    const steel = mat('powder', frameColor)
    const topT = 25
    const top = edge === 'wood' ? mat('wood', topColor) : mat('matte', topColor, { roughness: 0.5 })
    // Top: melamine board with an edge band (soft = rounded dark band, square = thin band).
    g.add(panelOn(W, topT, D, top, 0, H - topT, 0, { edge: edge === 'soft' ? 9 : edge === 'square' ? 1.5 : 2.5 }))
    if (edge === 'soft') g.add(panelOn(W + 1, 8, D + 1, mat('plastic', '#3a3b3e', { roughness: 0.5 }), 0, H - topT / 2 - 4, 0, { edge: 3.5 }))
    const underTop = H - topT
    const pedW = 400
    const left = pedestal === 'left' || pedestal === 'both'
    const right = pedestal === 'right' || pedestal === 'both'
    // Legs at the ends that have no pedestal.
    for (const s of [-1, 1] as const) {
      if ((s === -1 && left) || (s === 1 && right)) continue
      const x = s * (W / 2 - 30)
      if (legs === 'panel') {
        g.add(panelOn(28, underTop - 10, D - 60, steel, x, 10, 0, { edge: 4 }))
        for (const z of [-D / 2 + 60, D / 2 - 60]) g.add(adjuster(10, 14).translateX(x).translateZ(z))
      } else if (legs === 'frame') {
        for (const z of [-D / 2 + 40, D / 2 - 40]) {
          g.add(panelOn(40, underTop - 10, 40, steel, s * (W / 2 - 40), 10, z, { edge: 3 }))
          g.add(adjuster(10, 15).translateX(s * (W / 2 - 40)).translateZ(z))
        }
        g.add(panelOn(25, 50, D - 120, steel, s * (W / 2 - 40), underTop - 50, 0, { edge: 2 }))
      } else {
        g.add(panelOn(60, underTop - 40, 40, steel, x, 40, -D * 0.05, { edge: 4 }))
        g.add(panelOn(70, 40, D - 80, steel, x, 0, -D * 0.05 + 0, { edge: 6 }))
        g.add(panelOn(50, 40, D - 120, steel, x, underTop - 40, 0, { edge: 3 }))
      }
    }
    // Modesty panel at the back, between the legs / pedestals.
    if (modesty !== 'none') {
      const x0 = left ? -W / 2 + pedW : -W / 2 + 44
      const x1 = right ? W / 2 - pedW : W / 2 - 44
      const ph = modesty === 'half' ? Math.min(360, underTop * 0.5) : underTop - 100
      g.add(panelOn(x1 - x0, ph, 16, steel, (x0 + x1) / 2, underTop - ph, -D / 2 + 40, { edge: 3 }))
      // Pressed rib along the panel.
      g.add(box(x1 - x0 - 60, 3, 2, mat('matte', SEAM), [(x0 + x1) / 2, underTop - ph * 0.5, -D / 2 + 49]))
    }
    // Pedestals: a steel case hanging under the top, standing on adjusters.
    const ped = (side: -1 | 1) => {
      const x = side * (W / 2 - pedW / 2)
      const caseH = underTop - 20
      const pd = D - 40
      g.add(panelOn(pedW, caseH, pd, steel, x, 20, -20, { edge: 3 }))
      for (const sx of [-1, 1]) for (const z of [-pd / 2 + 40 - 20, pd / 2 - 40 - 20]) g.add(adjuster(20, 14).translateX(x + sx * (pedW / 2 - 40)).translateZ(z))
      const rows = pedDrawers === 'three' ? [0.27, 0.33, 0.4] : [0.3, 0.7]
      let y = 40
      const fh = caseH - 40
      rows
        .slice()
        .reverse()
        .forEach((share, i, arr) => {
          const h = fh * share
          const isTop = i === arr.length - 1
          const d = drawer(pedW - 16, h, pd - 40, { material: steel, handle: 'groove', out: isTop ? open * (pd - 60) : 0, inner: mat('powder', '#d9dbdc'), t: 14, edge: 2 })
          d.position.set(x, y, pd / 2 - 20)
          g.add(d)
          // Key cylinder in the top drawer.
          if (isTop) g.add(cyl(7, 7, 4, mat('chrome', '#cfd2d5'), [x + pedW / 2 - 50, y + h - 40, pd / 2 - 20 + 16 + (open * (pd - 60))], { rot: [Math.PI / 2, 0, 0], segments: 14 }))
          y += h
        })
      g.add(boxOn(pedW - 16, 18, pd - 30, mat('matte', SEAM), x, 22, -20))
    }
    if (left) ped(-1)
    if (right) ped(1)
    // Centre drawer under the top, between the pedestals / legs.
    if (center) {
      const x0 = left ? -W / 2 + pedW + 10 : -W / 2 + 60
      const x1 = right ? W / 2 - pedW - 10 : W / 2 - 60
      const cw = Math.min(700, (x1 - x0) * 0.8)
      const cx = (x0 + x1) / 2
      const ch = 70
      // Housing under the top; the drawer front sits 100 mm behind the front edge (knee room).
      g.add(boxOn(cw + 20, ch + 6, D - 120, steel, cx, underTop - ch - 6, -40))
      const d = drawer(cw, ch, D - 160, { material: steel, handle: 'groove', out: open * (D - 200), inner: mat('powder', '#d9dbdc'), t: 14, edge: 2 })
      d.position.set(cx, underTop - ch - 3, D / 2 - 100)
      g.add(d)
    }
    return g
  },
})

export const foldingChair = defineAsset({
  type: 'foldingChair',
  label: '折りたたみ・ミーティングチェア',
  category: 'office',
  description: 'パイプ椅子（折りたためる）、ミーティングチェア（座面を跳ね上げて重ねられる、キャスター付きにもできる）、スタッキングチェア',
  placement: 'floor',
  surfaces: () => [],
  params: {
    style: p.select('種類', { pipe: 'パイプ椅子', meeting: 'ミーティングチェア', stacking: 'スタッキングチェア' }, 'pipe', { group: '形' }),
    folded: p.bool('たたむ（跳ね上げる）', false, { hint: 'パイプ椅子は折りたたみ、ミーティングチェアは座面の跳ね上げ' }),
    casters: p.bool('キャスター', false),
    arms: p.bool('ひじ掛け', false),
    back: p.select('背もたれ', { plastic: '樹脂', mesh: 'メッシュ', cushion: 'クッション' }, 'cushion', { group: '形' }),
    seatColor: p.color('座面', '#3d4a5c', { swatches: ['#3d4a5c', '#2b2b2e', '#8e9196', '#c5687a', '#e8c76a', '#9fb5a5', '#f4f4f2', '#8f5f3d'] }),
    frame: p.select('フレーム', { chrome: 'クロム', black: 'ブラック', white: 'ホワイト', silver: 'シルバー' }, 'chrome', { group: '色・素材' }),
  },
  presets: [
    { name: 'パイプ椅子', params: {} },
    { name: 'たたんだパイプ椅子', params: { folded: true } },
    { name: 'ミーティングチェア', params: { style: 'meeting', casters: true, back: 'mesh', seatColor: '#2b2b2e', frame: 'silver' } },
    { name: '跳ね上げて重ねる', params: { style: 'meeting', folded: true, casters: true, back: 'plastic', seatColor: '#f4f4f2', frame: 'silver' } },
    { name: 'カフェ風スタッキング', params: { style: 'stacking', back: 'plastic', seatColor: '#9fb5a5', frame: 'black' } },
  ],
  body: ({ style, folded, casters }) => {
    if (style === 'pipe' && folded) return { min: { x: -230, y: 0, z: -60 }, max: { x: 230, y: 920, z: 60 } }
    if (style === 'meeting' && folded) return { min: { x: -280, y: 0, z: -270 }, max: { x: 280, y: 860, z: 120 } }
    const r = casters && style === 'meeting' ? 300 : 250
    return { min: { x: -r + 20, y: 0, z: -r }, max: { x: r - 20, y: 860, z: r } }
  },
  build({ style, folded, casters, arms, back, seatColor, frame }) {
    const g = group()
    const metal = frame === 'chrome' ? mat('chrome', '#d9dcdf', { roughness: 0.12 }) : frame === 'silver' ? mat('aluminum', '#c9ccd0') : mat('powder', frame === 'black' ? '#262729' : '#f1f1ef')
    const seatM = back === 'plastic' && style !== 'pipe' ? mat('plastic', seatColor, { roughness: 0.4 }) : mat('fabric', seatColor)
    const shellM = mat('plastic', seatColor, { roughness: 0.4 })
    const r = 11
    if (style === 'pipe') {
      if (folded) {
        // Folded flat: the two frames lie together, the seat stands between them.
        for (const s of [-1, 1]) {
          g.add(tube([[s * 200, 0, -20], [s * 200, 900, -20]], r, metal, { segments: 4 }))
          g.add(tube([[s * 185, 0, 22], [s * 185, 780, 22]], r, metal, { segments: 4 }))
        }
        g.add(tube([[-200, 900, -20], [200, 900, -20]], r, metal, { segments: 4 }))
        g.add(tube([[-185, 40, 22], [185, 40, 22]], r * 0.8, metal, { segments: 4 }))
        g.add(rbox(380, 400, 40, 14, seatM, [0, 520, 0]))
        g.add(rbox(370, 180, 26, 10, seatM, [0, 760, -30]))
        for (const s of [-1, 1]) g.add(cyl(13, 13, 14, mat('rubber', '#2a2a2a'), [s * 200, 7, -20], { segments: 10 }))
        return g
      }
      // Two crossing side frames: back post rising into the backrest, front leg up to the seat.
      for (const s of [-1, 1]) {
        g.add(tube([[s * 205, 0, -250], [s * 205, 430, -175], [s * 210, 900, -205]], r, metal, { segments: 24, tension: 0.2 }))
        g.add(tube([[s * 195, 0, 240], [s * 195, 430, 150], [s * 195, 440, -120]], r, metal, { segments: 24, tension: 0.2 }))
        g.add(cyl(13, 13, 14, mat('rubber', '#2a2a2a'), [s * 205, 7, -250], { segments: 10 }))
        g.add(cyl(13, 13, 14, mat('rubber', '#2a2a2a'), [s * 195, 7, 240], { segments: 10 }))
      }
      g.add(tube([[-195, 60, 228], [195, 60, 228]], r * 0.8, metal, { segments: 4 }))
      g.add(tube([[-205, 60, -238], [205, 60, -238]], r * 0.8, metal, { segments: 4 }))
      g.add(rbox(400, 45, 390, 16, seatM, [0, 462, 10]))
      const pad = rbox(390, 190, 30, 12, seatM, [0, 0, 0])
      pad.position.set(0, 790, -205)
      pad.rotation.x = deg(-6)
      g.add(pad)
      return g
    }
    // Meeting / stacking chairs: a moulded seat and back on a steel frame.
    const seatY = 440
    const nest = style === 'meeting' && folded
    const seat = new THREE.Group()
    seat.add(rbox(470, 30, 440, 14, shellM, [0, 0, 220]))
    if (back !== 'plastic') seat.add(rbox(450, 34, 410, 14, seatM, [0, 26, 225]))
    // Seat hinged at its back edge so it can flip up for nesting.
    seat.position.set(0, seatY, -230)
    seat.rotation.x = nest ? -deg(84) : 0
    g.add(seat)
    const backG = new THREE.Group()
    const bh = 380
    if (back === 'mesh') {
      backG.add(tube([[-220, 0, 0], [-225, bh, -10], [225, bh, -10], [220, 0, 0]], 9, mat('plastic', '#26262a'), { segments: 30, tension: 0.2 }))
      backG.add(boxOn(430, bh - 20, 4, mat('fabric', seatColor === '#f4f4f2' ? '#3a3b3e' : seatColor, { roughness: 0.95 }), 0, 10, -4))
    } else backG.add(rbox(450, bh, 24, 12, back === 'plastic' ? shellM : seatM, [0, bh / 2, 0]))
    backG.position.set(0, seatY + 90, -230)
    backG.rotation.x = deg(-10)
    g.add(backG)
    // Frame: a post from the seat to the back, and legs.
    for (const s of [-1, 1]) g.add(tube([[s * 200, seatY - 20, -200], [s * 205, seatY + 120, -238]], 10, metal, { segments: 6 }))
    if (casters && style === 'meeting') {
      // Four legs on twin-wheel casters.
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        g.add(tube([[sx * 190, seatY - 15, sz * 170], [sx * 240, 70, sz * 240]], 12, metal, { segments: 6 }))
        const c = caster(60, { turn: deg(sx * 30 + sz * 60) })
        c.position.set(sx * 240, 0, sz * 240)
        g.add(c)
      }
      for (const s of [-1, 1]) g.add(panelOn(24, 20, 380, metal, s * 190, seatY - 40, -10, { edge: 3 }))
    } else {
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        g.add(tube([[sx * 195, seatY - 15, sz * 170], [sx * 220, 0, sz * 215]], 11, metal, { segments: 6 }))
        g.add(cyl(12, 12, 8, mat('plastic', '#2a2a2a'), [sx * 220, 4, sz * 215], { segments: 10 }))
      }
      for (const s of [-1, 1]) g.add(panelOn(24, 18, 360, metal, s * 190, seatY - 34, -10, { edge: 3 }))
    }
    // Cross bars tie the legs together under the seat (visible when the seat is flipped up).
    for (const z of [-170, 170]) g.add(tube([[-195, seatY - 15, z], [195, seatY - 15, z]], 9, metal, { segments: 4 }))
    if (arms) {
      for (const s of [-1, 1]) {
        g.add(tube([[s * 240, seatY, -200], [s * 250, seatY + 200, -180], [s * 250, seatY + 210, 120], [s * 240, seatY, 160]], 10, metal, { segments: 30, tension: 0.15 }))
        g.add(rbox(50, 18, 250, 8, mat('plastic', '#26262a'), [s * 250, seatY + 214, -20]))
      }
    }
    return g
  },
})

export const partition = defineAsset({
  type: 'partition',
  label: 'パーテーション',
  category: 'office',
  description: '自立式のついたて・間仕切り。布・アクリル・木・ホワイトボードの面、フレームと脚を選べる。何枚かつなげられる',
  placement: 'floor',
  surfaces: () => [],
  params: {
    width: p.mm('1 枚の幅', 400, 1800, 1200),
    height: p.mm('高さ', 900, 1800, 1500),
    panels: p.number({ label: '枚数', min: 1, max: 4, step: 1, default: 1, group: '形' }),
    face: p.select('面', { fabric: '布', clear: 'アクリル（透明）', frosted: 'アクリル（すりガラス）', wood: '木', board: 'ホワイトボード', perforated: '有孔ボード' }, 'fabric', { group: '形' }),
    topClear: p.bool('上だけ透明', false, { hint: '上 300mm を透明なアクリルにする' }),
    frame: p.select('フレーム', { aluminum: 'アルミ', wood: '木', black: '黒', none: 'なし' }, 'aluminum', { group: '形' }),
    feet: p.select('脚', { tleg: 'T 字脚', base: '平たい台', casters: 'キャスター' }, 'tleg', { group: '形' }),
    color: p.color('面の色', '#8c9aa8', { swatches: ['#8c9aa8', '#4d5055', '#c4c6c8', '#9fb5a5', '#d9cbb4', '#3d5a80', '#c5687a', ...SWATCHES.wood.slice(0, 4)] }),
  },
  presets: [
    { name: '布のパーテーション', params: {} },
    { name: '飛沫防止アクリル', params: { width: 800, height: 900, face: 'clear', frame: 'none', feet: 'base' } },
    { name: '上だけ透明', params: { topClear: true, height: 1800, color: '#4d5055' } },
    { name: '木の衝立', params: { face: 'wood', frame: 'wood', color: '#b8875a', feet: 'base', height: 1200 } },
    { name: '3 枚つなげる', params: { panels: 3, width: 900 } },
  ],
  build({ width: W, height: H, panels, face, topClear, frame, feet, color }) {
    const g = group()
    const n = Math.round(panels)
    const total = W * n
    const fw = frame === 'none' ? 0 : 30
    const frameM = frame === 'wood' ? mat('wood', '#b8875a') : frame === 'black' ? mat('powder', '#26262a') : mat('aluminum', '#c9ccd0')
    const footH = feet === 'casters' ? 60 : 0
    const bottom = footH + (feet === 'base' ? 20 : 30)
    const faceM =
      face === 'clear' ? mat('acrylic', '#e8f3f5', { opacity: 0.18, roughness: 0.02 }) : face === 'frosted' ? mat('acrylic', '#eef3f4', { opacity: 0.6, roughness: 0.45 }) : face === 'wood' ? mat('wood', color) : face === 'board' ? mat('gloss', '#fbfbfa') : face === 'perforated' ? mat('matte', color) : mat('fabric', color)
    const clearM = mat('acrylic', '#e8f3f5', { opacity: 0.18, roughness: 0.02 })
    const faceT = face === 'clear' || face === 'frosted' ? 5 : 22
    for (let i = 0; i < n; i++) {
      const cx = -total / 2 + W * (i + 0.5)
      const ph = H - bottom
      const clearH = topClear ? 300 : 0
      // Face (and the clear top band), inside the frame.
      g.add(panelOn(W - fw * 2, ph - clearH - fw * 2 + (fw ? 0 : 0), faceT, faceM, cx, bottom + fw, 0, { edge: faceT > 10 ? 3 : 1 }))
      if (topClear) g.add(panelOn(W - fw * 2, clearH - fw, 5, clearM, cx, bottom + ph - clearH, 0, { edge: 1 }))
      if (face === 'perforated') {
        // Rows of holes as dark dots on both faces.
        const dots: THREE.Mesh[] = []
        for (let y = bottom + fw + 40; y < bottom + ph - clearH - fw - 30; y += 50)
          for (let x = cx - W / 2 + fw + 40; x < cx + W / 2 - fw - 30; x += 50) for (const z of [-11.4, 11.4]) dots.push(cyl(4, 4, 0.5, mat('matte', SEAM), [x, y, z], { rot: [Math.PI / 2, 0, 0], segments: 8 }))
        g.add(merged(dots, mat('matte', SEAM), { castShadow: false }))
      }
      if (fw) {
        g.add(panelOn(W, fw, 40, frameM, cx, bottom + ph - fw, 0, { edge: 4 }))
        g.add(panelOn(W, fw, 40, frameM, cx, bottom, 0, { edge: 4 }))
        if (topClear) g.add(panelOn(W - fw * 2, 20, 30, frameM, cx, bottom + ph - clearH - 10, 0, { edge: 3 }))
        for (const s of [-1, 1]) g.add(panelOn(fw, ph, 40, frameM, cx + s * (W / 2 - fw / 2), bottom, 0, { edge: 4 }))
      }
    }
    // Feet at both ends and at every joint.
    const footM = frame === 'wood' ? mat('wood', '#b8875a') : mat('powder', frame === 'black' ? '#26262a' : '#8e9196')
    for (let i = 0; i <= n; i++) {
      const x = -total / 2 + W * i + (i === 0 ? 40 : i === n ? -40 : 0)
      if (feet === 'tleg') {
        g.add(panelOn(60, 30, 500, footM, x, 0, 0, { edge: 8 }))
        g.add(panelOn(30, bottom, 40, footM, x, 0, 0, { edge: 3 }))
      } else if (feet === 'base') {
        g.add(panelOn(Math.min(260, W * 0.4), 20, 300, footM, x + (i === 0 ? 60 : i === n ? -60 : 0), 0, 0, { edge: 6 }))
      } else {
        g.add(panelOn(60, 30, 460, footM, x, footH, 0, { edge: 8 }))
        for (const z of [-200, 200]) {
          const c = caster(footH, { turn: deg(z) })
          c.position.set(x, 0, z)
          g.add(c)
        }
      }
    }
    return g
  },
})

/** Printed paper tray contents, the paper coming out. */
function paperSheet(w: number, d: number) {
  return boxOn(w, 1.5, d, mat('paper', '#fbfbf8'), 0, 0, 0)
}

export const printer = defineAsset({
  type: 'printer',
  label: 'プリンター',
  category: 'office',
  description: '家庭用のインクジェット複合機、または A4 レーザープリンター。机や棚に置く（大きなオフィス用は「オフィス複合機」）',
  placement: 'onTop',
  params: {
    kind: p.select('種類', { inkjet: 'インクジェット複合機', laser: 'A4 レーザー' }, 'inkjet', { group: '形' }),
    lid: p.bool('スキャナーのフタを開ける', false),
    paper: p.bool('印刷した紙', true),
    color: p.color('本体', '#f4f4f2', { swatches: ['#f4f4f2', '#2b2b2e', '#4d5055', '#e6e3dc'] }),
  },
  surfaces: ({ kind }) => (kind === 'laser' ? [{ y: 260, minX: -150, maxX: 150, minZ: -150, maxZ: 60, label: '天面' }] : []),
  build({ kind, lid, paper, color }) {
    const g = group()
    const body = mat('plastic', color, { roughness: 0.42 })
    const dark = mat('plastic', color === '#2b2b2e' ? '#1a1a1c' : '#3a3b3e', { roughness: 0.35 })
    if (kind === 'inkjet') {
      const W = 440
      const D = 340
      const H = 150
      g.add(panelOn(W, H - 20, D, body, 0, 0, 0, { edge: 8 }))
      // Scanner lid hinged at the back, a glass bed under it.
      g.add(boxOn(W - 60, 2, D - 70, mat('glass', '#26313a', { opacity: 0.8 }), 0, H - 21, -5))
      const lidG = new THREE.Group()
      lidG.add(panelOn(W - 10, 20, D - 20, body, 0, 0, D / 2 - 10, { edge: 6 }))
      lidG.position.set(0, H - 20, -D / 2 + 10)
      lidG.rotation.x = lid ? -deg(70) : 0
      g.add(lidG)
      // Tilted control panel and the output tray at the front.
      const ctrl = panel(160, 50, 10, dark, [W / 2 - 120, H - 50, D / 2 + 2], { edge: 3 })
      ctrl.rotation.x = deg(-30)
      g.add(ctrl)
      g.add(box(60, 30, 1, mat('screen', '#0c0f12'), [W / 2 - 130, H - 48, D / 2 + 8]))
      g.add(boxOn(W - 140, 4, 120, dark, -40, 40, D / 2 + 55))
      g.add(boxOn(W - 120, 24, 3, mat('matte', SEAM), -40, 50, D / 2 + 0.5))
      if (paper) {
        const s = paperSheet(210, 220)
        s.position.set(-40, 44, D / 2 + 30)
        s.rotation.x = deg(-3)
        g.add(s)
      }
      return g
    }
    // A4 laser: a taller box with a recessed output well on top.
    const W = 380
    const D = 400
    const H = 260
    g.add(panelOn(W, H, D, body, 0, 0, 0, { edge: 10 }))
    g.add(panelOn(W - 80, 4, D * 0.45, dark, 0, H - 30, 40, { edge: 2 }))
    g.add(panelOn(W - 30, 70, 16, body, 0, 20, D / 2 + 4, { edge: 4 })) // paper cassette
    g.add(boxOn(W - 70, 8, 2, mat('matte', SEAM), 0, 60, D / 2 + 12.5))
    g.add(panel(110, 40, 8, dark, [W / 2 - 80, H - 20, D / 2 - 10], { edge: 3 }))
    g.add(cyl(5, 5, 2, mat('emissive', '#7fd6a8', { intensity: 1.2 }), [W / 2 - 50, H - 2, D / 2 - 30], { segments: 12 }))
    if (paper) {
      const s = paperSheet(210, 260)
      s.position.set(0, H - 25, 50)
      s.rotation.x = deg(8)
      g.add(s)
    }
    void lid
    return g
  },
})

export const copier = defineAsset({
  type: 'copier',
  label: 'オフィス複合機',
  category: 'office',
  description: '床置きの大型複合機（コピー・プリント・スキャン）。給紙トレイの段数を変えられる',
  placement: 'floor',
  params: {
    trays: p.number({ label: '給紙トレイ', min: 1, max: 4, step: 1, default: 3, group: '形' }),
    finisher: p.bool('フィニッシャー（横の排紙ユニット）', false),
    color: p.color('本体', '#f2f2f0', { swatches: ['#f2f2f0', '#e6e3dc', '#c4c6c8'] }),
  },
  surfaces: () => [],
  build({ trays, finisher, color }) {
    const g = group()
    const body = mat('plastic', color, { roughness: 0.4 })
    const dark = mat('plastic', '#3a3b3e', { roughness: 0.35 })
    const W = 590
    const D = 660
    const n = Math.round(trays)
    const trayH = 130
    const baseH = 80
    // Stand on casters, then the trays, the engine, the scanner and the document feeder.
    g.add(panelOn(W - 20, baseH, D - 40, mat('plastic', '#d9dad8'), 0, 0, 0, { edge: 6 }))
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = caster(40, { turn: deg(sx * 20 + sz * 50) })
      c.position.set(sx * (W / 2 - 60), 0, sz * (D / 2 - 70))
      g.add(c)
    }
    let y = baseH
    for (let i = 0; i < n; i++) {
      g.add(panelOn(W, trayH - GAP, D, body, 0, y, 0, { edge: 6 }))
      g.add(panelOn(W - 120, 22, 8, dark, 0, y + trayH * 0.55, D / 2 + 2, { edge: 4 })) // handle slot
      y += trayH
    }
    const engineH = 360
    g.add(panelOn(W, engineH, D, body, 0, y, 0, { edge: 8 }))
    g.add(boxOn(W - 40, 4, 2, mat('matte', SEAM), 0, y + engineH * 0.35, D / 2 + 0.5))
    // Output space (a recess between the engine and the scanner) with a printed sheet.
    const gapH = 110
    g.add(boxOn(W - 160, gapH, D - 120, mat('matte', '#c8c9c7'), -60, y + engineH, 20))
    g.add(boxOn(210, 2, 290, mat('paper', '#fbfbf8'), -60, y + engineH + 6, 60))
    g.add(panelOn(140, gapH, D, body, W / 2 - 70, y + engineH, 0, { edge: 6 }))
    y += engineH + gapH
    g.add(panelOn(W, 90, D, body, 0, y, 0, { edge: 8 }))
    // Document feeder on top and the touch panel on an arm at the front right.
    g.add(panelOn(W - 60, 90, D - 120, body, -10, y + 90, -20, { edge: 10 }))
    g.add(panelOn(W - 220, 6, D - 260, dark, -30, y + 180, -20, { edge: 2 }))
    const ui = panel(260, 170, 24, dark, [0, 0, 0], { edge: 6 })
    ui.position.set(W / 2 - 150, y + 60, D / 2 + 60)
    ui.rotation.x = deg(-55)
    g.add(ui)
    const scr = box(200, 120, 1, mat('screen', '#0e1a24'), [0, 0, 0])
    scr.position.set(W / 2 - 150, y + 66, D / 2 + 70)
    scr.rotation.x = deg(-55)
    g.add(scr)
    if (finisher) {
      g.add(panelOn(420, 900, D - 60, body, W / 2 + 215, 0, 0, { edge: 8 }))
      for (const yy of [500, 700]) g.add(panelOn(300, 10, 300, mat('plastic', '#cfd0ce'), W / 2 + 470, yy, 0, { edge: 2 }))
    }
    return g
  },
})

type Scribble = 'none' | 'meeting' | 'plan' | 'todo'

function scribbleTexture(kind: Exclude<Scribble, 'none'>) {
  return drawnTexture(`board-${kind}`, 768, 512, (ctx, w, h) => {
    ctx.fillStyle = '#fbfbfa'
    ctx.fillRect(0, 0, w, h)
    const r = rng(kind.length * 97)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const pen = (c: string, lw = 4) => {
      ctx.strokeStyle = c
      ctx.fillStyle = c
      ctx.lineWidth = lw
    }
    const scrawl = (x: number, y: number, len: number) => {
      // Handwriting-like wiggle.
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let t = 0; t < len; t += 6) ctx.lineTo(x + t, y + Math.sin(t * 0.35 + r() * 2) * 4 + (r() - 0.5) * 3)
      ctx.stroke()
    }
    if (kind === 'meeting') {
      pen('#1d3f8f', 5)
      scrawl(40, 50, 260)
      pen('#20242a', 4)
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.arc(52, 110 + i * 52, 5, 0, Math.PI * 2)
        ctx.fill()
        scrawl(70, 110 + i * 52, 160 + r() * 200)
      }
      pen('#c4372f', 5)
      ctx.beginPath()
      ctx.ellipse(560, 210, 140, 90, 0.05, 0, Math.PI * 2)
      ctx.stroke()
      scrawl(470, 210, 170)
      pen('#2f7d4f', 4)
      ctx.beginPath()
      ctx.moveTo(420, 380)
      ctx.lineTo(500, 300)
      ctx.lineTo(480, 312)
      ctx.moveTo(500, 300)
      ctx.lineTo(488, 322)
      ctx.stroke()
    } else if (kind === 'plan') {
      pen('#20242a', 5)
      ctx.strokeRect(120, 70, 520, 360)
      ctx.beginPath()
      ctx.moveTo(380, 70)
      ctx.lineTo(380, 260)
      ctx.moveTo(120, 260)
      ctx.lineTo(300, 260)
      ctx.stroke()
      pen('#1d3f8f', 4)
      ctx.strokeRect(150, 100, 150, 110)
      ctx.strokeRect(420, 300, 170, 80)
      ctx.beginPath()
      ctx.arc(520, 160, 50, 0, Math.PI * 2)
      ctx.stroke()
      pen('#c4372f', 4)
      scrawl(160, 470, 220)
      ctx.beginPath()
      ctx.arc(380, 260, 70, -Math.PI / 2, 0)
      ctx.stroke()
    } else {
      pen('#20242a', 5)
      scrawl(40, 50, 140)
      for (let i = 0; i < 7; i++) {
        pen('#20242a', 3)
        ctx.strokeRect(46, 92 + i * 56, 26, 26)
        if (i < 3) {
          pen('#2f7d4f', 5)
          ctx.beginPath()
          ctx.moveTo(50, 104 + i * 56)
          ctx.lineTo(58, 114 + i * 56)
          ctx.lineTo(74, 90 + i * 56)
          ctx.stroke()
        }
        pen(i < 3 ? '#8e9196' : '#1d3f8f', 4)
        scrawl(90, 106 + i * 56, 150 + r() * 220)
      }
      // Sticky notes.
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = ['#ffe680', '#ffb3c7', '#a8e6cf', '#9bd0ff', '#ffe680'][i]
        const x = 470 + (i % 2) * 130
        const y = 70 + Math.floor(i / 2) * 140
        ctx.fillRect(x, y, 110, 110)
        pen('#20242a', 3)
        scrawl(x + 14, y + 40, 70)
        scrawl(x + 14, y + 70, 50)
      }
    }
  })
}

export const whiteboard = defineAsset({
  type: 'whiteboard',
  label: 'ホワイトボード',
  category: 'office',
  description: '脚付き・キャスター付きの移動式ホワイトボード。板の大きさと、書いてある内容を選べる',
  placement: 'floor',
  surfaces: () => [],
  params: {
    width: p.mm('板の幅', 900, 1800, 1200),
    height: p.mm('板の高さ', 600, 1200, 900),
    content: p.select('書いてあること', { none: 'まっさら', meeting: '会議メモ', plan: '間取りの落書き', todo: 'やることリスト' }, 'meeting', { group: '形' }),
    tilt: p.number({ label: '板の角度', min: -30, max: 30, step: 5, default: 0, unit: '°', group: '形', hint: '回転式の板を傾ける' }),
    casters: p.bool('キャスター', true),
    frameColor: p.color('フレーム', '#c9ccd0', { swatches: ['#c9ccd0', '#2a2b2e', '#f4f4f2'] }),
  },
  presets: [
    { name: '会議用', params: {} },
    { name: '大きいボード', params: { width: 1800, height: 1200, content: 'todo' } },
    { name: '小さめ・黒フレーム', params: { width: 900, height: 600, content: 'plan', frameColor: '#2a2b2e' } },
  ],
  build({ width: W, height: H, content, tilt, casters, frameColor }) {
    const g = group()
    const alu = frameColor === '#c9ccd0' ? mat('aluminum', frameColor) : mat('powder', frameColor)
    const footH = casters ? 70 : 20
    const total = 1800
    const centerY = Math.min(total - H / 2 - 60, 1150)
    // Two side stands: a foot bar along Z and an upright post.
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 40)
      g.add(panelOn(50, 35, 560, alu, x, footH, 0, { edge: 8 }))
      g.add(panelOn(40, total - footH - 35, 30, alu, x, footH + 35, 0, { edge: 4 }))
      for (const z of [-250, 250]) {
        if (casters) {
          const c = caster(footH, { turn: deg(s * 30 + z / 10), lock: z > 0 })
          c.position.set(x, 0, z)
          g.add(c)
        } else g.add(adjuster(footH, 15).translateX(x).translateZ(z))
      }
      g.add(cyl(14, 14, 20, mat('plastic', '#26262a'), [s * (W / 2 + 20), centerY, 0], { rot: [0, 0, Math.PI / 2], segments: 16 })) // pivot knob
    }
    // The board on a pivot between the posts.
    const board = new THREE.Group()
    board.add(panelOn(W, H, 18, alu, 0, -H / 2, 0, { edge: 4 }))
    const faceM = content === 'none' ? mat('gloss', '#fbfbfa') : printedMat(`board-${content}`, scribbleTexture(content as Exclude<Scribble, 'none'>), 'gloss')
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 40, H - 40), faceM)
    faceMesh.position.z = 9.2
    board.add(faceMesh)
    const backFace = new THREE.Mesh(new THREE.PlaneGeometry(W - 40, H - 40), mat('gloss', '#fbfbfa'))
    backFace.position.z = -9.2
    backFace.rotation.y = Math.PI
    board.add(backFace)
    // Marker tray with a few markers and an eraser.
    board.add(panelOn(W * 0.6, 10, 70, alu, 0, -H / 2 - 10, 40, { edge: 3 }))
    board.add(panelOn(W * 0.6, 24, 4, alu, 0, -H / 2 - 10, 74, { edge: 1.5 }))
    ;['#20242a', '#c4372f', '#1d3f8f'].forEach((c, i) => {
      board.add(cyl(9, 9, 125, mat('plastic', c, { roughness: 0.4 }), [-W * 0.2 + i * 40, -H / 2 + 9, 40], { rot: [0, 0, Math.PI / 2], segments: 12 }))
    })
    board.add(panelOn(130, 30, 50, mat('fabric', '#3a3b3e'), W * 0.15, -H / 2, 40, { edge: 6 }))
    board.position.y = centerY
    board.rotation.x = deg(tilt)
    g.add(board)
    return g
  },
})
