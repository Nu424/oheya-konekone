import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { rng } from '../../three/textures'
import { boxOn, cyl, deg, group, merged, panelOn, rbox } from '../kit'
import { p } from '../params'
import { adjuster, caster, HANDLE_LABELS, type HandleKind } from '../parts'
import {
  BASE_LABELS,
  buildStorage,
  FINISH_LABELS,
  FRONT_LABELS,
  SPAN_LABELS,
  storageBody,
  storageSurfaces,
  type Base,
  type Finish,
  type FrontKind,
  type Span,
  type StorageSpec,
} from '../storageKit'
import { defineAsset, type Surface } from '../types'

/**
 * Case furniture. Three catalog types share one builder (storageKit.ts):
 * - shelf: open shelving (bookcases, colour boxes, microwave racks)
 * - cabinet: doors and drawers (chests, lockers, sliding-door bookcases, cupboards)
 * - metalRack: pole-and-shelf wire racks
 * Contents are separate items placed on the shelf surfaces (books, file boxes, appliances).
 */

const BODY_SWATCHES = [...SWATCHES.wood.slice(0, 6), '#f4f4f2', '#e6e6e3', '#c4c6c8', '#4d5055', '#2a2b2e']
const finishOptions = (only?: Finish[]) => Object.fromEntries(Object.entries(FINISH_LABELS).filter(([k]) => !only || only.includes(k as Finish))) as Record<Finish, string>

export const shelf = defineAsset({
  type: 'shelf',
  label: 'オープン棚',
  category: 'storage',
  description: '扉のない棚（本棚・カラーボックス・レンジ台・見せる収納）。段数・列数・背板・脚を変えられる。各段に本や家電を載せられる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 300, 1800, 800),
    height: p.mm('高さ', 300, 2100, 1800),
    depth: p.mm('奥行き', 200, 600, 300),
    rows: p.number({ label: '段数', min: 1, max: 8, step: 1, default: 5, group: '形' }),
    cols: p.number({ label: '列数', min: 1, max: 5, step: 1, default: 1, group: '形' }),
    back: p.bool('背板', true),
    base: p.select('足もと', BASE_LABELS, 'plinth'),
    finish: p.select('素材', finishOptions(['wood', 'melamine', 'steel']), 'wood', { group: '色・素材' }),
    color: p.color('色', '#d2ad7c', { swatches: BODY_SWATCHES }),
  },
  presets: [
    { name: '本棚', params: {} },
    { name: '壁一面の本棚', params: { width: 1600, height: 2000, rows: 6, cols: 2 } },
    { name: 'カラーボックス（縦）', params: { width: 420, height: 880, depth: 295, rows: 3, cols: 1, base: 'none', finish: 'melamine', color: '#f4f4f2' } },
    { name: 'カラーボックス（横）', params: { width: 1150, height: 420, depth: 295, rows: 1, cols: 3, base: 'none', finish: 'melamine', color: '#f4f4f2' } },
    { name: 'レンジ台', params: { width: 600, height: 1200, depth: 450, rows: 3, cols: 1, back: false, base: 'casters', finish: 'melamine', color: '#f4f4f2' } },
    { name: '見せる収納（ロー）', params: { width: 1200, height: 800, depth: 350, rows: 2, cols: 3, base: 'legs', color: '#8f5f3d' } },
    { name: 'スチールシェルフ', params: { width: 900, height: 1800, depth: 400, rows: 5, finish: 'steel', color: '#e6e6e3', base: 'adjusters', back: false } },
  ],
  surfaces: (prm) => storageSurfaces(shelfSpec(prm)),
  build: (prm) => buildStorage(shelfSpec(prm)),
})

function shelfSpec(q: { width: number; height: number; depth: number; rows: number; cols: number; back: boolean; base: string; finish: string; color: string }): StorageSpec {
  return {
    W: q.width,
    H: q.height,
    D: q.depth,
    finish: q.finish as Finish,
    color: q.color,
    cols: q.cols,
    sections: [{ kind: 'open', rows: q.rows, weight: 1 }],
    span: 'cell',
    open: 0,
    handle: 'none',
    base: q.base as Base,
    back: q.back,
  }
}

const frontOptions = (exclude: FrontKind[] = []) => Object.fromEntries(Object.entries(FRONT_LABELS).filter(([k]) => !exclude.includes(k as FrontKind))) as Record<FrontKind, string>

