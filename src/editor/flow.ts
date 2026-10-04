import { getAsset } from '../assets/registry'
import type { Layout, Opening } from '../model/schema'
import { isPassive, itemFootprint2D, SEATS } from './placement'
import { footprint, overlaps2D, type Footprint2D } from './space'

/**
 * Circulation ("動線") analysis on a 50 mm floor grid:
 * distance to the nearest obstacle, which floor is reachable from the doors,
 * and human-readable issues (blocked door swing, closet, balcony window, narrow passages).
 */

export const CELL = 50
/** Half of the clear width needed to walk comfortably (600 mm) and to squeeze through sideways (400 mm). */
const COMFY = 300
const SQUEEZE = 190

export const enum Cell {
  Blocked = 0,
  Unreachable = 1,
  Tight = 2,
  Comfy = 3,
}

export interface FlowIssue {
  level: 'warn' | 'info'
  message: string
  itemId?: string
  openingId?: string
}

export interface FlowResult {
  cols: number
  rows: number
  cells: Uint8Array
  issues: FlowIssue[]
  /** Door swing sectors for drawing. */
  swings: { cx: number; cz: number; r: number; a0: number; a1: number }[]
}

/** Two-pass chamfer distance transform in place (mm). */
function chamfer(dist: Float32Array, cols: number, rows: number) {
  const d1 = CELL
  const d2 = CELL * Math.SQRT2
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      let v = dist[i]
      if (c > 0) v = Math.min(v, dist[i - 1] + d1)
      if (r > 0) {
        v = Math.min(v, dist[i - cols] + d1)
        if (c > 0) v = Math.min(v, dist[i - cols - 1] + d2)
        if (c < cols - 1) v = Math.min(v, dist[i - cols + 1] + d2)
      }
      dist[i] = v
    }
  for (let r = rows - 1; r >= 0; r--)
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c
      let v = dist[i]
      if (c < cols - 1) v = Math.min(v, dist[i + 1] + d1)
      if (r < rows - 1) {
        v = Math.min(v, dist[i + cols] + d1)
        if (c < cols - 1) v = Math.min(v, dist[i + cols + 1] + d2)
        if (c > 0) v = Math.min(v, dist[i + cols - 1] + d2)
      }
      dist[i] = v
    }
}

function pointInPoly(x: number, z: number, poly: [number, number][]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** Hinge point, radius and swept angle range (radians, atan2(z, x)) of an inward-opening door. */
export function doorSwing(o: Opening, layout: Layout) {
  if (o.type !== 'door' || o.swing !== 'in') return null
  const { width: W, depth: D } = layout.room
  // Inside view: hinge left/right → which end of the opening along the wall's u axis.
  const rightIsHighU = o.wall === 'north' || o.wall === 'east'
  const hingeHighU = (o.hinge === 'right') === rightIsHighU
  const u = hingeHighU ? o.offset + o.width : o.offset
  const r = o.width
  switch (o.wall) {
    case 'north':
      return { cx: u, cz: 0, r, a0: hingeHighU ? Math.PI / 2 : 0, a1: hingeHighU ? Math.PI : Math.PI / 2 }
    case 'south':
      return { cx: u, cz: D, r, a0: hingeHighU ? Math.PI : -Math.PI / 2, a1: hingeHighU ? (3 * Math.PI) / 2 : 0 }
    case 'west':
      return { cx: 0, cz: u, r, a0: hingeHighU ? -Math.PI / 2 : 0, a1: hingeHighU ? 0 : Math.PI / 2 }
    case 'east':
      return { cx: W, cz: u, r, a0: hingeHighU ? Math.PI : Math.PI / 2, a1: hingeHighU ? (3 * Math.PI) / 2 : Math.PI }
  }
}

/** Approximate a door-swing sector as a polygon footprint. */
function sectorPoly(s: { cx: number; cz: number; r: number; a0: number; a1: number }): Footprint2D {
  const pts: [number, number][] = [[s.cx, s.cz]]
  for (let i = 0; i <= 6; i++) {
    const a = s.a0 + ((s.a1 - s.a0) * i) / 6
    pts.push([s.cx + Math.cos(a) * s.r, s.cz + Math.sin(a) * s.r])
  }
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  // Bounding quad is enough for SAT against furniture: use the hull of the sector's box clipped to the arc.
  return { corners: hullQuad(pts), minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), minY: 0, maxY: 2000 }
}

