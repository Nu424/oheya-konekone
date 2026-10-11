import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { defaultParams, numberLimits, p, paramsSchema, resolveParams } from '../assets/params'
import { assetList } from '../assets/registry'
import { parseNumberEntry, sharedValue } from '../editor/fields'

describe('number entry', () => {
  it('reads absolute and relative values', () => {
    expect(parseNumberEntry('120')).toEqual({ value: 120, relative: false })
    expect(parseNumberEntry(' 12.5 ')).toEqual({ value: 12.5, relative: false })
    expect(parseNumberEntry('-40')).toEqual({ value: -40, relative: false })
    expect(parseNumberEntry('+50')).toEqual({ value: 50, relative: true })
    expect(parseNumberEntry('+=50')).toEqual({ value: 50, relative: true })
    expect(parseNumberEntry('-=7.5')).toEqual({ value: -7.5, relative: true })
    expect(parseNumberEntry('.5')).toEqual({ value: 0.5, relative: false })
  })

  it('accepts full-width input and rejects anything else', () => {
    expect(parseNumberEntry('１２０')).toEqual({ value: 120, relative: false })
    expect(parseNumberEntry('＋５０')).toEqual({ value: 50, relative: true })
    expect(parseNumberEntry('－４０')).toEqual({ value: -40, relative: false })
    for (const bad of ['', 'abc', '12mm', '1e3', '++5', '5+', '=5', '1,200']) expect(parseNumberEntry(bad), bad).toBeNull()
  })

  it('shows a value only when all items share it', () => {
    expect(sharedValue([900, 900, 900.02])).toBe(900)
    expect(sharedValue([900, 910])).toBeNull()
    expect(sharedValue([])).toBeNull()
    expect(sharedValue([0])).toBe(0)
  })
})

describe('number limits', () => {
  const specs = {
    len: p.mm('長さ', 100, 1000, 500),
    count: p.number({ label: '個数', min: 1, max: 8, default: 2 }),
    gap: p.mm('すき間', 0, 50, 10),
    tall: p.mm('高さ', 100, 1000, 500, { hardMin: 80, hardMax: 1200 }),
  }

  it('lets lengths grow past the slider range but not counts', () => {
    expect(numberLimits(specs.len)).toEqual({ min: 100, max: 1500 })
    expect(numberLimits(specs.count)).toEqual({ min: 1, max: 8 })
    expect(numberLimits(specs.gap)).toEqual({ min: 0, max: 75 })
    expect(numberLimits(specs.tall)).toEqual({ min: 80, max: 1200 })
  })

  it('validates and clamps against the wider range', () => {
    const schema = paramsSchema(specs)
    expect(schema.safeParse({ len: 1400 }).success).toBe(true)
    expect(schema.safeParse({ len: 1600 }).success).toBe(false)
    expect(schema.safeParse({ len: 90 }).success).toBe(false)
    expect(schema.safeParse({ count: 9 }).success).toBe(false)
    expect(resolveParams(specs, { len: 1400, count: 20, tall: 5000 })).toMatchObject({ len: 1400, count: 8, tall: 1200 })
    expect(resolveParams(specs, { len: 1 }).len).toBe(100)
  })

  it('every asset still builds at the edge of what can be typed in', () => {
    // All problems are collected so one run shows every asset that needs its own hardMin / hardMax.
    const problems: string[] = []
    for (const a of assetList) {
      for (const which of ['min', 'max'] as const) {
        const raw: Record<string, unknown> = defaultParams(a.params)
        for (const [k, s] of Object.entries(a.params)) if (s.kind === 'number') raw[k] = numberLimits(s)[which]
        const params = resolveParams(a.params, raw) as never
        const tag = `${a.type} ${which}`
        try {
          const b = new THREE.Box3().setFromObject(a.build(params))
          if (![b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].every(Number.isFinite)) problems.push(`${tag}: geometry is not finite`)
          const body = a.body?.(params)
          if (body) for (const axis of ['x', 'y', 'z'] as const) if (!(body.max[axis] > body.min[axis])) problems.push(`${tag}: body is empty along ${axis}`)
          for (const s of a.surfaces?.(params) ?? []) if (!(s.maxX > s.minX && s.maxZ > s.minZ)) problems.push(`${tag}: surface "${s.label ?? ''}" is empty`)
        } catch (e) {
          problems.push(`${tag}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})
