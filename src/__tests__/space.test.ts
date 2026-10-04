import { describe, expect, it } from 'vitest'
import { flushToWall, footprint, nearestWall, overlaps2D, rotateXZ, snapPosition } from '../editor/space'
import { TEMPLATES } from '../model/templates'

const box = (w: number, d: number, h = 500) => ({ min: { x: -w / 2, y: 0, z: -d / 2 }, max: { x: w / 2, y: h, z: d / 2 } })
const room = TEMPLATES[0].layout().room // 2700 × 3600

describe('space', () => {
  it('rotates so that 90° faces east', () => {
    const [x, z] = rotateXZ(0, 1, 90)
    expect(x).toBeCloseTo(1)
    expect(z).toBeCloseTo(0)
  })

  it('computes rotated footprints', () => {
    const f = footprint(box(1000, 400), 500, 0, 500, 90)
    expect(f.maxX - f.minX).toBeCloseTo(400)
    expect(f.maxZ - f.minZ).toBeCloseTo(1000)
  })

  it('detects overlaps including rotated boxes', () => {
    const a = footprint(box(1000, 1000), 0, 0, 0, 0)
    expect(overlaps2D(a, footprint(box(1000, 1000), 990, 0, 0, 0))).toBe(true)
    expect(overlaps2D(a, footprint(box(1000, 1000), 1001, 0, 0, 0))).toBe(false)
    // A 45° diamond whose bounding box overlaps but the shapes do not.
    expect(overlaps2D(a, footprint(box(600, 600), 950, 0, 950, 45))).toBe(false)
  })

  it('snaps to walls within the threshold and clamps inside the room', () => {
    const fp = (x: number, z: number) => footprint(box(800, 400), x, 0, z, 0)
    const r = snapPosition(fp, 450, 1000, room, [])
    expect(r.x).toBe(400) // flush with the west wall
    expect(r.snapped.some((s) => s.kind === 'wall' && s.axis === 'x')).toBe(true)
    const c = snapPosition(fp, -500, -500, room, [], { free: true })
    expect(c.x).toBe(400)
    expect(c.z).toBe(200)
  })

  it('snaps to neighbouring furniture edges', () => {
    const fp = (x: number, z: number) => footprint(box(500, 500), x, 0, z, 0)
    const other = footprint(box(1000, 600), 1200, 0, 1500, 0) // spans x 700..1700
    const r = snapPosition(fp, 1990, 1500, room, [other])
    expect(r.x).toBe(1950) // left edge 1700 meets the other's right edge
  })

  it('finds the nearest wall and flushes against it', () => {
    const w = nearestWall(room, 2600, 1800)
    expect(w.wall).toBe('east')
    expect(w.rotation).toBe(270)
    const fp = (x: number, z: number) => footprint(box(800, 250), x, 0, z, w.rotation)
    const p = flushToWall(fp, 2000, 1800, room, w.wall)
    expect(fp(p.x, p.z).maxX).toBeCloseTo(room.width)
  })
})
