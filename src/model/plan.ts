import type { Opening, Room, WallSide } from './schema'

/**
 * The floor plan derived from a room: its spaces, the faces of the walls around each space and the
 * walls to build. Everything that needs to know "where the walls are" goes through here instead of
 * assuming one width × depth rectangle. See docs/FLOORPLAN.md.
 *
 * All values are mm in room coordinates (x east, z south). Plans are rectilinear: spaces are
 * axis-aligned rectangles that meet along their edges.
 */

export type Axis = 'x' | 'z'

export interface PlanSpace {
  id: string
  name?: string
  /** Edge lines (wall centre lines for interior walls, the inner faces of exterior walls). */
  x0: number
  z0: number
  x1: number
  z1: number
  floor: Room['floor']
}

/** The inner face of the wall along one side (or one stretch of a side) of a space. */
export interface Face {
  id: string
  space: string
  /** Side of the space the wall is on. */
  side: WallSide
  /** The direction the face runs: north/south faces run along x, west/east faces along z. */
  axis: Axis
  /** Coordinate of the face across its axis (z for north/south faces, x for west/east). */
  line: number
  /** Absolute along-axis range of the face. */
  from: number
  to: number
  /** Along-axis coordinate of the space's low end, the origin for opening offsets on this side. */
  base: number
  exterior: boolean
  /** The space on the other side of an interior wall. */
  other?: string
  /** The wall this face belongs to. */
  wall: string
}

/** A wall to build: a box from `face` outward by `thickness`, over `start`..`end` along it. */
export interface Wall {
  id: string
  face: Face
  thickness: number
  exterior: boolean
  start: number
  end: number
}

export interface Plan {
  spaces: PlanSpace[]
  faces: Face[]
  walls: Wall[]
  /** Bounding box of the spaces (the room's width × depth when there is one space). */
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number }
}

const EPS = 1

/** Unit vector pointing out of a space through its `side`. */
export function outwardOf(side: WallSide): [number, number] {
  return side === 'north' ? [0, -1] : side === 'south' ? [0, 1] : side === 'west' ? [-1, 0] : [1, 0]
}

const OPPOSITE: Record<WallSide, WallSide> = { north: 'south', south: 'north', west: 'east', east: 'west' }

/** Rotation that turns an item's back to a wall on `side` (front facing into the space). */
export const BACK_TO_WALL: Record<WallSide, number> = { north: 0, south: 180, west: 90, east: 270 }

/** The spaces of a room: its `spaces`, or one rectangle of width × depth. */
export function spacesOf(room: Room): PlanSpace[] {
  if (!room.spaces?.length) return [{ id: 'room', x0: 0, z0: 0, x1: room.width, z1: room.depth, floor: room.floor }]
  return room.spaces.map((s) => ({ id: s.id, name: s.name, x0: s.rect[0], z0: s.rect[1], x1: s.rect[0] + s.rect[2], z1: s.rect[1] + s.rect[3], floor: s.floor ?? room.floor }))
}

function edge(s: PlanSpace, side: WallSide) {
  if (side === 'north') return { line: s.z0, lo: s.x0, hi: s.x1 }
  if (side === 'south') return { line: s.z1, lo: s.x0, hi: s.x1 }
  if (side === 'west') return { line: s.x0, lo: s.z0, hi: s.z1 }
  return { line: s.x1, lo: s.z0, hi: s.z1 }
}

function inside(spaces: PlanSpace[], x: number, z: number) {
  return spaces.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1)
}

const cache = new WeakMap<Room, Plan>()

