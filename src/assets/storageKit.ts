import * as THREE from 'three'
import { mat } from '../three/materials'
import { boxOn, cyl, deg, group, merged, panelOn } from './kit'
import { adjuster, atCorners, caster, drawer, hingedDoor, SEAM, slidingDoors, type HandleKind } from './parts'
import type { LocalBox, Surface } from './types'

/**
 * Builder for case furniture: open shelves, cabinets, chests, lockers, sliding-door bookcases.
 * One layout function decides where every board and opening is; geometry, support surfaces and
 * the collision body are all read from it, so they can never disagree.
 *
 * A carcass is split vertically into sections (bottom to top). Each section has a front kind
 * (open, doors, drawers…), a number of rows, and shares the carcass's columns.
 */

export type Finish = 'wood' | 'melamine' | 'steel' | 'plastic'
export const FINISH_LABELS: Record<Finish, string> = { wood: '木', melamine: '化粧板（白木・単色）', steel: 'スチール', plastic: '樹脂' }

export type FrontKind = 'open' | 'hinged' | 'glass' | 'sliding' | 'glassSliding' | 'drawers' | 'flap'
export const FRONT_LABELS: Record<FrontKind, string> = {
  open: 'オープン（扉なし）',
  hinged: '開き戸',
  glass: 'ガラス開き戸',
  sliding: '引き戸',
  glassSliding: 'ガラス引き戸',
  drawers: '引き出し',
  flap: 'フラップ扉（下に開く）',
}

/** How doors and drawers are divided over the grid of cells. */
export type Span = 'cell' | 'row' | 'column' | 'whole'
export const SPAN_LABELS: Record<Span, string> = { cell: 'マスごと', row: '横一列ごと', column: '縦一列ごと', whole: '全面で 1 枚（2 枚）' }

export type Base = 'none' | 'plinth' | 'legs' | 'casters' | 'adjusters'
export const BASE_LABELS: Record<Base, string> = { none: 'なし（床に直置き）', plinth: '台輪', legs: '脚', casters: 'キャスター', adjusters: 'アジャスター' }

export interface SectionSpec {
  kind: FrontKind
  rows: number
  /** Share of the inner height (sections are scaled to fill it). */
  weight: number
}

export interface StorageSpec {
  W: number
  H: number
  D: number
  finish: Finish
  color: string
  /** Colour of doors and drawer fronts (defaults to `color`). */
  frontColor?: string
  cols: number
  /** Bottom to top. */
  sections: SectionSpec[]
  span: Span
  /** 0..1: how far doors swing / drawers slide out. */
  open: number
  handle: HandleKind
  base: Base
  back: boolean
}

export interface Cell {
  x0: number
  x1: number
  y0: number
  y1: number
  row: number
  col: number
}

export interface SectionLayout {
  kind: FrontKind
  y0: number
  y1: number
  rows: number
  cells: Cell[]
}

export interface StorageLayout {
  t: number
  backT: number
  baseH: number
  /** Inner faces of the side panels. */
  x0: number
  x1: number
  /** Top of the bottom board and underside of the top board. */
  y0: number
  y1: number
  sections: SectionLayout[]
}

export function boardThickness(finish: Finish) {
  return finish === 'steel' ? 12 : finish === 'plastic' ? 10 : 18
}

export function baseHeight(base: Base) {
  return base === 'plinth' ? 60 : base === 'legs' ? 140 : base === 'casters' ? 60 : base === 'adjusters' ? 12 : 0
}

