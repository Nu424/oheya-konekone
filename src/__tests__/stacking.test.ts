import { describe, expect, it } from 'vitest'
import type { Surface } from '../assets/types'
import { applyPoses, createStacking } from '../editor/stacking'
import { makeLayout } from '../model/io'
import type { Item, Layout } from '../model/schema'

// A tiny world independent of the asset registry: surfaces come from the item's params.
const rect = (y: number, w: number, d: number, extra: Partial<Surface> = {}): Surface => ({ y, minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2, ...extra })
const SURFACES: Record<string, (p: Record<string, unknown>) => Surface[]> = {
  // Bench: top plus a lower shelf with limited headroom.
  bench: (p) => [rect(Number(p.height ?? 900), 1200, 600), rect(200, 1200, 600, { clearance: 600 })],
  plate: () => [rect(10, 600, 400)],
  rack: () => [],
}
const stack = createStacking({ surfaces: (i) => SURFACES[i.type]?.(i.params) ?? [] })

const item = (id: string, type: string, position: [number, number, number], rotation = 0, params: Record<string, unknown> = {}): Item => ({ id, type, position, rotation, params })
const layout = (...items: Item[]): Layout => ({ ...makeLayout({ room: { width: 4000, depth: 3000 } }), items })
const pos = (l: Layout, id: string) => l.items.find((i) => i.id === id)!.position

describe('stacking', () => {
  const base = () =>
    layout(
      item('bench', 'bench', [1000, 0, 1000]),
      item('plate', 'plate', [1000, 900, 1000]),
      item('rack', 'rack', [1100, 910, 1050]),
      item('low', 'rack', [800, 200, 1000]),
      item('floor', 'rack', [3000, 0, 2000]),
    )

  it('derives what stands on what from positions', () => {
    const sup = stack.supports(base())
    expect(sup.get('plate')?.itemId).toBe('bench')
    expect(sup.get('rack')?.itemId).toBe('plate')
    expect(sup.get('low')?.index).toBe(1)
    expect(sup.has('floor')).toBe(false)
    expect(stack.riders(base(), 'bench').sort()).toEqual(['low', 'plate', 'rack'])
    expect(stack.restsOn(sup, 'rack', 'bench')).toBe(true)
    expect(stack.restsOn(sup, 'bench', 'rack')).toBe(false)
  })

  it('moves and turns riders with their support', () => {
    const l = base()
    const moved = applyPoses(l, stack.moveWithRiders(l, 'bench', { position: [2000, 0, 1500], rotation: 90 }))
    expect(pos(moved, 'plate')).toEqual([2000, 900, 1500])
    // The rack was 100 east / 50 south of the bench centre; after a 90° turn that is 50 east / 100 north.
    expect(pos(moved, 'rack')).toEqual([2050, 910, 1400])
    expect(moved.items.find((i) => i.id === 'rack')!.rotation).toBe(90)
    expect(pos(moved, 'floor')).toEqual([3000, 0, 2000])
  })

  it('drops riders onto the next surface below when their support is removed', () => {
    const l = base()
    const without = { ...l, items: l.items.filter((i) => i.id !== 'plate') }
    const settled = applyPoses(without, stack.settle(without, ['rack']))
    expect(pos(settled, 'rack')[1]).toBe(900)
    const noBench = { ...l, items: l.items.filter((i) => i.id !== 'bench') }
    const dropped = applyPoses(noBench, stack.settle(noBench, ['plate', 'low']))
    expect(pos(dropped, 'plate')[1]).toBe(0)
    expect(pos(dropped, 'rack')[1]).toBe(10)
    expect(pos(dropped, 'low')[1]).toBe(0)
  })

  it('keeps riders on their surface when the support changes shape', () => {
    const before = base()
    const after = { ...before, items: before.items.map((i) => (i.id === 'bench' ? { ...i, params: { height: 750 } } : i)) }
    const out = applyPoses(after, stack.reseat(before, after, 'bench'))
    expect(pos(out, 'plate')[1]).toBe(750)
    expect(pos(out, 'rack')[1]).toBe(760)
    expect(pos(out, 'low')[1]).toBe(200)
  })

  it('picks the first surface along the pointer ray and falls back to the floor', () => {
    const l = base()
    const surfaces = stack.placedSurfaces(l, new Set(['floor']))
    const down = { x: 0, y: -1, z: 0 }
    const off = { x: 0, z: 0 }
    // Straight down onto the plate, the bench beside it, and the bare floor.
    expect(stack.pickAlongRay(surfaces, { x: 1000, y: 3000, z: 1000 }, down, off)?.y).toBe(910)
    expect(stack.pickAlongRay(surfaces, { x: 1550, y: 3000, z: 1000 }, down, off)?.y).toBe(900)
    expect(stack.pickAlongRay(surfaces, { x: 3000, y: 3000, z: 1000 }, down, off)?.y).toBe(0)
    // Looking in from the front below the bench top reaches the lower shelf.
    const side = stack.pickAlongRay(surfaces, { x: 1000, y: 600, z: 2500 }, { x: 0, y: -0.3, z: -1 }, off)
    expect(side?.y).toBe(200)
    // Something taller than the shelf's headroom skips it.
    const tall = stack.pickAlongRay(surfaces, { x: 1000, y: 600, z: 2500 }, { x: 0, y: -0.3, z: -1 }, off, { maxHeight: 700 })
    expect(tall?.y).toBe(0)
  })

  it('reports items floating in mid-air', () => {
    const l = layout(item('bench', 'bench', [1000, 0, 1000]), item('ok', 'rack', [1000, 900, 1000]), item('bad', 'rack', [1000, 850, 1000]))
    const f = stack.floating(l)
    expect(f.map((x) => x.item.id)).toEqual(['bad'])
    expect(f[0].nearest?.worldY).toBe(900)
  })
})

