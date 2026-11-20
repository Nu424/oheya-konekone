import { describe, expect, it } from 'vitest'
import { analyzeFlow, doorSwing } from '../editor/flow'
import { footprint, nearestWall, snapPosition } from '../editor/space'
import { makeLayout, parseLayout } from '../model/io'
import { planOf, resolveOpening, usableRects } from '../model/plan'
import type { LayoutInput } from '../model/schema'

// A 洋室 with a bathroom to the east of its north half (docs/FLOORPLAN.md).
const twoRooms = (openings: NonNullable<LayoutInput['room']>['openings'] = [], items: LayoutInput['items'] = []) =>
  makeLayout({
    room: {
      spaces: [
        { id: 'main', name: '洋室', rect: [0, 0, 3600, 2700] },
        { id: 'bath', name: '浴室', rect: [3600, 0, 1800, 1600] },
      ],
      openings,
    },
    items,
  })

describe('plan', () => {
  it('reads a plain room as one space with four exterior walls', () => {
    const L = makeLayout({ room: { width: 3600, depth: 2700 } })
    const p = planOf(L.room)
    expect(p.spaces).toHaveLength(1)
    expect(p.faces.map((f) => [f.side, f.line, f.from, f.to])).toEqual([
      ['north', 0, 0, 3600],
      ['south', 2700, 0, 3600],
      ['west', 0, 0, 2700],
      ['east', 3600, 0, 2700],
    ])
    // North and south walls close the corners.
    expect(p.walls.find((w) => w.face.side === 'north')).toMatchObject({ start: -120, end: 3720, exterior: true })
  })

  it('derives interior walls where spaces meet, half a wall in from the shared edge', () => {
    const L = twoRooms()
    expect([L.room.width, L.room.depth]).toEqual([5400, 2700])
    const p = planOf(L.room)
    const east = p.faces.filter((f) => f.space === 'main' && f.side === 'east')
    expect(east.map((f) => [f.exterior, f.line, f.from, f.to])).toEqual([
      [false, 3550, 0, 1600],
      [true, 3600, 1600, 2700],
    ])
    const west = p.faces.find((f) => f.space === 'bath' && f.side === 'west')!
    expect([west.exterior, west.line, west.other]).toEqual([false, 3650, 'main'])
    // One wall for the two faces of the interior wall, built from the 洋室 side.
    expect(p.walls.filter((w) => !w.exterior)).toHaveLength(1)
    expect(west.wall).toBe(east[0].id)
    // The 洋室's north wall stops where the bathroom continues it; the bathroom's closes its corner.
    expect(p.walls.find((w) => w.face.space === 'main' && w.face.side === 'north')).toMatchObject({ start: -120, end: 3600 })
    expect(p.walls.find((w) => w.face.space === 'bath' && w.face.side === 'north')).toMatchObject({ start: 3600, end: 5520 })
    expect(usableRects(L.room).find((r) => r.space === 'main')).toMatchObject({ minX: 0, maxX: 3550 })
  })

  it('places openings relative to their space, seen from inside it', () => {
    const L = twoRooms([{ id: 'd', type: 'door', space: 'bath', wall: 'west', offset: 400, width: 700, hinge: 'left', swing: 'in' }])
    const r = resolveOpening(L.room, L.room.openings[0])!
    expect([r.face.space, r.from, r.to, r.flipped]).toEqual(['bath', 400, 1100, true])
    // Swings into the bathroom: the hinge is on the bathroom's face.
    const s = doorSwing(L.room.openings[0], L)!
    expect(s.cx).toBe(3650)
    expect(Math.cos((s.a0 + s.a1) / 2)).toBeGreaterThan(0)
  })

  it('keeps reading openings without a space against the outline', () => {
    const L = twoRooms([{ id: 'w', type: 'window', wall: 'north', offset: 4000, width: 900 }])
    expect(resolveOpening(L.room, L.room.openings[0])?.face.space).toBe('bath')
  })

  it('reaches the next room only through a door', () => {
    const entrance = { id: 'e', type: 'door' as const, space: 'main', wall: 'south' as const, offset: 1000, width: 780 }
    const washer = [{ id: 'washer', type: 'washer', position: [4500, 0, 500] as [number, number, number], rotation: 0, params: {} }]
    const closed = analyzeFlow(twoRooms([entrance], washer))
    expect(closed.issues.map((i) => i.message)).toContain('「洗濯機」までたどり着けないかも')
    const open = analyzeFlow(twoRooms([entrance, { id: 'd', type: 'door', space: 'bath', wall: 'west', offset: 400, width: 750 }], washer))
    expect(open.issues.map((i) => i.message)).not.toContain('「洗濯機」までたどり着けないかも')
  })

  it('snaps to the walls of the space an item is in, and finds the nearest face there', () => {
    const L = twoRooms()
    const box = { min: { x: -300, y: 0, z: -300 }, max: { x: 300, y: 500, z: 300 } }
    const fp = (x: number, z: number) => footprint(box, x, 0, z, 0)
    // Pushed against the interior wall from the 洋室 side: stops at its face.
    expect(snapPosition(fp, 3400, 800, L.room, [], { free: true }).x).toBe(3250)
    expect(nearestWall(L.room, 3500, 800)).toMatchObject({ wall: 'east', rotation: 270 })
    expect(nearestWall(L.room, 3700, 800).face.space).toBe('bath')
  })

  it('reports overlapping spaces and unknown spaces', () => {
    const bad = parseLayout({
      room: {
        spaces: [
          { id: 'a', rect: [0, 0, 3000, 3000] },
          { id: 'b', rect: [2000, 0, 3000, 3000] },
        ],
        openings: [{ id: 'd', type: 'door', space: 'zz', wall: 'south', offset: 0 }],
      },
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.map((e) => e.message).join('\n')).toMatch(/重なっています[\s\S]*区画 "zz" がありません/)
  })
})
