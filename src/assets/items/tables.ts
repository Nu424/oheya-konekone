import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { boxOn, cyl, deg, extrude, group, loft, rbox, roundedRect } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

/** Table top: rectangle (rounded corners), circle or oval. Bottom of the top sits at y. */
function tableTop(shape: string, w: number, d: number, t: number, y: number, m: THREE.Material) {
  if (shape === 'round' || shape === 'oval') {
    const s = new THREE.Shape()
    s.absellipse(0, 0, w / 2, shape === 'round' ? w / 2 : d / 2, 0, Math.PI * 2, false, 0)
    const mesh = extrude(s, t, m, [0, y + t / 2, 0], { bevel: 3, rot: [Math.PI / 2, 0, 0] })
    return mesh
  }
  return extrude(roundedRect(w, d, 12), t, m, [0, y + t / 2, 0], { bevel: 3, rot: [Math.PI / 2, 0, 0] })
}

export const lowTable = defineAsset({
  type: 'lowTable',
  label: 'ローテーブル',
  category: 'table',
  description: '床に座って使う低いテーブル。四角・丸・楕円',
  placement: 'floor',
  params: {
    shape: p.select('天板の形', { rect: '四角', round: '丸', oval: '楕円' }, 'rect'),
    width: p.mm('幅', 500, 1400, 900),
    depth: p.mm('奥行き', 400, 900, 500, { hint: '丸の場合は幅＝直径' }),
    height: p.mm('高さ', 280, 500, 360),
    legs: p.select('脚', { wood: '木の脚', hairpin: 'ヘアピン', folding: '折りたたみ', box: '箱型' }, 'wood'),
    shelf: p.bool('下段の棚', false),
    topColor: p.color('天板', '#d2ad7c', { swatches: SWATCHES.wood }),
    legColor: p.color('脚', '#d2ad7c', { swatches: [...SWATCHES.wood, ...SWATCHES.metal] }),
  },
  presets: [
    { name: '丸テーブル', params: { shape: 'round', width: 750, legs: 'folding', topColor: '#f1ece4', legColor: '#f1ece4' } },
    { name: '北欧風', params: { shape: 'oval', width: 1000, depth: 550, topColor: '#e4cfa8', legColor: '#e4cfa8' } },
    { name: 'インダストリアル', params: { legs: 'hairpin', topColor: '#6b4a34', legColor: '#2b2b2b' } },
  ],
  build({ shape, width, depth, height, legs, shelf, topColor, legColor }) {
    const W = width
    const D = shape === 'round' ? width : depth
    const t = 25
    const top = mat('wood', topColor)
    const lm = legs === 'hairpin' ? mat('metal', legColor, { roughness: 0.35 }) : mat('wood', legColor)
    const g = group(tableTop(shape, W, D, t, height - t, top))
    const lh = height - t
    const inset = shape === 'rect' ? 60 : 0
    const pos: [number, number][] =
      shape === 'rect'
        ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (W / 2 - inset), sz * (D / 2 - inset)] as [number, number])
        : [0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4
            return [Math.cos(a) * W * 0.32, Math.sin(a) * D * 0.32] as [number, number]
          })
    if (legs === 'box') {
      for (const s of [-1, 1]) g.add(boxOn(22, lh, D * 0.8, lm, s * (W / 2 - 80), 0, 0, { grain: 'y' }))
    } else {
      for (const [x, z] of pos) {
        if (legs === 'hairpin') {
          for (const dz of [-25, 25]) g.add(cyl(6, 6, lh, lm, [x, lh / 2, z + dz], { rot: [0, 0, Math.sign(x) * deg(4)] }))
        } else if (legs === 'folding') {
          g.add(boxOn(40, lh, 40, lm, x * 0.9, 0, z * 0.9))
        } else {
          g.add(cyl(22, 16, lh, lm, [x, lh / 2, z]))
        }
      }
    }
    if (shelf) g.add(tableTop(shape, W * 0.86, D * 0.8, 15, lh * 0.25, top))
    return g
  },
})

