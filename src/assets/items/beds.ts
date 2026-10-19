import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { cyl, group, panelOn, rbox } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

const MATTRESS_W = { single: 970, semiDouble: 1200, double: 1400, queen: 1600 } as const

/** Duvet that drapes over the mattress: a soft slab plus a folded-back band at the head end. */
function duvet(width: number, length: number, topY: number, thickness: number, color: string) {
  const fab = mat('fabric', color)
  const g = new THREE.Group()
  const drop = Math.min(thickness + 40, 260)
  // Main body: wider than the mattress and extending down the sides.
  g.add(rbox(width + 90, drop + 50, length, 45, fab, [0, topY + 50 - (drop + 50) / 2, 0], { grain: 'z' }))
  // Folded band
  g.add(rbox(width + 96, 70, 180, 35, fab, [0, topY + 70, -length / 2 + 90], { grain: 'x' }))
  return g
}

/** Mattress, pillows and duvet on a deck at `deck` (mm). Returns the height of the mattress top. */
function bedding(g: THREE.Group, o: { mw: number; length: number; deck: number; mattress: number; sheetColor: string; beddingColor: string; duvet: boolean }) {
  const { mw, length, deck, mattress: mt } = o
  const sheet = mat('fabric', o.sheetColor)
  g.add(rbox(mw, mt, length, Math.min(50, mt / 2 - 1), sheet, [0, deck + mt / 2, 0], { grain: 'z' }))
  const top = deck + mt
  const pillows = mw >= 1400 ? 2 : 1
  const pw = Math.min(630, mw / pillows - 60)
  for (let i = 0; i < pillows; i++) {
    const x = pillows === 1 ? 0 : (i - 0.5) * (pw + 30)
    g.add(rbox(pw, 120, 420, 55, sheet, [x, top + 50, -length / 2 + 260], { grain: 'x' }))
  }
  if (o.duvet) {
    const dl = length * 0.74
    const d = duvet(mw, dl, top, mt, o.beddingColor)
    d.position.z = length / 2 - dl / 2 + 30
    g.add(d)
  }
  return top
}