/** Where every board and opening goes. */
export function storageLayout(s: StorageSpec): StorageLayout {
  const t = boardThickness(s.finish)
  const backT = s.back ? (s.finish === 'steel' ? 2 : 5) : 0
  const baseH = baseHeight(s.base)
  const x0 = -s.W / 2 + t
  const x1 = s.W / 2 - t
  const y0 = baseH + t
  const y1 = s.H - t
  const cols = Math.max(1, Math.round(s.cols))
  const total = s.sections.reduce((a, x) => a + Math.max(0.05, x.weight), 0)
  // Sections are separated by a full board of thickness t.
  const inner = y1 - y0 - t * (s.sections.length - 1)
  let y = y0
  const sections: SectionLayout[] = s.sections.map((sec, i) => {
    const h = (inner * Math.max(0.05, sec.weight)) / total
    const rows = Math.max(1, Math.round(sec.rows))
    // Drawers spanning a whole row ignore the column dividers.
    const c = sec.kind === 'drawers' && s.span !== 'cell' ? 1 : cols
    const cw = (x1 - x0 - t * (c - 1)) / c
    // Sliding doors need no dividers inside the section either; shelves still have columns.
    const rh = (h - t * (rows - 1)) / rows
    const cells: Cell[] = []
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < c; k++) {
        const cx = x0 + k * (cw + t)
        const cy = y + r * (rh + t)
        cells.push({ x0: cx, x1: cx + cw, y0: cy, y1: cy + rh, row: r, col: k })
      }
    const out = { kind: sec.kind, y0: y, y1: y + h, rows, cells }
    y += h + (i < s.sections.length - 1 ? t : 0)
    return out
  })
  return { t, backT, baseH, x0, x1, y0, y1, sections }
}

export function finishMaterial(finish: Finish, color: string) {
  switch (finish) {
    case 'wood':
      return mat('wood', color)
    case 'melamine':
      return mat('matte', color, { roughness: 0.55 })
    case 'steel':
      return mat('powder', color)
    case 'plastic':
      return mat('plastic', color, { roughness: 0.35 })
  }
}

/** Support surfaces: index 0 is the top; then every open or door-closed cell, bottom section first. */
export function storageSurfaces(s: StorageSpec): Surface[] {
  const L = storageLayout(s)
  const out: Surface[] = [{ y: s.H, minX: -s.W / 2, maxX: s.W / 2, minZ: -s.D / 2, maxZ: s.D / 2, label: '天板' }]
  let n = 0
  for (const sec of L.sections) {
    if (sec.kind === 'drawers') continue
    const front = sec.kind === 'sliding' || sec.kind === 'glassSliding' ? s.D / 2 - 40 : s.D / 2 - 2
    for (const c of sec.cells) out.push({ y: c.y0, minX: c.x0, maxX: c.x1, minZ: -s.D / 2 + L.backT + 2, maxZ: front, clearance: c.y1 - c.y0, label: `${++n}段目` })
  }
  return out
}

/** The carcass box, without doors swung open or drawers pulled out. */
export function storageBody(s: StorageSpec): LocalBox {
  const front = s.sections.some((x) => x.kind !== 'open') ? 20 : 0
  return { min: { x: -s.W / 2, y: 0, z: -s.D / 2 }, max: { x: s.W / 2, y: s.H, z: s.D / 2 + front } }
}

