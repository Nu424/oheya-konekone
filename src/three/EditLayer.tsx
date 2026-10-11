import { Html, Line } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getAsset } from '../assets/registry'
import { itemCommands } from '../editor/commands'
import { collisions, isPassive, itemFootprint2D, localBox, solids, stack, surfaceFrame, visualBox } from '../editor/placement'
import { flushToWall, footprint, nearestWall, snapPosition, type Footprint2D, type SnapTarget } from '../editor/space'
import { roundY, surfaceBounds, surfaceContains } from '../editor/stacking'
import type { Item } from '../model/schema'
import { beginGesture, endGesture, useDoc, useUi } from '../store/useStore'
import { DeleteButton } from '../ui/DeleteButton'
import { Icon } from '../ui/icons'
import { ItemObject } from './ItemObject'

const S = 0.001
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const ACCENT = '#e8835c'
const DANGER = '#d0544c'

let lastSnap: SnapTarget[] = []
/** Bounds of the level the dragged item is on (room floor or a surface), for the distance guides. */
let lastFrame: ReturnType<typeof surfaceFrame> | null = null

interface DragState {
  /** The item that follows the pointer: the pressed item, or the selected item it stands on. */
  leadId: string
  /** Roots that move together with the lead (the lead included). */
  group: string[]
  offX: number
  offZ: number
  sx: number
  sy: number
  moved: boolean
  /** Shift / Ctrl was held: a click toggles the item, and nothing is dragged. */
  toggle: boolean
  /** The item was already part of a multi-selection when pressed: a plain click narrows to it. */
  wasSelected: boolean
}

/** Set while a rubber-band selection just ended, so the click that follows does not change the selection. */
let suppressClickUntil = 0
export const suppressClicks = (ms = 250) => (suppressClickUntil = performance.now() + ms)
export const clicksSuppressed = () => performance.now() < suppressClickUntil

/** Items added after the first load pop in with a little bounce. */
function usePop() {
  const ref = useRef<THREE.Group>(null)
  const start = useRef(window.__oheya?.ready ? performance.now() : -1)
  const invalidate = useThree((s) => s.invalidate)
  useFrame(() => {
    const g = ref.current
    if (!g || start.current < 0) return
    const t = Math.min(1, (performance.now() - start.current) / 450)
    // Damped spring: overshoots a little, settles at 1.
    const k = 1 - Math.exp(-6 * t) * Math.cos(9 * t)
    g.scale.setScalar(0.55 + 0.45 * k)
    if (t >= 1) {
      g.scale.setScalar(1)
      start.current = -1
    }
    invalidate()
  })
  return ref
}