describe('several items at once', () => {
  // A bench carrying a plate and three racks in a row, plus a second bench on the floor.
  const world = () =>
    layout(
      item('bench', 'bench', [1000, 0, 1000]),
      item('plate', 'plate', [1000, 900, 1000]),
      item('r1', 'rack', [700, 900, 1200]),
      item('r2', 'rack', [800, 900, 1200]),
      item('r3', 'rack', [900, 910, 1000]),
      item('bench2', 'bench', [3000, 0, 1000], 0, { height: 700 }),
    )

  it('acts only on selected items that do not stand on another selected item', () => {
    const l = world()
    expect(stack.roots(l, ['r1', 'bench', 'r3', 'plate'])).toEqual(['bench'])
    expect(stack.roots(l, ['r1', 'r2'])).toEqual(['r1', 'r2'])
    expect(stack.roots(l, ['r3', 'plate', 'r1'])).toEqual(['plate', 'r1'])
    expect(stack.roots(l, ['gone', 'r1', 'r1'])).toEqual(['r1'])
  })

  it('moves a group rigidly and lets each root land on what is below', () => {
    const l = world()
    // Two racks slide off the bench onto the floor: same arrangement, both end at y = 0.
    const moved = applyPoses(l, stack.moveGroup(l, ['r1', 'r2'], { x: 0, y: 0, z: 800 }))
    expect(pos(moved, 'r1')).toEqual([700, 900, 2000])
    const landed = applyPoses(moved, stack.landGroup(moved, ['r1', 'r2']))
    expect(pos(landed, 'r1')).toEqual([700, 0, 2000])
    expect(pos(landed, 'r2')).toEqual([800, 0, 2000])
    // Over to the lower bench: they come down to its top (700), not through it.
    const over = applyPoses(l, stack.moveGroup(l, ['r1', 'r2'], { x: 2200, y: 0, z: -200 }))
    const onBench2 = applyPoses(over, stack.landGroup(over, ['r1', 'r2']))
    expect(pos(onBench2, 'r1')).toEqual([2900, 700, 1000])
    expect(pos(onBench2, 'r2')).toEqual([3000, 700, 1000])
    // The dragged item keeps the place it chose.
    const lead = applyPoses(moved, stack.landGroup(moved, ['r1', 'r2'], 'r1'))
    expect(pos(lead, 'r1')[1]).toBe(900)
    expect(pos(lead, 'r2')[1]).toBe(0)
  })

  it('carries riders when the group contains their support', () => {
    const l = world()
    const moved = applyPoses(l, stack.moveGroup(l, ['plate', 'r1', 'r3'], { x: 100, y: 0, z: 0 }))
    expect(pos(moved, 'plate')).toEqual([1100, 900, 1000])
    expect(pos(moved, 'r3')).toEqual([1000, 910, 1000]) // rode on the plate, moved once
    expect(pos(moved, 'r1')).toEqual([800, 900, 1200])
    expect(pos(moved, 'r2')).toEqual([800, 900, 1200]) // not selected, stays
  })

  it('turns a group around a pivot', () => {
    const l = world()
    const out = applyPoses(l, stack.rotateGroup(l, ['r1', 'r2'], { x: 750, z: 1200 }, 90))
    // 90° about the midpoint: the pair that lay along X now lies along Z.
    expect(pos(out, 'r1')).toEqual([750, 900, 1250])
    expect(pos(out, 'r2')).toEqual([750, 900, 1150])
    expect(out.items.find((i) => i.id === 'r1')!.rotation).toBe(90)
  })
})

