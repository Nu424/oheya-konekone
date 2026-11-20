import { uid } from '../model/geometry'
import type { Layout, Opening, Space, WallSide } from '../model/schema'

/**
 * Editing the floor plan (docs/FLOORPLAN.md): pure functions from a layout to a new layout.
 * Spaces stay rectangles that meet along their edges, never overlap and are at least MIN_SIZE across;
 * the room's origin stays at the north-west corner of the plan (everything shifts when it moves).
 */

export const MIN_SIZE = 600
const EPS = 1

type Rect = [number, number, number, number]

/** An edge of a space: the line it lies on and its extent along that line. */
export interface Edge {
  space: string
  side: WallSide
  axis: 'x' | 'z'
  line: number
  lo: number
  hi: number
}

export function edgeOf(s: Pick<Space, 'id' | 'rect'>, side: WallSide): Edge {
  const [x, z, w, d] = s.rect
  if (side === 'north') return { space: s.id, side, axis: 'x', line: z, lo: x, hi: x + w }
  if (side === 'south') return { space: s.id, side, axis: 'x', line: z + d, lo: x, hi: x + w }
  if (side === 'west') return { space: s.id, side, axis: 'z', line: x, lo: z, hi: z + d }
  return { space: s.id, side, axis: 'z', line: x + w, lo: z, hi: z + d }
}

const SIDES: WallSide[] = ['north', 'south', 'west', 'east']

/**
 * The edges that move together with `space`'s `side`: every edge on the same line that overlaps it,
 * directly or through another such edge (the shared walls of the neighbours stay shared).
 */
export function edgeGroup(spaces: Space[], space: string, side: WallSide): Edge[] {
  const start = spaces.find((s) => s.id === space)
  if (!start) return []
  const first = edgeOf(start, side)
  const all = spaces.flatMap((s) => SIDES.map((sd) => edgeOf(s, sd))).filter((e) => e.axis === first.axis && Math.abs(e.line - first.line) < EPS)
  const group = [first]
  const key = (e: Edge) => `${e.space}:${e.side}`
  const seen = new Set([key(first)])
  for (let i = 0; i < group.length; i++) {
    for (const e of all) {
      if (seen.has(key(e))) continue
      if (Math.min(e.hi, group[i].hi) - Math.max(e.lo, group[i].lo) > EPS) {
        seen.add(key(e))
        group.push(e)
      }
    }
  }
  return group
}

function moved(rect: Rect, side: WallSide, d: number): Rect {
  const [x, z, w, h] = rect
  if (side === 'north') return [x, z + d, w, h - d]
  if (side === 'south') return [x, z, w, h + d]
  if (side === 'west') return [x + d, z, w - d, h]
  return [x, z, w + d, h]
}

function overlap(a: Rect, b: Rect) {
  return a[0] < b[0] + b[2] - EPS && b[0] < a[0] + a[2] - EPS && a[1] < b[1] + b[3] - EPS && b[1] < a[1] + a[3] - EPS
}

function valid(spaces: Space[]) {
  if (spaces.some((s) => s.rect[2] < MIN_SIZE - EPS || s.rect[3] < MIN_SIZE - EPS)) return false
  for (let i = 0; i < spaces.length; i++) for (let j = i + 1; j < spaces.length; j++) if (overlap(spaces[i].rect, spaces[j].rect)) return false
  return true
}

/** Shift everything so the plan's north-west corner is the origin again, and size the room outline to the plan. */
function normalize(layout: Layout, spaces: Space[], openings: Opening[]): Layout {
  return normalizeShift(layout, spaces, openings).layout
}

/** `normalize`, also telling how far everything moved (new = old - shift). */
function normalizeShift(layout: Layout, spaces: Space[], openings: Opening[]): { layout: Layout; shift: [number, number] } {
  const minX = Math.min(...spaces.map((s) => s.rect[0]))
  const minZ = Math.min(...spaces.map((s) => s.rect[1]))
  const sp = spaces.map((s) => ({ ...s, rect: [s.rect[0] - minX, s.rect[1] - minZ, s.rect[2], s.rect[3]] as Rect }))
  const room = {
    ...layout.room,
    spaces: sp,
    openings,
    width: Math.max(...sp.map((s) => s.rect[0] + s.rect[2])),
    depth: Math.max(...sp.map((s) => s.rect[1] + s.rect[3])),
    columns: layout.room.columns.map((c) => ({ ...c, x: c.x - minX, z: c.z - minZ })),
  }
  const items = minX || minZ ? layout.items.map((it) => ({ ...it, position: [it.position[0] - minX, it.position[1], it.position[2] - minZ] as [number, number, number] })) : layout.items
  return { layout: { ...layout, room, items }, shift: [minX, minZ] }
}

/** Openings keep their place in the room when the low end of their space's side moves. */
function keepOpenings(openings: Opening[], before: Space[], after: Space[]): Opening[] {
  return openings.map((o) => {
    if (!o.space) return o
    const a = before.find((s) => s.id === o.space)
    const b = after.find((s) => s.id === o.space)
    if (!a || !b) return o
    const along = o.wall === 'north' || o.wall === 'south' ? 0 : 1
    const len = b.rect[along + 2]
    const offset = Math.max(0, Math.min(o.offset + a.rect[along] - b.rect[along], len - Math.min(o.width, len)))
    return { ...o, offset, width: Math.min(o.width, len) }
  })
}

/** The room as a plan: one space covering the old rectangle, with the openings assigned to it. */
export function ensureSpaces(layout: Layout): Layout {
  if (layout.room.spaces?.length) return layout
  const room = layout.room
  return {
    ...layout,
    room: {
      ...room,
      spaces: [{ id: 'main', name: '洋室', rect: [0, 0, room.width, room.depth] }],
      openings: room.openings.map((o) => ({ ...o, space: 'main' })),
    },
  }
}

