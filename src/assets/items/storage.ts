import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { rng } from '../../three/textures'
import { boxOn, cyl, deg, group, rbox } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

const BOOK_COLORS = ['#c96f53', '#e2b75f', '#5d7a8c', '#8c9f7a', '#efe6d6', '#3d4a5c', '#a24d4d', '#d9cbb4', '#6f5b8a', '#2f2f31', '#f2d3c0', '#4f7f73']

/** Fill a shelf (width w, height h, depth d, bottom-centre at x,y,z) with books. */
export function books(w: number, h: number, d: number, x: number, y: number, z: number, seed: number, fill = 0.75) {
  const g = new THREE.Group()
  const r = rng(seed)
  let cx = x - w / 2 + 10
  const end = x - w / 2 + w * fill
  while (cx < end) {
    const bw = 18 + r() * 32
    const bh = Math.min(h - 15, h * (0.62 + r() * 0.3))
    const bd = Math.min(d - 20, 150 + r() * 80)
    const col = BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]
    const b = boxOn(bw, bh, bd, mat('matte', col, { roughness: 0.7 }), cx + bw / 2, y, z + d / 2 - bd / 2 - 15)
    g.add(b)
    cx += bw + 1
    // Occasionally a gap, a leaning book or a small stack
    const roll = r()
    if (roll < 0.08 && cx + 120 < end) {
      const lean = boxOn(25, bh * 0.9, bd, mat('matte', BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]), 0, 0, 0)
      lean.position.set(cx + bh * 0.25, y + bh * 0.42, z + d / 2 - bd / 2 - 15)
      lean.rotation.z = -deg(18)
      g.add(lean)
      cx += bh * 0.4
    } else if (roll < 0.14) {
      cx += 40 + r() * 80
    }
  }
  return g
}

function carcass(W: number, H: number, D: number, t: number, m: THREE.Material, back: boolean, backMat?: THREE.Material) {
  const g = new THREE.Group()
  g.add(boxOn(t, H, D, m, -W / 2 + t / 2, 0, 0, { grain: 'y' }))
  g.add(boxOn(t, H, D, m, W / 2 - t / 2, 0, 0, { grain: 'y' }))
  g.add(boxOn(W - t * 2, t, D, m, 0, H - t, 0, { grain: 'x' }))
  g.add(boxOn(W - t * 2, t, D, m, 0, 0, 0, { grain: 'x' }))
  if (back) g.add(boxOn(W - t * 2, H - t * 2, 6, backMat ?? m, 0, t, -D / 2 + 3))
  return g
}

export const bookshelf = defineAsset({
  type: 'bookshelf',
  label: '本棚',
  category: 'storage',
  description: 'オープンシェルフ・本棚。段数・サイズを変えられ、本を並べた状態も表示できる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 300, 1800, 800),
    height: p.mm('高さ', 400, 2100, 1800),
    depth: p.mm('奥行き', 200, 450, 300),
    shelves: p.number({ label: '段数', min: 1, max: 8, step: 1, default: 5, group: '形' }),
    columns: p.number({ label: '列数', min: 1, max: 4, step: 1, default: 1, group: '形' }),
    back: p.bool('背板', true),
    books: p.bool('本を並べる', true),
    color: p.color('本体', '#d2ad7c', { swatches: SWATCHES.wood }),
  },
  presets: [
    { name: '壁一面', params: { width: 1600, height: 2000, columns: 2, shelves: 6 } },
    { name: 'ロー', params: { width: 1200, height: 800, shelves: 2, columns: 3, color: '#f1ece4' } },
    { name: 'ブラック', params: { color: '#2b2b2b', back: false } },
  ],
  build({ width: W, height: H, depth: D, shelves, columns, back, books: hasBooks, color }) {
    const t = 18
    const m = mat('wood', color)
    const g = group(carcass(W, H, D, t, m, back))
    const n = Math.round(shelves)
    const cols = Math.round(columns)
    const innerH = H - t * 2
    const cellH = (innerH - t * (n - 1)) / n
    const cellW = (W - t * 2 - t * (cols - 1)) / cols
    for (let i = 1; i < n; i++) g.add(boxOn(W - t * 2, t, D - 10, m, 0, t + i * (cellH + t) - t, 5))
    for (let c = 1; c < cols; c++) g.add(boxOn(t, innerH, D - 10, m, -W / 2 + t + c * (cellW + t) - t / 2, t, 5, { grain: 'y' }))
    if (hasBooks) {
      for (let i = 0; i < n; i++)
        for (let c = 0; c < cols; c++) {
          if (cellH < 140) continue
          const x = -W / 2 + t + c * (cellW + t) + cellW / 2
          const y = t + i * (cellH + t)
          const seed = (i * 7 + c * 13 + Math.round(W)) | 0
          if ((i + c) % 4 === 3) {
            // Decorative box instead of books
            g.add(rbox(Math.min(cellW * 0.5, 260), Math.min(cellH * 0.6, 200), D * 0.7, 8, mat('fabric', '#d9cbb4'), [x, y + Math.min(cellH * 0.6, 200) / 2, 0]))
          } else g.add(books(cellW, cellH, D, x, y, 0, seed, 0.55 + ((seed % 5) / 5) * 0.4))
        }
    }
    return g
  },
})

