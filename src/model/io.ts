import { z } from 'zod'
import { getAsset, itemParamsSchema } from '../assets/registry'
import { localBox, stack } from '../editor/placement'
import { overlappingOpenings } from './geometry'
import { floorAt, onFloor, resolveOpening, sideLength } from './plan'
import { Layout, type LayoutInput } from './schema'

z.config(z.locales.ja())

export interface Issue {
  /** Dotted path such as `items[2].params.width`. */
  path: string
  message: string
}

export type ParseResult =
  | { ok: true; layout: Layout; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] }

function fmtPath(path: PropertyKey[]): string {
  let out = ''
  for (const p of path) {
    if (typeof p === 'number') out += `[${p}]`
    else out += out ? `.${String(p)}` : String(p)
  }
  return out || '(ルート)'
}

/** Strip code fences / prose around JSON, which AI replies often include. */
export function extractJson(text: string): string {
  const fence = text.match(/```(?:json|jsonc)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

export function parseLayoutText(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(extractJson(text))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, errors: [{ path: '(JSON)', message: `JSONとして読めませんでした: ${msg}` }], warnings: [] }
  }
  return parseLayout(raw)
}

/**
 * Bring older layouts up to date in place (they keep loading as they were saved):
 * - bathtub `shower` (2026-11): the tap and shower are now their own wall item, `faucetShower`,
 *   on the wall behind the tub.
 * - `kotatsu` (2026-11): a low table with the kotatsu option.
 */
function migrate(layout: Layout) {
  const added: Layout['items'] = []
  for (const it of layout.items) {
    if (it.type !== 'bathtub' || !('shower' in it.params)) continue
    const { shower, ...rest } = it.params
    it.params = rest
    if (shower === 'none') continue
    const w = Number(rest.width ?? 750)
    const h = Number(rest.height ?? 550)
    const r = (it.rotation * Math.PI) / 180
    const params = { kind: shower === 'faucet' ? 'mixer' : 'bath' }
    // The middle of the tub's back is on the wall; the fitting's back goes there, its body in front.
    const off = w / 2 + localBox({ type: 'faucetShower', params }).min.z
    added.push({
      id: `${it.id}-shower`,
      type: 'faucetShower',
      position: [Math.round(it.position[0] - off * Math.sin(r)), it.position[1] + h + 200, Math.round(it.position[2] - off * Math.cos(r))],
      rotation: it.rotation,
      params,
    })
  }
  layout.items.push(...added)
  // kotatsu (2026-11): now an option of the low table (and the dining table and desk).
  for (const it of layout.items) {
    if (it.type !== 'kotatsu') continue
    const q = it.params
    it.type = 'lowTable'
    it.params = {
      ...(q.width !== undefined ? { width: q.width } : { width: 800 }),
      ...(q.depth !== undefined ? { depth: q.depth } : { depth: 600 }),
      height: 380,
      legs: 'box',
      kotatsu: q.futon ?? true,
      ...(q.futonColor !== undefined ? { futonColor: q.futonColor } : {}),
      ...(q.topColor !== undefined ? { topColor: q.topColor, legColor: q.topColor } : { topColor: '#8f5f3d', legColor: '#8f5f3d' }),
    }
  }
}

export function parseLayout(raw: unknown): ParseResult {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const res = Layout.safeParse(raw)
  if (!res.success) {
    for (const i of res.error.issues) errors.push({ path: fmtPath(i.path), message: i.message })
    return { ok: false, errors, warnings }
  }
  const layout = res.data
  migrate(layout)

  // Spaces: unique ids, no overlaps; the room outline is the box around them.
  const spaces = layout.room.spaces ?? []
  if (spaces.length) {
    const sids = new Set<string>()
    spaces.forEach((sp, i) => {
      if (sids.has(sp.id)) errors.push({ path: `room.spaces[${i}].id`, message: `区画の id "${sp.id}" が重複しています` })
      sids.add(sp.id)
    })
    for (let i = 0; i < spaces.length; i++)
      for (let j = i + 1; j < spaces.length; j++) {
        const [a, b] = [spaces[i].rect, spaces[j].rect]
        if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1)
          errors.push({ path: `room.spaces[${j}].rect`, message: `区画 "${spaces[i].id}" と "${spaces[j].id}" が重なっています。辺で接するように並べてください` })
      }
    if (spaces.length > 1)
      spaces.forEach((sp, i) => {
        const [x, z, w, d] = sp.rect
        const touches = spaces.some((o, j) => {
          if (j === i) return false
          const [ox, oz, ow, od] = o.rect
          const sideBySide = (Math.abs(x + w - ox) < 1 || Math.abs(ox + ow - x) < 1) && Math.min(z + d, oz + od) - Math.max(z, oz) > 1
          const stacked = (Math.abs(z + d - oz) < 1 || Math.abs(oz + od - z) < 1) && Math.min(x + w, ox + ow) - Math.max(x, ox) > 1
          return sideBySide || stacked
        })
        if (!touches) warnings.push({ path: `room.spaces[${i}].rect`, message: `区画 "${sp.id}" がほかの区画と接していません（離れ小島になっています）` })
      })
    layout.room.width = Math.max(...spaces.map((sp) => sp.rect[0] + sp.rect[2]))
    layout.room.depth = Math.max(...spaces.map((sp) => sp.rect[1] + sp.rect[3]))
  }

  // Items: known type + params valid for that asset.
  const ids = new Set<string>()
  layout.items.forEach((item, idx) => {
    const base = `items[${idx}]`
    if (ids.has(item.id)) errors.push({ path: `${base}.id`, message: `id "${item.id}" が重複しています` })
    ids.add(item.id)
    const asset = getAsset(item.type)
    if (!asset) {
      errors.push({ path: `${base}.type`, message: `未知のアイテム種別 "${item.type}" です` })
      return
    }
    const schema = itemParamsSchema(item.type)!
    const pr = schema.safeParse(item.params)
    if (!pr.success) {
      for (const i of pr.error.issues)
        errors.push({ path: `${base}.params${i.path.length ? '.' + fmtPath(i.path) : ''}`, message: i.message })
    } else {
      item.params = pr.data as Record<string, unknown>
    }
    const [x, , z] = item.position
    if (!errors.length && !onFloor(layout.room, x, z) && asset.placement !== 'wall')
      warnings.push({ path: `${base}.position`, message: `「${item.name ?? asset.label}」の中心が部屋の外にあります` })
  })

  // Items in mid-air: y must match the surface they stand on (see docs/STACKING.md).
  if (!errors.length) {
    for (const { item, nearest } of stack.floating(layout)) {
      const idx = layout.items.indexOf(item)
      const y = item.position[1]
      const name = item.name ?? getAsset(item.type)?.label ?? item.type
      const fix = nearest
        ? `真下の面（${layout.items.find((i) => i.id === nearest.itemId)?.id} の${nearest.label ?? '上面'}）は y=${Math.round(nearest.worldY * 10) / 10} です`
        : `真下に載せられる面がありません。床に置くなら y=${floorAt(layout.room, item.position[0], item.position[2])} にしてください`
      warnings.push({ path: `items[${idx}].position`, message: `「${name}」が宙に浮いています（y=${y}）。${fix}` })
    }
  }

  // Openings must fit on their wall.
  const oids = new Set<string>()
  layout.room.openings.forEach((o, idx) => {
    const base = `room.openings[${idx}]`
    if (oids.has(o.id)) errors.push({ path: `${base}.id`, message: `id "${o.id}" が重複しています` })
    oids.add(o.id)
    if (o.space && !spaces.some((sp) => sp.id === o.space)) {
      errors.push({ path: `${base}.space`, message: `区画 "${o.space}" がありません（room.spaces の id を書いてください）` })
      return
    }
    const len = sideLength(layout.room, o.wall, o.space)
    if (o.offset + o.width > len)
      errors.push({ path: base, message: `開口部が壁(長さ${len}mm)からはみ出しています (offset ${o.offset} + width ${o.width})` })
    else if (!errors.length) {
      const r = resolveOpening(layout.room, o)
      if (!r || r.from < r.face.from - 1 || r.to > r.face.to + 1)
        warnings.push({ path: base, message: `開口部 "${o.id}" が壁の切れ目にかかっています（外壁と内壁、または 2 つの内壁にまたがっています）` })
    }
    const top = (o.type === 'window' ? o.sill : 0) + o.height
    if (top > layout.room.height && o.type !== 'passage')
      errors.push({ path: base, message: `開口部の上端(${top}mm)が天井高(${layout.room.height}mm)を超えています` })
  })
  for (const [a, b] of overlappingOpenings(layout.room))
    warnings.push({ path: 'room.openings', message: `開口部 "${a}" と "${b}" が重なっています` })

  if (errors.length) return { ok: false, errors, warnings }
  return { ok: true, layout, warnings }
}

/** Serialise with stable key order and without default noise where possible. */
export function serializeLayout(layout: Layout): string {
  return JSON.stringify(layout, null, 2)
}

/** Build a normalised layout (defaults filled, item params expanded); throws on invalid input. */
export function makeLayout(input: LayoutInput): Layout {
  const r = parseLayout(input)
  if (!r.ok) throw new Error(r.errors.map((e) => `${e.path}: ${e.message}`).join('\n'))
  return r.layout
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function layoutJsonSchema() {
  return z.toJSONSchema(Layout, { io: 'input' })
}