/** The plan of a room (cached per room object). */
export function planOf(room: Room): Plan {
  const hit = cache.get(room)
  if (hit) return hit
  const spaces = spacesOf(room)
  const ti = room.interiorWallThickness ?? 100
  const faces: Face[] = []
  const walls: Wall[] = []
  for (const s of spaces) {
    for (const side of ['north', 'south', 'west', 'east'] as const) {
      const e = edge(s, side)
      const axis: Axis = side === 'north' || side === 'south' ? 'x' : 'z'
      // Stretches of this edge shared with a neighbour's opposite edge become interior walls.
      const shared: { lo: number; hi: number; other: string }[] = []
      for (const o of spaces) {
        if (o === s) continue
        const oe = edge(o, OPPOSITE[side])
        if (Math.abs(oe.line - e.line) > EPS) continue
        const lo = Math.max(e.lo, oe.lo)
        const hi = Math.min(e.hi, oe.hi)
        if (hi - lo > EPS) shared.push({ lo, hi, other: o.id })
      }
      shared.sort((a, b) => a.lo - b.lo)
      const pieces: { lo: number; hi: number; other?: string }[] = []
      let cur = e.lo
      for (const sh of shared) {
        if (sh.lo - cur > EPS) pieces.push({ lo: cur, hi: sh.lo })
        pieces.push(sh)
        cur = Math.max(cur, sh.hi)
      }
      if (e.hi - cur > EPS) pieces.push({ lo: cur, hi: e.hi })
      const [ox, oz] = outwardOf(side)
      for (const pc of pieces) {
        const exterior = pc.other === undefined
        // Interior walls straddle the edge line: each face is half a wall in from it.
        const line = exterior ? e.line : e.line - (ox + oz) * (ti / 2)
        const id = `${s.id}:${side}:${Math.round(pc.lo)}`
        // One wall per interior pair, built from the face of the space to the north / west.
        const wallId = exterior ? id : side === 'south' || side === 'east' ? id : `${pc.other}:${OPPOSITE[side]}:${Math.round(pc.lo)}`
        faces.push({ id, space: s.id, side, axis, line, from: pc.lo, to: pc.hi, base: e.lo, exterior, other: pc.other, wall: wallId })
      }
    }
  }
  for (const f of faces) {
    if (f.exterior) {
      // Exterior walls along x close the corners: extend each end past a convex corner by the wall thickness.
      const t = room.wallThickness
      let start = f.from
      let end = f.to
      if (f.axis === 'x') {
        const [, oz] = outwardOf(f.side)
        const convex = (x: number) => !inside(spaces, x, f.line + oz) && !inside(spaces, x, f.line - oz)
        if (convex(f.from - EPS)) start -= t
        if (convex(f.to + EPS)) end += t
      }
      walls.push({ id: f.wall, face: f, thickness: t, exterior: true, start, end })
    } else if (f.wall === f.id) walls.push({ id: f.wall, face: f, thickness: ti, exterior: false, start: f.from, end: f.to })
  }
  const plan: Plan = {
    spaces,
    faces,
    walls,
    bounds: {
      minX: Math.min(...spaces.map((s) => s.x0)),
      minZ: Math.min(...spaces.map((s) => s.z0)),
      maxX: Math.max(...spaces.map((s) => s.x1)),
      maxZ: Math.max(...spaces.map((s) => s.z1)),
    },
  }
  cache.set(room, plan)
  return plan
}

/** Where an opening sits: the face it is on, the wall to cut and its absolute range along the face. */
export interface ResolvedOpening<T extends Opening = Opening> {
  opening: T
  face: Face
  wall: Wall
  /** Absolute along-axis range. */
  from: number
  to: number
  /**
   * The opening was written from the other side of the wall it is built in: its "inside" (door swing
   * and hinge side) is the other space's.
   */
  flipped: boolean
}