function hullQuad(pts: [number, number][]): [number, number][] {
  // Bounding box as a quad; sectors are quarter circles so this slightly over-approximates.
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]
}

/** Strip of floor in front of an opening, `depth` mm into the room. */
function frontStrip(o: Opening, layout: Layout, depth: number): Footprint2D {
  const { width: W, depth: D } = layout.room
  const a = o.offset
  const b = o.offset + o.width
  const box = (x0: number, z0: number, x1: number, z1: number) => footprint({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 2000, z: z1 } }, 0, 0, 0, 0)
  switch (o.wall) {
    case 'north':
      return box(a, 0, b, depth)
    case 'south':
      return box(a, D - depth, b, D)
    case 'west':
      return box(0, a, depth, b)
    case 'east':
      return box(W - depth, a, W, b)
  }
}

function label(id: string, layout: Layout) {
  const it = layout.items.find((i) => i.id === id)
  return it?.name ?? getAsset(it?.type ?? '')?.label ?? id
}

export function analyzeFlow(layout: Layout): FlowResult {
  const { room } = layout
  const cols = Math.max(1, Math.round(room.width / CELL))
  const rows = Math.max(1, Math.round(room.depth / CELL))
  const n = cols * rows
  const blocked = new Uint8Array(n)

  // Obstacles: furniture that stands in the way at body height, and columns.
  const solid = layout.items
    // Chairs can be pulled out, so they do not block access to the desk / table they belong to.
    .filter((i) => !isPassive(i.type) && !SEATS.has(i.type))
    .map((i) => ({ i, f: itemFootprint2D(i, layout) }))
    .filter(({ f }) => f.minY < 1200)
  const cols2 = room.columns.map((c) => footprint({ min: { x: -c.width / 2, y: 0, z: -c.depth / 2 }, max: { x: c.width / 2, y: room.height, z: c.depth / 2 } }, c.x, 0, c.z, 0))
  for (const f of [...solid.map((s) => s.f), ...cols2]) {
    const c0 = Math.max(0, Math.floor(f.minX / CELL))
    const c1 = Math.min(cols - 1, Math.floor(f.maxX / CELL))
    const r0 = Math.max(0, Math.floor(f.minZ / CELL))
    const r1 = Math.min(rows - 1, Math.floor(f.maxZ / CELL))
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) if (pointInPoly((c + 0.5) * CELL, (r + 0.5) * CELL, f.corners)) blocked[r * cols + c] = 1
  }

  // Chamfer distance transform (mm) to the nearest obstacle or wall.
  const INF = 1e9
  const dist = new Float32Array(n)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      // Walls: distance from the cell centre to the nearest wall.
      const wall = Math.min((c + 0.5) * CELL, (cols - c - 0.5) * CELL, (r + 0.5) * CELL, (rows - r - 0.5) * CELL)
      dist[i] = blocked[i] ? 0 : Math.min(INF, wall)
    }
  chamfer(dist, cols, rows)

  // Flood fill from the doors over cells where a body fits.
  const cells = new Uint8Array(n)
  const queue: number[] = []
  const visit = (i: number) => {
    if (cells[i] || blocked[i] || dist[i] < SQUEEZE) return
    cells[i] = dist[i] >= COMFY ? Cell.Comfy : Cell.Tight
    queue.push(i)
  }
  const doors = room.openings.filter((o) => o.type === 'door')
  for (const o of doors) {
    const mid = o.offset + o.width / 2
    const inset = SQUEEZE + CELL
    const [x, z] = o.wall === 'north' ? [mid, inset] : o.wall === 'south' ? [mid, room.depth - inset] : o.wall === 'west' ? [inset, mid] : [room.width - inset, mid]
    const c = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL)))
    const r = Math.min(rows - 1, Math.max(0, Math.floor(z / CELL)))
    visit(r * cols + c)
  }
  while (queue.length) {
    const i = queue.pop()!
    const c = i % cols
    if (c > 0) visit(i - 1)
    if (c < cols - 1) visit(i + 1)
    if (i >= cols) visit(i - cols)
    if (i < n - cols) visit(i + cols)
  }
  // `cells` so far marks where a body *centre* can stand. Spread that to the floor a body covers,
  // so strips along walls are not reported as unreachable.
  const spread = (seed: (i: number) => boolean) => {
    const d = new Float32Array(n)
    for (let i = 0; i < n; i++) d[i] = seed(i) ? 0 : INF
    chamfer(d, cols, rows)
    return d
  }
  const dComfy = spread((i) => cells[i] === Cell.Comfy)
  const dAny = spread((i) => cells[i] === Cell.Comfy || cells[i] === Cell.Tight)
  for (let i = 0; i < n; i++) {
    if (blocked[i]) continue
    if (dComfy[i] <= COMFY) cells[i] = Cell.Comfy
    else if (dAny[i] <= SQUEEZE + CELL / 2) cells[i] = Cell.Tight
    else cells[i] = Cell.Unreachable
  }

  // Issues
  const issues: FlowIssue[] = []
  const swings = doors.map((o) => doorSwing(o, layout)).filter((s): s is NonNullable<typeof s> => !!s)
  doors.forEach((o) => {
    const s = doorSwing(o, layout)
    if (!s) return
    const poly = sectorPoly(s)
    for (const { i, f } of solid) {
      if (!overlaps2D(poly, f)) continue
      // Check against the true arc: any furniture corner within the radius & angle range, or the hinge inside the furniture.
      const hitsArc = f.corners.some(([x, z]) => {
        const dx = x - s.cx
        const dz = z - s.cz
        const a = Math.atan2(dz, dx)
        const inRange = [a, a + Math.PI * 2, a - Math.PI * 2].some((aa) => aa >= s.a0 - 0.01 && aa <= s.a1 + 0.01)
        return Math.hypot(dx, dz) < s.r && inRange
      })
      if (hitsArc) issues.push({ level: 'warn', message: `ドアを開けると「${label(i.id, layout)}」に当たるよ`, itemId: i.id, openingId: o.id })
    }
  })
  for (const o of room.openings) {
    if (o.type === 'closet' && o.doorStyle !== 'open') {
      const strip = frontStrip(o, layout, o.doorStyle === 'folding' ? 450 : 350)
      for (const { i, f } of solid) if (overlaps2D(strip, f) && f.maxY > 200) issues.push({ level: 'warn', message: `クローゼットの前を「${label(i.id, layout)}」がふさいでるよ`, itemId: i.id, openingId: o.id })
    }
    if (o.type === 'window' && o.sill < 300) {
      const strip = frontStrip(o, layout, 350)
      for (const { i, f } of solid) if (overlaps2D(strip, f) && f.maxY > 900) issues.push({ level: 'info', message: `掃き出し窓の前に背の高い「${label(i.id, layout)}」があるよ（ベランダに出にくいかも）`, itemId: i.id, openingId: o.id })
    }
  }
  // Furniture you cannot get to (e.g. a bed boxed in).
  for (const { i, f } of solid) {
    const t = getAsset(i.type)
    if (!t || !['bed', 'desk', 'sofa', 'fridge', 'washer', 'chest', 'bookshelf', 'miniKitchen'].includes(i.type)) continue
    let reach = false
    const pad = 150
    for (let r = Math.max(0, Math.floor((f.minZ - pad) / CELL)); r <= Math.min(rows - 1, Math.floor((f.maxZ + pad) / CELL)) && !reach; r++)
      for (let c = Math.max(0, Math.floor((f.minX - pad) / CELL)); c <= Math.min(cols - 1, Math.floor((f.maxX + pad) / CELL)); c++) {
        const v = cells[r * cols + c]
        if (v === Cell.Comfy || v === Cell.Tight) {
          reach = true
          break
        }
      }
    if (!reach && doors.length) issues.push({ level: 'warn', message: `「${label(i.id, layout)}」までたどり着けないかも`, itemId: i.id })
  }
  let tight = 0
  let comfy = 0
  for (let i = 0; i < n; i++) {
    if (cells[i] === Cell.Tight) tight++
    if (cells[i] === Cell.Comfy) comfy++
  }
  if (tight * CELL * CELL > 0.1e6) issues.push({ level: 'info', message: `通路が60cmより狭いところがあるよ（黄色の部分は横歩きになるかも）` })
  if (!doors.length) issues.push({ level: 'info', message: 'ドアがないから、動線は部屋全体で計算できないよ' })
  if (doors.length && comfy + tight === 0) issues.push({ level: 'warn', message: 'ドアの前がふさがってて、部屋に入れないかも' })

  return { cols, rows, cells, issues, swings }
}

let memo: { layout: Layout; result: FlowResult } | null = null
/** Cached analysis for the current layout object (shared by the overlay and the panel). */
export function getFlow(layout: Layout): FlowResult {
  if (memo?.layout !== layout) memo = { layout, result: analyzeFlow(layout) }
  return memo.result
}