function EditableItem({ item, ceiling }: { item: Item; ceiling: number }) {
  // Only items with live parameters subscribe to the clock, so moving the slider redraws just those.
  const hasLive = !!getAsset(item.type)?.live
  const hour = useUi((s) => (hasLive ? s.hour : 0))
  const live = hasLive ? { hour } : undefined
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null
  const drag = useRef<DragState | null>(null)
  const hit = useMemo(() => new THREE.Vector3(), [])
  const pop = usePop()

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const ui = useUi.getState()
    if (ui.photo) return
    const base = { offX: 0, offZ: 0, sx: e.clientX, sy: e.clientY, moved: false, leadId: item.id, group: [item.id] }
    // Shift / Ctrl + click adds or removes; Shift + drag is the rubber band (handled by the viewport).
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      drag.current = { ...base, toggle: true, wasSelected: false }
      return
    }
    const wasSelected = ui.selection.length > 1 && ui.selection.includes(item.id)
    if (!wasSelected) ui.select(item.id)
    if (ui.view === 'walk') return
    // With several items selected, the whole selection moves; the pointer leads the selected item
    // the pressed one stands on (or the pressed one itself).
    const L = useDoc.getState().layout
    const sel = wasSelected ? ui.selection : [item.id]
    const roots = stack.roots(L, sel)
    const sup = stack.supports(L)
    const leadId = roots.includes(item.id) ? item.id : (roots.find((r) => stack.restsOn(sup, item.id, r)) ?? item.id)
    const lead = L.items.find((i) => i.id === leadId) ?? item
    const group = roots.filter((id) => !L.items.find((i) => i.id === id)?.locked)
    drag.current = { ...base, leadId, group, toggle: false, wasSelected }
    if (lead.locked || !group.includes(leadId)) return
    // Grab offset measured on the plane the lead stands on, so it does not jump when the drag starts.
    const p = e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -lead.position[1] * S), hit) ?? e.ray.intersectPlane(FLOOR, hit)
    if (!p) return
    drag.current.offX = lead.position[0] - p.x / S
    drag.current.offZ = lead.position[2] - p.z / S
    ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
    if (controls) controls.enabled = false
  }

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d || d.toggle) return
    const L = useDoc.getState().layout
    const it = L.items.find((i) => i.id === d.leadId)
    if (!it || it.locked || !d.group.includes(d.leadId) || useUi.getState().view === 'walk') return
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return
      d.moved = true
      beginGesture()
      useUi.getState().setDragging(d.leadId)
      document.body.style.cursor = 'grabbing'
    }
    const asset = getAsset(it.type)
    const box = localBox(it)
    const free = !useUi.getState().snap || e.altKey
    let rot = it.rotation
    let x: number
    let y = it.position[1]
    let z: number

    if (asset?.placement === 'wall' || asset?.placement === 'ceiling') {
      // Wall and ceiling items slide over the floor plan and keep their height.
      const p = e.ray.intersectPlane(FLOOR, hit)
      if (!p) return
      x = p.x / S + d.offX
      z = p.z / S + d.offZ
      const fp = (xx: number, zz: number) => footprint(box, xx, y, zz, rot)
      if (asset.placement === 'wall') {
        const nw = nearestWall(L.room, x, z)
        rot = nw.rotation
        ;({ x, z } = flushToWall(fp, x, z, L.room, nw.wall))
      }
      const others = L.items.filter((o) => o.id !== it.id && !isPassive(o.type)).map((o) => itemFootprint2D(o, L))
      const sn = snapPosition(fp, x, z, L.room, others, { free })
      x = sn.x
      z = sn.z
      lastSnap = sn.snapped
      if (asset.placement === 'wall') ({ x, z } = flushToWall(fp, x, z, L.room, nearestWall(L.room, x, z).wall))
    } else {
      // Everything else lands on the first surface under the pointer (table top, shelf, chest), or the floor.
      const carried = new Set(d.group.flatMap((id) => [id, ...stack.riders(L, id)]))
      const o = e.ray.origin
      const dir = e.ray.direction
      const pick = stack.pickAlongRay(
        stack.placedSurfaces(L, carried),
        { x: o.x / S, y: o.y / S, z: o.z / S },
        dir,
        { x: d.offX, z: d.offZ },
        { sticky: 25, maxHeight: box.max.y - box.min.y, solids: solids(L, carried) },
      )
      if (!pick) return
      ;({ x, y, z } = pick)
      const fp = (xx: number, zz: number) => footprint(box, xx, y, zz, rot)
      // Neighbours are the things standing on the same level.
      const here = fp(x, z)
      const others = L.items
        .filter((n) => !carried.has(n.id) && !isPassive(n.type) && n.id !== pick.surface?.itemId)
        .map((n) => itemFootprint2D(n, L))
        .filter((f) => f.maxY > here.minY + 1 && f.minY < here.maxY - 1)
      const onSurface = pick.surface !== null
      const sn = snapPosition(fp, x, z, L.room, others, {
        free,
        surface: pick.surface ? surfaceBounds(pick.surface) : undefined,
        threshold: onSurface ? 30 : 80,
        grid: onSurface ? 10 : 50,
      })
      // Snapping must not push the item off the surface it was dropped on.
      if (!pick.surface || surfaceContains(pick.surface, sn.x, sn.z)) {
        x = sn.x
        z = sn.z
        lastSnap = sn.snapped
      } else lastSnap = []
      lastFrame = surfaceFrame(pick.surface, L.room)
    }
    itemCommands.dragTo(it.id, { position: [Math.round(x), roundY(y), Math.round(z)], rotation: rot }, d.group)
  }

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    if (!d.moved && !clicksSuppressed() && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) {
      // A click: toggle with Shift / Ctrl, or narrow a multi-selection down to this item.
      if (d.toggle) useUi.getState().select(item.id, 'toggle')
      else if (d.wasSelected) useUi.getState().select(item.id)
    }
    if (d.moved) {
      // The rest of the group settles on whatever is under it; all within the same undo step.
      if (d.group.length > 1) itemCommands.land(d.group, d.leadId)
      endGesture()
      useUi.getState().setDragging(null)
      document.body.style.cursor = 'grab'
      lastSnap = []
      lastFrame = null
    }
  }

  return (
    <group
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (!drag.current) document.body.style.cursor = item.locked ? 'pointer' : 'grab'
      }}
      onPointerOut={() => {
        if (!drag.current) document.body.style.cursor = ''
      }}
    >
      <ItemObject item={item} ceiling={ceiling} innerRef={pop} live={live} />
    </group>
  )
}

