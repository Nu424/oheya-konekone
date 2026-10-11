import type { Surface } from '../assets/types'
import type { Item, Layout } from '../model/schema'
import { rotateXZ } from './space'

/**
 * Multi-level stacking: items stand on support surfaces declared by other items
 * (bench top → deck plate → stand → rack, fridge → shelf → holder).
 *
 * The layout JSON stays flat: every item keeps an absolute position, and "what stands on what"
 * is derived from geometry (an item rests on a surface when its origin is inside the surface
 * rectangle at the surface's height). See docs/STACKING.md for the reasoning.
 *
 * This module has no dependency on the asset registry or three.js; the host supplies the
 * surfaces of an item through `StackingHost`, so it can be reused as is in another app.
 */

export interface StackingHost {
  /** Support surfaces of an item in its local frame (mm). Return [] for items nothing can stand on. */
  surfaces(item: Item): Surface[]
  /** False for items that never rest on anything (wall-mounted, ceiling-hung). */
  stackable?(item: Item): boolean
}

/** A surface placed in the room: local rectangle + the owner's pose. */
export interface PlacedSurface extends Surface {
  itemId: string
  /** Index in the owner's `surfaces()` list; stable while the owner's shape does not change. */
  index: number
  /** Height of the surface in room coordinates (mm). */
  worldY: number
  /** Owner pose. */
  x: number
  z: number
  rotation: number
}