export const colorBox = defineAsset({
  type: 'colorBox',
  label: 'カラーボックス',
  category: 'storage',
  description: '定番のカラーボックス。縦置き・横置き、インナーボックスの有無',
  placement: 'floor',
  params: {
    cubes: p.number({ label: '段数', min: 2, max: 4, step: 1, default: 3, group: '形' }),
    orientation: p.select('向き', { vertical: '縦置き', horizontal: '横置き' }, 'vertical'),
    bins: p.select('インナーボックス', { none: 'なし', some: 'いくつか', all: 'ぜんぶ' }, 'some'),
    color: p.color('本体', '#f1ece4', { swatches: SWATCHES.wood }),
    binColor: p.color('インナーボックス', '#b9b0a3', { swatches: SWATCHES.fabric }),
  },
  build({ cubes, orientation, bins, color, binColor }) {
    const n = Math.round(cubes)
    const t = 15
    const cell = 330
    const D = 290
    const vertical = orientation === 'vertical'
    const W = vertical ? cell + t * 2 : n * cell + (n + 1) * t
    const H = vertical ? n * cell + (n + 1) * t : cell + t * 2
    const m = mat('matte', color, { roughness: 0.55 })
    const g = group(carcass(W, H, D, t, m, true))
    for (let i = 1; i < n; i++) {
      if (vertical) g.add(boxOn(W - t * 2, t, D - 6, m, 0, i * (cell + t), 3))
      else g.add(boxOn(t, H - t * 2, D - 6, m, -W / 2 + i * (cell + t) + t / 2, t, 3))
    }
    const bm = mat('fabric', binColor)
    for (let i = 0; i < n; i++) {
      const has = bins === 'all' || (bins === 'some' && i % 2 === 0)
      const x = vertical ? 0 : -W / 2 + t + i * (cell + t) + cell / 2
      const y = vertical ? t + i * (cell + t) : t
      if (has) {
        g.add(rbox(cell - 16, cell - 20, D - 30, 10, bm, [x, y + (cell - 20) / 2 + 2, 8]))
        g.add(boxOn(90, 24, 6, mat('matte', '#3b2f28'), x, y + cell - 90, D / 2 - 4)) // handle cut-out
      } else if (i % 3 === 1) {
        g.add(books(cell, cell, D, x, y, 0, i * 31 + n, 0.7))
      }
    }
    return g
  },
})

