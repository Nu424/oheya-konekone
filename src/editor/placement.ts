import { getAsset, resolveItemParams } from '../assets/registry'
import type { Surface } from '../assets/types'
import type { Item, Layout } from '../model/schema'
import { itemFootprint } from '../three/ItemObject'
import { flushToWall, footprint, nearestWall, overlaps3D, partsOf, type Footprint2D, type LocalBox } from './space'
import { createStacking, roundY, surfaceBounds, type PlacedSurface, type Solid } from './stacking'

const FALLBACK: LocalBox = { min: { x: -100, y: 0, z: -100 }, max: { x: 100, y: 100, z: 100 } }

/** Local box of the part of an item that occupies space (mm): the asset's `body`, or its bounding box. */
export function localBox(item: Pick<Item, 'type' | 'params'>): LocalBox {
  return itemFootprint(item.type, item.params)?.body ?? FALLBACK
}

/** Local bounding box of everything the item draws, including arms and open doors. */
export function visualBox(item: Pick<Item, 'type' | 'params'>): LocalBox {
  return itemFootprint(item.type, item.params)?.box ?? FALLBACK
}

/** Separate solid parts of an item in its local frame (mm), when the asset declares them. */
export function localSolids(item: Pick<Item, 'type' | 'params'>): LocalBox[] | undefined {
  return itemFootprint(item.type, item.params)?.solids
}

/**
 * Room-space footprint of an item; ceiling items hang from the ceiling height.
 * Items made of several solid parts (AssetDef.solids) carry them in `parts`.
 */
export function itemFootprint2D(item: Item, layout: Layout, at?: { x?: number; y?: number; z?: number; rotation?: number }): Footprint2D {
  const box = localBox(item)
  const asset = getAsset(item.type)
  const x = at?.x ?? item.position[0]
  const y = asset?.placement === 'ceiling' ? layout.room.height : (at?.y ?? item.position[1])
  const z = at?.z ?? item.position[2]
  const rot = at?.rotation ?? item.rotation
  const f = footprint(box, x, y, z, rot)
  const parts = localSolids(item)
  if (parts?.length) f.parts = parts.map((b) => footprint(b, x, y, z, rot))
  return f
}

const surfaceCache = new Map<string, Surface[]>()

/**
 * Support surfaces of an item in its local frame: the asset's `surfaces`, or the top of its body.
 * Wall items only have the surfaces they declare (a wall shelf); ceiling items have none.
 */
export function itemSurfaces(item: Pick<Item, 'type' | 'params'>): Surface[] {
  const asset = getAsset(item.type)
  if (!asset || asset.placement === 'ceiling' || (asset.placement === 'wall' && !asset.surfaces)) return []
  const key = item.type + JSON.stringify(item.params)
  let s = surfaceCache.get(key)
  if (!s) {
    if (asset.surfaces) s = asset.surfaces(resolveItemParams(item.type, item.params) as never)
    else {
      const b = localBox(item)
      s = [{ y: b.max.y, minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z }]
    }
    if (surfaceCache.size > 500) surfaceCache.clear()
    surfaceCache.set(key, s)
  }
  return s
}

function stackable(item: Item) {
  const p = getAsset(item.type)?.placement
  return p !== 'wall' && p !== 'ceiling'
}

/** Stacking helpers bound to the asset registry. */
export const stack = createStacking({ surfaces: itemSurfaces, stackable })

/**
 * Things that never block others: soft or flat ones (rugs, curtains, floor cushions) and ceiling
 * fixtures, unless the asset says otherwise (AssetDef.blocks).
 */
export function isPassive(type: string) {
  const a = getAsset(type)
  return !(a?.blocks ?? a?.placement !== 'ceiling')
}

/** Seats that are meant to be tucked under tables and desks. */
export const SEATS = new Set(['officeChair', 'diningChair', 'floorChair', 'foldingChair'])
const TABLES = new Set(['desk', 'officeDesk', 'diningTable', 'lowTable', 'kotatsu'])
function tucks(a: string, b: string) {
  return (SEATS.has(a) && TABLES.has(b)) || (SEATS.has(b) && TABLES.has(a))
}

function isHollow(item: Item) {
  const h = getAsset(item.type)?.hollow
  return typeof h === 'function' ? h(resolveItemParams(item.type, item.params) as never) : !!h
}

/** `inner` lies within the outline of `outer` when seen from above. */
function within(inner: Footprint2D, outer: Footprint2D) {
  return inner.minX >= outer.minX - 1 && inner.maxX <= outer.maxX + 1 && inner.minZ >= outer.minZ - 1 && inner.maxZ <= outer.maxZ + 1
}

/**
 * Ids of items that collide with something. Two items do not collide when
 * - one stands on the other, directly or through other items (a lamp on a book on a desk), or
 * - one is a hollow frame and the other fits inside its outline, or
 * - one is a seat tucked under a table or desk.
 */
