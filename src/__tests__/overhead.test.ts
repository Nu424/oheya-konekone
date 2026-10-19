import { describe, expect, it } from 'vitest'
import { defaultParams, getAsset } from '../assets/registry'
import { analyzeFlow } from '../editor/flow'
import { collisions, itemSurfaces, solids, stack, wallElevation } from '../editor/placement'
import { makeLayout } from '../model/io'
import type { Item, Layout } from '../model/schema'

// Things off the floor (docs/OVERHEAD.md): wall storage that carries items, a loft bed with room
// underneath, laundry hanging from the ceiling.

const item = (id: string, type: string, position: [number, number, number], params: Record<string, unknown> = {}, rotation = 0): Item => ({
  id,
  type,
  position,
  rotation,
  params: { ...defaultParams(getAsset(type)!.params), ...params },
})
const layout = (...items: Item[]): Layout => ({ ...makeLayout({ room: { width: 3600, depth: 2700, height: 2400 } }), items })

describe('wall storage', () => {
  // A board shelf on the north wall, 1200 up; its board top is at 1200 + 200.
  const shelf = () => item('shelf', 'wallStorage', [1000, 1200, 100], { style: 'board', depth: 200 })

  it('has surfaces other items can stand on, and carries them', () => {
    expect(itemSurfaces(shelf()).length).toBe(1)
    const L = layout(shelf(), item('book', 'bookStack', [1000, 1400, 100]))
    expect(stack.supports(L).get('book')?.itemId).toBe('shelf')
    const moved = stack.moveWithRiders(L, 'shelf', { position: [1500, 1200, 100] })
    expect(moved.get('book')?.position).toEqual([1500, 1400, 100])
  })

  it('does not collide with furniture below it', () => {
    const L = layout(shelf(), item('desk', 'desk', [1000, 0, 400]))
    expect([...collisions(L)]).toEqual([])
  })

  it('collides with a tall bookcase in the same spot', () => {
    const L = layout(shelf(), item('case', 'shelf', [1000, 0, 200], { height: 1800 }))
    expect([...collisions(L)].sort()).toEqual(['case', 'shelf'])
  })

  it('mounts deep door cupboards flush with the ceiling', () => {
    const p = { ...defaultParams(getAsset('wallStorage')!.params), style: 'sliding', height: 450, depth: 600 }
    expect(wallElevation('wallStorage', p, { height: 2400 })).toBe(1950)
    expect(wallElevation('wallStorage', { ...p, depth: 350 }, { height: 2400 })).toBe(1500)
  })

  it('leaves wall items without declared surfaces bare', () => {
    expect(itemSurfaces(item('ac', 'aircon', [1000, 1950, 100]))).toEqual([])
  })
})

describe('passive things', () => {
  it('rugs, curtains and ceiling lights never collide', () => {
    const L = layout(item('rug', 'rug', [1000, 0, 1000]), item('sofa', 'sofa', [1000, 0, 1000]), item('light', 'pendantLight', [1000, 0, 1000]))
    expect([...collisions(L)]).toEqual([])
  })
})

export { analyzeFlow, solids }
