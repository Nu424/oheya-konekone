import { getAsset, itemParamsSchema } from '../assets/registry'
import { uid } from '../model/geometry'
import type { Item, Layout } from '../model/schema'
import { rotateXZ } from './space'
import { roundY } from './stacking'

/**
 * Copy / paste of items through the system clipboard (see docs/CLIPBOARD.md).
 *
 * The clipboard holds plain JSON text, so a copied item can be pasted into another tab,
 * another layout, a text editor or a chat with an AI. Positions are stored relative to the
 * copied item ("root"); whatever stood on it travels along.
 *
 * Everything here is pure: the caller decides which items ride along and where to paste.
 */

export const CLIP_KIND = 'layout-items'
export const CLIP_VERSION = 1

export interface ClipItem {
  type: string
  name?: string
  params: Record<string, unknown>
  /** Position relative to the root item, in the root's unrotated frame (mm). The root itself is [0, 0, 0]. */
  offset: [number, number, number]
  /** Rotation relative to the root (degrees). The root itself is 0. */
  turn: number
}

export interface Clip {
  kind: typeof CLIP_KIND
  version: number
  /** Where the root was, so "paste in place" can put the copy next to the original. */
  origin: { position: [number, number, number]; rotation: number }
  /** The reference item first, then the other picked items and everything standing on them. */
  items: ClipItem[]
}

const norm = (d: number) => ((d % 360) + 360) % 360

/**
 * Describe the copied items as a clip. `rootIds` are the items the user picked (the first one is the
 * reference everything is measured from); `riderIds` are the items standing on them (from the stacking module).
 */
export function makeClip(layout: Layout, rootIds: string | string[], riderIds: string[] = []): Clip | null {
  const picked = (typeof rootIds === 'string' ? [rootIds] : rootIds).map((id) => layout.items.find((i) => i.id === id)).filter((i): i is Item => !!i)
  const root = picked[0]
  if (!root) return null
  const entry = (it: Item): ClipItem => {
    // Undo the root's rotation so the clip does not depend on which way the root was facing.
    const [dx, dz] = rotateXZ(it.position[0] - root.position[0], it.position[2] - root.position[2], -root.rotation)
    return {
      type: it.type,
      ...(it.name ? { name: it.name } : {}),
      params: it.params,
      // `+ 0` turns the -0 that rotating by 180° can produce into 0.
      offset: [Math.round(dx * 10) / 10 + 0, roundY(it.position[1] - root.position[1]) + 0, Math.round(dz * 10) / 10 + 0],
      turn: norm(it.rotation - root.rotation),
    }
  }
  const riders = riderIds.map((id) => layout.items.find((i) => i.id === id)).filter((i): i is Item => !!i && !picked.includes(i))
  return { kind: CLIP_KIND, version: CLIP_VERSION, origin: { position: root.position, rotation: root.rotation }, items: [...picked, ...riders].map(entry) }
}

export function serializeClip(clip: Clip): string {
  return JSON.stringify(clip, null, 2)
}

export type ClipParse = { ok: true; clip: Clip } | { ok: false; reason: 'not-a-clip' } | { ok: false; reason: 'invalid'; message: string }

const isVec3 = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

/**
 * Read clipboard text. Anything that is not our JSON is "not-a-clip" (the caller ignores it or
 * treats it as something else); our JSON with a bad item is "invalid" with a message that says where.
 */
export function parseClip(text: string): ClipParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'not-a-clip' }
  }
  if (!raw || typeof raw !== 'object' || (raw as Clip).kind !== CLIP_KIND) return { ok: false, reason: 'not-a-clip' }
  const c = raw as Clip
  if (!Array.isArray(c.items) || c.items.length === 0) return { ok: false, reason: 'invalid', message: 'items が空です' }
  const items: ClipItem[] = []
  for (let i = 0; i < c.items.length; i++) {
    const it = c.items[i]
    const at = `items[${i}]`
    if (!it || typeof it.type !== 'string' || !getAsset(it.type)) return { ok: false, reason: 'invalid', message: `${at}.type: 未知のアイテム種別 "${String(it?.type)}" です` }
    // Same strict check as importing a layout: unknown or out-of-range parameters are errors.
    const p = itemParamsSchema(it.type)!.safeParse(it.params ?? {})
    if (!p.success) return { ok: false, reason: 'invalid', message: `${at}.params${p.error.issues[0].path.length ? '.' + p.error.issues[0].path.join('.') : ''}: ${p.error.issues[0].message}` }
    items.push({
      type: it.type,
      ...(typeof it.name === 'string' && it.name ? { name: it.name.slice(0, 64) } : {}),
      params: p.data as Record<string, unknown>,
      offset: isVec3(it.offset) ? it.offset : [0, 0, 0],
      turn: typeof it.turn === 'number' && Number.isFinite(it.turn) ? it.turn : 0,
    })
  }
  const origin = c.origin && isVec3(c.origin.position) ? { position: c.origin.position, rotation: Number(c.origin.rotation) || 0 } : { position: [0, 0, 0] as [number, number, number], rotation: 0 }
  return { ok: true, clip: { kind: CLIP_KIND, version: CLIP_VERSION, origin, items } }
}

/** Turn a clip into new items with the root at `at` (fresh ids, riders placed around the root). */
export function instantiateClip(clip: Clip, at: { position: [number, number, number]; rotation: number }): Item[] {
  return clip.items.map((it) => {
    const [dx, dz] = rotateXZ(it.offset[0], it.offset[2], at.rotation)
    return {
      id: uid(it.type),
      type: it.type,
      ...(it.name ? { name: it.name } : {}),
      params: it.params,
      position: [Math.round(at.position[0] + dx), roundY(at.position[1] + it.offset[1]), Math.round(at.position[2] + dz)] as [number, number, number],
      rotation: norm(at.rotation + it.turn),
    }
  })
}