export const bed = defineAsset({
  type: 'bed',
  label: 'ベッド',
  category: 'bed',
  description: 'ベッド。サイズ（シングル〜クイーン）、フレームの種類、脚の高さ、ヘッドボードの有無、寝具の色を変えられる。足元が正面(+Z)、頭側が背面',
  placement: 'floor',
  // Nothing is meant to stand on it.
  surfaces: () => [],
  params: {
    size: p.select('サイズ', { single: 'シングル', semiDouble: 'セミダブル', double: 'ダブル', queen: 'クイーン' }, 'single', { group: 'サイズ' }),
    length: p.mm('長さ', 1950, 2150, 1950, { hint: 'マットレスの長さ。フレームはこれより少し長くなる' }),
    frame: p.select('フレーム', { wood: '木製・脚つき', steel: 'スチール', storage: '収納付き', low: 'ローベッド', none: 'マットレスのみ' }, 'wood'),
    legHeight: p.mm('脚の高さ', 0, 400, 180, { group: '形', hint: '木製・スチールのときに有効。高いと下に収納ケースが入る' }),
    headboard: p.select('ヘッドボード', { none: 'なし', panel: 'パネル', shelf: '棚付き' }, 'panel'),
    mattress: p.mm('マットレス厚', 100, 300, 200),
    frameColor: p.color('フレーム', '#b8875a', { swatches: SWATCHES.wood }),
    beddingColor: p.color('掛け布団', '#c9d6df', { swatches: SWATCHES.fabric }),
    sheetColor: p.color('シーツ・枕', '#f4f1ec', { swatches: SWATCHES.fabric }),
    duvet: p.bool('掛け布団', true),
  },
  presets: [
    { name: 'シングル・木製', params: { size: 'single', frame: 'wood' } },
    { name: 'セミダブル・収納付き', params: { size: 'semiDouble', frame: 'storage', frameColor: '#f1ece4', beddingColor: '#c9d6df' } },
    { name: 'ローベッド', params: { size: 'semiDouble', frame: 'low', headboard: 'none', frameColor: '#6b4a34', beddingColor: '#9fb59a' } },
    { name: 'アイアン', params: { frame: 'steel', legHeight: 300, frameColor: '#2b2b2b', beddingColor: '#d8a48f' } },
  ],
  build({ size, length, frame, legHeight, headboard, mattress: mt, frameColor, beddingColor, sheetColor, duvet: hasDuvet }) {
    const mw = MATTRESS_W[size]
    const ft = frame === 'none' ? 0 : 30 // frame side thickness
    const W = mw + ft * 2
    const L = length + ft * 2
    const wood = frame === 'steel' ? mat('metal', frameColor, { roughness: 0.45 }) : mat('wood', frameColor)
    const g = group()

    // Deck height (top of the slats the mattress rests on)
    let deck = 0
    if (frame === 'wood' || frame === 'steel') deck = legHeight + 120
    if (frame === 'storage') deck = 330
    if (frame === 'low') deck = 140

    if (frame === 'wood') {
      const railH = 160
      const ry = deck - railH + 60
      g.add(panelOn(ft, railH, L, wood, -W / 2 + ft / 2, ry, 0, { grain: 'z' }))
      g.add(panelOn(ft, railH, L, wood, W / 2 - ft / 2, ry, 0, { grain: 'z' }))
      g.add(panelOn(W, railH, ft, wood, 0, ry, L / 2 - ft / 2))
      g.add(panelOn(W, railH, ft, wood, 0, ry, -L / 2 + ft / 2))
      if (legHeight > 0) {
        const lh = ry
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) g.add(panelOn(60, lh, 60, wood, sx * (W / 2 - 30), 0, sz * (L / 2 - 30), { grain: 'y' }))
        if (mw >= 1400) for (const sz of [-1, 1]) g.add(panelOn(60, lh, 60, wood, 0, 0, sz * (L / 2 - 30)))
      }
    } else if (frame === 'steel') {
      const r = 14
      const top = deck - 20
      for (const sx of [-1, 1]) {
        g.add(cyl(r, r, L, wood, [sx * (W / 2 - r), top, 0], { rot: [Math.PI / 2, 0, 0] }))
        for (const sz of [-1, 1]) g.add(cyl(r, r, top, wood, [sx * (W / 2 - r), top / 2, sz * (L / 2 - r)]))
      }
      for (const sz of [-1, 1]) g.add(cyl(r, r, W, wood, [0, top, sz * (L / 2 - r)], { rot: [0, 0, Math.PI / 2] }))
      // Footboard bars
      for (let i = 0; i < 5; i++) {
        const x = -W / 2 + r + ((W - 2 * r) / 4) * i
        g.add(cyl(8, 8, 260, wood, [x, top + 130, L / 2 - r]))
      }
      g.add(cyl(r, r, W, wood, [0, top + 260, L / 2 - r], { rot: [0, 0, Math.PI / 2] }))
    } else if (frame === 'storage' || frame === 'low') {
      g.add(panelOn(W, deck, L, wood, 0, 0, 0, { grain: 'z' }))
      if (frame === 'storage') {
        // Two drawers on the +X side
        const dl = (L - 200) / 2 - 20
        const front = mat('wood', frameColor, { roughness: 0.5 })
        for (const i of [0, 1]) {
          const z = L / 2 - 100 - dl / 2 - i * (dl + 20)
          g.add(panelOn(16, deck - 80, dl, front, W / 2 + 6, 30, z))
          g.add(panelOn(10, 22, 160, mat('metal', '#a7aaae'), W / 2 + 18, deck - 120, z))
        }
        g.add(panelOn(W - 20, 30, L - 20, mat('matte', '#2b2420'), 0, 0, 0)) // plinth shadow gap
      }
    }

    const top = bedding(g, { mw, length, deck, mattress: mt, sheetColor, beddingColor, duvet: hasDuvet })

    // Headboard
    if (headboard !== 'none' && frame === 'steel') {
      // Iron bars headboard
      const hbH = top + 420
      const z = -L / 2 + 14
      for (const sx of [-1, 1]) g.add(cyl(14, 14, hbH, wood, [sx * (W / 2 - 14), hbH / 2, z]))
      g.add(cyl(14, 14, W, wood, [0, hbH, z], { rot: [0, 0, Math.PI / 2] }))
      g.add(cyl(12, 12, W, wood, [0, top + 60, z], { rot: [0, 0, Math.PI / 2] }))
      const n = Math.round(W / 140)
      for (let i = 1; i < n; i++) g.add(cyl(7, 7, hbH - top - 60, wood, [-W / 2 + (W / n) * i, (hbH + top + 60) / 2, z]))
    } else if (headboard !== 'none' && frame !== 'none') {
      const hbH = top + 380
      const hbD = headboard === 'shelf' ? 220 : 40
      g.add(panelOn(W, hbH, hbD, wood, 0, 0, -L / 2 - hbD / 2 + (frame === 'wood' ? 0 : 10), { grain: 'x' }))
      if (headboard === 'shelf') {
        // Recessed niche
        g.add(panelOn(W - 60, 140, hbD - 30, mat('matte', '#2b2420', { roughness: 0.9 }), 0, hbH - 180, -L / 2 - hbD / 2 + 15))
      }
    }
    return g
  },
})