export const cabinet = defineAsset({
  type: 'cabinet',
  label: '扉・引き出し付き収納',
  category: 'storage',
  description:
    'チェスト・ロッカー・引き戸書庫・食器棚・キャビネットなど、扉や引き出しのある収納。下段と上段で扉の種類を選べる。扉を開けると中の棚に物を置ける',
  placement: 'floor',
  params: {
    width: p.mm('幅', 300, 1800, 800),
    height: p.mm('高さ', 300, 2100, 900),
    depth: p.mm('奥行き', 300, 650, 450),
    cols: p.number({ label: '列数', min: 1, max: 4, step: 1, default: 1, group: '形' }),
    lower: p.select('下段の扉', frontOptions(), 'drawers', { group: '形' }),
    lowerRows: p.number({ label: '下段の段数', min: 1, max: 8, step: 1, default: 4, group: '形' }),
    upperShare: p.number({ label: '上段の高さ', min: 0, max: 0.9, step: 0.05, default: 0, group: '形', hint: '0 なら上段なし（全部が下段）' }),
    upper: p.select('上段の扉', frontOptions(), 'glassSliding', { group: '形' }),
    upperRows: p.number({ label: '上段の段数', min: 1, max: 6, step: 1, default: 2, group: '形' }),
    span: p.select('扉の分け方', SPAN_LABELS, 'cell', { group: '形' }),
    open: p.number({ label: '開き具合', min: 0, max: 1, step: 0.05, default: 0, group: '形' }),
    handle: p.select('取っ手', HANDLE_LABELS, 'bar', { group: '形' }),
    base: p.select('足もと', BASE_LABELS, 'plinth'),
    finish: p.select('素材', finishOptions(), 'wood', { group: '色・素材' }),
    color: p.color('本体', '#d2ad7c', { swatches: BODY_SWATCHES }),
    frontColor: p.color('扉・前板', '#d2ad7c', { swatches: BODY_SWATCHES }),
  },
  presets: [
    { name: 'チェスト（4 段）', params: {} },
    { name: '横長チェスト', params: { width: 1200, height: 700, cols: 3, lowerRows: 2, handle: 'knob' } },
    { name: '衣装ケース', params: { width: 440, height: 1000, depth: 550, lowerRows: 5, finish: 'plastic', color: '#f4f4f2', frontColor: '#f4f4f2', handle: 'cup', base: 'casters' } },
    { name: 'ロッカー（1 人用）', params: { width: 380, height: 1790, depth: 515, lower: 'hinged', lowerRows: 4, span: 'column', handle: 'lever', finish: 'steel', color: '#e6e6e3', frontColor: '#e6e6e3', base: 'adjusters' } },
    { name: 'ロッカー（3 人用）', params: { width: 900, height: 1790, depth: 515, cols: 3, lower: 'hinged', lowerRows: 4, span: 'column', handle: 'lever', finish: 'steel', color: '#e6e6e3', frontColor: '#e6e6e3', base: 'adjusters' } },
    { name: '引き戸書庫', params: { width: 880, height: 1050, depth: 400, lower: 'sliding', lowerRows: 2, finish: 'steel', color: '#e6e6e3', frontColor: '#e6e6e3', base: 'adjusters' } },
    {
      name: 'スチール書庫（上ガラス）',
      params: { width: 880, height: 1790, depth: 400, lower: 'hinged', lowerRows: 2, upperShare: 0.55, upper: 'glassSliding', upperRows: 3, span: 'column', handle: 'lever', finish: 'steel', color: '#e6e6e3', frontColor: '#e6e6e3', base: 'adjusters' },
    },
    { name: '食器棚', params: { width: 900, height: 1800, depth: 450, lower: 'drawers', lowerRows: 2, upperShare: 0.6, upper: 'glass', upperRows: 3, span: 'row', color: '#f1ece4', frontColor: '#f1ece4', finish: 'melamine', handle: 'bar' } },
    { name: 'キャビネット（開き戸）', params: { width: 800, height: 850, depth: 400, lower: 'hinged', lowerRows: 2, span: 'whole', handle: 'knob', base: 'legs', color: '#8f5f3d', frontColor: '#8f5f3d' } },
    { name: 'サイドボード', params: { width: 1500, height: 700, depth: 420, cols: 3, lower: 'flap', lowerRows: 1, span: 'cell', handle: 'groove', base: 'legs', color: '#6b4a34', frontColor: '#6b4a34' } },
  ],
  surfaces: (prm) => storageSurfaces(cabinetSpec(prm)),
  body: (prm) => storageBody(cabinetSpec(prm)),
  build: (prm) => buildStorage(cabinetSpec(prm)),
})

function cabinetSpec(q: {
  width: number
  height: number
  depth: number
  cols: number
  lower: string
  lowerRows: number
  upperShare: number
  upper: string
  upperRows: number
  span: string
  open: number
  handle: string
  base: string
  finish: string
  color: string
  frontColor: string
}): StorageSpec {
  const sections = [{ kind: q.lower as FrontKind, rows: q.lowerRows, weight: 1 - q.upperShare }]
  if (q.upperShare > 0.02) sections.push({ kind: q.upper as FrontKind, rows: q.upperRows, weight: q.upperShare })
  return {
    W: q.width,
    H: q.height,
    D: q.depth,
    finish: q.finish as Finish,
    color: q.color,
    frontColor: q.frontColor,
    cols: q.cols,
    sections,
    span: q.span as Span,
    open: q.open,
    handle: q.handle as HandleKind,
    base: q.base as Base,
    back: true,
  }
}