export const chest = defineAsset({
  type: 'chest',
  label: 'チェスト',
  category: 'storage',
  description: '引き出しの収納家具。段数と列数を変えられる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 350, 1400, 800),
    height: p.mm('高さ', 400, 1300, 900),
    depth: p.mm('奥行き', 300, 550, 420),
    rows: p.number({ label: '段数', min: 2, max: 7, step: 1, default: 4, group: '形' }),
    columns: p.number({ label: '列数', min: 1, max: 3, step: 1, default: 1, group: '形' }),
    handle: p.select('取っ手', { bar: 'バー', knob: 'つまみ', groove: '溝' }, 'bar'),
    material: p.select('素材', { wood: '木製', plastic: 'プラスチック（衣装ケース風）' }, 'wood'),
    color: p.color('本体', '#d2ad7c', { swatches: SWATCHES.wood }),
  },
  presets: [
    { name: '衣装ケース', params: { width: 440, height: 1000, rows: 5, material: 'plastic', color: '#ffffff' } },
    { name: '横長ロー', params: { width: 1200, height: 600, rows: 2, columns: 3 } },
  ],
  build({ width: W, height: H, depth: D, rows, columns, handle, material, color }) {
    const plastic = material === 'plastic'
    const m = plastic ? mat('plastic', color, { roughness: 0.3 }) : mat('wood', color)
    const front = plastic ? mat('glass', '#f4f4f4', { opacity: 0.55, roughness: 0.4 }) : mat('wood', color)
    const g = group()
    const t = 18
    const base = plastic ? 30 : 60
    g.add(boxOn(W, H - base, D, m, 0, base, 0))
    if (!plastic) g.add(boxOn(W - 40, base, D - 40, mat('matte', '#3b2f28'), 0, 0, 0))
    else for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(18, 18, base, mat('rubber', '#cccccc'), [sx * (W / 2 - 40), base / 2, sz * (D / 2 - 40)]))
    const r = Math.round(rows)
    const c = Math.round(columns)
    const fh = (H - base - t) / r
    const fw = (W - t) / c
    const hm = mat('metal', '#3a3b3e', { roughness: 0.35 })
    // Dark backing so the gaps between drawer fronts read as seams.
    if (!plastic) g.add(boxOn(W - t, H - base - t, 2, mat('matte', '#2b2420'), 0, base + t / 2, D / 2 + 1))
    for (let i = 0; i < r; i++)
      for (let j = 0; j < c; j++) {
        const x = -W / 2 + t / 2 + fw * (j + 0.5)
        const y = base + t / 2 + i * fh
        g.add(boxOn(fw - 6, fh - 6, 16, front, x, y + 3, D / 2 + 4))
        if (plastic) {
          // Visible folded clothes behind the translucent front
          g.add(boxOn(fw - 60, fh * 0.55, 20, mat('fabric', BOOK_COLORS[(i * 3 + j) % BOOK_COLORS.length]), x, y + 12, D / 2 - 20))
          g.add(boxOn(Math.min(140, fw * 0.4), 18, 10, m, x, y + fh - 40, D / 2 + 16))
          continue
        }
        if (handle === 'bar') g.add(boxOn(Math.min(160, fw * 0.4), 14, 16, hm, x, y + fh / 2 - 7, D / 2 + 18))
        else if (handle === 'knob') {
          const k = cyl(16, 16, 24, mat('wood', '#6b4a34'), [x, y + fh / 2, D / 2 + 22], { rot: [Math.PI / 2, 0, 0] })
          g.add(k)
        } else g.add(boxOn(fw - 40, 10, 6, mat('matte', '#3b2f28'), x, y + fh - 26, D / 2 + 10))
      }
    return g
  },
})

const CLOTHES = ['#f2efe9', '#3d4a5c', '#8fa9bf', '#c5687a', '#e8c76a', '#4d4f53', '#9fb59a', '#d9cbb4', '#2f2f31']

