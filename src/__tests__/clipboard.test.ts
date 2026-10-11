import { describe, expect, it } from 'vitest'
import { instantiateClip, makeClip, parseClip, serializeClip } from '../editor/clipboard'
import { collisions, stack } from '../editor/placement'
import { TEMPLATES } from '../model/templates'

describe('clipboard', () => {
  const layout = TEMPLATES.find((t) => t.id === 'work-7')!.layout()

  it('copies an item with everything standing on it and pastes it elsewhere', () => {
    const riders = stack.riders(layout, 'desk')
    expect(riders.sort()).toEqual(['keyboard', 'lamp', 'monitor-l', 'monitor-r'])
    const clip = makeClip(layout, 'desk', riders)!
    expect(clip.items).toHaveLength(riders.length + 1)
    expect(clip.items[0].offset).toEqual([0, 0, 0])

    const parsed = parseClip(serializeClip(clip))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    // Paste turned by 90° into an empty room: the copy keeps its internal arrangement.
    const pasted = instantiateClip(parsed.clip, { position: [1500, 0, 1500], rotation: 0 })
    const next = { ...layout, items: pasted }
    expect(new Set(pasted.map((p) => p.id)).size).toBe(pasted.length)
    expect(layout.items.some((i) => pasted.some((p) => p.id === i.id))).toBe(false)
    expect(stack.riders(next, pasted[0].id).length).toBe(riders.length)
    expect(stack.floating(next)).toEqual([])
    expect([...collisions(next)]).toEqual([])
  })

  it('pasting at the original pose reproduces the original positions', () => {
    const riders = stack.riders(layout, 'desk')
    const clip = makeClip(layout, 'desk', riders)!
    const root = layout.items.find((i) => i.id === 'desk')!
    const again = instantiateClip(clip, { position: root.position, rotation: root.rotation })
    riders.forEach((id, k) => {
      const orig = layout.items.find((i) => i.id === id)!
      expect(again[k + 1].position).toEqual(orig.position)
      expect(again[k + 1].rotation).toBe(orig.rotation)
    })
  })

  it('ignores foreign text and explains bad items', () => {
    expect(parseClip('hello')).toEqual({ ok: false, reason: 'not-a-clip' })
    expect(parseClip(JSON.stringify(layout))).toEqual({ ok: false, reason: 'not-a-clip' })
    const clip = makeClip(layout, 'desk')!
    const bad = parseClip(JSON.stringify({ ...clip, items: [{ ...clip.items[0], params: { width: 99999 } }] }))
    expect(bad.ok).toBe(false)
    if (!bad.ok && bad.reason === 'invalid') expect(bad.message).toContain('items[0].params.width')
    const unknown = parseClip(JSON.stringify({ ...clip, items: [{ ...clip.items[0], type: 'spaceship' }] }))
    expect(unknown.ok).toBe(false)
  })
})

describe('clipboard with several picked items', () => {
  const layout = TEMPLATES.find((t) => t.id === '1k-6')!.layout()

  it('keeps the spacing between items that do not stand on each other', () => {
    // The desk (with its monitor) and the chair in front of it.
    const roots = ['desk', 'chair']
    const riders = roots.flatMap((id) => stack.riders(layout, id))
    expect(riders.sort()).toEqual(['keyboard', 'monitor'])
    const clip = makeClip(layout, roots, riders)!
    expect(clip.items).toHaveLength(4)
    const pasted = instantiateClip(clip, { position: [1500, 0, 1500], rotation: 90 })
    const a = layout.items.find((i) => i.id === 'desk')!
    const b = layout.items.find((i) => i.id === 'chair')!
    expect(pasted[1].position[0] - pasted[0].position[0]).toBe(b.position[0] - a.position[0])
    expect(pasted[1].position[2] - pasted[0].position[2]).toBe(b.position[2] - a.position[2])
    // Which pasted items are roots falls out of the geometry.
    const next = { ...layout, items: [...layout.items, ...pasted] }
    expect(stack.roots(next, pasted.map((p) => p.id))).toEqual([pasted[0].id, pasted[1].id])
    expect(stack.floating(next)).toEqual([])
  })
})