export const tvStand = defineAsset({
  type: 'tvStand',
  label: 'テレビ台',
  category: 'av',
  description: 'テレビを置く低い台。テレビ（tv）を上に載せて使う。中の段にゲーム機などを置ける',
  placement: 'floor',
  params: {
    width: p.mm('幅', 600, 2000, 1200),
    height: p.mm('高さ', 250, 600, 400),
    depth: p.mm('奥行き', 280, 500, 400),
    style: p.select('スタイル', { open: 'オープン', drawers: '引き出し', doors: '扉付き', flap: 'フラップ扉' }, 'open'),
    legs: p.bool('脚付き', true),
    finish: p.select('素材', finishOptions(['wood', 'melamine']), 'wood', { group: '色・素材' }),
    color: p.color('本体', '#8f5f3d', { swatches: BODY_SWATCHES }),
  },
  surfaces: (prm) => storageSurfaces(tvSpec(prm)),
  body: (prm) => storageBody(tvSpec(prm)),
  build: (prm) => buildStorage(tvSpec(prm)),
})

function tvSpec(q: { width: number; height: number; depth: number; style: string; legs: boolean; finish: string; color: string }): StorageSpec {
  const kind: FrontKind = q.style === 'drawers' ? 'drawers' : q.style === 'doors' ? 'hinged' : q.style === 'flap' ? 'flap' : 'open'
  return {
    W: q.width,
    H: q.height,
    D: q.depth,
    finish: q.finish as Finish,
    color: q.color,
    cols: Math.max(2, Math.round(q.width / 450)),
    sections: [{ kind, rows: 1, weight: 1 }],
    span: 'cell',
    open: 0,
    handle: q.style === 'flap' ? 'groove' : 'groove',
    base: q.legs ? 'legs' : 'plinth',
    back: true,
  }
}

const RACK_FINISH = { chrome: 'クロムめっき', black: 'ブラック', white: 'ホワイト', gold: 'ゴールド' } as const

function rackMetal(finish: string) {
  return finish === 'chrome' ? mat('chrome', '#d9dcdf', { roughness: 0.14 }) : finish === 'gold' ? mat('chrome', '#c9a86a', { roughness: 0.22 }) : mat('powder', finish === 'black' ? '#262729' : '#f1f1ef')
}

type RackParams = { width: number; depth: number; height: number; shelves: number; shelfType: string; finish: string; feet: string; pole: string; boardColor: string; handle: boolean }

/** Height of the wire guard around basket shelves. */
const BASKET_RIM = 70

/** Height (top face) of every shelf, bottom first. */
function rackLevels(q: RackParams) {
  const n = Math.max(2, Math.round(q.shelves))
  const foot = q.feet === 'casters' ? 75 : 30
  const top = q.height - 40
  const board = q.shelfType === 'wire' ? 0 : q.shelfType === 'glass' ? 6 : 9
  return Array.from({ length: n }, (_, i) => foot + 25 + ((top - foot - 25) * i) / (n - 1) + board)
}