function Outline({ f, color, width = 2.5 }: { f: Footprint2D; color: string; width?: number }) {
  const y = f.minY + 4
  const pts = [...f.corners, f.corners[0]].map(([x, z]) => [x * S, y * S, z * S] as [number, number, number])
  return <Line points={pts} color={color} lineWidth={width} transparent opacity={0.95} depthTest={false} renderOrder={10} />
}

/** Dashed box around everything that is selected, with the group's toolbar above it. */
function GroupFrame({ ids, fps, top, showToolbar }: { ids: string[]; fps: Footprint2D[]; top: number; showToolbar: boolean }) {
  const minX = Math.min(...fps.map((f) => f.minX))
  const maxX = Math.max(...fps.map((f) => f.maxX))
  const minZ = Math.min(...fps.map((f) => f.minZ))
  const maxZ = Math.max(...fps.map((f) => f.maxZ))
  const y = (Math.min(...fps.map((f) => f.minY)) + 6) * S
  const pad = 12
  const pts: [number, number, number][] = [
    [(minX - pad) * S, y, (minZ - pad) * S],
    [(maxX + pad) * S, y, (minZ - pad) * S],
    [(maxX + pad) * S, y, (maxZ + pad) * S],
    [(minX - pad) * S, y, (maxZ + pad) * S],
    [(minX - pad) * S, y, (minZ - pad) * S],
  ]
  const { rotate, duplicate, toggleLock } = itemCommands
  return (
    <>
      <Line points={pts} color={ACCENT} lineWidth={1.5} dashed dashSize={0.02} gapSize={0.012} transparent opacity={0.9} depthTest={false} renderOrder={10} />
      {showToolbar && (
        <Html position={[((minX + maxX) / 2) * S, top * S, minZ * S]} center zIndexRange={[20, 0]}>
          <div className="item-toolbar" onPointerDown={(e) => e.stopPropagation()}>
            <span className="it-name">
              {ids.length} 点を選択中
              <small>
                {Math.round(maxX - minX)}×{Math.round(maxZ - minZ)}
              </small>
            </span>
            <button title="まとめて 90°回転 (R)" onClick={() => rotate(ids, 90)}>
              <Icon.rotate />
            </button>
            <button title="まとめて複製 (Ctrl+D)" onClick={() => duplicate(ids)}>
              <Icon.copy />
            </button>
            <button title="まとめてロック／解除 (L)" onClick={() => toggleLock(ids)}>
              <Icon.lock />
            </button>
            <DeleteButton ids={ids} title="まとめて削除 (Delete)" />
          </div>
        </Html>
      )}
    </>
  )
}

function Dim({ a, b, label }: { a: [number, number, number]; b: [number, number, number]; label: string }) {
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  return (
    <>
      <Line points={[a, b]} color="#3b2f28" lineWidth={1.5} dashed dashSize={0.04} gapSize={0.025} depthTest={false} renderOrder={11} />
      <Html position={mid} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className="dim-chip">{label}</div>
      </Html>
    </>
  )
}

