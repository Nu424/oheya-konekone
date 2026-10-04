import type { Item, Room, WallSide } from '../model/schema'

/**
 * 2D (top-down) geometry for editing: footprints, overlap tests and snapping.
 * All values are in mm in room coordinates (x east, z south).
 */

export interface LocalBox {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

export interface Footprint2D {
  /** Corners in room coordinates (counter-clockwise when seen from above). */
  corners: [number, number][]
  /** Axis-aligned bounds of the rotated footprint. */
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Vertical extent in room coordinates. */
  minY: number
  maxY: number
}

const rad = (d: number) => (d * Math.PI) / 180

/** Rotate a local (x, z) offset by the item's rotation (three.js Y rotation). */
export function rotateXZ(x: number, z: number, deg: number): [number, number] {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return [x * c + z * s, -x * s + z * c]
}

export function footprint(box: LocalBox, x: number, y: number, z: number, rotation: number): Footprint2D {
  const local: [number, number][] = [
    [box.min.x, box.min.z],
    [box.max.x, box.min.z],
    [box.max.x, box.max.z],
    [box.min.x, box.max.z],
  ]
  const corners = local.map(([lx, lz]) => {
    const [rx, rz] = rotateXZ(lx, lz, rotation)
    return [x + rx, z + rz] as [number, number]
  })
  const xs = corners.map((c) => c[0])
  const zs = corners.map((c) => c[1])
  return {
    corners,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    minY: y + box.min.y,
    maxY: y + box.max.y,
  }
}

function project(corners: [number, number][], ax: number, az: number): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const [x, z] of corners) {
    const p = x * ax + z * az
    if (p < min) min = p
    if (p > max) max = p
  }
  return [min, max]
}

/** Separating-axis test for two convex quads. `margin` shrinks the overlap needed (mm). */
export function overlaps2D(a: Footprint2D, b: Footprint2D, margin = 1): boolean {
  if (a.maxX <= b.minX + margin || b.maxX <= a.minX + margin || a.maxZ <= b.minZ + margin || b.maxZ <= a.minZ + margin) return false
  for (const poly of [a.corners, b.corners]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = poly[i]
      const [x2, z2] = poly[(i + 1) % 4]
      const len = Math.hypot(x2 - x1, z2 - z1) || 1
      const ax = -(z2 - z1) / len
      const az = (x2 - x1) / len
      const [a0, a1] = project(a.corners, ax, az)
      const [b0, b1] = project(b.corners, ax, az)
      if (a1 <= b0 + margin || b1 <= a0 + margin) return false
    }
  }
  return true
}

export function overlaps3D(a: Footprint2D, b: Footprint2D) {
  if (a.maxY <= b.minY + 1 || b.maxY <= a.minY + 1) return false
  return overlaps2D(a, b)
}

export interface SnapTarget {
  axis: 'x' | 'z'
  value: number
  kind: 'wall' | 'item' | 'grid'
}

export interface SnapResult {
  x: number
  z: number
  snapped: SnapTarget[]
}

/**
 * Snap an item centre so its footprint edges align with walls / other footprints.
 * Falls back to a grid when nothing is close. The footprint is kept inside the room.
 */