export const hangerRack = defineAsset({
  type: 'hangerRack',
  label: 'ハンガーラック',
  category: 'storage',
  description: '服をかけるラック。服をかけた状態も表示できる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 600, 1600, 1000),
    height: p.mm('高さ', 1300, 1900, 1650),
    depth: p.mm('奥行き', 350, 600, 450),
    clothes: p.number({ label: '服の数', min: 0, max: 20, step: 1, default: 9, group: '形' }),
    shelf: p.bool('下段の棚', true),
    color: p.color('フレーム', '#2b2b2b', { swatches: [...SWATCHES.metal, '#b8875a', '#f2efe9'] }),
  },
  build({ width: W, height: H, depth: D, clothes, shelf, color }) {
    const metal = mat('metal', color, { roughness: 0.35 })
    const g = group()
    const r = 13
    for (const s of [-1, 1]) {
      g.add(cyl(r, r, H, metal, [s * (W / 2 - r), H / 2, 0]))
      g.add(cyl(r, r, D, metal, [s * (W / 2 - r), r + 30, 0], { rot: [Math.PI / 2, 0, 0] }))
      for (const sz of [-1, 1]) g.add(cyl(22, 22, 30, mat('rubber', '#222'), [s * (W / 2 - r), 15, sz * (D / 2 - 30)]))
    }
    g.add(cyl(r, r, W, metal, [0, H - r, 0], { rot: [0, 0, Math.PI / 2] }))
    if (shelf) {
      const sm = mat('wood', '#b8875a')
      g.add(boxOn(W - 60, 18, D - 60, sm, 0, 200, 0))
      g.add(rbox(320, 110, 260, 30, mat('fabric', '#d9cbb4'), [-W / 4, 275, 0]))
      g.add(rbox(280, 90, 300, 20, mat('leather', '#6b4a34'), [W / 5, 265, 0]))
    }
    const n = Math.round(clothes)
    const rr = rng(n * 17 + Math.round(W))
    const usable = W - 160
    for (let i = 0; i < n; i++) {
      const x = -usable / 2 + (usable / Math.max(1, n - 1)) * i + (rr() - 0.5) * 20
      const long = rr() < 0.3
      const ch = long ? 950 + rr() * 200 : 600 + rr() * 150
      const cw = 420 + rr() * 80
      const col = CLOTHES[Math.floor(rr() * CLOTHES.length)]
      const hang = new THREE.Group()
      const body = rbox(55, ch, cw, 22, mat('fabric', col), [0, -ch / 2 - 60, 0])
      hang.add(body)
      // shoulders
      hang.add(rbox(60, 60, cw + 60, 28, mat('fabric', col), [0, -80, 0]))
      // hanger hook
      hang.add(cyl(4, 4, 70, mat('metal', '#c9ccd0'), [0, -30, 0]))
      hang.position.set(x, H - r, 0)
      hang.rotation.y = (rr() - 0.5) * 0.25
      g.add(hang)
    }
    return g
  },
})

export const tvStand = defineAsset({
  type: 'tvStand',
  label: 'テレビ台',
  category: 'av',
  description: 'テレビを置く低い台。テレビ（tv）を上に載せて使う',
  placement: 'floor',
  params: {
    width: p.mm('幅', 600, 2000, 1200),
    height: p.mm('高さ', 250, 600, 400),
    depth: p.mm('奥行き', 280, 500, 400),
    style: p.select('スタイル', { open: 'オープン', drawers: '引き出し', doors: '扉付き' }, 'open'),
    legs: p.bool('脚付き', true),
    color: p.color('本体', '#8f5f3d', { swatches: SWATCHES.wood }),
  },
  build({ width: W, height: H, depth: D, style, legs, color }) {
    const m = mat('wood', color)
    const t = 20
    const g = group()
    const legH = legs ? Math.min(120, H * 0.3) : 0
    const bodyH = H - legH
    const body = carcass(W, bodyH, D, t, m, true)
    body.position.y = legH
    g.add(body)
    if (legs) for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(16, 12, legH, mat('wood', color), [sx * (W / 2 - 60), legH / 2, sz * (D / 2 - 60)], { rot: [sz * deg(5), 0, -sx * deg(5)] }))
    const innerH = bodyH - t * 2
    const n = Math.max(2, Math.round(W / 450))
    const cw = (W - t * 2) / n
    for (let i = 1; i < n; i++) g.add(boxOn(t, innerH, D - 10, m, -W / 2 + t + cw * i, legH + t, 5, { grain: 'y' }))
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + t + cw * (i + 0.5)
      const closed = style === 'doors' ? i !== Math.floor(n / 2) : style === 'drawers' ? i % 2 === 0 : false
      if (closed) {
        g.add(boxOn(cw - 6, innerH - 6, 16, mat('wood', color, { roughness: 0.45 }), x, legH + t + 3, D / 2 - 6))
        g.add(boxOn(Math.min(120, cw * 0.4), 10, 10, mat('metal', '#2b2b2b'), x, legH + t + innerH - 40, D / 2 + 7))
      } else if (i === 0 || i === n - 1) {
        // A game console / router in an open cell
        g.add(rbox(Math.min(260, cw * 0.7), Math.min(70, innerH * 0.4), 220, 8, mat('plastic', i === 0 ? '#2f2f31' : '#f2efe9'), [x, legH + t + Math.min(70, innerH * 0.4) / 2, 20]))
      }
    }
    return g
  },
})
