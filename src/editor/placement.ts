import { getAsset } from '../assets/registry'
import type { Item, Layout } from '../model/schema'
import { itemFootprint } from '../three/ItemObject'
import { flushToWall, footprint, nearestWall, overlaps3D, type Footprint2D, type LocalBox } from './space'

/** Local bounding box of an item (mm), from its built geometry. */
export function localBox(item: Pick<Item, 'type' | 'params'>): LocalBox {
  const fp = itemFootprint(item.type, item.params)
  if (!fp) return { min: { x: -250, y: 0, z: -250 }, max: { x: 250, y: 500, z: 250 } }
  return fp.box
}

/** Room-space footprint of an item; ceiling items hang from the ceiling height. */
export function itemFootprint2D(item: Item, layout: Layout, at?: { x?: number; y?: number; z?: number; rotation?: number }): Footprint2D {
  const box = localBox(item)
  const asset = getAsset(item.type)
  const y = asset?.placement === 'ceiling' ? layout.room.height : (at?.y ?? item.position[1])
  return footprint(box, at?.x ?? item.position[0], y, at?.z ?? item.position[2], at?.rotation ?? item.rotation)
}

/** Soft or flat things that never block others (rugs, curtains, floor cushions, ceiling fixtures). */
const SOFT = new Set(['rug', 'curtain', 'cushion'])
export function isPassive(type: string) {
  const a = getAsset(type)
  return SOFT.has(type) || a?.placement === 'ceiling'
}

/** Seats that are meant to be tucked under tables and desks. */
const SEATS = new Set(['officeChair', 'diningChair', 'floorChair'])
const TABLES = new Set(['desk', 'diningTable', 'lowTable', 'kotatsu'])
function tucks(a: string, b: string) {
  return (SEATS.has(a) && TABLES.has(b)) || (SEATS.has(b) && TABLES.has(a))
}

/** Ids of items that collide with something (furniture vs furniture, furniture vs columns). */
export function collisions(layout: Layout): Set<string> {
  const out = new Set<string>()
  const list = layout.items.filter((i) => !isPassive(i.type)).map((i) => ({ i, f: itemFootprint2D(i, layout) }))
  const cols = layout.room.columns.map((c) => footprint({ min: { x: -c.width / 2, y: 0, z: -c.depth / 2 }, max: { x: c.width / 2, y: layout.room.height, z: c.depth / 2 } }, c.x, 0, c.z, 0))
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      if (supports(list[a], list[b]) || supports(list[b], list[a])) continue
      if (tucks(list[a].i.type, list[b].i.type)) continue
      if (overlaps3D(list[a].f, list[b].f)) {
        out.add(list[a].i.id)
        out.add(list[b].i.id)
      }
    }
    for (const c of cols) if (overlaps3D(list[a].f, c)) out.add(list[a].i.id)
  }
  return out
}

/** True when `top` rests on `base` (e.g. a monitor on a desk): treated as stacking, not collision. */
function supports(base: { i: Item; f: Footprint2D }, top: { i: Item; f: Footprint2D }) {
  const a = getAsset(top.i.type)
  if (a?.placement !== 'onTop') return false
  return Math.abs(top.f.minY - base.f.maxY) < 60 || (top.f.minY >= base.f.minY && top.f.minY <= base.f.maxY)
}

/**
 * Height of the surface under (x, z) for an onTop item: the highest top among floor items
 * whose footprint contains the point (ignoring rugs and the item itself). 0 if none.
 */
export function supportHeight(layout: Layout, x: number, z: number, exceptId?: string): number {
  let best = 0
  for (const it of layout.items) {
    if (it.id === exceptId || isPassive(it.type)) continue
    const a = getAsset(it.type)
    if (a?.placement !== 'floor') continue
    const f = itemFootprint2D(it, layout)
    if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue
    if (f.maxY > 1300) continue // shelves taller than this are not "surfaces"
    best = Math.max(best, f.maxY)
  }
  return best
}

const PREFERRED_SUPPORT: Record<string, string[]> = {
  monitor: ['desk', 'diningTable'],
  deskLamp: ['desk', 'diningTable', 'lowTable', 'chest'],
  tv: ['tvStand', 'chest', 'lowTable'],
}

/** Find a sensible spot for a newly added item. */
export function placeNewItem(layout: Layout, type: string, params: Record<string, unknown>): Pick<Item, 'position' | 'rotation'> & { crowded?: boolean } {
  const asset = getAsset(type)
  const { room } = layout
  const probe: Item = { id: '__new', type, params, position: [room.width / 2, 0, room.depth / 2], rotation: 0 }
  const fpAt = (x: number, z: number, rot: number, y = 0) => itemFootprint2D(probe, layout, { x, z, rotation: rot, y })

  if (asset?.placement === 'onTop') {
    for (const st of PREFERRED_SUPPORT[type] ?? []) {
      const base = layout.items.find((i) => i.type === st)
      if (!base) continue
      const bf = itemFootprint2D(base, layout)
      // Sit towards the back of the support.
      const [bx, , bz] = base.position
      const back = rotateBack(base.rotation, Math.min(120, (bf.maxZ - bf.minZ) * 0.2))
      return { position: [bx + back[0], bf.maxY, bz + back[1]], rotation: base.rotation }
    }
    return { position: [room.width / 2, asset.elevation ?? 0, room.depth / 2], rotation: 0 }
  }

  if (asset?.placement === 'wall') {
    const windows = room.openings.filter((o) => o.type === 'window').sort((a, b) => b.width * b.height - a.width * a.height)
    const at = (w: (typeof windows)[number]['wall'], u: number) => {
      const nx = w === 'west' ? 100 : w === 'east' ? room.width - 100 : u
      const nz = w === 'north' ? 100 : w === 'south' ? room.depth - 100 : u
      const rot = nearestWall(room, nx, nz).rotation
      const p = flushToWall((x, z) => fpAt(x, z, rot), nx, nz, room, w)
      return { x: p.x, z: p.z, rot }
    }
    // Curtains go on the biggest window; everything else prefers a wall without windows.
    if (type === 'curtain' && windows[0]) {
      const w = windows[0]
      const p = at(w.wall, w.offset + w.width / 2)
      return { position: [p.x, Math.max(10, w.sill - 150), p.z], rotation: p.rot }
    }
    const walls = (['north', 'west', 'east', 'south'] as const).slice().sort((a, b) => {
      const n = (w: string) => room.openings.filter((o) => o.wall === w).length
      return n(a) - n(b)
    })
    const w = walls[0]
    const p = at(w, (w === 'north' || w === 'south' ? room.width : room.depth) / 2)
    return { position: [p.x, asset.elevation ?? 1500, p.z], rotation: p.rot }
  }

  // Floor / ceiling: spiral out from the room centre until there is no overlap.
  const others = layout.items.filter((i) => !isPassive(i.type)).map((i) => itemFootprint2D(i, layout))
  const passive = type === 'rug' || asset?.placement === 'ceiling'
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

/** Offset pointing towards the back (-Z local) of an item with the given rotation. */
function rotateBack(rotation: number, dist: number): [number, number] {
  const r = (rotation * Math.PI) / 180
  return [-Math.sin(r) * dist, -Math.cos(r) * dist]
}
