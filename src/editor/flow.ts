import { getAsset } from '../assets/registry'
import type { Layout, Opening } from '../model/schema'
import { isPassive, itemFootprint2D, SEATS, stack } from './placement'
import { outwardOf, planOf, resolveOpening, resolvedOpenings, usableRects, type Face, type ResolvedOpening } from '../model/plan'
import { footprint, overlaps2D, partsOf, type Footprint2D } from './space'

/**
 * Circulation ("動線") analysis on a 50 mm floor grid:
 * distance to the nearest obstacle, which floor is reachable from the doors,
 * and human-readable issues (blocked door swing, closet, balcony window, narrow passages).
 */

export const CELL = 50
/** Half of the clear width needed to walk comfortably (600 mm) and to squeeze through sideways (400 mm). */
const COMFY = 300
const SQUEEZE = 190
/** Things whose bottom is higher than this are overhead (a loft bed's deck, a wall cupboard) and not in the way. */
const HEADROOM = 1200

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

/**
 * The face an opening is seen from on the side it opens toward: its own face, or for a door that
 * swings out through an interior wall, the face on the other side (with left and right swapped).
 */
function swingSide(r: ResolvedOpening, room: Layout['room']): { face: Face; mirrored: boolean } | null {
  const o = r.opening
  if (o.type !== 'door' || o.swing === 'in') return { face: r.face, mirrored: false }
  if (r.face.exterior) return null
  const other = planOf(room).faces.find((f) => f.wall === r.face.wall && f.id !== r.face.id)
  return other ? { face: other, mirrored: true } : null
}