/** Carcass: sides, top, bottom, back, section boards, shelves and dividers. */
function carcass(s: StorageSpec, L: StorageLayout, body: THREE.Material) {
  const g = new THREE.Group()
  const { t, baseH } = L
  const e = s.finish === 'steel' ? 2 : 1.5
  const shelfD = s.D - L.backT - (s.finish === 'steel' ? 10 : 2)
  const shelfZ = -s.D / 2 + L.backT + shelfD / 2
  for (const sx of [-1, 1]) g.add(panelOn(t, s.H - baseH, s.D, body, sx * (s.W / 2 - t / 2), baseH, 0, { edge: e, grain: 'y' }))
  g.add(panelOn(s.W - t * 2, t, s.D, body, 0, s.H - t, 0, { edge: e, grain: 'x' }))
  g.add(panelOn(s.W - t * 2, t, s.D, body, 0, baseH, 0, { edge: e, grain: 'x' }))
  if (s.back) g.add(boxOn(s.W - t * 2, s.H - baseH - t * 2, L.backT, s.finish === 'wood' ? body : finishMaterial(s.finish, s.color), 0, baseH + t, -s.D / 2 + L.backT / 2))
  L.sections.forEach((sec, i) => {
    if (i > 0) g.add(panelOn(s.W - t * 2, t, shelfD, body, 0, sec.y0 - t, shelfZ, { edge: e, grain: 'x' }))
    // Sliding doors run in tracks inside the front edge, so shelves behind them are shallower.
    const sliding = sec.kind === 'sliding' || sec.kind === 'glassSliding'
    const secD = sliding ? s.D - L.backT - 52 : shelfD
    const secZ = -s.D / 2 + L.backT + secD / 2
    const cols = new Set(sec.cells.map((c) => c.col)).size
    const rows = sec.rows
    // Shelves between rows (drawers have runners instead, shown as a thin dark rail).
    for (let r = 1; r < rows; r++) {
      const y = sec.cells.find((c) => c.row === r)!.y0 - t
      if (sec.kind === 'drawers') g.add(boxOn(s.W - t * 2, t, 8, mat('matte', SEAM), 0, y, s.D / 2 - 30))
      else g.add(panelOn(s.W - t * 2, t, secD, body, 0, y, secZ, { edge: e, grain: 'x' }))
    }
    // Column dividers.
    for (let k = 1; k < cols; k++) {
      const x = sec.cells.find((c) => c.col === k)!.x0 - t / 2
      g.add(panelOn(t, sec.y1 - sec.y0, secD, body, x, sec.y0, secZ, { edge: e, grain: 'y' }))
    }
    // Dark backing behind closed fronts so the gaps between them read as seams.
    // (Not behind glass, which shows the shelves inside.)
    // Only while closed: an open door shows the real interior.
    if (s.open < 0.03 && sec.kind !== 'open' && sec.kind !== 'glass' && sec.kind !== 'glassSliding') g.add(boxOn(s.W - t * 2, sec.y1 - sec.y0, 2, mat('matte', SEAM), 0, sec.y0, s.D / 2 - 32))
  })
  return g
}

function baseParts(s: StorageSpec, L: StorageLayout, body: THREE.Material) {
  const g = new THREE.Group()
  if (s.base === 'plinth') g.add(boxOn(s.W - 40, L.baseH, s.D - 50, mat('matte', s.finish === 'steel' ? '#2a2b2e' : '#3b2f28'), 0, 0, -10))
  if (s.base === 'legs') {
    const steel = s.finish === 'steel'
    g.add(
      atCorners(s.W, s.D, 50, () =>
        steel
          ? group(panelOn(30, L.baseH, 30, mat('powder', '#2a2b2e'), 0, 0, 0, { edge: 2 }))
          : (() => {
              const leg = cyl(18, 12, L.baseH, mat('wood', s.finish === 'wood' ? s.color : '#b8875a'), [0, L.baseH / 2, 0], { segments: 16 })
              return group(leg)
            })(),
      ),
    )
  }
  if (s.base === 'casters') g.add(atCorners(s.W, s.D, 45, (i) => caster(L.baseH, { turn: deg(i * 37), lock: i < 2 })))
  if (s.base === 'adjusters') g.add(atCorners(s.W, s.D, 40, () => adjuster(L.baseH)))
  void body
  return g
}

/** Merge cells into the rectangles each door / drawer covers. */
function frontRects(sec: SectionLayout, span: Span, kind: FrontKind): { x0: number; x1: number; y0: number; y1: number; col: number; row: number }[] {
  const cols = Math.max(...sec.cells.map((c) => c.col)) + 1
  const xs = (k: number) => sec.cells.find((c) => c.col === k)!
  const ys = (r: number) => sec.cells.find((c) => c.row === r)!
  const eff: Span = kind === 'drawers' ? (span === 'column' || span === 'whole' ? 'row' : span) : span
  if (eff === 'cell') return sec.cells.map((c) => ({ ...c }))
  if (eff === 'row') return Array.from({ length: sec.rows }, (_, r) => ({ x0: xs(0).x0, x1: xs(cols - 1).x1, y0: ys(r).y0, y1: ys(r).y1, col: 0, row: r }))
  if (eff === 'column') return Array.from({ length: cols }, (_, k) => ({ x0: xs(k).x0, x1: xs(k).x1, y0: sec.y0, y1: sec.y1, col: k, row: 0 }))
  return [{ x0: xs(0).x0, x1: xs(cols - 1).x1, y0: sec.y0, y1: sec.y1, col: 0, row: 0 }]
}

