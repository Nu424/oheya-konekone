import { describe, expect, it } from 'vitest'
import { stepWalk, walkObstacles } from '../editor/walk'
import { makeLayout } from '../model/io'
import type { LayoutInput } from '../model/schema'

// A 洋室 with a bathroom to the east; walls along x = 3600 between them (docs/FLOORPLAN.md).
const plan = (openings: NonNullable<LayoutInput['room']>['openings'] = [], items: LayoutInput['items'] = []) =>
  makeLayout({
    room: {
      spaces: [
        { id: 'main', rect: [0, 0, 3600, 2700] },
        { id: 'bath', rect: [3600, 0, 1800, 1600] },
      ],
      openings,
    },
    items,
  })

/** Walk east from x = 2600 at z in 50 mm steps; where does the walker end up? */
function walkEast(L: ReturnType<typeof plan>, z: number) {
  const obs = walkObstacles(L, 1550)
  let x = 2600
  for (let i = 0; i < 40; i++) [x, z] = stepWalk(x, z, 50, 0, obs)
  return x
}

describe('walk collision', () => {
  it('stops at an interior wall and goes through its door', () => {
    expect(walkEast(plan(), 800)).toBeLessThan(3400)
    const door = { id: 'd', type: 'door' as const, space: 'bath', wall: 'west' as const, offset: 400, width: 750 }
    expect(walkEast(plan([door]), 800)).toBeGreaterThan(4500)
  })

  it('slides along a wall instead of sticking to it', () => {
    const obs = walkObstacles(plan(), 1550)
    const [x, z] = stepWalk(3340, 800, 50, 50, obs)
    expect([x, z]).toEqual([3340, 850])
  })

  it('bumps into furniture but steps over rugs', () => {
    const items = (type: string, params = {}) => [{ id: 'x', type, position: [3300, 0, 2000] as [number, number, number], rotation: 0, params }]
    expect(walkEast(plan([], items('shelf', { width: 400, depth: 300 })), 2000)).toBeLessThan(3100)
    expect(walkEast(plan([], items('rug')), 2000)).toBeGreaterThan(3300)
  })

  it('lets a walker that starts inside something walk out, but not into anything else', () => {
    const L = plan([], [{ id: 's', type: 'shelf', position: [3000, 0, 2000], rotation: 0, params: { width: 400, depth: 300 } }])
    const obs = walkObstacles(L, 1550)
    let x = 3000
    for (let i = 0; i < 40; i++) [x] = stepWalk(x, 2000, 50, 0, obs)
    expect(x).toBeLessThan(3600)
    expect(x).toBeGreaterThan(3200)
  })
})