export function collisions(layout: Layout): Set<string> {
  const out = new Set<string>()
  const sup = stack.supports(layout)
  const list = layout.items.filter((i) => !isPassive(i.type)).map((i) => ({ i, f: itemFootprint2D(i, layout), hollow: isHollow(i) }))
  const cols = layout.room.columns.map((c) => footprint({ min: { x: -c.width / 2, y: 0, z: -c.depth / 2 }, max: { x: c.width / 2, y: layout.room.height, z: c.depth / 2 } }, c.x, 0, c.z, 0))
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const A = list[a]
      const B = list[b]
      if (!overlaps3D(A.f, B.f)) continue
      if (stack.restsOn(sup, A.i.id, B.i.id) || stack.restsOn(sup, B.i.id, A.i.id)) continue
      if ((B.hollow && within(A.f, B.f)) || (A.hollow && within(B.f, A.f))) continue
      if (tucks(A.i.type, B.i.type)) continue
      out.add(A.i.id)
      out.add(B.i.id)
    }
    for (const c of cols) if (overlaps3D(list[a].f, c)) out.add(list[a].i.id)
  }
  return out
}

/** Height at which an item dropped at (x, z) comes to rest: the highest surface under it, or the floor. */
export function supportHeight(layout: Layout, x: number, z: number, except?: ReadonlySet<string>): number {
  return roundY(stack.surfaceUnder(layout, x, z, { except })?.worldY ?? 0)
}

const area = (s: PlacedSurface) => (s.maxX - s.minX) * (s.maxZ - s.minZ)

/** Items that sit on furniture look for surfaces no higher than this when they are added. */
const REACHABLE_HEIGHT = 1700

/** Furniture an onTop item would rather stand on, in order, when nothing is selected. */
const PREFERRED_SUPPORT: Record<string, string[]> = {
  monitor: ['desk', 'diningTable'],
  deskLamp: ['desk', 'diningTable', 'lowTable', 'cabinet'],
  tv: ['tvStand', 'cabinet', 'lowTable'],
}

/**
 * A free spot for an item that sits on furniture: the preferred item's surfaces first, then the largest ones,
 * scanning each from its centre outwards.
 */
function placeOnSurface(layout: Layout, probe: Item, preferId?: string): Pick<Item, 'position' | 'rotation'> | null {
  const box = localBox(probe)
  const height = box.max.y - box.min.y
  const sup = stack.supports(layout)
  const others = layout.items.filter((i) => !isPassive(i.type)).map((i) => ({ i, f: itemFootprint2D(i, layout) }))
  const surfaces = stack
    .placedSurfaces(layout)
    .filter((s) => s.worldY <= REACHABLE_HEIGHT && (s.clearance === undefined || s.clearance >= height))
    .sort((a, b) => Number(b.itemId === preferId) - Number(a.itemId === preferId) || area(b) - area(a))
  for (const s of surfaces) {
    // Things that the surface's owner stands on (and the owner itself) are not obstacles.
    const blockers = others.filter((o) => o.i.id !== s.itemId && !stack.restsOn(sup, s.itemId, o.i.id)).map((o) => o.f)
    const w = box.max.x - box.min.x
    const d = box.max.z - box.min.z
    const spanX = s.maxX - s.minX - w
    const spanZ = s.maxZ - s.minZ - d
    if (spanX < 0 || spanZ < 0) continue
    const step = Math.max(25, Math.max(spanX, spanZ) / 40)
    const cx = (s.minX + s.maxX) / 2 - (box.min.x + box.max.x) / 2
    const cz = (s.minZ + s.maxZ) / 2 - (box.min.z + box.max.z) / 2
    const spots: [number, number][] = []
    for (let ix = -Math.floor(spanX / 2 / step); ix <= Math.floor(spanX / 2 / step); ix++)
      for (let iz = -Math.floor(spanZ / 2 / step); iz <= Math.floor(spanZ / 2 / step); iz++) spots.push([cx + ix * step, cz + iz * step])
    spots.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cz) - Math.hypot(q[0] - cx, q[1] - cz))
    const r = (s.rotation * Math.PI) / 180
    for (const [lx, lz] of spots) {
      const x = Math.round(s.x + lx * Math.cos(r) + lz * Math.sin(r))
      const z = Math.round(s.z - lx * Math.sin(r) + lz * Math.cos(r))
      const f = footprint(box, x, s.worldY, z, s.rotation)
      if (!blockers.some((o) => overlaps3D(f, o))) return { position: [x, roundY(s.worldY), z], rotation: s.rotation }
    }
  }
  return null
}

/** Default mounting height (mm) of a wall item with these parameters. */
export function wallElevation(type: string, params: Record<string, unknown>, room: { height: number }) {
  const e = getAsset(type)?.elevation
  return typeof e === 'function' ? e(resolveItemParams(type, params) as never, room) : (e ?? 1500)
}

