import { describe, expect, it } from 'vitest'
import { addSpace, edgeGroup, ensureSpaces, moveEdge, removeSpace, resizeSpace } from '../editor/planEdit'
import { makeLayout, parseLayout } from '../model/io'

const plan = () =>
  makeLayout({
    room: {
      spaces: [
        { id: 'main', rect: [0, 0, 3400, 3400] },
        { id: 'kitchen', rect: [0, 3400, 1900, 1600] },
        { id: 'bath', rect: [1900, 3400, 1500, 1300] },
      ],
      openings: [{ id: 'd', type: 'door', space: 'bath', wall: 'west', offset: 100, width: 700 }],
    },
    items: [{ id: 'bed', type: 'bed', position: [2800, 0, 1200], rotation: 0, params: {} }],
  })
const rect = (L: ReturnType<typeof plan>, id: string) => L.room.spaces!.find((s) => s.id === id)!.rect

describe('plan editing', () => {
  it('moves the edges that share a wall together', () => {
    const g = edgeGroup(plan().room.spaces!, 'main', 'south').map((e) => `${e.space}:${e.side}`)
    expect(g.sort()).toEqual(['bath:north', 'kitchen:north', 'main:south'])
    const L = moveEdge(plan(), 'main', 'south', 3000)
    expect(rect(L, 'main')).toEqual([0, 0, 3400, 3000])
    expect(rect(L, 'kitchen')).toEqual([0, 3000, 1900, 2000])
    expect(rect(L, 'bath')).toEqual([1900, 3000, 1500, 1700])
    // The bathroom door stays where it was in the room.
    expect(L.room.openings[0].offset).toBe(500)
    expect(parseLayout(L).ok).toBe(true)
  })

  it('stops a move before a space gets too small or overlaps another', () => {
    const L = moveEdge(plan(), 'kitchen', 'east', 3000)
    // The kitchen's east edge is the bathroom's west edge: they move together, the bath keeps 600.
    expect(rect(L, 'kitchen')[2]).toBe(2800)
    expect(rect(L, 'bath')).toEqual([2800, 3400, 600, 1300])
  })

  it('keeps the north-west corner at the origin, shifting items with the plan', () => {
    const L = moveEdge(plan(), 'main', 'west', -500)
    expect(rect(L, 'main')).toEqual([0, 0, 3900, 3400])
    expect(rect(L, 'kitchen')).toEqual([500, 3400, 1900, 1600])
    expect(L.items[0].position).toEqual([3300, 0, 1200])
    expect([L.room.width, L.room.depth]).toEqual([3900, 5000])
  })

  it('resizes a space by its east or south edge', () => {
    expect(rect(resizeSpace(plan(), 'bath', 'depth', 1100), 'bath')).toEqual([1900, 3400, 1500, 1100])
  })

  it('adds a space beside another with a door into it, and removes it with its openings', () => {
    const r = addSpace(plan(), 'main', 'east', { depth: 1200, name: 'ベランダ' })!
    const s = r.layout.room.spaces!.find((x) => x.id === r.id)!
    expect(s.rect).toEqual([3400, 0, 1200, 3400])
    const door = r.layout.room.openings.find((o) => o.space === r.id)!
    expect([door.type, door.wall]).toEqual(['door', 'west'])
    expect(parseLayout(r.layout).ok).toBe(true)
    const back = removeSpace(r.layout, r.id)
    expect(back.room.spaces).toHaveLength(3)
    expect(back.room.openings).toHaveLength(1)
    // No room beside the kitchen to the east: the bathroom is there.
    expect(addSpace(plan(), 'kitchen', 'east')).toBeNull()
  })

  it('turns a plain room into a one-space plan', () => {
    const L = ensureSpaces(makeLayout({ room: { width: 3000, depth: 2500, openings: [{ id: 'w', type: 'window', wall: 'north', offset: 500 }] } }))
    expect(L.room.spaces).toEqual([{ id: 'main', name: '洋室', rect: [0, 0, 3000, 2500] }])
    expect(L.room.openings[0].space).toBe('main')
  })
})
