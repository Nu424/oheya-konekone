import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { boxOn, cyl, group, rbox } from '../kit'
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

export const bed = defineAsset({
  type: 'bed',
  label: 'ベッド',
  category: 'bed',
  description: 'ベッド。サイズ（シングル〜クイーン）、フレームの種類、脚の高さ、ヘッドボードの有無、寝具の色を変えられる。足元が正面(+Z)、頭側が背面',
  placement: 'floor',
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
      g.add(boxOn(ft, railH, L, wood, -W / 2 + ft / 2, ry, 0, { grain: 'z' }))
      g.add(boxOn(ft, railH, L, wood, W / 2 - ft / 2, ry, 0, { grain: 'z' }))
      g.add(boxOn(W, railH, ft, wood, 0, ry, L / 2 - ft / 2))
      g.add(boxOn(W, railH, ft, wood, 0, ry, -L / 2 + ft / 2))
      if (legHeight > 0) {
        const lh = ry
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) g.add(boxOn(60, lh, 60, wood, sx * (W / 2 - 30), 0, sz * (L / 2 - 30), { grain: 'y' }))
        if (mw >= 1400) for (const sz of [-1, 1]) g.add(boxOn(60, lh, 60, wood, 0, 0, sz * (L / 2 - 30)))
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
      g.add(boxOn(W, deck, L, wood, 0, 0, 0, { grain: 'z' }))
      if (frame === 'storage') {
        // Two drawers on the +X side
        const dl = (L - 200) / 2 - 20
        const front = mat('wood', frameColor, { roughness: 0.5 })
        for (const i of [0, 1]) {
          const z = L / 2 - 100 - dl / 2 - i * (dl + 20)
          g.add(boxOn(16, deck - 80, dl, front, W / 2 + 6, 30, z))
          g.add(boxOn(10, 22, 160, mat('metal', '#a7aaae'), W / 2 + 18, deck - 120, z))
        }
        g.add(boxOn(W - 20, 30, L - 20, mat('matte', '#2b2420'), 0, 0, 0)) // plinth shadow gap
      }
    }

    // Mattress
    const sheet = mat('fabric', sheetColor)
    const mY = deck
    g.add(rbox(mw, mt, length, 50, sheet, [0, mY + mt / 2, 0], { grain: 'z' }))
    const top = mY + mt

    // Pillows
    const pillows = mw >= 1400 ? 2 : 1
    const pw = Math.min(630, mw / pillows - 60)
    for (let i = 0; i < pillows; i++) {
      const x = pillows === 1 ? 0 : (i - 0.5) * (pw + 30)
      g.add(rbox(pw, 120, 420, 55, sheet, [x, top + 50, -length / 2 + 260], { grain: 'x' }))
    }

    if (hasDuvet) {
      const dl = length * 0.74
      const d = duvet(mw, dl, top, mt, beddingColor)
      d.position.z = length / 2 - dl / 2 + 30
      g.add(d)
    }

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
      g.add(boxOn(W, hbH, hbD, wood, 0, 0, -L / 2 - hbD / 2 + (frame === 'wood' ? 0 : 10), { grain: 'x' }))
      if (headboard === 'shelf') {
        // Recessed niche
        g.add(boxOn(W - 60, 140, hbD - 30, mat('matte', '#2b2420', { roughness: 0.9 }), 0, hbH - 180, -L / 2 - hbD / 2 + 15))
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