export const metalRack = defineAsset({
  type: 'metalRack',
  label: 'メタルラック',
  category: 'storage',
  description: 'ポールと棚板を組み合わせるスチールラック（ワイヤー棚・木目の棚板・ガラス）。キッチン・洗面所・押し入れなどに。各段に物を載せられる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 450, 1800, 910, { hint: '定番は 550 / 760 / 910 / 1220' }),
    depth: p.mm('奥行き', 300, 650, 460, { hint: '定番は 350 / 460 / 610' }),
    height: p.mm('高さ', 600, 2000, 1790),
    shelves: p.number({ label: '棚の数', min: 2, max: 8, step: 1, default: 5, group: '形' }),
    shelfType: p.select('棚板', { wire: 'ワイヤー', basket: 'かご（ふちのあるワイヤー）', board: '木目の板をのせる', glass: 'ガラスをのせる' }, 'wire', { group: '形' }),
    pole: p.select('ポール', { standard: '太い (25mm)', slim: '細い (19mm)' }, 'standard', { group: '形' }),
    feet: p.select('足もと', { adjuster: 'アジャスター', casters: 'キャスター' }, 'adjuster', { group: '形' }),
    handle: p.bool('持ち手', false, { hint: '一番上の棚の横に付く押し手（ワゴンに）' }),
    finish: p.select('色', RACK_FINISH, 'chrome', { group: '色・素材' }),
    boardColor: p.color('棚板の色', '#b8875a', { swatches: SWATCHES.wood }),
  },
  presets: [
    { name: 'キッチンラック', params: { width: 760, depth: 460, height: 1790, shelves: 5, feet: 'casters' } },
    { name: 'ブラック＋木目', params: { finish: 'black', shelfType: 'board', boardColor: '#8f5f3d' } },
    { name: 'ロー（3 段）', params: { width: 910, height: 900, shelves: 3, pole: 'slim', finish: 'white', shelfType: 'board', boardColor: '#e4cfa8' } },
    { name: 'すき間ラック', params: { width: 450, depth: 350, height: 1500, shelves: 5, pole: 'slim' } },
    { name: 'キッチンワゴン', params: { width: 450, depth: 300, height: 820, shelves: 3, shelfType: 'basket', pole: 'slim', feet: 'casters', finish: 'white', handle: true } },
  ],
  surfaces: (q) => {
    const lv = rackLevels(q)
    const r = q.pole === 'slim' ? 9.5 : 12.5
    const rect = { minX: -q.width / 2 + r, maxX: q.width / 2 - r, minZ: -q.depth / 2 + r, maxZ: q.depth / 2 - r }
    const top: Surface = { y: lv[lv.length - 1], ...rect, label: '一番上の棚' }
    return [top, ...lv.slice(0, -1).map((y, i) => ({ y, ...rect, clearance: lv[i + 1] - y - 30, label: `${i + 1}段目` }))]
  },
  build(q) {
    const g = group()
    const metal = rackMetal(q.finish)
    const r = q.pole === 'slim' ? 9.5 : 12.5
    const W = q.width
    const D = q.depth
    const lv = rackLevels(q)
    const footH = q.feet === 'casters' ? 75 : 30
    const poleTop = q.height
    const poles: THREE.Mesh[] = []
    const wires: THREE.Mesh[] = []
    const grooves: THREE.Mesh[] = []
    const corners: [number, number][] = [
      [-W / 2 + r, -D / 2 + r],
      [W / 2 - r, -D / 2 + r],
      [-W / 2 + r, D / 2 - r],
      [W / 2 - r, D / 2 - r],
    ]
    corners.forEach(([x, z], i) => {
      poles.push(cyl(r, r, poleTop - footH, metal, [x, footH + (poleTop - footH) / 2, z], { segments: 18 }))
      // Grooves every inch along the pole, as on real rack poles.
      for (let y = footH + 30; y < poleTop - 10; y += 25.4) grooves.push(new THREE.Mesh(new THREE.TorusGeometry(r, 0.9, 4, 14), metal).translateX(x).translateY(y).translateZ(z).rotateX(Math.PI / 2))
      poles.push(cyl(r + 1, r + 1, 8, metal, [x, poleTop - 4, z], { segments: 18 })) // cap
      if (q.feet === 'casters') {
        const c = caster(footH, { turn: deg(i * 41), lock: i < 2 })
        c.position.set(x, 0, z)
        g.add(c)
      } else {
        poles.push(cyl(r * 0.9, r * 1.2, footH - 8, metal, [x, 8 + (footH - 8) / 2, z], { segments: 16 }))
        const a = adjuster(8, r * 1.3)
        a.position.set(x, 0, z)
        g.add(a)
      }
    })
    const wireR = 2.2
    for (const top of lv) {
      const y = top - (q.shelfType === 'wire' ? 0 : q.shelfType === 'glass' ? 6 : 9)
      // Frame: front and back rails (flat bars), side rails, conical sleeves on the poles.
      for (const z of [-D / 2 + r, D / 2 - r]) wires.push(panelOn(W - r * 2, 22, 3, metal, 0, y - 22, z, { edge: 1 }))
      for (const x of [-W / 2 + r, W / 2 - r]) wires.push(panelOn(3, 22, D - r * 2, metal, x, y - 22, 0, { edge: 1 }))
      for (const [x, z] of corners) wires.push(cyl(r + 2, r + 5, 34, metal, [x, y - 12, z], { segments: 16 }))
      // Wires front to back, and two trusses underneath.
      const n = Math.max(6, Math.round((W - r * 2) / 24))
      for (let k = 1; k < n; k++) {
        const x = -W / 2 + r + ((W - r * 2) * k) / n
        wires.push(cyl(wireR, wireR, D - r * 2, metal, [x, y - wireR, 0], { rot: [Math.PI / 2, 0, 0], segments: 6 }))
      }
      for (const z of [-D / 6, D / 6]) wires.push(cyl(wireR, wireR, W - r * 2, metal, [0, y - wireR * 3, z], { rot: [0, 0, Math.PI / 2], segments: 6 }))
      if (q.shelfType === 'basket') {
        // Guard rails around the basket: a top wire and uprights every few centimetres.
        const top = y + BASKET_RIM
        for (const z of [-D / 2 + r, D / 2 - r]) wires.push(cyl(wireR, wireR, W - r * 2, metal, [0, top, z], { rot: [0, 0, Math.PI / 2], segments: 6 }))
        for (const x of [-W / 2 + r, W / 2 - r]) wires.push(cyl(wireR, wireR, D - r * 2, metal, [x, top, 0], { rot: [Math.PI / 2, 0, 0], segments: 6 }))
        const up = (x: number, z: number) => wires.push(cyl(1.6, 1.6, BASKET_RIM, metal, [x, y + BASKET_RIM / 2, z], { segments: 5 }))
        for (let k = 1; k < n; k++) for (const z of [-D / 2 + r, D / 2 - r]) up(-W / 2 + r + ((W - r * 2) * k) / n, z)
        const m = Math.max(3, Math.round((D - r * 2) / 24))
        for (let k = 1; k < m; k++) for (const x of [-W / 2 + r, W / 2 - r]) up(x, -D / 2 + r + ((D - r * 2) * k) / m)
      }
      if (q.shelfType === 'board') g.add(panelOn(W - r * 2 - 4, 9, D - r * 2 - 4, mat('wood', q.boardColor), 0, y, 0, { edge: 1.5 }))
      if (q.shelfType === 'glass') g.add(panelOn(W - r * 2 - 4, 6, D - r * 2 - 4, mat('glass', '#d9e8ea', { opacity: 0.3 }), 0, y, 0, { edge: 1 }))
    }
    if (q.handle) {
      // Push handle on the right side, just under the pole tops.
      const hx = W / 2 + 55
      const hy = poleTop - 30
      for (const z of [-D / 4, D / 4]) wires.push(cyl(5, 5, 55, metal, [W / 2 + 27, hy, z], { rot: [0, 0, Math.PI / 2], segments: 8 }))
      wires.push(cyl(9, 9, D / 2 + 30, metal, [hx, hy, 0], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
    }
    g.add(merged(poles, metal), merged(wires, metal), merged(grooves, metal, { castShadow: false }))
    return g
  },
})

const CLOTHES = ['#f2efe9', '#3d4a5c', '#8fa9bf', '#c5687a', '#e8c76a', '#4d4f53', '#9fb59a', '#d9cbb4', '#2f2f31']
const LAUNDRY_KINDS = { clothes: '服（ハンガー）', laundry: '洗濯物（シャツ・タオル・ピンチハンガー）' } as const
type LaundryKind = keyof typeof LAUNDRY_KINDS

/**
 * Things hanging from a horizontal rail at `railY` (mm), spread over `usable` mm along X: coats and
 * shirts on hangers, or drying laundry (T-shirts, towels folded over the rail, a pinch hanger with socks).
 * Shared by the hanger rack (and its indoor drying preset) and the ceiling drying pole.
 */
function hangOnRail(usable: number, railY: number, n: number, kind: LaundryKind, seed: number) {
  const g = new THREE.Group()
  const rr = rng(n * 17 + seed)
  const hook = mat('metal', '#c9ccd0')
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -usable / 2 + (usable / (n - 1)) * i + (rr() - 0.5) * 20
    const fab = mat('fabric', CLOTHES[Math.floor(rr() * CLOTHES.length)])
    const hang = new THREE.Group()
    const pick = kind === 'clothes' ? 'coat' : i % 4 === 1 ? 'towel' : i % 4 === 3 ? 'pinch' : 'shirt'
    if (pick === 'coat') {
      const long = rr() < 0.3
      const ch = long ? 950 + rr() * 200 : 600 + rr() * 150
      const cw = 420 + rr() * 80
      hang.add(rbox(55, ch, cw, 22, fab, [0, -ch / 2 - 60, 0]))
      // shoulders
      hang.add(rbox(60, 60, cw + 60, 28, fab, [0, -80, 0]))
      // hanger hook
      hang.add(cyl(4, 4, 70, hook, [0, -30, 0]))
    } else if (pick === 'shirt') {
      // A T-shirt on a hanger: a thin body and short sleeves angled down.
      const ch = 640 + rr() * 80
      const cw = 470 + rr() * 50
      hang.add(rbox(18, ch, cw, 8, fab, [0, -ch / 2 - 70, 0]))
      for (const s of [-1, 1]) {
        const sl = rbox(14, 170, 130, 6, fab)
        sl.position.set(0, -140, s * (cw / 2 + 25))
        sl.rotation.x = -s * 0.6
        hang.add(sl)
      }
      hang.add(cyl(3, 3, 60, hook, [0, -30, 0]))
      hang.add(cyl(3, 3, cw - 40, hook, [0, -62, 0], { rot: [Math.PI / 2, 0, 0], segments: 6 }))
    } else if (pick === 'towel') {
      // A bath towel folded over the rail: front and back halves.
      const tl = 520 + rr() * 120
      const tw = 340 + rr() * 60
      for (const s of [-1, 1]) hang.add(rbox(tw, tl, 7, 3, fab, [0, -tl / 2, s * 11], { grain: 'y' }))
      hang.add(cyl(15, 15, tw, fab, [0, 0, 0], { rot: [0, 0, Math.PI / 2], segments: 12 }))
    } else {
      // A pinch hanger: a square frame on a hook, with socks and hand towels clipped below.
      const fw = 380
      const s = (fw / 2) * Math.SQRT1_2
      const plastic = mat('plastic', '#f2f2ef', { roughness: 0.4 })
      for (const [a, b] of [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]] as const)
        hang.add(cyl(5, 5, Math.hypot(b[0] - a[0], b[1] - a[1]), plastic, [(a[0] + b[0]) / 2, -170, (a[1] + b[1]) / 2], { rot: a[0] === b[0] ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2], segments: 6 }))
      hang.add(cyl(3, 3, 170, hook, [0, -85, 0]))
      for (let k = 0; k < 6; k++) {
        const x = [-s, 0, s][k % 3]
        const z = k < 3 ? -s : s
        const sock = k % 3 !== 1
        const c = mat('fabric', CLOTHES[(i + k * 3) % CLOTHES.length])
        hang.add(rbox(sock ? 90 : 220, sock ? 230 : 280, 8, 3, c, [x, -180 - (sock ? 115 : 140), z]))
        hang.add(boxOn(14, 22, 12, plastic, x, -192, z))
      }
    }
    hang.position.set(x, railY, 0)
    hang.rotation.y += (rr() - 0.5) * 0.25
    g.add(hang)
  }
  return g
}