/** Doors, drawers and sliding panels in front of each section. */
function fronts(s: StorageSpec, L: StorageLayout, front: THREE.Material) {
  const g = new THREE.Group()
  const { t } = L
  const inner = finishMaterial(s.finish, s.finish === 'wood' ? '#e4cfa8' : s.color)
  const plasticFront = s.finish === 'plastic' ? mat('acrylic', '#f4f6f8', { opacity: 0.55, roughness: 0.35 }) : front
  for (const sec of L.sections) {
    if (sec.kind === 'open') continue
    if (sec.kind === 'sliding' || sec.kind === 'glassSliding') {
      // Two panels on tracks set just inside the front edge.
      const d = slidingDoors(L.x1 - L.x0, sec.y1 - sec.y0, { material: front, glass: sec.kind === 'glassSliding', open: s.open, t: s.finish === 'steel' ? 10 : 14 })
      d.position.set(0, sec.y0, s.D / 2 - 34)
      g.add(d)
      continue
    }
    const rects = frontRects(sec, s.span, sec.kind)
    // Full overlay: fronts cover half of each inner board and all of the outer edges.
    const grow = (v: number, outer: number, sign: number) => (Math.abs(v - outer) < 1 ? outer + sign * t : v + sign * (t / 2))
    rects.forEach((r, i) => {
      const fx0 = grow(r.x0, L.x0, -1)
      const fx1 = grow(r.x1, L.x1, 1)
      const fy0 = Math.abs(r.y0 - L.y0) < 1 ? r.y0 - t : r.y0 - t / 2
      const fy1 = Math.abs(r.y1 - L.y1) < 1 ? r.y1 + t : r.y1 + t / 2
      const w = fx1 - fx0
      const h = fy1 - fy0
      const cx = (fx0 + fx1) / 2
      if (sec.kind === 'drawers') {
        const dr = drawer(w, h, s.D - 40, { material: plasticFront, handle: s.handle, out: s.open * (s.D - 40) * (r.row === sec.rows - 1 ? 1 : 0.35), inner, t: s.finish === 'steel' ? 14 : 18 })
        dr.position.set(cx, fy0, s.D / 2)
        g.add(dr)
        return
      }
      if (sec.kind === 'flap') {
        const d = hingedDoor(w, h, { material: front, hinge: 'bottom', open: s.open, handle: s.handle })
        d.position.set(cx, fy0, s.D / 2)
        g.add(d)
        return
      }
      // Hinged doors. Wide openings get a pair; otherwise columns alternate their hinge side.
      const glass = sec.kind === 'glass'
      const pair = w > 700 || (s.span === 'whole' && w > 450) || (s.span === 'row' && w > 450)
      if (pair) {
        for (const side of ['left', 'right'] as const) {
          const d = hingedDoor(w / 2, h, { material: front, hinge: side, open: s.open, handle: s.handle, glass })
          d.position.set(cx + (side === 'left' ? -w / 4 : w / 4), fy0, s.D / 2)
          g.add(d)
        }
      } else {
        const d = hingedDoor(w, h, { material: front, hinge: (r.col + i) % 2 === 0 ? 'left' : 'right', open: s.open, handle: s.handle, glass })
        // Locker doors: ventilation louvres near the top and bottom of tall steel doors.
        if (s.handle === 'lever' && s.finish === 'steel' && h > 600 && !glass) {
          const leaf = d.children[0].children[0]
          const slits: THREE.Mesh[] = []
          for (const y0 of [h - 150, 60])
            for (let k = 0; k < 5; k++) slits.push(boxOn(w * 0.55, 6, 3, mat('matte', SEAM), 0, y0 + k * 16, 18.4))
          leaf.add(merged(slits, mat('matte', SEAM), { castShadow: false }))
        }
        d.position.set(cx, fy0, s.D / 2)
        g.add(d)
      }
    })
  }
  return g
}

export function buildStorage(s: StorageSpec) {
  const L = storageLayout(s)
  const body = finishMaterial(s.finish, s.color)
  const front = finishMaterial(s.finish, s.frontColor ?? s.color)
  return group(carcass(s, L, body), baseParts(s, L, body), fronts(s, L, front))
}