/** Distances from the dragged item to the edges of the level it is on (table top, shelf or room). */
function Guides({ f, room }: { f: Footprint2D; room: { width: number; depth: number } }) {
  const b = lastFrame ?? surfaceFrame(null, room)
  const g = { west: f.minX - b.minX, east: b.maxX - f.maxX, north: f.minZ - b.minZ, south: b.maxZ - f.maxZ }
  const y = (f.minY + 8) * S
  const midZ = ((f.minZ + f.maxZ) / 2) * S
  const midX = ((f.minX + f.maxX) / 2) * S
  const ext = Math.min(300, Math.max(40, (f.maxX - f.minX + f.maxZ - f.minZ) / 2))
  const parts = []
  if (g.west <= g.east) parts.push(<Dim key="x" a={[b.minX * S, y, midZ]} b={[f.minX * S, y, midZ]} label={String(Math.round(g.west))} />)
  else parts.push(<Dim key="x" a={[f.maxX * S, y, midZ]} b={[b.maxX * S, y, midZ]} label={String(Math.round(g.east))} />)
  if (g.north <= g.south) parts.push(<Dim key="z" a={[midX, y, b.minZ * S]} b={[midX, y, f.minZ * S]} label={String(Math.round(g.north))} />)
  else parts.push(<Dim key="z" a={[midX, y, f.maxZ * S]} b={[midX, y, b.maxZ * S]} label={String(Math.round(g.south))} />)
  for (const s of lastSnap) {
    const pts: [number, number, number][] =
      s.axis === 'x'
        ? [
            [s.value * S, y, (f.minZ - ext) * S],
            [s.value * S, y, (f.maxZ + ext) * S],
          ]
        : [
            [(f.minX - ext) * S, y, s.value * S],
            [(f.maxX + ext) * S, y, s.value * S],
          ]
    parts.push(<Line key={`s${s.axis}${s.value}`} points={pts} color={ACCENT} lineWidth={1.5} depthTest={false} renderOrder={11} />)
  }
  return <>{parts}</>
}

function Toolbar({ item, f, top }: { item: Item; f: Footprint2D; top: number }) {
  const { rotate, duplicate, toggleLock } = itemCommands
  const asset = getAsset(item.type)
  const w = Math.round(f.maxX - f.minX)
  const d = Math.round(f.maxZ - f.minZ)
  return (
    <Html position={[((f.minX + f.maxX) / 2) * S, top * S, f.minZ * S]} center zIndexRange={[20, 0]}>
      <div className="item-toolbar" onPointerDown={(e) => e.stopPropagation()}>
        <span className="it-name">
          {item.name ?? asset?.label}
          <small>
            {w}×{d}
          </small>
        </span>
        <button title="90°回転 (R)" onClick={() => rotate(item.id, 90)}>
          <Icon.rotate />
        </button>
        <button title="複製 (Ctrl+D)" onClick={() => duplicate(item.id)}>
          <Icon.copy />
        </button>
        <button title={item.locked ? 'ロック解除' : 'ロック（動かないようにする）'} className={item.locked ? 'on' : ''} onClick={() => toggleLock(item.id)}>
          <Icon.lock />
        </button>
        <DeleteButton ids={item.id} />
      </div>
    </Html>
  )
}

export { itemCommands }

export function EditLayer({ cutaway }: { cutaway: boolean }) {
  const layout = useDoc((s) => s.layout)
  const selection = useUi((s) => s.selection)
  const dragging = useUi((s) => s.dragging)
  const view = useUi((s) => s.view)
  const colliding = useMemo(() => collisions(layout), [layout])

  const picked = selection.map((id) => layout.items.find((i) => i.id === id)).filter((i): i is Item => !!i)
  const primary = picked[picked.length - 1]
  const fps = picked.map((it) => itemFootprint2D(it, layout))
  const selected = new Set(picked.map((i) => i.id))
  const lead = dragging ? layout.items.find((i) => i.id === dragging) : undefined

  return (
    <>
      {layout.items.map((it) =>
        getAsset(it.type)?.hideWithCeiling && cutaway ? null : <EditableItem key={it.id} item={it} ceiling={layout.room.height} />,
      )}
      {[...colliding].map((id) => {
        const it = layout.items.find((i) => i.id === id)
        return it && !selected.has(id) ? <Outline key={`c${id}`} f={itemFootprint2D(it, layout)} color={DANGER} /> : null
      })}
      {picked.map((it, i) => (
        <Outline key={`s${it.id}`} f={fps[i]} color={colliding.has(it.id) ? DANGER : ACCENT} width={it === primary ? 2.8 : 1.8} />
      ))}
      {lead && <Guides f={itemFootprint2D(lead, layout)} room={layout.room} />}
      {picked.length === 1 && !dragging && view !== 'walk' && <Toolbar item={primary} f={fps[0]} top={primary.position[1] + visualBox(primary).max.y} />}
      {picked.length > 1 && (
        <GroupFrame
          ids={picked.map((i) => i.id)}
          fps={fps}
          top={Math.max(...picked.map((it) => it.position[1] + visualBox(it).max.y))}
          showToolbar={!dragging && view !== 'walk'}
        />
      )}
    </>
  )
}
