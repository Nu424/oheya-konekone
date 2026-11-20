import type { Layout } from '../model/schema'
import { wallRects } from '../model/plan'
import { isPassive, itemFootprint2D } from './placement'
import { footprint, overlaps2D, partsOf, type Footprint2D } from './space'

/**
 * Collision for the first-person walk mode (mm, room coordinates). The walker is a square
 * `2 * radius` across; it bumps into walls (doorways and passages are open), columns, and furniture
 * between knee and head height. Rugs and cushions underfoot, and a loft bed's deck overhead, let it pass.
 */

/** Below this (mm) things are stepped over. */
const KNEE = 300
export const WALKER_RADIUS = 200

export function walkObstacles(layout: Layout, eye: number): Footprint2D[] {
  const { room } = layout
  const out: Footprint2D[] = []
  const box = (minX: number, minZ: number, maxX: number, maxZ: number) => footprint({ min: { x: minX, y: 0, z: minZ }, max: { x: maxX, y: room.height, z: maxZ } }, 0, 0, 0, 0)
  for (const w of wallRects(room).walls) out.push(box(w.minX, w.minZ, w.maxX, w.maxZ))
  for (const c of room.columns) out.push(box(c.x - c.width / 2, c.z - c.depth / 2, c.x + c.width / 2, c.z + c.depth / 2))
  const head = eye + 150
  for (const it of layout.items) {
    if (isPassive(it.type)) continue
    for (const p of partsOf(itemFootprint2D(it, layout))) if (p.maxY > KNEE && p.minY < head) out.push(p)
  }
  return out
}

/** Indices of the obstacles the walker overlaps at (x, z). */
function hits(x: number, z: number, obstacles: Footprint2D[], r: number): number[] {
  const me = footprint({ min: { x: -r, y: 0, z: -r }, max: { x: r, y: 1, z: r } }, x, 0, z, 0)
  const out: number[] = []
  obstacles.forEach((o, i) => {
    if (overlaps2D(me, o, 0.5)) out.push(i)
  })
  return out
}

/**
 * Move from (x, z) by (dx, dz), sliding along whatever is in the way. A walker that is already inside
 * something (it started in a sofa, collision was just turned on) may move as long as it bumps into
 * nothing new, so it can walk out.
 */
export function stepWalk(x: number, z: number, dx: number, dz: number, obstacles: Footprint2D[], r = WALKER_RADIUS): [number, number] {
  const now = new Set(hits(x, z, obstacles, r))
  const ok = (nx: number, nz: number) => hits(nx, nz, obstacles, r).every((i) => now.has(i))
  if (ok(x + dx, z + dz)) return [x + dx, z + dz]
  if (dx && ok(x + dx, z)) return [x + dx, z]
  if (dz && ok(x, z + dz)) return [x, z + dz]
  return [x, z]
}
