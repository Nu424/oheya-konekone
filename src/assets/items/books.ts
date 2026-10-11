import * as THREE from 'three'
import { mat } from '../../three/materials'
import { rng } from '../../three/textures'
import { box, boxOn, deg, extrude, group, merged } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

/**
 * Books, binders and papers: things that go on shelves, desks and the floor.
 * A whole row or stack is one item so a shelf is filled with a few drags, not dozens.
 * Every book is built from real parts (covers, spine, a slightly smaller page block) and the
 * pieces are merged per colour so a long row stays cheap to draw.
 */

const PALETTES = {
  colorful: ['#c96f53', '#e2b75f', '#5d7a8c', '#8c9f7a', '#efe6d6', '#3d4a5c', '#a24d4d', '#d9cbb4', '#6f5b8a', '#2f2f31', '#4f7f73'],
  calm: ['#efe6d6', '#d9cbb4', '#b9b0a3', '#8c8a86', '#4d4f53', '#e4d7c3', '#a89f91'],
  mono: ['#f4f2ee', '#2b2b2e', '#8e9196', '#d6d4d0', '#4d5055'],
  pastel: ['#f2d3c0', '#cfe0e8', '#d9e4d3', '#efe1b4', '#e6d1e2', '#f4f2ee'],
  office: ['#3d5a80', '#2b2b2e', '#c4c6c8', '#a24d4d', '#4f7f73', '#e2b75f'],
} as const
const PALETTE_LABELS = { colorful: 'カラフル', calm: '落ち着いた色', mono: 'モノトーン', pastel: 'パステル', office: '事務用' } as const
type Palette = keyof typeof PALETTES

/** Size of one volume: height (along y), depth (into the shelf), and a thickness range. */
const KINDS = {
  books: { label: '単行本', h: [180, 200], d: [128, 140], t: [16, 32] },
  bunko: { label: '文庫', h: [148, 152], d: [105, 106], t: [8, 18] },
  manga: { label: 'マンガ', h: [175, 182], d: [112, 128], t: [12, 16] },
  large: { label: '大判・図鑑', h: [250, 300], d: [182, 220], t: [14, 30] },
  magazines: { label: '雑誌', h: [276, 297], d: [210, 220], t: [4, 9] },
  binders: { label: 'バインダー', h: [310, 318], d: [255, 285], t: [35, 65] },
  files: { label: 'フラットファイル', h: [307, 310], d: [235, 240], t: [10, 16] },
} as const
type Kind = keyof typeof KINDS

interface Parts {
  add(color: string, mesh: THREE.Mesh): void
  build(): THREE.Group
}

/** Collects meshes by material and merges them at the end. */
function parts(material: (color: string) => THREE.Material): Parts {
  const byColor = new Map<string, THREE.Mesh[]>()
  return {
    add(color, mesh) {
      if (!byColor.has(color)) byColor.set(color, [])
      byColor.get(color)!.push(mesh)
    },
    build() {
      const g = new THREE.Group()
      for (const [c, list] of byColor) g.add(merged(list, material(c)))
      return g
    },
  }
}

const PAGE = '#f1ead9'
const ink = (c: string) => (new THREE.Color(c).getHSL({ h: 0, s: 0, l: 0 }).l > 0.6 ? '#3b3f45' : '#efe6d6')

/**
 * One upright volume standing on y = 0, spine facing +Z, centred on x = 0.
 * Hardcovers overhang the page block; magazines and files are thin all through.
 */
function volume(out: Parts, kind: Kind, t: number, h: number, d: number, color: string, r: () => number, tf: THREE.Matrix4) {
  const put = (c: string, m: THREE.Mesh) => {
    m.applyMatrix4(tf)
    out.add(c, m)
  }
  if (kind === 'binders') {
    // Board covers with a rounded spine, a label window, and a finger hole.
    put(color, box(t, h, d, mat('matte', color), [0, h / 2, -d / 2]))
    put('#f4f2ee', box(t * 0.6, h * 0.28, 1, mat('matte', '#f4f2ee'), [0, h * 0.62, 0.5]))
    put('#1d1a18', box(t * 0.4, 18, 1, mat('matte', '#1d1a18'), [0, h * 0.18, 0.6]))
    return
  }
  if (kind === 'magazines' || kind === 'files') {
    put(color, box(t, h, d, mat('matte', color), [0, h / 2, -d / 2]))
    if (kind === 'files') put('#f4f2ee', box(t * 0.7, 60, 1, mat('matte', '#f4f2ee'), [0, h * 0.7, 0.5]))
    else put(PAGE, box(t - 1, 1, d - 2, mat('paper', PAGE), [0, h + 0.5, -d / 2]))
    return
  }
  const cover = Math.min(2.5, t * 0.12)
  const over = kind === 'bunko' || kind === 'manga' ? 1 : 3
  // Page block, slightly lower and shallower than the covers.
  put(PAGE, box(t - cover * 2, h - over * 2, d - over - cover, mat('paper', PAGE), [0, h / 2, -d / 2 - (over - cover) / 2]))
  for (const s of [-1, 1]) put(color, box(cover, h, d, mat('matte', color), [s * (t / 2 - cover / 2), h / 2, -d / 2]))
  put(color, box(t, h, cover, mat('matte', color), [0, h / 2, -cover / 2]))
  // Title band on the spine of some books.
  if (r() < 0.65) {
    const band = ink(color)
    put(band, box(t * 0.62, h * (0.08 + r() * 0.2), 0.6, mat('matte', band), [0, h * (0.55 + r() * 0.25), 0.3]))
    if (r() < 0.6) put(band, box(t * 0.5, 4, 0.6, mat('matte', band), [0, h * 0.12, 0.3]))
  }
}