/**
 * Move `side` of `space` to `to` (mm, along its axis), dragging the edges that share its line with it.
 * The move is shortened as needed to keep every space at least MIN_SIZE and free of overlaps.
 */
export function moveEdge(layout: Layout, space: string, side: WallSide, to: number): Layout {
  return moveEdgeShift(layout, space, side, to).layout
}

/** `moveEdge`, also telling how far the plan moved to keep its corner at the origin (new = old - shift). */
export function moveEdgeShift(layout: Layout, space: string, side: WallSide, to: number): { layout: Layout; shift: [number, number] } {
  const L = ensureSpaces(layout)
  const spaces = L.room.spaces!
  const group = edgeGroup(spaces, space, side)
  if (!group.length) return { layout, shift: [0, 0] }
  const apply = (d: number) => spaces.map((s) => group.filter((e) => e.space === s.id).reduce((acc, e) => ({ ...acc, rect: moved(acc.rect, e.side, d) }), s))
  let d = Math.round(to - group[0].line)
  // Back off toward no move until the plan is valid again.
  const step = Math.sign(d) * 10
  while (d !== 0 && !valid(apply(d))) d = Math.abs(d) <= 10 ? 0 : d - step
  if (d === 0) return { layout, shift: [0, 0] }
  const next = apply(d)
  return normalizeShift(L, next, keepOpenings(L.room.openings, spaces, next))
}

/** Set a space's width or depth by moving its east or south edge. */
export function resizeSpace(layout: Layout, space: string, dim: 'width' | 'depth', size: number): Layout {
  const s = ensureSpaces(layout).room.spaces!.find((x) => x.id === space)
  if (!s) return layout
  return dim === 'width' ? moveEdge(layout, space, 'east', s.rect[0] + size) : moveEdge(layout, space, 'south', s.rect[1] + size)
}

const OPPOSITE: Record<WallSide, WallSide> = { north: 'south', south: 'north', west: 'east', east: 'west' }

/**
 * Add a space on `side` of `from`, as long as that side and `depth` deep (less if something is in the
 * way), with a door into it. Returns null when there is no room for one.
 */
export function addSpace(layout: Layout, from: string, side: WallSide, o: { depth?: number; name?: string } = {}): { layout: Layout; id: string } | null {
  const L = ensureSpaces(layout)
  const spaces = L.room.spaces!
  const s = spaces.find((x) => x.id === from)
  if (!s) return null
  const e = edgeOf(s, side)
  const len = e.hi - e.lo
  const id = uid('space')
  const rectFor = (depth: number): Rect =>
    side === 'north' ? [e.lo, e.line - depth, len, depth] : side === 'south' ? [e.lo, e.line, len, depth] : side === 'west' ? [e.line - depth, e.lo, depth, len] : [e.line, e.lo, depth, len]
  let depth = o.depth ?? 1800
  while (depth >= MIN_SIZE && spaces.some((x) => overlap(x.rect, rectFor(depth)))) depth -= 50
  if (depth < MIN_SIZE) return null
  const name = o.name ?? `区画 ${spaces.length + 1}`
  const door: Opening = {
    id: uid('door'),
    type: 'door',
    space: id,
    wall: OPPOSITE[side],
    offset: Math.max(0, Math.round((len - Math.min(750, len - 100)) / 2)),
    width: Math.min(750, len - 100),
    height: 2000,
    hinge: 'left',
    swing: 'in',
    color: '#f2ede4',
  }
  const next = [...spaces, { id, name, rect: rectFor(depth) }]
  // No new door when one already opens onto that side (an old entrance now leads into the new space).
  const hasDoor = L.room.openings.some((op) => op.space === from && op.wall === side && (op.type === 'door' || op.type === 'passage'))
  return { layout: normalize(L, next, hasDoor ? L.room.openings : [...L.room.openings, door]), id }
}

/** Remove a space and the openings written against it. The last space cannot be removed. */
export function removeSpace(layout: Layout, id: string): Layout {
  const spaces = layout.room.spaces ?? []
  if (spaces.length <= 1 || !spaces.some((s) => s.id === id)) return layout
  const next = spaces.filter((s) => s.id !== id)
  return normalize(layout, next, layout.room.openings.filter((o) => o.space !== id))
}

/** Rename a space, or change its floor or walls. */
export function updateSpace(layout: Layout, id: string, patch: Partial<Pick<Space, 'name' | 'floor' | 'wall'>>): Layout {
  const L = ensureSpaces(layout)
  return { ...L, room: { ...L.room, spaces: L.room.spaces!.map((s) => (s.id === id ? { ...s, ...patch } : s)) } }
}

/** Raise or lower a space's floor; what stands on it there moves with it. */
export function setSpaceLevel(layout: Layout, id: string, level: number): Layout {
  const L = ensureSpaces(layout)
  const s = L.room.spaces!.find((x) => x.id === id)
  if (!s) return layout
  const before = s.floorLevel ?? 0
  const d = level - before
  if (!d) return layout
  const [x, z, w, h] = s.rect
  const inside = (p: [number, number, number]) => p[0] >= x && p[0] <= x + w && p[2] >= z && p[2] <= z + h
  return {
    ...L,
    room: { ...L.room, spaces: L.room.spaces!.map((sp) => (sp.id === id ? { ...sp, floorLevel: level || undefined } : sp)) },
    // Everything whose centre is in the space and is not hung on a wall or the ceiling goes with the floor.
    items: L.items.map((it) => (inside(it.position) && it.position[1] < (L.room.height ?? 2400) - 1 ? { ...it, position: [it.position[0], it.position[1] + d, it.position[2]] as [number, number, number] } : it)),
  }
}