export const kotatsu = defineAsset({
  type: 'kotatsu',
  label: 'こたつ',
  category: 'table',
  description: 'こたつ布団付きのこたつ。布団なし（夏モード）にもできる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 600, 1200, 800),
    depth: p.mm('奥行き', 600, 900, 600),
    futon: p.bool('こたつ布団', true),
    futonColor: p.color('布団の色', '#9a7b6a', { swatches: SWATCHES.fabric }),
    topColor: p.color('天板', '#8f5f3d', { swatches: SWATCHES.wood }),
  },
  build({ width: W, depth: D, futon, futonColor, topColor }) {
    const h = 380
    const top = mat('wood', topColor)
    const g = group()
    if (futon) {
      const fab = mat('fabric', futonColor, { side: THREE.DoubleSide })
      // Futon drapes from just over the table edge and flares out onto the floor.
      const skirt = 380
      const topY = h - 25
      g.add(
        loft(
          (t) => {
            const e = Math.pow(t, 2.2)
            return {
              hw: W / 2 + 40 + skirt * e + Math.sin(t * Math.PI) * 25,
              hd: D / 2 + 40 + skirt * e + Math.sin(t * Math.PI) * 25,
              r: 60 + 220 * e,
              y: topY - (topY - 8) * Math.pow(t, 0.85),
              wave: 0.025 * e,
            }
          },
          fab,
          { rings: 18 },
        ),
      )
      // Flat top under the board
      g.add(boxOn(W + 80, 14, D + 80, fab, 0, topY - 10, 0))
      // Hem lying on the floor
      g.add(rbox(W + 40 + skirt * 2 + 30, 20, D + 40 + skirt * 2 + 30, 10, fab, [0, 10, 0]))
      g.add(boxOn(W + 40, 25, D + 40, top, 0, h - 10, 0))
    } else {
      g.add(boxOn(W, 30, D, top, 0, h - 30, 0))
      g.add(boxOn(W - 60, 70, D - 60, top, 0, h - 100, 0))
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(boxOn(50, h - 30, 50, top, sx * (W / 2 - 40), 0, sz * (D / 2 - 40)))
      g.add(boxOn(260, 50, 260, mat('metal', '#3a3b3e'), 0, h - 150, 0)) // heater unit
    }
    return g
  },
})

export const diningTable = defineAsset({
  type: 'diningTable',
  label: 'ダイニングテーブル',
  category: 'table',
  description: '椅子で使うテーブル。カフェテーブルからダイニングまで',
  placement: 'floor',
  params: {
    shape: p.select('天板の形', { rect: '四角', round: '丸' }, 'rect'),
    width: p.mm('幅', 600, 1600, 1100),
    depth: p.mm('奥行き', 600, 900, 700, { hint: '丸の場合は幅＝直径' }),
    height: p.mm('高さ', 650, 1000, 720, { hint: 'カウンターテーブルなら900前後' }),
    legs: p.select('脚', { four: '4本脚', center: '1本脚', trestle: 'コの字' }, 'four'),
    topColor: p.color('天板', '#b8875a', { swatches: SWATCHES.wood }),
    legColor: p.color('脚', '#b8875a', { swatches: [...SWATCHES.wood, ...SWATCHES.metal] }),
  },
  presets: [
    { name: 'カフェテーブル', params: { shape: 'round', width: 650, legs: 'center', topColor: '#f1ece4', legColor: '#2b2b2b' } },
    { name: '2人用', params: { width: 800, depth: 650 } },
  ],
  build({ shape, width, depth, height, legs, topColor, legColor }) {
    const W = width
    const D = shape === 'round' ? width : depth
    const t = 30
    const top = mat('wood', topColor)
    const metalLegs = ['#d7d9dc', '#a7aaae', '#3a3b3e', '#2b2b2b', '#c9a86a', '#b87a5a'].includes(legColor.toLowerCase())
    const lm = metalLegs ? mat('metal', legColor, { roughness: 0.35 }) : mat('wood', legColor)
    const g = group(tableTop(shape, W, D, t, height - t, top))
    const lh = height - t
    if (legs === 'center' || shape === 'round') {
      g.add(cyl(30, 30, lh, lm, [0, lh / 2, 0]))
      g.add(cyl(Math.min(W, D) * 0.28, Math.min(W, D) * 0.3, 20, lm, [0, 10, 0], { segments: 48 }))
    } else if (legs === 'trestle') {
      for (const s of [-1, 1]) {
        g.add(boxOn(40, lh, 40, lm, s * (W / 2 - 70), 0, 0))
        g.add(boxOn(40, 30, D - 80, lm, s * (W / 2 - 70), 0, 0))
        g.add(boxOn(40, 30, D - 80, lm, s * (W / 2 - 70), lh - 30, 0))
      }
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(boxOn(45, lh, 45, lm, sx * (W / 2 - 55), 0, sz * (D / 2 - 55), { grain: 'y' }))
      g.add(boxOn(W - 150, 70, 20, lm, 0, lh - 70, D / 2 - 55))
      g.add(boxOn(W - 150, 70, 20, lm, 0, lh - 70, -D / 2 + 55))
    }
    return g
  },
})
