import { defaultParams, getAsset } from '../assets/registry'
import { uid } from '../model/geometry'
import type { Item, Layout } from '../model/schema'
import { primaryOf, useDoc, useUi } from '../store/useStore'
import { instantiateClip, makeClip, parseClip, serializeClip } from './clipboard'
import { isPassive, itemFootprint2D, localBox, placeNewItem, stack, supportHeight } from './placement'
import { flushToWall, footprint, nearestWall, snapPosition, type Footprint2D } from './space'
import { applyPoses, roundY, type Pose } from './stacking'

/** Converts a screen point to a floor point (mm); registered by the viewport. */
export let screenToFloor: ((clientX: number, clientY: number) => { x: number; y?: number; z: number } | null) | null = null
export function registerScreenToFloor(f: typeof screenToFloor) {
  screenToFloor = f
}

const labelOf = (it: Item | undefined) => it?.name ?? getAsset(it?.type ?? '')?.label ?? 'アイテム'
const list = (ids: string | readonly string[]) => (typeof ids === 'string' ? [ids] : [...ids])
const find = (L: Layout, id: string) => L.items.find((i) => i.id === id)

/** Add an item of `type`, either at a sensible free spot or at a dropped floor point. */
export function addItemOfType(type: string, params?: Record<string, unknown>, at?: { x: number; y?: number; z: number }) {
  const asset = getAsset(type)
  if (!asset) return
  const doc = useDoc.getState()
  const ui = useUi.getState()
  const L = doc.layout
  const full = { ...defaultParams(asset.params), ...params } as Record<string, unknown>
  const placed = placeNewItem(L, type, full, primaryOf(ui.selection) ?? undefined)
  let { position, rotation } = placed
  if (at) {
    const box = localBox({ type, params: full })
    let x = at.x
    let z = at.z
    let y = position[1]
    if (asset.placement === 'wall') {
      const nw = nearestWall(L.room, x, z)
      rotation = nw.rotation
      ;({ x, z } = flushToWall((xx, zz) => footprint(box, xx, y, zz, rotation), x, z, L.room, nw.wall))
    } else {
      rotation = 0
      // The drop point already knows which surface is under the pointer; fall back to the highest one.
      y = at.y ?? supportHeight(L, x, z)
    }
    const others = L.items.filter((o) => !isPassive(o.type)).map((o) => itemFootprint2D(o, L))
    if (y === 0) {
      const sn = snapPosition((xx, zz) => footprint(box, xx, y, zz, rotation), x, z, L.room, others)
      x = sn.x
      z = sn.z
      if (asset.placement !== 'wall') y = supportHeight(L, x, z)
    }
    position = [Math.round(x), roundY(y), Math.round(z)]
  }
  const id = doc.addItem({ type, params: full, position, rotation })
  ui.select(id)
  ui.notify(placed.crowded && !at ? `空きが見つからなかったから真ん中に置いたよ。ドラッグで動かしてね` : `${asset.label}を置いたよ`)
  return id
}

/** Roots of a selection that may be moved (locked ones stay put). See docs/MULTISELECT.md. */
function movable(L: Layout, ids: string | readonly string[]): string[] {
  return stack.roots(L, list(ids)).filter((id) => !find(L, id)?.locked)
}

/** Outline around the footprints of several items. */
function bounds(fps: Footprint2D[]) {
  return {
    minX: Math.min(...fps.map((f) => f.minX)),
    maxX: Math.max(...fps.map((f) => f.maxX)),
    minZ: Math.min(...fps.map((f) => f.minZ)),
    maxZ: Math.max(...fps.map((f) => f.maxZ)),
  }
}

