import { describe, expect, it } from 'vitest'
import { MOTION_PIXELS, motionRenderScale, restPixelRatio } from '../three/render/quality'

describe('motion render scale (docs/PERFORMANCE.md B-1)', () => {
  it('leaves canvases within the pixel budget alone', () => {
    expect(motionRenderScale(1280, 720, 1)).toBeNull()
    expect(motionRenderScale(1600, 1000, 1)).toBeNull()
  })

  it('shrinks big 1× canvases to about the budget', () => {
    const scale = motionRenderScale(2560, 1271, 1)!
    expect(scale).toBeCloseTo(0.7, 5)
    expect(2560 * 1271 * scale * scale).toBeLessThanOrEqual(MOTION_PIXELS)
  })

  it('drops high-DPI screens to 1× (or less on big ones)', () => {
    expect(motionRenderScale(1440, 900, 2)).toBeCloseTo(0.5, 5)
    expect(motionRenderScale(2560, 1300, 2)).toBeCloseTo(0.35, 5)
  })

  it('never goes below half resolution', () => {
    expect(motionRenderScale(7680, 4320, 1)).toBe(0.5)
  })

  it('matches the Canvas dpr range', () => {
    expect(restPixelRatio(0)).toBe(1)
    expect(restPixelRatio(1.25)).toBe(1.25)
    expect(restPixelRatio(3)).toBe(2)
  })
})