function rand(r: () => number, [a, b]: readonly [number, number]) {
  return a + (b - a) * r()
}

export const bookRow = defineAsset({
  type: 'bookRow',
  label: '本の列（縦置き）',
  category: 'small',
  description: '本棚や机に立てて並べた本・バインダー・ファイル。幅を決めると、その幅ぶんだけ並ぶ。棚の段の上に置く',
  placement: 'onTop',
  surfaces: () => [],
  contactShadow: false,
  params: {
    width: p.mm('幅', 60, 1200, 400),
    kind: p.select('種類', Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.label])) as Record<Kind, string>, 'books', { group: '形' }),
    palette: p.select('色', PALETTE_LABELS, 'colorful', { group: '色・素材' }),
    lean: p.bool('端の 1 冊を斜めに', true),
    bookends: p.bool('ブックエンド', false),
    seed: p.number({ label: '並び', min: 1, max: 50, step: 1, default: 1, group: 'その他', hint: '数字を変えると、本の並び・厚み・色が入れ替わる' }),
  },
  presets: [
    { name: '文庫の列', params: { kind: 'bunko', width: 300, palette: 'calm' } },
    { name: 'マンガ全巻', params: { kind: 'manga', width: 500, palette: 'colorful' } },
    { name: 'バインダー', params: { kind: 'binders', width: 350, palette: 'office', lean: false } },
    { name: '雑誌', params: { kind: 'magazines', width: 200, palette: 'pastel', bookends: true } },
  ],
  build({ width: W, kind, palette, lean, bookends, seed }) {
    const r = rng(seed * 977 + Math.round(W))
    const k = KINDS[kind as Kind]
    const pal = PALETTES[palette as Palette]
    const out = parts((c) => (c === PAGE ? mat('paper', PAGE) : mat('matte', c)))
    const g = group()
    const endT = bookends ? 2 : 0
    let x = -W / 2 + endT + (bookends ? 1 : 0)
    const end = W / 2 - endT - (bookends ? 1 : 0)
    // One series (same height/depth) for manga and bunko, varied sizes for the rest.
    const series = kind === 'manga' || kind === 'bunko' || kind === 'binders' || kind === 'files'
    const sh = rand(r, k.h)
    const sd = rand(r, k.d)
    const seriesColor = pal[Math.floor(r() * pal.length)]
    let maxD = 0
    let leanBook: { t: number; h: number; d: number; color: string } | null = null
    for (let i = 0; i < 400; i++) {
      const t = Math.round(rand(r, k.t))
      const h = series ? sh : rand(r, k.h)
      const d = series ? sd : rand(r, k.d)
      const color = series && kind === 'manga' && r() < 0.8 ? seriesColor : pal[Math.floor(r() * pal.length)]
      if (lean && !bookends && end - x < t + h * 0.45 && end - x > t) {
        leanBook = { t, h, d, color }
        break
      }
      if (x + t > end) break
      volume(out, kind as Kind, t - 0.6, h, d, color, r, new THREE.Matrix4().makeTranslation(x + t / 2, 0, 0))
      maxD = Math.max(maxD, d)
      x += t
    }
    if (leanBook) {
      // The last volume leans on its neighbour: it pivots on its bottom-left corner until its top
      // touches the previous spine, with its foot still inside the row.
      const { t, h, d, color } = leanBook
      let a = deg(24)
      while (a > deg(4) && x + h * Math.sin(a) + t * Math.cos(a) > end) a -= deg(1)
      const m = new THREE.Matrix4()
        .makeTranslation(x + h * Math.sin(a), 0, 0)
        .multiply(new THREE.Matrix4().makeRotationZ(a))
        .multiply(new THREE.Matrix4().makeTranslation(t / 2, 0, 0))
      volume(out, kind as Kind, t - 0.6, h, d, color, r, m)
      maxD = Math.max(maxD, d)
    }
    g.add(out.build())
    if (bookends) {
      const steel = mat('powder', '#2b2b2e')
      for (const s of [-1, 1]) {
        g.add(boxOn(1.5, 150, 120, steel, s * (W / 2 - 1), 0, -maxD / 2))
        g.add(boxOn(120, 1.5, 120, steel, s * (W / 2 - 60), 0, -maxD / 2))
      }
    }
    // The row is built with spines at z = 0; centre it on its depth.
    g.position.z = maxD / 2
    return group(g)
  },
})