export const futon = defineAsset({
  type: 'futon',
  label: '敷布団',
  category: 'bed',
  description: '床に敷く布団。たたんだ状態にもできる',
  placement: 'floor',
  // Nothing is meant to stand on it.
  surfaces: () => [],
  params: {
    width: p.mm('幅', 900, 1500, 1000),
    length: p.mm('長さ', 1900, 2200, 2100),
    thickness: p.mm('厚み', 40, 150, 80),
    folded: p.bool('三つ折りにたたむ', false),
    color: p.color('布団の色', '#f1ede6', { swatches: SWATCHES.fabric }),
    coverColor: p.color('掛け布団', '#c9d6df', { swatches: SWATCHES.fabric }),
  },
  build({ width, length, thickness, folded, color, coverColor }) {
    const fab = mat('fabric', color)
    const cover = mat('fabric', coverColor)
    const g = group()
    if (folded) {
      const fl = length / 3
      for (let i = 0; i < 3; i++) g.add(rbox(width, thickness, fl, thickness * 0.45, fab, [0, thickness * (i + 0.5), 0], { grain: 'x' }))
      for (let i = 0; i < 2; i++) g.add(rbox(width + 40, 70, fl + 20, 30, cover, [0, thickness * 3 + 35 + i * 70, 0], { grain: 'x' }))
      g.add(rbox(560, 110, 360, 50, fab, [0, thickness * 3 + 140 + 55, 0]))
      return g
    }
    g.add(rbox(width, thickness, length, thickness * 0.45, fab, [0, thickness / 2, 0], { grain: 'z' }))
    g.add(rbox(width + 40, 60, length * 0.72, 28, cover, [0, thickness + 25, length * 0.14], { grain: 'z' }))
    g.add(rbox(560, 110, 360, 50, fab, [0, thickness + 50, -length / 2 + 230]))
    return g
  },
})

type LoftParams = { size: 'single' | 'semiDouble'; length: number; deckHeight: number; frame: string; ladder: string; ladderSide: string; guard: number; mattress: number }

/** Outer size, post size and where the ladder goes, shared by the geometry and the solid parts. */
function loftLayout(q: LoftParams) {
  const post = q.frame === 'wood' ? 60 : 40
  const W = MATTRESS_W[q.size] + post * 2
  const L = q.length + post * 2
  const top = q.deckHeight + q.guard
  const lw = 360
  const slant = q.ladder === 'slant' ? Math.min(520, q.deckHeight * 0.32) : 0
  // Ladder rectangle in the bed's frame (x across, z along), standing outside the frame.
  const side = q.ladderSide
  const along = side === 'end' ? 'x' : 'z'
  const out = 50 + slant
  const ladder =
    side === 'end'
      ? { minX: W / 2 - post - lw, maxX: W / 2 - post, minZ: L / 2, maxZ: L / 2 + out }
      : side === 'right'
        ? { minX: W / 2, maxX: W / 2 + out, minZ: L / 2 - post - lw - 150, maxZ: L / 2 - post - 150 }
        : { minX: -W / 2 - out, maxX: -W / 2, minZ: L / 2 - post - lw - 150, maxZ: L / 2 - post - 150 }
  return { post, W, L, top, lw, slant, ladder, along }
}

