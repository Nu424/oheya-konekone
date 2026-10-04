import { describe, expect, it } from 'vitest'
import { analyzeFlow } from '../editor/flow'
import { collisions } from '../editor/placement'
import { TEMPLATES } from '../model/templates'

describe('templates', () => {
  for (const t of TEMPLATES) {
    it(`${t.id}: no collisions and no blocking flow issues`, () => {
      const l = t.layout()
      expect([...collisions(l)]).toEqual([])
      const warns = analyzeFlow(l).issues.filter((i) => i.level === 'warn')
      expect(warns.map((w) => w.message)).toEqual([])
    })
  }
})
