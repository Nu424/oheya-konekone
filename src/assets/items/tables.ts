import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { cyl, deg, extrude, group, loft, panelOn, rbox, roundedRect } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

/**
 * A kotatsu futon draped over a table whose board sits at `under` (mm): it drapes from just under the
 * board and flares out onto the floor. Any table with the `kotatsu` option gets one (docs: tables).
 */
function kotatsuFuton(W: number, D: number, under: number, color: string, round: boolean) {
  const g = group()
  const fab = mat('fabric', color, { side: THREE.DoubleSide })
  const skirt = 380
  const topY = under - 4
  g.add(
    loft(
      (t) => {
        const e = Math.pow(t, 2.2)
        const hw = W / 2 + 40 + skirt * e + Math.sin(t * Math.PI) * 25
        const hd = D / 2 + 40 + skirt * e + Math.sin(t * Math.PI) * 25
        return { hw, hd, r: round ? Math.min(hw, hd) - 1 : 60 + 220 * e, y: topY - (topY - 8) * Math.pow(t, 0.85), wave: 0.025 * e }
      },
      fab,
      { rings: 18 },
    ),
  )
  // Flat top under the board, and the hem lying on the floor.
  g.add(round ? cyl(W / 2 + 40, W / 2 + 40, 14, fab, [0, topY - 7, 0], { segments: 48 }) : panelOn(W + 80, 14, D + 80, fab, 0, topY - 14, 0))
  g.add(round ? cyl(W / 2 + 35 + skirt, W / 2 + 35 + skirt, 20, fab, [0, 10, 0], { segments: 64 }) : rbox(W + 40 + skirt * 2 + 30, 20, D + 40 + skirt * 2 + 30, 10, fab, [0, 10, 0]))
  return g
}

/** The kotatsu option shared by the low table, the dining table and the desk. */
export const kotatsuParams = {
  kotatsu: p.bool('こたつにする', false, { group: 'こたつ', hint: 'こたつ布団をかける（ヒーターは天板の下）' }),
  futonColor: p.color('こたつ布団', '#9a7b6a', { swatches: SWATCHES.fabric, group: 'こたつ' }),
}

export function withKotatsu(g: THREE.Group, o: { kotatsu: boolean; futonColor: string; W: number; D: number; under: number; round?: boolean }) {
  if (o.kotatsu) g.add(kotatsuFuton(o.W, o.D, o.under, o.futonColor, !!o.round))
  return g
}

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
    width: p.mm('幅', 350, 1400, 900),
    depth: p.mm('奥行き', 300, 900, 500, { hint: '丸の場合は幅＝直径' }),
    height: p.mm('高さ', 280, 650, 360, { hint: 'ソファの横のサイドテーブルなら 500〜600' }),
    legs: p.select('脚', { wood: '木の脚', hairpin: 'ヘアピン', folding: '折りたたみ', box: '箱型' }, 'wood'),
    shelf: p.bool('下段の棚', false),
    topColor: p.color('天板', '#d2ad7c', { swatches: SWATCHES.wood }),
    legColor: p.color('脚', '#d2ad7c', { swatches: [...SWATCHES.wood, ...SWATCHES.metal] }),
    ...kotatsuParams,
  },
  presets: [
    { name: 'こたつ', params: { width: 800, depth: 600, height: 380, legs: 'box', kotatsu: true, topColor: '#8f5f3d', legColor: '#8f5f3d' } },
    { name: '丸テーブル', params: { shape: 'round', width: 750, legs: 'folding', topColor: '#f1ece4', legColor: '#f1ece4' } },
    { name: 'サイドテーブル', params: { shape: 'round', width: 400, height: 550, legs: 'wood', topColor: '#6b4a34', legColor: '#6b4a34' } },
    { name: 'ナイトテーブル（四角）', params: { width: 400, depth: 350, height: 500, legs: 'wood', shelf: true, topColor: '#d2ad7c', legColor: '#d2ad7c' } },
    { name: '北欧風', params: { shape: 'oval', width: 1000, depth: 550, topColor: '#e4cfa8', legColor: '#e4cfa8' } },
    { name: 'インダストリアル', params: { legs: 'hairpin', topColor: '#6b4a34', legColor: '#2b2b2b' } },
  ],
  build({ shape, width, depth, height, legs, shelf, topColor, legColor, kotatsu, futonColor }) {
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
      for (const s of [-1, 1]) g.add(panelOn(22, lh, D * 0.8, lm, s * (W / 2 - 80), 0, 0, { grain: 'y' }))
    } else {
      for (const [x, z] of pos) {
        if (legs === 'hairpin') {
          for (const dz of [-25, 25]) g.add(cyl(6, 6, lh, lm, [x, lh / 2, z + dz], { rot: [0, 0, Math.sign(x) * deg(4)] }))
        } else if (legs === 'folding') {
          g.add(panelOn(40, lh, 40, lm, x * 0.9, 0, z * 0.9))
        } else {
          g.add(cyl(22, 16, lh, lm, [x, lh / 2, z]))
        }
      }
    }
    if (shelf) g.add(tableTop(shape, W * 0.86, D * 0.8, 15, lh * 0.25, top))
    return withKotatsu(g, { kotatsu, futonColor, W, D, under: lh, round: shape !== 'rect' })
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
    ...kotatsuParams,
  },
  presets: [
    { name: 'ダイニングこたつ', params: { width: 1050, depth: 750, height: 650, kotatsu: true, futonColor: '#6b6157' } },
    { name: 'カフェテーブル', params: { shape: 'round', width: 650, legs: 'center', topColor: '#f1ece4', legColor: '#2b2b2b' } },
    { name: '2人用', params: { width: 800, depth: 650 } },
  ],
  build({ shape, width, depth, height, legs, topColor, legColor, kotatsu, futonColor }) {
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
        g.add(panelOn(40, lh, 40, lm, s * (W / 2 - 70), 0, 0))
        g.add(panelOn(40, 30, D - 80, lm, s * (W / 2 - 70), 0, 0))
        g.add(panelOn(40, 30, D - 80, lm, s * (W / 2 - 70), lh - 30, 0))
      }
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(panelOn(45, lh, 45, lm, sx * (W / 2 - 55), 0, sz * (D / 2 - 55), { grain: 'y' }))
      g.add(panelOn(W - 150, 70, 20, lm, 0, lh - 70, D / 2 - 55))
      g.add(panelOn(W - 150, 70, 20, lm, 0, lh - 70, -D / 2 + 55))
    }
    return withKotatsu(g, { kotatsu, futonColor, W, D, under: lh, round: shape === 'round' })
  },
})