/** Find a sensible spot for a newly added item. `preferId` is the item whose surfaces are tried first. */
export function placeNewItem(
  layout: Layout,
  type: string,
  params: Record<string, unknown>,
  preferId?: string,
): Pick<Item, 'position' | 'rotation'> & { crowded?: boolean } {
  const asset = getAsset(type)
  const { room } = layout
  const probe: Item = { id: '__new', type, params, position: [room.width / 2, 0, room.depth / 2], rotation: 0 }
  const fpAt = (x: number, z: number, rot: number, y = 0) => itemFootprint2D(probe, layout, { x, z, rotation: rot, y })

  if (asset?.placement === 'onTop') {
    const prefer = preferId ?? (PREFERRED_SUPPORT[type] ?? []).map((t) => layout.items.find((i) => i.type === t)?.id).find(Boolean)
    const spot = placeOnSurface(layout, probe, prefer)
    if (spot) return spot
  }

  if (asset?.placement === 'wall') {
    const windows = room.openings.filter((o) => o.type === 'window').sort((a, b) => b.width * b.height - a.width * a.height)
    // Curtains go on the biggest window; everything else prefers a wall without windows.
    if (type === 'curtain' && windows[0]) {
      const win = windows[0]
      const u = win.offset + win.width / 2
      const nx = win.wall === 'west' ? 100 : win.wall === 'east' ? room.width - 100 : u
      const nz = win.wall === 'north' ? 100 : win.wall === 'south' ? room.depth - 100 : u
      const rot = nearestWall(room, nx, nz).rotation
      const p = flushToWall((x, z) => fpAt(x, z, rot), nx, nz, room, win.wall)
      return { position: [p.x, Math.max(10, win.sill - 150), p.z], rotation: rot }
    }
    const walls = (['north', 'west', 'east', 'south'] as const).slice().sort((a, b) => {
      const n = (w: string) => room.openings.filter((o) => o.wall === w).length
      return n(a) - n(b)
    })
    const w = walls[0]
    const u = (w === 'north' || w === 'south' ? room.width : room.depth) / 2
    const nx = w === 'west' ? 100 : w === 'east' ? room.width - 100 : u
    const nz = w === 'north' ? 100 : w === 'south' ? room.depth - 100 : u
    const rot = nearestWall(room, nx, nz).rotation
    const p = flushToWall((x, z) => fpAt(x, z, rot), nx, nz, room, w)
    return { position: [p.x, Math.round(wallElevation(type, params, room)), p.z], rotation: rot }
  }

  // Floor / ceiling: spiral out from the room centre until there is no overlap.
  const others = layout.items.filter((i) => !isPassive(i.type)).map((i) => itemFootprint2D(i, layout))
  const passive = type === 'rug' || (asset?.placement === 'ceiling' && isPassive(type))
  const cx = room.width / 2
  const cz = room.depth / 2
  for (const rot of [0, 90]) {
    for (let r = 0; r < Math.max(room.width, room.depth); r += 100) {
      const steps = Math.max(1, Math.round((2 * Math.PI * r) / 150))
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2
        const x = Math.round((cx + Math.cos(a) * r) / 50) * 50
        const z = Math.round((cz + Math.sin(a) * r) / 50) * 50
        const f = fpAt(x, z, rot)
        if (f.minX < 0 || f.minZ < 0 || f.maxX > room.width || f.maxZ > room.depth) continue
        if (passive || !others.some((o) => overlaps3D(f, o))) return { position: [x, 0, z], rotation: rot }
      }
    }
    if (passive) break
  }
  return { position: [cx, 0, cz], rotation: 0, crowded: true }
}

/** Snap targets and bounds for an item resting on `surface` (null = the floor of the room). */
export function surfaceFrame(surface: PlacedSurface | null, room: { width: number; depth: number }) {
  if (!surface) return { minX: 0, maxX: room.width, minZ: 0, maxZ: room.depth, y: 0 }
  return { ...surfaceBounds(surface), y: surface.worldY }
}

/** Bodies nothing can be dropped into (open frames excluded), for `stack.pickAlongRay`. */
export function solids(layout: Layout, except?: ReadonlySet<string>): Solid[] {
  return layout.items
    .filter((i) => !except?.has(i.id) && !isPassive(i.type) && !isHollow(i))
    .flatMap((i) => {
      const occludes = itemSurfaces(i).length > 0
      // Each solid part separately: the floor under a loft bed's deck is a place to put things.
      return partsOf(itemFootprint2D(i, layout)).map((f) => ({ itemId: i.id, occludes, minX: f.minX, maxX: f.maxX, minY: f.minY, maxY: f.maxY, minZ: f.minZ, maxZ: f.maxZ }))
    })
}
