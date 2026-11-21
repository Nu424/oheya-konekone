import { describe, expect, it } from 'vitest'
import { nextWallsMode, WALLS_ORDER, wallLowered, type WallsMode } from '../three/wallDisplay'

/** Lowered walls for [exterior facing the camera, exterior behind, interior]. */
const lowered = (m: WallsMode) => [wallLowered(m, true, true), wallLowered(m, true, false), wallLowered(m, false, false)]

describe('wall display', () => {
  it('lowers the walls each mode says', () => {
    expect(lowered('up')).toEqual([false, false, false])
    expect(lowered('near')).toEqual([true, false, false])
    expect(lowered('inner')).toEqual([false, false, true])
    expect(lowered('far')).toEqual([true, false, true])
    expect(lowered('low')).toEqual([true, true, true])
  })

  it('steps from the most walls shown to the fewest, then round again', () => {
    const shown = (m: WallsMode) => lowered(m).filter((x) => !x).length
    for (let i = 1; i < WALLS_ORDER.length; i++) expect(shown(WALLS_ORDER[i])).toBeLessThanOrEqual(shown(WALLS_ORDER[i - 1]))
    expect(nextWallsMode('low')).toBe('up')
  })
})