/** Hinge point, radius and swept angle range (radians, atan2(z, x)) of a door, on the side it swings into. */
export function doorSwing(o: Opening, layout: Layout) {
  if (o.type !== 'door') return null
  const r = resolveOpening(layout.room, o)
  if (!r) return null
  const side = swingSide(r, layout.room)
  if (!side) return null
  const f = side.face
  // Inside view: hinge left/right → which end of the opening along the face.
  const rightIsHighU = f.side === 'north' || f.side === 'east'
  const right = (o.hinge === 'right') !== side.mirrored
  const hingeHighU = right === rightIsHighU
  const u = hingeHighU ? r.to : r.from
  const [ox, oz] = outwardOf(f.side)
  const [cx, cz] = f.axis === 'x' ? [u, f.line] : [f.line, u]
  // Quarter circle between the closed leaf (along the wall toward the latch) and the inward normal.
  const sgn = hingeHighU ? -1 : 1
  const along = f.axis === 'x' ? Math.atan2(0, sgn) : Math.atan2(sgn, 0)
  const inward = Math.atan2(-oz, -ox)
  const d = Math.atan2(Math.sin(inward - along), Math.cos(inward - along))
  const a0 = d > 0 ? along : inward
  return { cx, cz, r: o.width, a0, a1: a0 + Math.PI / 2 }
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

/** Strip of floor in front of an opening, `depth` mm into its space. */
function frontStrip(o: Opening, layout: Layout, depth: number): Footprint2D | null {
  const r = resolveOpening(layout.room, o)
  if (!r) return null
  const f = r.face
  const [ox, oz] = outwardOf(f.side)
  const inner = f.line - (f.axis === 'x' ? oz : ox) * depth
  const [p0, p1] = [Math.min(f.line, inner), Math.max(f.line, inner)]
  const box = (x0: number, z0: number, x1: number, z1: number) => footprint({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 2000, z: z1 } }, 0, 0, 0, 0)
  return f.axis === 'x' ? box(r.from, p0, r.to, p1) : box(p0, r.from, p1, r.to)
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
  // Things standing on other furniture (a TV on its stand) are covered by what carries them.
  const sup = stack.supports(layout)
  const solid = layout.items
    // Chairs can be pulled out, so they do not block access to the desk / table they belong to.
    .filter((i) => !isPassive(i.type) && !SEATS.has(i.type) && !sup.has(i.id))
    .map((i) => {
      const f = itemFootprint2D(i, layout)
      // Only the parts at body height are in the way (a loft bed's posts, not its deck).
      return { i, f, parts: partsOf(f).filter((p) => p.minY < HEADROOM) }
    })
    .filter(({ parts }) => parts.length > 0)
  const hits = (poly: Footprint2D, s: { parts: Footprint2D[] }) => s.parts.some((p) => overlaps2D(poly, p))
  const cols2 = room.columns.map((c) => footprint({ min: { x: -c.width / 2, y: 0, z: -c.depth / 2 }, max: { x: c.width / 2, y: room.height, z: c.depth / 2 } }, c.x, 0, c.z, 0))
  for (const f of [...solid.flatMap((s) => s.parts), ...cols2]) {
    const c0 = Math.max(0, Math.floor(f.minX / CELL))
    const c1 = Math.min(cols - 1, Math.floor(f.maxX / CELL))
    const r0 = Math.max(0, Math.floor(f.minZ / CELL))
    const r1 = Math.min(rows - 1, Math.floor(f.maxZ / CELL))
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) if (pointInPoly((c + 0.5) * CELL, (r + 0.5) * CELL, f.corners)) blocked[r * cols + c] = 1
  }

  // Walls as rectangles: exterior walls whole, interior walls with their doorways cut out.
  const plan = planOf(room)
  const resolved = resolvedOpenings(room)
  const wallRects: { minX: number; minZ: number; maxX: number; maxZ: number }[] = []
  const gaps: typeof wallRects = []
  for (const w of plan.walls) {
    const f = w.face
    const [ox, oz] = outwardOf(f.side)
    const far = f.line + (f.axis === 'x' ? oz : ox) * w.thickness
    const [c0, c1] = [Math.min(f.line, far), Math.max(f.line, far)]
    const rect = (a: number, b: number) => (f.axis === 'x' ? { minX: a, maxX: b, minZ: c0, maxZ: c1 } : { minX: c0, maxX: c1, minZ: a, maxZ: b })
    const doorways = w.exterior ? [] : resolved.filter((r) => r.wall.id === w.id && (r.opening.type === 'door' || r.opening.type === 'passage')).sort((a, b) => a.from - b.from)
    let cur = w.start
    for (const d of doorways) {
      if (d.from > cur) wallRects.push(rect(cur, d.from))
      gaps.push(rect(d.from, d.to))
      cur = Math.max(cur, d.to)
    }
    if (w.end > cur) wallRects.push(rect(cur, w.end))
  }
  // Floor outside every space (and inside interior walls) is not floor, except in doorways.
  const floors = usableRects(room)
  const within = (x: number, z: number, r: { minX: number; minZ: number; maxX: number; maxZ: number }) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ
  if (plan.spaces.length > 1)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * CELL
        const z = (r + 0.5) * CELL
        if (!floors.some((f) => within(x, z, f)) && !gaps.some((g) => within(x, z, g))) blocked[r * cols + c] = 1
      }

  // Chamfer distance transform (mm) to the nearest obstacle or wall.
  const INF = 1e9
  const dist = new Float32Array(n)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (blocked[i]) {
        dist[i] = 0
        continue
      }
      // Walls: distance from the cell centre to the nearest wall.
      const x = (c + 0.5) * CELL
      const z = (r + 0.5) * CELL
      let wall = Math.min(x, room.width - x, z, room.depth - z)
      for (const w of wallRects) wall = Math.min(wall, Math.hypot(Math.max(w.minX - x, 0, x - w.maxX), Math.max(w.minZ - z, 0, z - w.maxZ)))
      dist[i] = Math.min(INF, wall)
    }
  chamfer(dist, cols, rows)

  // Flood fill from the entrance (doors in exterior walls; any door if there is none) over cells where a body fits.
  const cells = new Uint8Array(n)
  const queue: number[] = []
  const visit = (i: number) => {
    if (cells[i] || blocked[i] || dist[i] < SQUEEZE) return
    cells[i] = dist[i] >= COMFY ? Cell.Comfy : Cell.Tight
    queue.push(i)
  }
  const doors = room.openings.filter((o) => o.type === 'door')
  const doorFaces = resolved.filter((r) => r.opening.type === 'door')
  const entrances = doorFaces.some((r) => r.face.exterior) ? doorFaces.filter((r) => r.face.exterior) : doorFaces
  for (const d of entrances) {
    const mid = (d.from + d.to) / 2
    const [ox, oz] = outwardOf(d.face.side)
    const inset = d.face.line - (d.face.axis === 'x' ? oz : ox) * (SQUEEZE + CELL)
    const [x, z] = d.face.axis === 'x' ? [mid, inset] : [inset, mid]
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
    // Check against the true arc: any furniture corner within the radius & angle range.
    const inArc = (f: Footprint2D) =>
      f.corners.some(([x, z]) => {
        const dx = x - s.cx
        const dz = z - s.cz
        const a = Math.atan2(dz, dx)
        const inRange = [a, a + Math.PI * 2, a - Math.PI * 2].some((aa) => aa >= s.a0 - 0.01 && aa <= s.a1 + 0.01)
        return Math.hypot(dx, dz) < s.r && inRange
      })
    for (const { i, parts } of solid) {
      const hitsArc = parts.some((f) => overlaps2D(poly, f) && inArc(f))
      if (hitsArc) issues.push({ level: 'warn', message: `ドアを開けると「${label(i.id, layout)}」に当たるよ`, itemId: i.id, openingId: o.id })
    }
  })
  for (const o of room.openings) {
    if (o.type === 'closet' && o.doorStyle !== 'open') {
      const strip = frontStrip(o, layout, o.doorStyle === 'folding' ? 450 : 350)
      if (strip) for (const sd of solid) if (hits(strip, sd) && sd.f.maxY > 200) issues.push({ level: 'warn', message: `クローゼットの前を「${label(sd.i.id, layout)}」がふさいでるよ`, itemId: sd.i.id, openingId: o.id })
    }
    if (o.type === 'window' && o.sill < 300) {
      const strip = frontStrip(o, layout, 350)
      if (strip) for (const sd of solid) if (hits(strip, sd) && sd.f.maxY > 900) issues.push({ level: 'info', message: `掃き出し窓の前に背の高い「${label(sd.i.id, layout)}」があるよ（ベランダに出にくいかも）`, itemId: sd.i.id, openingId: o.id })
    }
  }
  // Furniture you cannot get to (e.g. a bed boxed in).
  for (const { i, f } of solid) {
    const t = getAsset(i.type)
    if (!t || !['bed', 'desk', 'officeDesk', 'sofa', 'fridge', 'washer', 'cabinet', 'shelf', 'metalRack', 'miniKitchen'].includes(i.type)) continue
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