export const hangerRack = defineAsset({
  type: 'hangerRack',
  label: 'ハンガーラック',
  category: 'storage',
  description: '服をかけるラック。服をかけた状態も表示できる。洗濯物を干した室内物干しにもなる',
  placement: 'floor',
  // Nothing is meant to stand on it.
  surfaces: () => [],
  params: {
    width: p.mm('幅', 600, 1600, 1000),
    height: p.mm('高さ', 1300, 1900, 1650),
    depth: p.mm('奥行き', 350, 600, 450),
    clothes: p.number({ label: '服の数', min: 0, max: 20, step: 1, default: 9, group: '形' }),
    kind: p.select('かける物', LAUNDRY_KINDS, 'clothes', { group: '形' }),
    shelf: p.bool('下段の棚', true),
    color: p.color('フレーム', '#2b2b2b', { swatches: [...SWATCHES.metal, '#b8875a', '#f2efe9'] }),
  },
  presets: [{ name: '室内物干し', params: { width: 1300, height: 1600, depth: 550, clothes: 7, kind: 'laundry', shelf: false, color: '#d7d9dc' } }],
  build({ width: W, height: H, depth: D, clothes, kind, shelf, color }) {
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
    g.add(hangOnRail(W - 160, H - r, Math.round(clothes), kind as LaundryKind, Math.round(W)))
    return g
  },
})