export function snapPosition(
  fp: (x: number, z: number) => Footprint2D,
  x: number,
  z: number,
  room: Room,
  others: Footprint2D[],
  o: { threshold?: number; grid?: number; free?: boolean } = {},
): SnapResult {
  const T = o.threshold ?? 80
  const grid = o.grid ?? 50
  const snapped: SnapTarget[] = []
  if (o.free) return clampInside(fp, x, z, room, snapped)

  const f = fp(x, z)
  const edgesX: { v: number; kind: SnapTarget['kind'] }[] = [
    { v: 0, kind: 'wall' },
    { v: room.width, kind: 'wall' },
  ]
  const edgesZ: { v: number; kind: SnapTarget['kind'] }[] = [
    { v: 0, kind: 'wall' },
    { v: room.depth, kind: 'wall' },
  ]
  for (const c of room.columns) {
    edgesX.push({ v: c.x - c.width / 2, kind: 'wall' }, { v: c.x + c.width / 2, kind: 'wall' })
    edgesZ.push({ v: c.z - c.depth / 2, kind: 'wall' }, { v: c.z + c.depth / 2, kind: 'wall' })
  }
  for (const b of others) {
    // Only items near on the other axis are useful snap targets.
    if (b.maxZ > f.minZ - 600 && b.minZ < f.maxZ + 600) edgesX.push({ v: b.minX, kind: 'item' }, { v: b.maxX, kind: 'item' })
    if (b.maxX > f.minX - 600 && b.minX < f.maxX + 600) edgesZ.push({ v: b.minZ, kind: 'item' }, { v: b.maxZ, kind: 'item' })
  }

  const best = (lo: number, hi: number, edges: { v: number; kind: SnapTarget['kind'] }[]) => {
    let d = Infinity
    let pick: { shift: number; v: number; kind: SnapTarget['kind'] } | null = null
    for (const e of edges) {
      for (const side of [lo, hi]) {
        const shift = e.v - side
        if (Math.abs(shift) < T && Math.abs(shift) < Math.abs(d)) {
          d = shift
          pick = { shift, v: e.v, kind: e.kind }
        }
      }
    }
    return pick
  }

  let nx = x
  let nz = z
  const bx = best(f.minX, f.maxX, edgesX)
  if (bx) {
    nx += bx.shift
    snapped.push({ axis: 'x', value: bx.v, kind: bx.kind })
  } else nx = Math.round(x / grid) * grid
  const bz = best(f.minZ, f.maxZ, edgesZ)
  if (bz) {
    nz += bz.shift
    snapped.push({ axis: 'z', value: bz.v, kind: bz.kind })
  } else nz = Math.round(z / grid) * grid
  return clampInside(fp, nx, nz, room, snapped)
}

function clampInside(fp: (x: number, z: number) => Footprint2D, x: number, z: number, room: Room, snapped: SnapTarget[]): SnapResult {
  const f = fp(x, z)
  let nx = x
  let nz = z
  const w = f.maxX - f.minX
  const d = f.maxZ - f.minZ
  if (w <= room.width) {
    if (f.minX < 0) nx -= f.minX
    if (f.maxX > room.width) nx -= f.maxX - room.width
  }
  if (d <= room.depth) {
    if (f.minZ < 0) nz -= f.minZ
    if (f.maxZ > room.depth) nz -= f.maxZ - room.depth
  }
  return { x: nx, z: nz, snapped }
}

/** Nearest wall to a point and the rotation that makes an item's back face that wall. */
export function nearestWall(room: Room, x: number, z: number): { wall: WallSide; rotation: number; dist: number } {
  const c: { wall: WallSide; rotation: number; dist: number }[] = [
    { wall: 'north', rotation: 0, dist: z },
    { wall: 'south', rotation: 180, dist: room.depth - z },
    { wall: 'west', rotation: 90, dist: x },
    { wall: 'east', rotation: 270, dist: room.width - x },
  ]
  return c.sort((a, b) => a.dist - b.dist)[0]
}

/** Push a footprint flush against a wall. */
export function flushToWall(fp: (x: number, z: number) => Footprint2D, x: number, z: number, room: Room, wall: WallSide) {
  const f = fp(x, z)
  if (wall === 'north') return { x, z: z - f.minZ }
  if (wall === 'south') return { x, z: z + (room.depth - f.maxZ) }
  if (wall === 'west') return { x: x - f.minX, z }
  return { x: x + (room.width - f.maxX), z }
}

/** Distances from a footprint to the four walls (mm). */
export function wallGaps(f: Footprint2D, room: Room) {
  return { west: f.minX, east: room.width - f.maxX, north: f.minZ, south: room.depth - f.maxZ }
}

export function normalizeDeg(d: number) {
  return ((Math.round(d) % 360) + 360) % 360
}

export type { Item }