export const loftBed = defineAsset({
  type: 'loftBed',
  label: 'ロフトベッド',
  category: 'bed',
  description:
    '床板が高いベッド。下の空いたところにデスク・ソファ・収納を置ける（柱・はしご以外はぶつからない）。ミドルは床板 800〜1000、ハイは 1400〜1600。天井とマットレスのあいだは 700 くらい空けると起き上がれる。足元が正面(+Z)',
  placement: 'floor',
  surfaces: () => [],
  params: {
    size: p.select('サイズ', { single: 'シングル', semiDouble: 'セミダブル' }, 'single', { group: 'サイズ' }),
    length: p.mm('長さ', 1950, 2100, 1950, { hint: 'マットレスの長さ' }),
    deckHeight: p.mm('床板の高さ', 700, 1700, 1450, { hint: '床から床板の上面まで。下に入れる物の高さ＋100 くらい' }),
    frame: p.select('フレーム', { steel: 'スチールパイプ', wood: '木製' }, 'steel'),
    ladder: p.select('はしご', { straight: 'まっすぐ', slant: 'ななめ（上りやすい）' }, 'straight'),
    ladderSide: p.select('はしごの位置', { right: '右の側面', left: '左の側面', end: '足元' }, 'right', { hint: '足元側から見た左右' }),
    guard: p.mm('柵の高さ', 200, 450, 320, { group: '形', hint: '床板の上面から' }),
    mattress: p.mm('マットレス厚', 60, 200, 100),
    frameColor: p.color('フレーム', '#f4f4f2', { swatches: ['#f4f4f2', '#2b2b2e', '#8e9196', ...SWATCHES.wood.slice(0, 5)] }),
    beddingColor: p.color('掛け布団', '#9fb59a', { swatches: SWATCHES.fabric }),
    sheetColor: p.color('シーツ・枕', '#f4f1ec', { swatches: SWATCHES.fabric }),
    duvet: p.bool('掛け布団', true),
  },
  presets: [
    { name: 'ハイ（黒）', params: { deckHeight: 1550, frameColor: '#2b2b2e', beddingColor: '#d9d2c5' } },
    { name: 'ミドル', params: { deckHeight: 900, ladder: 'slant', ladderSide: 'end', beddingColor: '#c9d6df' } },
    { name: '木製', params: { frame: 'wood', frameColor: '#b8875a', ladder: 'slant', deckHeight: 1400, beddingColor: '#e8c76a' } },
    { name: 'セミダブル', params: { size: 'semiDouble', deckHeight: 1500, frameColor: '#8e9196' } },
  ],
  solids: (q) => {
    const { post, W, L, top, ladder } = loftLayout(q)
    const parts = []
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = sx * (W / 2 - post / 2)
        const z = sz * (L / 2 - post / 2)
        parts.push({ min: { x: x - post / 2, y: 0, z: z - post / 2 }, max: { x: x + post / 2, y: top, z: z + post / 2 } })
      }
    // The deck with its rails and the bedding; the space under it is free.
    parts.push({ min: { x: -W / 2, y: q.deckHeight - 90, z: -L / 2 }, max: { x: W / 2, y: top, z: L / 2 } })
    parts.push({ min: { x: ladder.minX, y: 0, z: ladder.minZ }, max: { x: ladder.maxX, y: top, z: ladder.maxZ } })
    return parts
  },
  build(q) {
    const { post, W, L, top, lw, slant, ladder, along } = loftLayout(q)
    const steel = q.frame === 'steel'
    const fm = steel ? mat('powder', q.frameColor) : mat('wood', q.frameColor)
    const e = steel ? 3 : 2
    const g = group()
    const deck = q.deckHeight
    // Posts.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(panelOn(post, top, post, fm, sx * (W / 2 - post / 2), 0, sz * (L / 2 - post / 2), { edge: e, grain: 'y' }))
    // Deck frame and the board the mattress rests on.
    const railH = steel ? 60 : 90
    for (const sx of [-1, 1]) g.add(panelOn(post * 0.6, railH, L - post * 2, fm, sx * (W / 2 - post / 2), deck - railH, 0, { edge: e, grain: 'z' }))
    for (const sz of [-1, 1]) g.add(panelOn(W - post * 2, railH, post * 0.6, fm, 0, deck - railH, sz * (L / 2 - post / 2), { edge: e, grain: 'x' }))
    g.add(panelOn(W - post * 2, 12, L - post * 2, steel ? mat('powder', q.frameColor) : mat('wood', '#d9c3a0'), 0, deck - 12, 0, { edge: 1, grain: 'z' }))
    // Slats show from below as a few cross bars.
    const n = Math.max(4, Math.round(L / 350))
    for (let i = 1; i < n; i++) g.add(panelOn(W - post * 2, 20, 30, fm, 0, deck - 32, -L / 2 + (L * i) / n, { edge: 1 }))
    // Guard rails: two bars on every side, open over the ladder.
    const bar = steel ? 25 : 40
    const gap = { from: 0, to: 0, side: q.ladderSide }
    if (along === 'z') {
      gap.from = ladder.minZ
      gap.to = ladder.maxZ
    } else {
      gap.from = ladder.minX
      gap.to = ladder.maxX
    }
    for (const y of [deck + q.guard * 0.45, top - bar]) {
      for (const sx of [-1, 1]) {
        const open = (sx > 0 && q.ladderSide === 'right') || (sx < 0 && q.ladderSide === 'left')
        const x = sx * (W / 2 - post / 2)
        if (!open) g.add(panelOn(bar * 0.6, bar, L - post * 2, fm, x, y, 0, { edge: e, grain: 'z' }))
        else {
          const a = -L / 2 + post
          const b = L / 2 - post
          if (gap.from - a > 20) g.add(panelOn(bar * 0.6, bar, gap.from - a, fm, x, y, (a + gap.from) / 2, { edge: e, grain: 'z' }))
          if (b - gap.to > 20) g.add(panelOn(bar * 0.6, bar, b - gap.to, fm, x, y, (gap.to + b) / 2, { edge: e, grain: 'z' }))
        }
      }
      for (const sz of [-1, 1]) {
        const z = sz * (L / 2 - post / 2)
        if (sz > 0 && q.ladderSide === 'end') {
          const a = -W / 2 + post
          if (gap.from - a > 20) g.add(panelOn(gap.from - a, bar, bar * 0.6, fm, (a + gap.from) / 2, y, z, { edge: e, grain: 'x' }))
        } else g.add(panelOn(W - post * 2, bar, bar * 0.6, fm, 0, y, z, { edge: e, grain: 'x' }))
      }
    }
    // Head end: a cross brace (steel) or a panel (wood) below the deck keeps the frame square.
    const hz = -L / 2 + post / 2
    if (steel) {
      const len = Math.hypot(W - post * 2, deck - railH - 150)
      const ang = Math.atan2(W - post * 2, deck - railH - 150)
      for (const s of [-1, 1]) {
        const b = panelOn(16, len, 8, fm, 0, -len / 2, 0, { edge: 1 })
        const pv = group(b)
        pv.position.set(0, 150 + (deck - railH - 150) / 2, hz)
        pv.rotation.z = s * ang
        g.add(pv)
      }
    } else g.add(panelOn(W - post * 2, 300, 18, fm, 0, deck - railH - 300, hz, { edge: 1.5, grain: 'x' }))
    // Ladder: two stiles and rungs every ~280 mm, leaning out by `slant` at the floor.
    const rails: THREE.Mesh[] = []
    const lm = fm
    const cx = along === 'z' ? (q.ladderSide === 'right' ? W / 2 + 25 : -W / 2 - 25) : (ladder.minX + ladder.maxX) / 2
    const cz = along === 'z' ? (ladder.minZ + ladder.maxZ) / 2 : L / 2 + 25
    const outward = along === 'z' ? [q.ladderSide === 'right' ? 1 : -1, 0] : [0, 1]
    const lean = Math.atan2(slant, top)
    const stileLen = Math.hypot(slant, top)
    const ladderG = group()
    ladderG.position.set(cx + outward[0] * slant, 0, cz + outward[1] * slant)
    for (const s of [-1, 1]) {
      const off = (s * (lw - bar)) / 2
      rails.push(panelOn(along === 'z' ? bar * 0.8 : bar, stileLen, along === 'z' ? bar : bar * 0.8, lm, along === 'x' ? off : 0, 0, along === 'z' ? off : 0, { edge: e, grain: 'y' }))
    }
    for (let y = 280; y < stileLen - 120; y += 280) rails.push(panelOn(along === 'x' ? lw - bar : steel ? 22 : 30, steel ? 22 : 30, along === 'z' ? lw - bar : steel ? 22 : 30, lm, 0, y, 0, { edge: e }))
    for (const m of rails) ladderG.add(m)
    // Lean the ladder back toward the frame so its top meets the deck.
    if (along === 'z') ladderG.rotation.z = (q.ladderSide === 'right' ? 1 : -1) * lean
    else ladderG.rotation.x = -lean
    g.add(ladderG)
    // Rubber feet under the posts.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(panelOn(post + 4, 8, post + 4, mat('rubber', '#2a2a2a'), sx * (W / 2 - post / 2), 0, sz * (L / 2 - post / 2), { edge: 1 }))
    bedding(g, { mw: MATTRESS_W[q.size], length: q.length, deck, mattress: q.mattress, sheetColor: q.sheetColor, beddingColor: q.beddingColor, duvet: q.duvet })
    return g
  },
})
