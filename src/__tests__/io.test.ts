import { describe, expect, it } from 'vitest'
import { clampOpening, tatami } from '../model/geometry'
import { extractJson, parseLayout, parseLayoutText, serializeLayout } from '../model/io'
import { TEMPLATES } from '../model/templates'

describe('layout io', () => {
  it('all templates validate and round-trip', () => {
    for (const t of TEMPLATES) {
      const l = t.layout()
      const r = parseLayoutText(serializeLayout(l))
      expect(r.ok, t.id).toBe(true)
      if (r.ok) expect(r.layout).toEqual(l)
    }
  })

  it('fills defaults for a minimal layout', () => {
    const r = parseLayout({ room: { width: 3000, depth: 3000 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.layout.room.height).toBe(2400)
    expect(r.layout.items).toEqual([])
    expect(r.layout.version).toBe(1)
  })

  it('reports item param errors with a precise path', () => {
    const r = parseLayout({
      room: { width: 3000, depth: 3000 },
      items: [{ id: 'd', type: 'desk', position: [1000, 0, 1000], params: { width: 99999 } }],
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0].path).toBe('items[0].params.width')
  })

  it('rejects unknown item types and unknown params', () => {
    const r = parseLayout({
      room: { width: 3000, depth: 3000 },
      items: [
        { id: 'a', type: 'spaceship', position: [0, 0, 0] },
        { id: 'b', type: 'desk', position: [0, 0, 0], params: { widht: 1000 } },
      ],
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.map((e) => e.path)).toEqual(['items[0].type', 'items[1].params'])
  })

  it('rejects openings that do not fit their wall', () => {
    const r = parseLayout({
      room: { width: 2000, depth: 3000, openings: [{ id: 'w', type: 'window', wall: 'north', offset: 1500, width: 1000 }] },
    })
    expect(r.ok).toBe(false)
  })

  it('extracts JSON from fenced AI replies', () => {
    const text = 'はい、配置案です！\n```json\n{"room":{"width":3000,"depth":2500}}\n```\nどうでしょう？'
    expect(JSON.parse(extractJson(text)).room.width).toBe(3000)
  })
})

describe('geometry', () => {
  it('computes tatami', () => {
    const l = TEMPLATES[0].layout()
    expect(tatami(l.room)).toBeCloseTo(6, 1)
  })

  it('clamps openings onto their wall', () => {
    const l = TEMPLATES[0].layout()
    const o = clampOpening(l.room, { ...l.room.openings[0], offset: 99999 })
    expect(o.offset + o.width).toBeLessThanOrEqual(l.room.width)
  })
})