// ---- Wall-mounted storage ----------------------------------------------------------------------

const WALL_STYLES = {
  board: '1 枚板の棚',
  open: '箱の棚（扉なし）',
  hinged: '開き戸',
  sliding: '引き戸',
  flap: 'フラップ扉（下に開く）',
  glass: 'ガラス開き戸',
} as const
type WallStyle = keyof typeof WALL_STYLES

type WallStorageParams = {
  style: WallStyle
  width: number
  height: number
  depth: number
  rows: number
  cols: number
  bracket: string
  open: number
  handle: string
  finish: string
  color: string
}

/** Thickness of a single wall board: floating shelves hide their fixing in a thicker board. */
const wallBoardT = (q: WallStorageParams) => (q.bracket === 'hidden' ? 30 : 20)

/** Top face of each board of a board shelf, bottom first. The brackets hang below the lowest one. */
function wallBoardLevels(q: WallStorageParams) {
  const n = Math.max(1, Math.round(q.rows))
  return Array.from({ length: n }, (_, i) => ((i + 1) * q.height) / n)
}

function wallStorageSpec(q: WallStorageParams): StorageSpec {
  return {
    W: q.width,
    H: q.height,
    D: q.depth,
    finish: q.finish as Finish,
    color: q.color,
    cols: q.cols,
    sections: [{ kind: q.style as FrontKind, rows: q.rows, weight: 1 }],
    span: q.style === 'hinged' || q.style === 'glass' ? 'column' : 'cell',
    open: q.open,
    handle: q.handle as HandleKind,
    base: 'none',
    back: true,
  }
}

