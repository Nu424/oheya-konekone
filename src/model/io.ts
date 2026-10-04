import { z } from 'zod'
import { getAsset, itemParamsSchema } from '../assets/registry'
import { overlappingOpenings, wallLength } from './geometry'
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

export function parseLayout(raw: unknown): ParseResult {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const res = Layout.safeParse(raw)
  if (!res.success) {
    for (const i of res.error.issues) errors.push({ path: fmtPath(i.path), message: i.message })
    return { ok: false, errors, warnings }
  }
  const layout = res.data

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
    if (x < 0 || x > layout.room.width || z < 0 || z > layout.room.depth)
      warnings.push({ path: `${base}.position`, message: `「${item.name ?? asset.label}」の中心が部屋の外にあります` })
  })

  // Openings must fit on their wall.
  const oids = new Set<string>()
  layout.room.openings.forEach((o, idx) => {
    const base = `room.openings[${idx}]`
    if (oids.has(o.id)) errors.push({ path: `${base}.id`, message: `id "${o.id}" が重複しています` })
    oids.add(o.id)
    const len = wallLength(layout.room, o.wall)
    if (o.offset + o.width > len)
      errors.push({ path: base, message: `開口部が壁(長さ${len}mm)からはみ出しています (offset ${o.offset} + width ${o.width})` })
    const top = (o.type === 'window' ? o.sill : 0) + o.height
    if (top > layout.room.height)
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