/** The space an item occupies (room coordinates, mm): nothing can be dropped inside it. */
export interface Solid {
  itemId: string
  /** Hides what is behind it from the pointer (benches, cabinets, housings: things with surfaces of their own). */
  occludes?: boolean
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export interface Pose {
  position: [number, number, number]
  rotation: number
}

/** How far (mm) an item's bottom may be from a surface and still count as resting on it. */
export const REST_TOLERANCE = 2

/** Heights are kept to 0.1 mm so stacked items do not accumulate rounding gaps. */
export const roundY = (y: number) => Math.round(y * 10) / 10

/** Room (x, z) → the surface owner's local frame. */
function toLocal(s: PlacedSurface, x: number, z: number): [number, number] {
  return rotateXZ(x - s.x, z - s.z, -s.rotation)
}

function toWorld(s: PlacedSurface, lx: number, lz: number): [number, number] {
  const [dx, dz] = rotateXZ(lx, lz, s.rotation)
  return [s.x + dx, s.z + dz]
}

/** True when the room point (x, z) lies on the surface rectangle, grown by `margin`. */
export function surfaceContains(s: PlacedSurface, x: number, z: number, margin = 0): boolean {
  const [lx, lz] = toLocal(s, x, z)
  return lx >= s.minX - margin && lx <= s.maxX + margin && lz >= s.minZ - margin && lz <= s.maxZ + margin
}

/** Nearest point on the surface rectangle to the room point (x, z). */
export function clampToSurface(s: PlacedSurface, x: number, z: number): [number, number] {
  const [lx, lz] = toLocal(s, x, z)
  return toWorld(s, Math.min(s.maxX, Math.max(s.minX, lx)), Math.min(s.maxZ, Math.max(s.minZ, lz)))
}

/** Axis-aligned bounds of the surface rectangle in room coordinates. */
export function surfaceBounds(s: PlacedSurface) {
  const pts = [
    toWorld(s, s.minX, s.minZ),
    toWorld(s, s.maxX, s.minZ),
    toWorld(s, s.maxX, s.maxZ),
    toWorld(s, s.minX, s.maxZ),
  ]
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

export function createStacking(host: StackingHost) {
  const stackable = (item: Item) => host.stackable?.(item) ?? true

  /** All support surfaces in the room, optionally leaving out some owners. */
  function placedSurfaces(layout: Layout, except?: ReadonlySet<string>): PlacedSurface[] {
    const out: PlacedSurface[] = []
    for (const it of layout.items) {
      if (except?.has(it.id)) continue
      host.surfaces(it).forEach((s, index) =>
        out.push({ ...s, itemId: it.id, index, worldY: it.position[1] + s.y, x: it.position[0], z: it.position[2], rotation: it.rotation }),
      )
    }
    return out
  }

  /**
   * The highest surface under the room point (x, z), no higher than `maxY`.
   * null means the floor. Used when an item is dropped, duplicated or loses its support.
   */
  function surfaceUnder(layout: Layout, x: number, z: number, o: { except?: ReadonlySet<string>; maxY?: number } = {}): PlacedSurface | null {
    let best: PlacedSurface | null = null
    for (const s of placedSurfaces(layout, o.except)) {
      if (o.maxY !== undefined && s.worldY > o.maxY + REST_TOLERANCE) continue
      if (!surfaceContains(s, x, z)) continue
      if (!best || s.worldY > best.worldY) best = s
    }
    return best
  }

  /** The surface each item rests on (items on the floor or floating in the air have no entry). */
  function supports(layout: Layout): Map<string, PlacedSurface> {
    const all = placedSurfaces(layout)
    const out = new Map<string, PlacedSurface>()
    for (const it of layout.items) {
      if (!stackable(it)) continue
      const [x, y, z] = it.position
      let best: PlacedSurface | null = null
      for (const s of all) {
        if (s.itemId === it.id || Math.abs(s.worldY - y) > REST_TOLERANCE) continue
        if (!surfaceContains(s, x, z)) continue
        // Two surfaces at the same height: prefer the smaller one (a stand on a bench, not the bench).
        if (!best || area(s) < area(best)) best = s
      }
      if (best) out.set(it.id, best)
    }
    return out
  }

  /** Everything that stands on `id`, directly or through other items (nearest first). */
  function riders(layout: Layout, id: string, sup = supports(layout)): string[] {
    const out: string[] = []
    const seen = new Set([id])
    let frontier = [id]
    while (frontier.length) {
      const next: string[] = []
      for (const [rider, s] of sup) {
        if (seen.has(rider) || !frontier.includes(s.itemId)) continue
        seen.add(rider)
        out.push(rider)
        next.push(rider)
      }
      frontier = next
    }
    return out
  }

  /** True when `id` stands on `baseId`, directly or through other items. */
  function restsOn(sup: Map<string, PlacedSurface>, id: string, baseId: string): boolean {
    const seen = new Set<string>()
    for (let s = sup.get(id); s && !seen.has(s.itemId); s = sup.get(s.itemId)) {
      if (s.itemId === baseId) return true
      seen.add(s.itemId)
    }
    return false
  }

  /**
   * Move an item to a new pose and carry everything standing on it along:
   * riders translate with it and turn around its origin.
   */
  function moveWithRiders(layout: Layout, id: string, to: Partial<Pose>): Map<string, Pose> {
    const out = new Map<string, Pose>()
    const it = layout.items.find((i) => i.id === id)
    if (!it) return out
    const position = to.position ?? it.position
    const rotation = to.rotation ?? it.rotation
    out.set(id, { position, rotation })
    const turn = rotation - it.rotation
    const dy = position[1] - it.position[1]
    for (const rid of riders(layout, id)) {
      const r = layout.items.find((i) => i.id === rid)!
      const [rx, rz] = rotateXZ(r.position[0] - it.position[0], r.position[2] - it.position[2], turn)
      out.set(rid, {
        position: [Math.round(position[0] + rx), roundY(r.position[1] + dy), Math.round(position[2] + rz)],
        rotation: (((r.rotation + turn) % 360) + 360) % 360,
      })
    }
    return out
  }

  /**
   * Let items fall onto whatever is below them (after their support was removed or shrank).
   * Each item drops with its own riders; lower items settle first.
   */
  function settle(layout: Layout, ids: string[]): Map<string, Pose> {
    const out = new Map<string, Pose>()
    let current = layout
    const order = ids
      .map((id) => current.items.find((i) => i.id === id))
      .filter((i): i is Item => !!i)
      .sort((a, b) => a.position[1] - b.position[1])
    for (const item of order) {
      const it = current.items.find((i) => i.id === item.id)!
      const carried = new Set([it.id, ...riders(current, it.id)])
      const below = surfaceUnder(current, it.position[0], it.position[2], { except: carried, maxY: it.position[1] })
      const y = roundY(below ? below.worldY : 0)
      if (Math.abs(y - it.position[1]) < 0.05) continue
      const moved = moveWithRiders(current, it.id, { position: [it.position[0], y, it.position[2]] })
      for (const [k, v] of moved) out.set(k, v)
      current = applyPoses(current, moved)
    }
    return out
  }

  /**
   * After `id` changed shape (parameters edited), keep its riders on the surfaces they stood on:
   * a rider follows its surface (same index) to the new height, or drops if the surface is gone
   * or no longer under it.
   */
  function reseat(before: Layout, after: Layout, id: string): Map<string, Pose> {
    const out = new Map<string, Pose>()
    const sup = supports(before)
    const owner = after.items.find((i) => i.id === id)
    if (!owner) return out
    const now = host.surfaces(owner)
    let current = after
    const orphans: string[] = []
    for (const [rid, s] of sup) {
      if (s.itemId !== id) continue
      const r = current.items.find((i) => i.id === rid)
      if (!r) continue
      const next = now[s.index]
      const placed: PlacedSurface | null = next ? { ...next, itemId: id, index: s.index, worldY: owner.position[1] + next.y, x: owner.position[0], z: owner.position[2], rotation: owner.rotation } : null
      if (!placed || !surfaceContains(placed, r.position[0], r.position[2], REST_TOLERANCE)) {
        orphans.push(rid)
        continue
      }
      // Riders of the rider are found in `before`, where they were still resting on it.
      const carried = moveWithRiders(before, rid, { position: [r.position[0], roundY(placed.worldY), r.position[2]] })
      for (const [k, v] of carried) out.set(k, v)
      current = applyPoses(current, carried)
    }
    if (orphans.length) {
      // Dropping needs the riders still attached, so lift nothing: settle from where they are.
      for (const rid of orphans) {
        const r = before.items.find((i) => i.id === rid)!
        const carriedIds = new Set([rid, ...riders(before, rid)])
        const below = surfaceUnder(current, r.position[0], r.position[2], { except: carriedIds, maxY: r.position[1] })
        const moved = moveWithRiders(before, rid, { position: [r.position[0], roundY(below ? below.worldY : 0), r.position[2]] })
        for (const [k, v] of moved) out.set(k, v)
        current = applyPoses(current, moved)
      }
    }
    return out
  }

  /**
   * Where a dragged item lands: follow the pointer ray (mm, room coordinates) and take the first
   * surface it crosses on which the item's origin would rest; the floor (y = 0) is the fallback.
   * `offset` is the (x, z) distance from the grabbed point to the item origin.
   * `sticky` keeps the item on a surface while the pointer is just past its edge.
   */
  function pickAlongRay(
    surfaces: PlacedSurface[],
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    offset: { x: number; z: number },
    o: { sticky?: number; maxHeight?: number; solids?: readonly Solid[] } = {},
  ): { x: number; y: number; z: number; surface: PlacedSurface | null } | null {
    const sticky = o.sticky ?? 0
    // A spot inside another item's body is not a place to put things: pointing at the front panel
    // of a cabinet must not drop the item onto the floor underneath it.
    const buried = (x: number, y: number, z: number, ownerId?: string) =>
      !!o.solids?.some((b) => b.itemId !== ownerId && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y + 1 > b.minY && y + 1 < b.maxY)
    // Likewise a spot hidden behind a cabinet: the pointer is on the cabinet's front, not on the floor behind it.
    const enters = (b: Solid) => {
      let t0 = 0
      let t1 = Infinity
      for (const [p, d, lo, hi] of [
        [origin.x, dir.x, b.minX, b.maxX],
        [origin.y, dir.y, b.minY, b.maxY],
        [origin.z, dir.z, b.minZ, b.maxZ],
      ] as const) {
        if (Math.abs(d) < 1e-9) {
          if (p < lo || p > hi) return Infinity
          continue
        }
        const a = (lo - p) / d
        const c = (hi - p) / d
        t0 = Math.max(t0, Math.min(a, c))
        t1 = Math.min(t1, Math.max(a, c))
      }
      return t0 <= t1 ? t0 : Infinity
    }
    const hidden = (t: number, ownerId?: string) => !!o.solids?.some((b) => b.occludes && b.itemId !== ownerId && enters(b) < t - 1)
    let best: { x: number; y: number; z: number; surface: PlacedSurface | null; t: number } | null = null
    const at = (planeY: number) => {
      if (Math.abs(dir.y) < 1e-9) return null
      const t = (planeY - origin.y) / dir.y
      return t > 0 ? { t, x: origin.x + dir.x * t + offset.x, z: origin.z + dir.z * t + offset.z } : null
    }
    for (const s of surfaces) {
      if (o.maxHeight !== undefined && s.clearance !== undefined && o.maxHeight > s.clearance) continue
      const h = at(s.worldY)
      if (!h || (best && h.t >= best.t)) continue
      if (!surfaceContains(s, h.x, h.z, sticky)) continue
      const [x, z] = sticky ? clampToSurface(s, h.x, h.z) : [h.x, h.z]
      if (buried(x, s.worldY, z, s.itemId) || hidden(h.t, s.itemId)) continue
      best = { x, y: s.worldY, z, surface: s, t: h.t }
    }
    if (best) return best
    const floor = at(0)
    return floor && !buried(floor.x, 0, floor.z) && !hidden(floor.t) ? { x: floor.x, y: 0, z: floor.z, surface: null } : null
  }

  /** Items whose bottom is in mid-air: above the floor with no surface under them. */
  function floating(layout: Layout): { item: Item; nearest: PlacedSurface | null }[] {
    const sup = supports(layout)
    const out: { item: Item; nearest: PlacedSurface | null }[] = []
    for (const it of layout.items) {
      if (!stackable(it) || it.position[1] <= REST_TOLERANCE || sup.has(it.id)) continue
      out.push({ item: it, nearest: surfaceUnder(layout, it.position[0], it.position[2], { except: new Set([it.id]) }) })
    }
    return out
  }

  // ---- Several items at once (docs/MULTISELECT.md) --------------------------------------------

  /**
   * The items an operation on a selection acts on: selected ids that do not stand on another
   * selected item. A bench and a rack on it, both selected, move once (the rack as a rider).
   */
  function roots(layout: Layout, ids: readonly string[]): string[] {
    const sup = supports(layout)
    const present = new Set(layout.items.map((i) => i.id))
    return [...new Set(ids)].filter((id) => present.has(id) && !ids.some((other) => other !== id && restsOn(sup, id, other)))
  }

  /** Move the roots (and what stands on them) by the same amount, keeping their arrangement. */
  function moveGroup(layout: Layout, ids: readonly string[], delta: { x: number; y: number; z: number }): Map<string, Pose> {
    const out = new Map<string, Pose>()
    for (const id of roots(layout, ids)) {
      const it = layout.items.find((i) => i.id === id)!
      const moved = moveWithRiders(layout, id, { position: [Math.round(it.position[0] + delta.x), roundY(it.position[1] + delta.y), Math.round(it.position[2] + delta.z)] })
      for (const [k, v] of moved) out.set(k, v)
    }
    return out
  }

  /** Turn the roots around a vertical axis through `pivot`: positions orbit it and every item turns with it. */
  function rotateGroup(layout: Layout, ids: readonly string[], pivot: { x: number; z: number }, degrees: number): Map<string, Pose> {
    const out = new Map<string, Pose>()
    for (const id of roots(layout, ids)) {
      const it = layout.items.find((i) => i.id === id)!
      const [dx, dz] = rotateXZ(it.position[0] - pivot.x, it.position[2] - pivot.z, degrees)
      const moved = moveWithRiders(layout, id, {
        position: [Math.round(pivot.x + dx), it.position[1], Math.round(pivot.z + dz)],
        rotation: (((it.rotation + degrees) % 360) + 360) % 360,
      })
      for (const [k, v] of moved) out.set(k, v)
    }
    return out
  }

  /**
   * After a group was moved rigidly, let each root come to rest: on the highest surface under it
   * that is not above it, or on the floor. `leadId` (the item the user dragged) already chose its
   * surface and is left alone. Lower roots land first.
   */
  function landGroup(layout: Layout, ids: readonly string[], leadId?: string): Map<string, Pose> {
    const out = new Map<string, Pose>()
    let current = layout
    const order = roots(layout, ids)
      .filter((id) => id !== leadId)
      .map((id) => layout.items.find((i) => i.id === id)!)
      .filter(stackable)
      .sort((a, b) => a.position[1] - b.position[1])
    for (const item of order) {
      const it = current.items.find((i) => i.id === item.id)!
      const carried = new Set([it.id, ...riders(current, it.id)])
      const below = surfaceUnder(current, it.position[0], it.position[2], { except: carried, maxY: Math.max(0, it.position[1]) })
      const y = roundY(below ? below.worldY : 0)
      if (Math.abs(y - it.position[1]) < 0.05) continue
      const moved = moveWithRiders(current, it.id, { position: [it.position[0], y, it.position[2]] })
      for (const [k, v] of moved) out.set(k, v)
      current = applyPoses(current, moved)
    }
    return out
  }

  // ---- Delete with or without riders, pose fields (docs/EDITING-EXTRAS.md) --------------------

  /** Everything standing on any of `ids` that is not in `ids` itself. */
  function ridersOf(layout: Layout, ids: readonly string[]): string[] {
    const sup = supports(layout)
    const picked = new Set(ids)
    const out = new Set<string>()
    for (const id of ids) for (const r of riders(layout, id, sup)) if (!picked.has(r)) out.add(r)
    return [...out]
  }

  /**
   * Remove items. By default whatever stood on them drops onto the surface below;
   * with `withRiders` it is removed too.
   */
  function removeItems(layout: Layout, ids: readonly string[], o: { withRiders?: boolean } = {}): { layout: Layout; removed: string[] } {
    const present = new Set(layout.items.map((i) => i.id))
    const gone = new Set(ids.filter((id) => present.has(id)))
    if (o.withRiders) for (const r of ridersOf(layout, [...gone])) gone.add(r)
    if (!gone.size) return { layout, removed: [] }
    const orphans = [...supports(layout)].filter(([rid, s]) => gone.has(s.itemId) && !gone.has(rid)).map(([rid]) => rid)
    const without = { ...layout, items: layout.items.filter((i) => !gone.has(i.id)) }
    return { layout: applyPoses(without, settle(without, orphans)), removed: [...gone] }
  }

  /**
   * Set one coordinate (0 = x, 1 = y, 2 = z) of every root to `value`, or shift it by `value`
   * when `relative`. Riders keep their place on their support.
   */
  function setAxis(layout: Layout, ids: readonly string[], axis: 0 | 1 | 2, value: number, relative = false): Map<string, Pose> {
    const out = new Map<string, Pose>()
    for (const id of roots(layout, ids)) {
      const it = layout.items.find((i) => i.id === id)!
      const position: [number, number, number] = [...it.position]
      const v = relative ? it.position[axis] + value : value
      position[axis] = axis === 1 ? roundY(v) : Math.round(v)
      if (position[axis] === it.position[axis]) continue
      for (const [k, p] of moveWithRiders(layout, id, { position })) out.set(k, p)
    }
    return out
  }

  /** Turn every root on the spot to face `rotation` (unlike `rotateGroup`, positions stay). */
  function faceTo(layout: Layout, ids: readonly string[], rotation: number): Map<string, Pose> {
    const out = new Map<string, Pose>()
    const r = ((rotation % 360) + 360) % 360
    for (const id of roots(layout, ids)) {
      const it = layout.items.find((i) => i.id === id)!
      if ((((it.rotation % 360) + 360) % 360) === r) continue
      for (const [k, p] of moveWithRiders(layout, id, { rotation: r })) out.set(k, p)
    }
    return out
  }

  return {
    placedSurfaces,
    surfaceUnder,
    supports,
    riders,
    restsOn,
    moveWithRiders,
    settle,
    reseat,
    pickAlongRay,
    floating,
    roots,
    moveGroup,
    rotateGroup,
    landGroup,
    ridersOf,
    removeItems,
    setAxis,
    faceTo,
  }
}

const area = (s: Surface) => (s.maxX - s.minX) * (s.maxZ - s.minZ)

/** Apply poses to a layout, returning a new layout (items not in the map are shared). */
export function applyPoses(layout: Layout, poses: Map<string, Pose>): Layout {
  if (!poses.size) return layout
  return { ...layout, items: layout.items.map((i) => (poses.has(i.id) ? { ...i, ...poses.get(i.id)! } : i)) }
}