export const wallStorage = defineAsset({
  type: 'wallStorage',
  label: '壁付けの棚・吊り戸棚',
  category: 'storage',
  description:
    '壁に取り付ける収納。1 枚板のウォールシェルフ・箱の飾り棚・吊り戸棚・天袋。床から浮いているので下に家具を置ける。棚の上や中に物を載せられ、物は棚と一緒に動く。奥行き 450 以上の扉付きは天井にぴったり付けて置く',
  placement: 'wall',
  // Shelves at about chest height; door cupboards above head height, deep ones (天袋) flush with the ceiling.
  elevation: (q, room) => {
    if (q.style === 'board' || q.style === 'open') return 1200
    return Math.max(0, Math.min(room.height - q.height, q.depth >= 450 ? Infinity : 1500))
  },
  contactShadow: false,
  params: {
    style: p.select('形', WALL_STYLES, 'board', { group: '形' }),
    width: p.mm('幅', 300, 2400, 800),
    height: p.mm('高さ', 100, 1200, 200, { hint: '1 枚板の棚では、一番上の板までの高さ（段が増えると板の間隔になる）' }),
    depth: p.mm('奥行き', 120, 650, 200),
    rows: p.number({ label: '段数', min: 1, max: 5, step: 1, default: 1, group: '形' }),
    cols: p.number({ label: '列数', min: 1, max: 4, step: 1, default: 1, group: '形', hint: '箱の棚・扉付きのとき' }),
    bracket: p.select('棚受け', { hidden: '見えない（浮いて見える）', iron: 'アイアン', wood: '木' }, 'iron', { group: '形', hint: '1 枚板の棚のとき' }),
    open: p.number({ label: '開き具合', min: 0, max: 1, step: 0.05, default: 0, group: '形' }),
    handle: p.select('取っ手', HANDLE_LABELS, 'groove', { group: '形' }),
    finish: p.select('素材', finishOptions(['wood', 'melamine', 'steel']), 'wood', { group: '色・素材' }),
    color: p.color('色', '#b8875a', { swatches: BODY_SWATCHES }),
  },
  presets: [
    { name: 'ウォールシェルフ', params: { style: 'board', width: 600, height: 180, depth: 180, bracket: 'hidden', color: '#d2ad7c' } },
    { name: 'アイアンの 2 段棚', params: { style: 'board', width: 900, height: 700, depth: 220, rows: 2, bracket: 'iron', color: '#8f5f3d' } },
    { name: '飾り棚（箱）', params: { style: 'open', width: 900, height: 300, depth: 220, cols: 3, finish: 'melamine', color: '#f4f4f2' } },
    { name: '吊り戸棚', params: { style: 'hinged', width: 900, height: 600, depth: 350, cols: 2, rows: 2, handle: 'bar', finish: 'melamine', color: '#f1ece4' } },
    { name: '天袋', params: { style: 'sliding', width: 1600, height: 450, depth: 600, finish: 'melamine', color: '#efe9df', handle: 'groove' } },
    { name: 'フラップ扉の吊り戸棚', params: { style: 'flap', width: 1200, height: 380, depth: 330, cols: 3, finish: 'wood', color: '#6b4a34' } },
  ],
  surfaces: (q) => {
    if (q.style !== 'board') return storageSurfaces(wallStorageSpec(q))
    const lv = wallBoardLevels(q)
    const t = wallBoardT(q)
    return lv.map((y, i) => ({
      y,
      minX: -q.width / 2,
      maxX: q.width / 2,
      minZ: -q.depth / 2,
      maxZ: q.depth / 2,
      clearance: i < lv.length - 1 ? lv[i + 1] - y - t : undefined,
      label: lv.length > 1 ? `${i + 1}段目` : '棚板',
    }))
  },
  body: (q) => (q.style === 'board' ? { min: { x: -q.width / 2, y: 0, z: -q.depth / 2 }, max: { x: q.width / 2, y: q.height, z: q.depth / 2 } } : storageBody(wallStorageSpec(q))),
  build(q) {
    if (q.style !== 'board') {
      const g = buildStorage(wallStorageSpec(q))
      // A hanging rail along the top of the back, as on real wall cupboards.
      g.add(boxOn(q.width - 60, 40, 8, mat('matte', '#3b3530'), 0, q.height - 60, -q.depth / 2 - 4))
      return g
    }
    const g = group()
    const wood = q.finish === 'steel' ? mat('powder', q.color) : q.finish === 'melamine' ? mat('matte', q.color, { roughness: 0.55 }) : mat('wood', q.color)
    const t = wallBoardT(q)
    const W = q.width
    const D = q.depth
    const iron = mat('powder', '#262729')
    const n = W > 900 ? 3 : 2
    const xs = Array.from({ length: n }, (_, i) => -W / 2 + W * 0.15 + ((W * 0.7) / (n - 1)) * i)
    const lv = wallBoardLevels(q)
    lv.forEach((top, i) => {
      g.add(panelOn(W, t, D, wood, 0, top - t, 0, { edge: q.bracket === 'hidden' ? 2 : 1.5, grain: 'x' }))
      if (q.bracket === 'hidden') return
      // Brackets under each board: as tall as the gap below allows, up to about the board's depth.
      const below = i === 0 ? top - t : top - t - lv[i - 1]
      const h = Math.max(40, Math.min(below, D * 0.8, 220))
      for (const x of xs) {
        if (q.bracket === 'iron') {
          const arm = Math.min(D - 20, h)
          g.add(panelOn(4, h, 25, iron, x, top - t - h, -D / 2 + 12.5, { edge: 1 }))
          g.add(panelOn(4, 4, arm, iron, x, top - t - 4, -D / 2 + arm / 2, { edge: 1 }))
          // Diagonal brace.
          const len = Math.hypot(arm * 0.8, h * 0.8)
          const brace = panelOn(4, len, 4, iron, 0, -len, 0, { edge: 1 })
          const pivot = group(brace)
          pivot.position.set(x, top - t - 4, -D / 2 + arm * 0.8)
          pivot.rotation.x = Math.atan2(arm * 0.8, h * 0.8)
          g.add(pivot)
        } else {
          // Wooden triangular brace.
          const sh = new THREE.Shape()
          const arm = Math.min(D - 20, h)
          sh.moveTo(0, 0)
          sh.lineTo(0, h)
          sh.lineTo(arm, h)
          sh.lineTo(arm, h - 20)
          sh.lineTo(20, 0)
          sh.closePath()
          const geo = new THREE.ExtrudeGeometry(sh, { depth: 18, bevelEnabled: false })
          geo.translate(0, 0, -9)
          geo.rotateY(-Math.PI / 2)
          const m = new THREE.Mesh(geo, wood)
          m.castShadow = true
          m.receiveShadow = true
          m.position.set(x, top - t - h, -D / 2)
          g.add(m)
        }
      }
    })
    return g
  },
})