const STACK_KINDS = {
  books: { label: '本', w: [130, 190], d: [180, 260], t: [14, 38] },
  large: { label: '大判の本', w: [210, 260], d: [260, 310], t: [12, 26] },
  magazines: { label: '雑誌', w: [210, 220], d: [276, 297], t: [4, 9] },
  paper: { label: 'コピー用紙・書類', w: [210, 210], d: [297, 297], t: [5, 12] },
  clearFolders: { label: 'クリアファイル', w: [220, 220], d: [310, 310], t: [2, 5] },
} as const
type StackKind = keyof typeof STACK_KINDS

export const bookStack = defineAsset({
  type: 'bookStack',
  label: '本・書類の平積み',
  category: 'small',
  description: '平積みにした本・雑誌・書類・クリアファイル。机や棚、床の上に置く。上にも物を置ける',
  placement: 'onTop',
  params: {
    kind: p.select('種類', Object.fromEntries(Object.entries(STACK_KINDS).map(([k, v]) => [k, v.label])) as Record<StackKind, string>, 'books', { group: '形' }),
    count: p.number({ label: '冊数・束の数', min: 1, max: 15, step: 1, default: 4, group: 'サイズ' }),
    mess: p.number({ label: '散らかり具合', min: 0, max: 1, step: 0.1, default: 0.3, group: '形' }),
    palette: p.select('色', PALETTE_LABELS, 'colorful', { group: '色・素材' }),
    seed: p.number({ label: '並び', min: 1, max: 50, step: 1, default: 1, group: 'その他' }),
  },
  presets: [
    { name: '書類の山', params: { kind: 'paper', count: 6, mess: 0.6 } },
    { name: 'クリアファイル', params: { kind: 'clearFolders', count: 8, mess: 0.2, palette: 'pastel' } },
    { name: 'きっちり', params: { mess: 0 } },
  ],
  surfaces: (prm) => {
    const { h, w, d } = stackSize(prm)
    return [{ y: h, minX: -w / 2 + 10, maxX: w / 2 - 10, minZ: -d / 2 + 10, maxZ: d / 2 - 10, label: '一番上' }]
  },
  build(prm) {
    return stackBuild(prm)
  },
})

type StackParams = { kind: string; count: number; mess: number; palette: string; seed: number }

function stackLayers({ kind, count, mess, palette, seed }: StackParams) {
  const r = rng(seed * 131 + Math.round(count) * 7 + kind.length)
  const k = STACK_KINDS[kind as StackKind]
  const pal = PALETTES[palette as Palette]
  const out: { w: number; d: number; t: number; dx: number; dz: number; turn: number; color: string }[] = []
  for (let i = 0; i < Math.round(count); i++)
    out.push({
      w: rand(r, k.w),
      d: rand(r, k.d),
      t: rand(r, k.t),
      dx: (r() - 0.5) * 30 * mess,
      dz: (r() - 0.5) * 30 * mess,
      turn: (r() - 0.5) * deg(22) * mess,
      color: kind === 'paper' ? (r() < 0.75 ? '#f6f4ef' : pal[Math.floor(r() * pal.length)]) : pal[Math.floor(r() * pal.length)],
    })
  return out
}

function stackSize(prm: StackParams) {
  const layers = stackLayers(prm)
  return { h: layers.reduce((s, l) => s + l.t, 0), w: Math.min(...layers.map((l) => l.w)), d: Math.min(...layers.map((l) => l.d)) }
}