/** Apply per-root moves one after another, so each sees the previous ones. */
function moveEach(L: Layout, moves: [string, { x: number; z: number }][]): Layout {
  let cur = L
  for (const [id, d] of moves) {
    const it = find(cur, id)
    if (!it || (Math.abs(d.x) < 0.5 && Math.abs(d.z) < 0.5)) continue
    cur = applyPoses(cur, stack.moveWithRiders(cur, id, { position: [Math.round(it.position[0] + d.x), it.position[1], Math.round(it.position[2] + d.z)] }))
  }
  return cur
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'back' | 'centerZ' | 'front'

/**
 * Item commands shared by the toolbar, inspector and keyboard shortcuts. Each takes one id or
 * several (the selection). Everything that stands on an item follows it (docs/STACKING.md), and
 * with several ids only the ones not standing on another selected item are acted on (docs/MULTISELECT.md).
 */
export const itemCommands = {
  /** Move / turn one item, carrying whatever stands on it. */
  move(id: string, to: { position?: [number, number, number]; rotation?: number }) {
    const s = useDoc.getState()
    s.patchItems(stack.moveWithRiders(s.layout, id, to))
  },
  /**
   * Drag: `leadId` goes to `to`, the other roots of `groupIds` keep their place relative to it.
   * Call `land` when the drag ends so they settle on what is under them.
   */
  dragTo(leadId: string, to: { position: [number, number, number]; rotation: number }, groupIds: readonly string[]) {
    const s = useDoc.getState()
    const L = s.layout
    const lead = find(L, leadId)
    if (!lead) return
    const patches = new Map<string, Pose>()
    const others = groupIds.filter((id) => id !== leadId)
    if (others.length) {
      const delta = { x: to.position[0] - lead.position[0], y: to.position[1] - lead.position[1], z: to.position[2] - lead.position[2] }
      for (const [k, v] of stack.moveGroup(L, others, delta)) patches.set(k, v)
    }
    for (const [k, v] of stack.moveWithRiders(L, leadId, to)) patches.set(k, v)
    s.patchItems(patches)
  },
  /** Let the roots of a moved group (except the dragged one) come to rest on what is under them. */
  land(groupIds: readonly string[], leadId?: string) {
    const s = useDoc.getState()
    s.patchItems(stack.landGroup(s.layout, groupIds, leadId))
  },
  /** Turn by `delta` degrees: one item on the spot, several around the centre of the group. */
  rotate(ids: string | readonly string[], delta: number) {
    const s = useDoc.getState()
    const L = s.layout
    const roots = movable(L, ids)
    if (!roots.length) return
    if (roots.length === 1) {
      const it = find(L, roots[0])!
      const rotation = (((it.rotation + delta) % 360) + 360) % 360
      // Keep the rotated footprint inside the room.
      const box = localBox(it)
      const fp = (x: number, z: number) => footprint(box, x, it.position[1], z, rotation)
      const sn = snapPosition(fp, it.position[0], it.position[2], L.room, [], { free: true })
      s.patchItems(stack.moveWithRiders(L, it.id, { rotation, position: [Math.round(sn.x), it.position[1], Math.round(sn.z)] }))
      return
    }
    const b = bounds(roots.map((id) => itemFootprint2D(find(L, id)!, L)))
    s.patchItems(stack.rotateGroup(L, roots, { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }, delta))
  },
  /** Copy the items together with what stands on them, next to the originals, keeping their arrangement. */
  duplicate(ids: string | readonly string[]) {
    const s = useDoc.getState()
    const L = s.layout
    const roots = stack.roots(L, list(ids))
    if (!roots.length) return
    const b = bounds(roots.map((id) => itemFootprint2D(find(L, id)!, L)))
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    const gap = Math.max(10, Math.min(100, Math.min(w, d) * 0.2))
    // Try beside (right), then in front, then the other two sides, then diagonal; the first spot inside the floor wins.
    const tries: [number, number][] = [
      [w + gap, 0],
      [0, d + gap],
      [-(w + gap), 0],
      [0, -(d + gap)],
      [gap * 2, gap * 2],
    ]
    const [dx, dz] = tries.find(([tx, tz]) => b.minX + tx >= 0 && b.maxX + tx <= L.room.width && b.minZ + tz >= 0 && b.maxZ + tz <= L.room.depth) ?? tries[4]
    const copies: Item[] = []
    const copiedRoots: string[] = []
    for (const rootId of roots) {
      const group = [find(L, rootId)!, ...stack.riders(L, rootId).map((rid) => find(L, rid)!)]
      group.forEach((g, i) => {
        const id = uid(g.type)
        if (i === 0) copiedRoots.push(id)
        copies.push({ ...g, id, position: [g.position[0] + dx, g.position[1], g.position[2] + dz], locked: undefined })
      })
    }
    // The copies land on whatever is under the new spot (the same desk, another table, or the floor).
    const next = { ...L, items: [...L.items, ...copies] }
    s.setLayout(applyPoses(next, stack.landGroup(next, copiedRoots)))
    useUi.getState().select(copiedRoots)
    const riders = copies.length - copiedRoots.length
    useUi.getState().notify(
      copiedRoots.length > 1 ? `${copiedRoots.length}点を複製したよ${riders ? `（上に載ってる${riders}点も一緒）` : ''}` : riders ? `上に載ってる${riders}点と一緒に複製したよ` : '複製したよ',
    )
  },
  /**
   * Remove the items. Whatever stood on them (and is not removed too) drops onto the surface below,
   * or goes with them when `withRiders` is set (docs/EDITING-EXTRAS.md).
   */
  remove(ids: string | readonly string[], o: { withRiders?: boolean } = {}) {
    const s = useDoc.getState()
    const L = s.layout
    const picked = list(ids).filter((id) => find(L, id))
    if (!picked.length) return
    const riders = stack.ridersOf(L, picked).length
    const r = stack.removeItems(L, picked, o)
    s.setLayout(r.layout)
    useUi.getState().select(null)
    const what = picked.length > 1 ? `${picked.length}点` : labelOf(find(L, picked[0]))
    const done = !riders ? `${what}を削除したよ` : o.withRiders ? `${what}と、上に載ってた${riders}点を削除したよ` : `${what}を削除して、上の${riders}点は下に降ろしたよ`
    useUi.getState().notify(`${done}（Ctrl+Zで戻せる）`)
  },
  /** How many items stand on the given ones without being among them (what "delete with riders" would add). */
  riderCount(ids: string | readonly string[]) {
    return stack.ridersOf(useDoc.getState().layout, list(ids)).length
  },
  /** Set (or shift, when `relative`) one coordinate of every selected root; 0 = x, 1 = y, 2 = z. */
  setAxis(ids: string | readonly string[], axis: 0 | 1 | 2, value: number, relative = false) {
    const s = useDoc.getState()
    s.patchItems(stack.setAxis(s.layout, movable(s.layout, ids), axis, value, relative))
  },
  /** Turn every selected root on the spot to face `rotation`. */
  faceTo(ids: string | readonly string[], rotation: number) {
    const s = useDoc.getState()
    s.patchItems(stack.faceTo(s.layout, movable(s.layout, ids), rotation))
  },
  /** Lock everything if anything is unlocked, otherwise unlock everything. */
  toggleLock(ids: string | readonly string[]) {
    const s = useDoc.getState()
    const items = list(ids)
      .map((id) => find(s.layout, id))
      .filter((i): i is Item => !!i)
    if (!items.length) return
    const lock = items.some((i) => !i.locked)
    s.patchItems(new Map(items.map((i) => [i.id, { locked: lock || undefined }])))
  },
  nudge(ids: string | readonly string[], dx: number, dz: number) {
    const s = useDoc.getState()
    const roots = movable(s.layout, ids)
    if (roots.length) s.patchItems(stack.moveGroup(s.layout, roots, { x: dx, y: 0, z: dz }))
  },
  /** Change parameters; things standing on the item follow its surfaces (a taller desk lifts its monitor). */
  setParams(ids: string | readonly string[], patch: Record<string, unknown>) {
    const s = useDoc.getState()
    let cur = s.layout
    for (const id of list(ids)) {
      const before = cur
      const after = { ...before, items: before.items.map((i) => (i.id === id ? { ...i, params: { ...i.params, ...patch } } : i)) }
      cur = applyPoses(after, stack.reseat(before, after, id))
    }
    s.setLayout(cur)
  },
  /** Line the items up along one edge or centre of the group (seen from above). */
  align(ids: readonly string[], mode: AlignMode) {
    const s = useDoc.getState()
    const L = s.layout
    const roots = movable(L, ids)
    if (roots.length < 2) return
    const fps = roots.map((id) => [id, itemFootprint2D(find(L, id)!, L)] as const)
    const b = bounds(fps.map(([, f]) => f))
    s.setLayout(
      moveEach(
        L,
        fps.map(([id, f]) => {
          switch (mode) {
            case 'left':
              return [id, { x: b.minX - f.minX, z: 0 }]
            case 'right':
              return [id, { x: b.maxX - f.maxX, z: 0 }]
            case 'centerX':
              return [id, { x: (b.minX + b.maxX) / 2 - (f.minX + f.maxX) / 2, z: 0 }]
            case 'back':
              return [id, { x: 0, z: b.minZ - f.minZ }]
            case 'front':
              return [id, { x: 0, z: b.maxZ - f.maxZ }]
            default:
              return [id, { x: 0, z: (b.minZ + b.maxZ) / 2 - (f.minZ + f.maxZ) / 2 }]
          }
        }),
      ),
    )
  },
  /** Space the items evenly between the two outermost ones (equal gaps between footprints). */
  distribute(ids: readonly string[], axis: 'x' | 'z') {
    const s = useDoc.getState()
    const L = s.layout
    const roots = movable(L, ids)
    if (roots.length < 3) return
    const lo = (f: Footprint2D) => (axis === 'x' ? f.minX : f.minZ)
    const hi = (f: Footprint2D) => (axis === 'x' ? f.maxX : f.maxZ)
    const fps = roots.map((id) => [id, itemFootprint2D(find(L, id)!, L)] as const).sort((p, q) => lo(p[1]) + hi(p[1]) - (lo(q[1]) + hi(q[1])))
    const span = Math.max(...fps.map(([, f]) => hi(f))) - lo(fps[0][1])
    const used = fps.reduce((sum, [, f]) => sum + hi(f) - lo(f), 0)
    const gap = (span - used) / (fps.length - 1)
    let at = lo(fps[0][1])
    const moves: [string, { x: number; z: number }][] = []
    for (const [id, f] of fps) {
      const d = at - lo(f)
      moves.push([id, axis === 'x' ? { x: d, z: 0 } : { x: 0, z: d }])
      at += hi(f) - lo(f) + gap
    }
    s.setLayout(moveEach(L, moves))
  },
}

// ---- Copy / paste (docs/CLIPBOARD.md) ---------------------------------------------------------

/** Where the pointer last was, so a paste can land under it. */
let pointer: { x: number; y: number; overView: boolean } = { x: 0, y: 0, overView: false }
export function trackPointer(x: number, y: number, overView: boolean) {
  pointer = { x, y, overView }
}

/** Repeated pastes of the same text at the same spot step aside instead of stacking up. */
let lastPaste = { key: '', count: 0 }

/** The selection as (roots with the primary first, everything standing on them). */
function picked(L: Layout): { roots: string[]; riders: string[] } | null {
  const sel = useUi.getState().selection
  const roots = stack.roots(L, sel)
  if (!roots.length) return null
  // Positions in the clip are measured from the first item: use the primary when it is a root.
  const primary = primaryOf(sel)
  if (primary && roots.includes(primary)) roots.unshift(...roots.splice(roots.indexOf(primary), 1))
  return { roots, riders: roots.flatMap((id) => stack.riders(L, id)) }
}

const countText = (roots: number, riders: number) => (roots > 1 ? `${roots}点${riders ? `（上に載ってる${riders}点も一緒）` : ''}を` : riders ? `上に載ってる${riders}点と一緒に` : '')

/** Clipboard text for the selected items and everything standing on them, or null when nothing is selected. */
export function copySelection(): string | null {
  const L = useDoc.getState().layout
  const p = picked(L)
  const clip = p && makeClip(L, p.roots, p.riders)
  if (!p || !clip) return null
  lastPaste = { key: '', count: 0 }
  useUi.getState().notify(`${countText(p.roots.length, p.riders.length)}コピーしたよ`)
  return serializeClip(clip)
}

export function cutSelection(): string | null {
  const L = useDoc.getState().layout
  const p = picked(L)
  const clip = p && makeClip(L, p.roots, p.riders)
  if (!p || !clip) return null
  lastPaste = { key: '', count: 0 }
  // Cutting takes the riders along (unlike delete, which lets them drop).
  const gone = new Set([...p.roots, ...p.riders])
  useDoc.getState().setLayout({ ...L, items: L.items.filter((i) => !gone.has(i.id)) })
  useUi.getState().select(null)
  useUi.getState().notify(`${countText(p.roots.length, p.riders.length)}切り取ったよ`)
  return serializeClip(clip)
}

/**
 * Paste clipboard text. Returns false when the text is not ours, so the caller can try something else.
 * The first item lands under the pointer (table top, shelf or floor) when the pointer is over the view,
 * otherwise beside the original; the other picked items keep their arrangement and settle below.
 */
export function pasteText(text: string): boolean {
  const r = parseClip(text)
  const ui = useUi.getState()
  if (!r.ok) {
    if (r.reason === 'not-a-clip') return false
    ui.notify(`貼り付けられなかった: ${r.message}`, 'error')
    return true
  }
  const { clip } = r
  const doc = useDoc.getState()
  const L = doc.layout
  const rootAsset = getAsset(clip.items[0].type)
  const under = pointer.overView && rootAsset?.placement !== 'wall' && rootAsset?.placement !== 'ceiling' ? screenToFloor?.(pointer.x, pointer.y) : null
  const key = `${text.length}:${under ? `${pointer.x},${pointer.y}` : 'origin'}`
  lastPaste = lastPaste.key === key ? { key, count: lastPaste.count + 1 } : { key, count: 0 }

  let position: [number, number, number]
  const rotation = clip.origin.rotation
  const box = localBox({ type: clip.items[0].type, params: clip.items[0].params })
  if (under) {
    const step = lastPaste.count * 20
    // Keep the copy on the floor even when the pointer is near (or past) its edge.
    const inside = snapPosition((xx, zz) => footprint(box, xx, 0, zz, rotation), under.x + step, under.z + step, L.room, [], { free: true })
    const moved = step > 0 || Math.abs(inside.x - under.x) > 0.5 || Math.abs(inside.z - under.z) > 0.5
    position = [Math.round(inside.x), moved ? supportHeight(L, inside.x, inside.z) : roundY(under.y ?? 0), Math.round(inside.z)]
  } else {
    // Beside the original: one footprint (plus a gap) to the right per paste, on whatever is below.
    const f = footprint(box, clip.origin.position[0], clip.origin.position[1], clip.origin.position[2], rotation)
    const w = f.maxX - f.minX
    const gap = Math.max(10, Math.min(100, w * 0.2))
    const x = Math.min(L.room.width, clip.origin.position[0] + (w + gap) * (lastPaste.count + 1))
    const z = Math.min(L.room.depth, Math.max(0, clip.origin.position[2]))
    const fixed = rootAsset?.placement === 'wall' || rootAsset?.placement === 'ceiling'
    position = [Math.round(x), fixed ? clip.origin.position[1] : supportHeight(L, x, z), Math.round(z)]
  }
  // Wall-hung items keep their height but must end up flat against the nearest wall again.
  const items = instantiateClip(clip, { position, rotation }).map((it) => {
    if (getAsset(it.type)?.placement !== 'wall') return it
    const nw = nearestWall(L.room, it.position[0], it.position[2])
    const b = localBox(it)
    const p = flushToWall((xx, zz) => footprint(b, xx, it.position[1], zz, nw.rotation), it.position[0], it.position[2], L.room, nw.wall)
    return { ...it, position: [Math.round(p.x), it.position[1], Math.round(p.z)] as [number, number, number], rotation: nw.rotation }
  })
  // Which of the pasted items were picked (not riders) falls out of the geometry; they settle
  // on what is below them, except the first, which already has its place.
  const next = { ...L, items: [...L.items, ...items] }
  const roots = stack.roots(
    next,
    items.map((i) => i.id),
  )
  doc.setLayout(applyPoses(next, stack.landGroup(next, roots, items[0].id)))
  ui.select([...roots.filter((id) => id !== items[0].id), items[0].id])
  const name = items[0].name ?? rootAsset?.label ?? 'アイテム'
  const riders = items.length - roots.length
  ui.notify(roots.length > 1 ? `${roots.length}点${riders ? `（上に載ってる${riders}点も一緒）` : ''}を貼り付けたよ` : riders ? `${name}と、上に載ってる${riders}点を貼り付けたよ` : `${name}を貼り付けたよ`)
  return true
}