/** Resolve an opening against the plan. `space` + `wall` + `offset`, or the room outline's side when `space` is omitted. */
export function resolveOpening<T extends Opening>(room: Room, o: T): ResolvedOpening<T> | null {
  const plan = planOf(room)
  const sp = o.space ? plan.spaces.find((s) => s.id === o.space) : undefined
  let candidates: Face[]
  let from: number
  if (sp) {
    candidates = plan.faces.filter((f) => f.space === sp.id && f.side === o.wall)
    from = edge(sp, o.wall).lo + o.offset
  } else {
    // Relative to the outline: the exterior faces on that side of the bounding box.
    const b = plan.bounds
    const line = o.wall === 'north' ? b.minZ : o.wall === 'south' ? b.maxZ : o.wall === 'west' ? b.minX : b.maxX
    candidates = plan.faces.filter((f) => f.side === o.wall && f.exterior && Math.abs(f.line - line) <= EPS)
    from = o.offset
  }
  const to = from + o.width
  let best: Face | null = null
  let bestOverlap = -Infinity
  for (const f of candidates) {
    const ov = Math.min(to, f.to) - Math.max(from, f.from)
    if (ov > bestOverlap) {
      bestOverlap = ov
      best = f
    }
  }
  if (!best) return null
  const wall = plan.walls.find((w) => w.id === best.wall)!
  return { opening: o, face: best, wall, from, to, flipped: wall.face.id !== best.id }
}

/** All openings of a room, resolved (unplaceable ones are left out). */
export function resolvedOpenings(room: Room): ResolvedOpening[] {
  return room.openings.map((o) => resolveOpening(room, o)).filter((r): r is ResolvedOpening => !!r)
}

/** Length available for openings on `wall` of `space` (or of the room outline). */
export function sideLength(room: Room, wall: WallSide, space?: string): number {
  const plan = planOf(room)
  const sp = space ? plan.spaces.find((s) => s.id === space) : undefined
  if (sp) return wall === 'north' || wall === 'south' ? sp.x1 - sp.x0 : sp.z1 - sp.z0
  const b = plan.bounds
  return wall === 'north' || wall === 'south' ? b.maxX - b.minX : b.maxZ - b.minZ
}

/** Floor area each space offers for furniture: its rectangle less half an interior wall on shared sides. */
export function usableRects(room: Room): { space: string; minX: number; minZ: number; maxX: number; maxZ: number }[] {
  const plan = planOf(room)
  return plan.spaces.map((s) => {
    const fs = plan.faces.filter((f) => f.space === s.id)
    const lineOf = (side: WallSide, fallback: number, pick: (a: number, b: number) => number) =>
      fs.filter((f) => f.side === side).reduce((v, f) => pick(v, f.line), fallback)
    return {
      space: s.id,
      minX: lineOf('west', s.x0, Math.max),
      maxX: lineOf('east', s.x1, Math.min),
      minZ: lineOf('north', s.z0, Math.max),
      maxZ: lineOf('south', s.z1, Math.min),
    }
  })
}

/** The space whose usable area contains (x, z), if any. */
export function spaceAt(room: Room, x: number, z: number) {
  return usableRects(room).find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
}

/** Whether (x, z) is on the floor of some space. */
export function onFloor(room: Room, x: number, z: number) {
  return !!spaceAt(room, x, z)
}

/**
 * The wall face nearest to (x, z), seen from inside: faces the point is behind count only when
 * it is within `behind` mm of them (a dragged footprint can poke a little through a wall).
 */
export function nearestFace(room: Room, x: number, z: number, behind = 150): { face: Face; dist: number } {
  const plan = planOf(room)
  let best: { face: Face; dist: number } | null = null
  for (const f of plan.faces) {
    const [ox, oz] = outwardOf(f.side)
    const along = f.axis === 'x' ? x : z
    const across = f.axis === 'x' ? z : x
    // Signed distance into the space from the face line.
    const d = (f.line - across) * (f.axis === 'x' ? oz : ox)
    if (d < -behind) continue
    const off = along < f.from ? f.from - along : along > f.to ? along - f.to : 0
    // Faces the point is in front of win over faces it has gone through (the other side of a wall).
    const dist = Math.hypot(Math.abs(d), off) + (d < 0 ? behind : 0)
    if (!best || dist < best.dist) best = { face: f, dist }
  }
  return best ?? { face: plan.faces[0], dist: 0 }
}

/** Area of the room in m²: all spaces together. */
export function planArea(room: Room) {
  return spacesOf(room).reduce((a, s) => a + (s.x1 - s.x0) * (s.z1 - s.z0), 0) / 1_000_000
}