function stackBuild(prm: StackParams) {
  const kind = prm.kind as StackKind
  const out = parts((c) => (c === PAGE ? mat('paper', PAGE) : kind === 'clearFolders' ? mat('acrylic', c, { opacity: 0.55, roughness: 0.2 }) : kind === 'paper' ? mat('paper', c) : mat('matte', c)))
  let y = 0
  const r = rng(prm.seed * 17)
  for (const l of stackLayers(prm)) {
    const tf = new THREE.Matrix4().makeTranslation(l.dx, y, l.dz).multiply(new THREE.Matrix4().makeRotationY(l.turn))
    const add = (c: string, m: THREE.Mesh) => {
      m.applyMatrix4(tf)
      out.add(c, m)
    }
    if (kind === 'books' || kind === 'large') {
      // Lying on its back: covers top and bottom, spine on the -X side.
      const cover = Math.min(2.5, l.t * 0.12)
      add(PAGE, box(l.w - 4, l.t - cover * 2, l.d - 6, mat('paper', PAGE), [1, l.t / 2, 0]))
      for (const yy of [cover / 2, l.t - cover / 2]) add(l.color, box(l.w, cover, l.d, mat('matte', l.color), [0, yy, 0]))
      add(l.color, box(cover, l.t, l.d, mat('matte', l.color), [-l.w / 2 + cover / 2, l.t / 2, 0]))
      if (r() < 0.5) {
        const band = ink(l.color)
        add(band, box(l.w * 0.5, 0.6, l.d * 0.18, mat('matte', band), [0, l.t + 0.3, l.d * 0.2]))
      }
    } else if (kind === 'paper') {
      add(l.color, box(l.w, l.t, l.d, mat('paper', l.color), [0, l.t / 2, 0]))
    } else {
      add(l.color, box(l.w, l.t, l.d, mat('matte', l.color), [0, l.t / 2, 0]))
    }
    y += l.t
  }
  return out.build()
}

export const fileBox = defineAsset({
  type: 'fileBox',
  label: 'ファイルボックス',
  category: 'small',
  description: '書類やファイルを立てて入れる箱。横から見ると斜めに切れている。棚に並べたり机に置いたりする',
  placement: 'onTop',
  surfaces: () => [],
  params: {
    width: p.mm('幅', 75, 200, 100),
    height: p.mm('高さ', 240, 330, 320),
    depth: p.mm('奥行き', 240, 340, 280),
    material: p.select('素材', { plastic: 'プラスチック', paper: '紙（段ボール）', steel: 'スチール' }, 'plastic', { group: '色・素材' }),
    color: p.color('色', '#f4f2ee', { swatches: ['#f4f2ee', '#c4c6c8', '#2b2b2e', '#d9cbb4', '#3d5a80', '#9fb5a5', '#e8c76a'] }),
    contents: p.select('中身', { none: 'からっぽ', files: 'ファイル', papers: '書類' }, 'files'),
  },
  presets: [
    { name: '紙のファイルボックス', params: { material: 'paper', color: '#e3cfa8' } },
    { name: 'スチール', params: { material: 'steel', color: '#2b2b2e' } },
  ],
  build({ width: W, height: H, depth: D, material, color, contents }) {
    const m = material === 'steel' ? mat('powder', color) : material === 'paper' ? mat('cardboard', color) : mat('plastic', color, { roughness: 0.5 })
    const t = material === 'steel' ? 1.2 : 2.5
    const g = group()
    // Side profile: full height at the back, sloping down to a low front.
    const front = H * 0.42
    const side = new THREE.Shape()
    side.moveTo(-D / 2, 0)
    side.lineTo(D / 2, 0)
    side.lineTo(D / 2, front)
    side.lineTo(-D / 2 + D * 0.32, H)
    side.lineTo(-D / 2, H)
    side.lineTo(-D / 2, 0)
    for (const s of [-1, 1]) g.add(extrude(side, t, m, [s * (W / 2 - t / 2), 0, 0], { rot: [0, -Math.PI / 2, 0] }))
    g.add(boxOn(W - t * 2, t, D, m, 0, 0, 0))
    g.add(boxOn(W - t * 2, H, t, m, 0, 0, -D / 2 + t / 2))
    g.add(boxOn(W - t * 2, front, t, m, 0, 0, D / 2 - t / 2))
    // A finger hole in the back panel.
    g.add(box(W * 0.45, 18, 0.6, mat('matte', '#1d1a18'), [0, H - 40, -D / 2 - 0.2]))
    if (contents !== 'none') {
      const r = rng(Math.round(W + D))
      const cols = contents === 'files' ? ['#3d5a80', '#e2b75f', '#a24d4d', '#4f7f73', '#f4f2ee'] : ['#f6f4ef', '#f6f4ef', '#efe9df']
      const n = Math.max(2, Math.floor((W - 12) / (contents === 'files' ? 14 : 9)))
      const meshes: Record<string, THREE.Mesh[]> = {}
      for (let i = 0; i < n; i++) {
        const c = cols[Math.floor(r() * cols.length)]
        const th = contents === 'files' ? 10 : 6
        const hh = H * (0.82 + r() * 0.1)
        ;(meshes[c] ??= []).push(box(th, hh, D * 0.86, mat('matte', c), [-W / 2 + 8 + (i + 0.5) * ((W - 16) / n), hh / 2 + t, -4]))
      }
      for (const [c, list] of Object.entries(meshes)) g.add(merged(list, contents === 'files' ? mat('matte', c) : mat('paper', c)))
    }
    return g
  },
})