describe('dropping near solid bodies', () => {
  const l = layout(item('bench', 'bench', [1000, 0, 1000]))
  const surfaces = stack.placedSurfaces(l)
  const body = { itemId: 'bench', occludes: true, minX: 400, maxX: 1600, minY: 0, maxY: 900, minZ: 700, maxZ: 1300 }
  const toward = (o: { x: number; y: number; z: number }, t: { x: number; y: number; z: number }) => {
    const d = { x: t.x - o.x, y: t.y - o.y, z: t.z - o.z }
    const n = Math.hypot(d.x, d.y, d.z)
    return { x: d.x / n, y: d.y / n, z: d.z / n }
  }
  const eye = { x: 1000, y: 2500, z: 5000 }

  it('does not drop onto the floor hidden behind or under a body', () => {
    // Aiming at the front face of the bench: without the body the ray reaches the floor behind it.
    const dir = toward(eye, { x: 1000, y: 100, z: 1300 })
    expect(stack.pickAlongRay(surfaces, eye, dir, { x: 0, z: 0 })?.y).toBe(0)
    expect(stack.pickAlongRay(surfaces, eye, dir, { x: 0, z: 0 }, { solids: [body] })).toBeNull()
    // Straight down through the bench: only its own surfaces are reachable.
    expect(stack.pickAlongRay(surfaces, { x: 1000, y: 3000, z: 1000 }, { x: 0, y: -1, z: 0 }, { x: 0, z: 0 }, { solids: [body] })?.y).toBe(900)
  })

  it('still reaches the floor in front of the body and the surfaces inside it', () => {
    expect(stack.pickAlongRay(surfaces, eye, toward(eye, { x: 1000, y: 0, z: 1800 }), { x: 0, z: 0 }, { solids: [body] })?.y).toBe(0)
    const low = { x: 1000, y: 600, z: 2500 }
    expect(stack.pickAlongRay(surfaces, low, toward(low, { x: 1000, y: 200, z: 1000 }), { x: 0, z: 0 }, { solids: [body] })?.y).toBe(200)
  })
})

