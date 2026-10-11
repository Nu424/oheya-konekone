// Checks a layout the way the app does and prints what is wrong, without a browser.
// Usage: npx tsx scripts/check-layout.ts [<template id> | <file.json>]   (no argument: every template)
import { readFileSync } from 'node:fs'
import { getAsset } from '../src/assets/registry'
import { collisions, itemFootprint2D, stack } from '../src/editor/placement'
import { overlaps3D } from '../src/editor/space'
import { parseLayoutText } from '../src/model/io'
import type { Layout } from '../src/model/schema'
import { TEMPLATES } from '../src/model/templates'

/** Wall and ceiling items hang where they are; they never rest on anything. */
const where = (type: string) => ({ wall: 'on the wall', ceiling: 'from the ceiling' })[getAsset(type)?.placement as 'wall' | 'ceiling']

function check(name: string, layout: Layout, warnings: { path: string; message: string }[] = []) {
  console.log(`\n== ${name}: ${layout.items.length} items`)
  for (const w of warnings) console.log(`  warn  ${w.path}: ${w.message}`)
  const sup = stack.supports(layout)
  for (const it of layout.items) {
    const s = sup.get(it.id)
    const f = itemFootprint2D(it, layout)
    console.log(
      `  ${it.id.padEnd(14)} ${it.type.padEnd(14)} y ${String(it.position[1]).padStart(6)}  x ${Math.round(f.minX)}..${Math.round(f.maxX)}  z ${Math.round(f.minZ)}..${Math.round(f.maxZ)}  top ${Math.round(f.maxY)}  ${where(it.type) ?? (s ? `on ${s.itemId}${s.label ? ` (${s.label})` : ''}` : it.position[1] > 2 ? 'FLOATING' : 'floor')}`,
    )
  }
  const hit = collisions(layout)
  if (hit.size) {
    const list = layout.items.filter((i) => hit.has(i.id))
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++)
        if (overlaps3D(itemFootprint2D(list[a], layout), itemFootprint2D(list[b], layout)) && !stack.restsOn(sup, list[a].id, list[b].id) && !stack.restsOn(sup, list[b].id, list[a].id))
          console.log(`  COLLISION  ${list[a].id} × ${list[b].id}`)
  }
  for (const f of stack.floating(layout)) console.log(`  FLOATING   ${f.item.id} at y=${f.item.position[1]}${f.nearest ? `, surface below: ${f.nearest.itemId} y=${f.nearest.worldY}` : ''}`)
}

const arg = process.argv[2]
if (arg?.endsWith('.json')) {
  const r = parseLayoutText(readFileSync(arg, 'utf8'))
  if (!r.ok) {
    for (const e of r.errors) console.log(`error ${e.path}: ${e.message}`)
    process.exit(1)
  }
  check(arg, r.layout, r.warnings)
} else {
  for (const t of TEMPLATES) if (!arg || t.id === arg) check(t.id, t.layout())
}