// ---- Ceiling drying pole -------------------------------------------------------------------------

export const ceilingDryer = defineAsset({
  type: 'ceilingDryer',
  label: '天井の物干し',
  category: 'storage',
  description:
    '天井から 2 本の支柱で竿を吊るす室内物干し。洗濯物は床から浮いているので下を通れる・物を置けるが、背の高い家具とはぶつかる。天井から吊るす（position y は無視）',
  placement: 'ceiling',
  // Laundry hangs low enough to bump into a bookcase.
  blocks: true,
  contactShadow: false,
  surfaces: () => [],
  params: {
    length: p.mm('竿の長さ', 900, 2400, 1600),
    drop: p.mm('吊り下げの長さ', 250, 1100, 500, { hint: '天井から竿まで' }),
    clothes: p.number({ label: '洗濯物の数', min: 0, max: 14, step: 1, default: 6, group: '形' }),
    kind: p.select('かける物', LAUNDRY_KINDS, 'laundry', { group: '形' }),
    color: p.color('支柱と竿', '#f2f2ef', { swatches: ['#f2f2ef', '#d7d9dc', '#2b2b2e', '#c9a86a'] }),
  },
  presets: [
    { name: '何もかけない', params: { clothes: 0, drop: 300 } },
    { name: '窓ぎわに長く', params: { length: 2200, clothes: 10 } },
  ],
  build({ length: Lg, drop, clothes, kind, color }) {
    // Origin at the ceiling; everything hangs below it.
    const g = group()
    const metal = color === '#d7d9dc' ? mat('stainless', color) : mat('powder', color)
    for (const s of [-1, 1]) {
      const x = s * (Lg / 2 - 120)
      g.add(cyl(32, 32, 14, metal, [x, -7, 0], { segments: 24 }))
      g.add(cyl(9, 9, drop, metal, [x, -drop / 2, 0], { segments: 12 }))
      g.add(boxOn(30, 50, 24, metal, x, -drop - 22, 0))
    }
    g.add(cyl(13, 13, Lg, metal, [0, -drop, 0], { rot: [0, 0, Math.PI / 2], segments: 16 }))
    for (const s of [-1, 1]) g.add(cyl(15, 15, 20, mat('plastic', '#3a3b3e'), [s * (Lg / 2 + 10), -drop, 0], { rot: [0, 0, Math.PI / 2], segments: 16 }))
    g.add(hangOnRail(Lg - 300, -drop, Math.round(clothes), kind, Math.round(Lg)))
    return g
  },
})