describe('delete with or without riders, pose fields', () => {
  // A bench carrying a plate with a rack on it, a second rack on the bench, and a rack on the floor.
  const world = () =>
    layout(
      item('bench', 'bench', [1000, 0, 1000]),
      item('plate', 'plate', [1000, 900, 1000]),
      item('onPlate', 'rack', [1100, 910, 1050]),
      item('onBench', 'rack', [600, 900, 1000]),
      item('floor', 'rack', [3000, 0, 2000]),
    )
  const ids = (l: Layout) => l.items.map((i) => i.id).sort()

  it('counts what stands on a selection without the selection itself', () => {
    const l = world()
    expect(stack.ridersOf(l, ['bench']).sort()).toEqual(['onBench', 'onPlate', 'plate'])
    expect(stack.ridersOf(l, ['bench', 'plate']).sort()).toEqual(['onBench', 'onPlate'])
    expect(stack.ridersOf(l, ['floor', 'onPlate'])).toEqual([])
  })

  it('drops riders by default and removes them on request', () => {
    const l = world()
    const kept = stack.removeItems(l, ['plate'])
    expect(ids(kept.layout)).toEqual(['bench', 'floor', 'onBench', 'onPlate'])
    expect(pos(kept.layout, 'onPlate')[1]).toBe(900)
    const all = stack.removeItems(l, ['plate'], { withRiders: true })
    expect(ids(all.layout)).toEqual(['bench', 'floor', 'onBench'])
    expect(all.removed.sort()).toEqual(['onPlate', 'plate'])
    // Deleting the bench with everything on it leaves only the rack on the floor.
    expect(ids(stack.removeItems(l, ['bench'], { withRiders: true }).layout)).toEqual(['floor'])
    // Without riders the whole pile comes down in order: plate on the floor, its rack on the plate.
    const pile = stack.removeItems(l, ['bench']).layout
    expect(pos(pile, 'plate')[1]).toBe(0)
    expect(pos(pile, 'onPlate')[1]).toBe(10)
    expect(pos(pile, 'onBench')[1]).toBe(0)
    expect(stack.removeItems(l, ['gone']).removed).toEqual([])
  })

  it('sets one coordinate of every root and carries riders', () => {
    const l = world()
    // Same height for a rack on the bench and one on the floor; x and z stay.
    const lifted = applyPoses(l, stack.setAxis(l, ['onBench', 'floor'], 1, 1200))
    expect(pos(lifted, 'onBench')).toEqual([600, 1200, 1000])
    expect(pos(lifted, 'floor')).toEqual([3000, 1200, 2000])
    // The plate moves in x; its rack keeps its offset. The rack is also selected but is not a root.
    const slid = applyPoses(l, stack.setAxis(l, ['plate', 'onPlate'], 0, 1200))
    expect(pos(slid, 'plate')).toEqual([1200, 900, 1000])
    expect(pos(slid, 'onPlate')).toEqual([1300, 910, 1050])
    // Relative: each root shifts from where it is.
    const shifted = applyPoses(l, stack.setAxis(l, ['onBench', 'floor'], 2, -50, true))
    expect(pos(shifted, 'onBench')[2]).toBe(950)
    expect(pos(shifted, 'floor')[2]).toBe(1950)
    // Nothing to do when the value is already there.
    expect(stack.setAxis(l, ['floor'], 1, 0).size).toBe(0)
  })

  it('turns every root on the spot', () => {
    const l = world()
    const turned = applyPoses(l, stack.faceTo(l, ['plate', 'floor'], 90))
    expect(turned.items.find((i) => i.id === 'floor')!.rotation).toBe(90)
    expect(pos(turned, 'floor')).toEqual([3000, 0, 2000])
    expect(pos(turned, 'plate')).toEqual([1000, 900, 1000])
    // The rack on the plate orbits the plate: 100 east / 50 south becomes 50 east / 100 north.
    expect(pos(turned, 'onPlate')).toEqual([1050, 910, 900])
    expect(stack.faceTo(l, ['floor'], 360).size).toBe(0)
  })
})
