import { Html, Line } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getAsset } from '../assets/registry'
import { collisions, isPassive, itemFootprint2D, localBox, supportHeight } from '../editor/placement'
import { flushToWall, footprint, nearestWall, snapPosition, wallGaps, type Footprint2D, type SnapTarget } from '../editor/space'
import type { Item } from '../model/schema'
import { beginGesture, endGesture, useDoc, useUi } from '../store/useStore'
import { Icon } from '../ui/icons'
import { ItemObject } from './ItemObject'

const S = 0.001
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const ACCENT = '#e8835c'
const DANGER = '#d0544c'

let lastSnap: SnapTarget[] = []

interface DragState {
  offX: number
  offZ: number
  sx: number
  sy: number
  moved: boolean
}

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
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null
  const drag = useRef<DragState | null>(null)
  const hit = useMemo(() => new THREE.Vector3(), [])
  const pop = usePop()

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const ui = useUi.getState()
    if (ui.photo) return
    ui.select({ kind: 'item', id: item.id })
    if (item.locked || ui.view === 'walk') return
    const p = e.ray.intersectPlane(FLOOR, hit)
    if (!p) return
    drag.current = { offX: item.position[0] - p.x / S, offZ: item.position[2] - p.z / S, sx: e.clientX, sy: e.clientY, moved: false }
    ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
    if (controls) controls.enabled = false
  }

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return
      d.moved = true
      beginGesture()
      useUi.getState().setDragging(item.id)
      document.body.style.cursor = 'grabbing'
    }
    const p = e.ray.intersectPlane(FLOOR, hit)
    if (!p) return
    const L = useDoc.getState().layout
    const it = L.items.find((i) => i.id === item.id)
    if (!it) return
    const asset = getAsset(it.type)
    const box = localBox(it)
    let x = p.x / S + d.offX
    let z = p.z / S + d.offZ
    let rot = it.rotation
    let y = it.position[1]
    const fp = (xx: number, zz: number) => footprint(box, xx, y, zz, rot)
    if (asset?.placement === 'wall') {
      const nw = nearestWall(L.room, x, z)
      rot = nw.rotation
      ;({ x, z } = flushToWall(fp, x, z, L.room, nw.wall))
    }
    const others = L.items.filter((o) => o.id !== it.id && !isPassive(o.type)).map((o) => itemFootprint2D(o, L))
    const free = !useUi.getState().snap || e.altKey
    const sn = snapPosition(fp, x, z, L.room, others, { free })
    x = sn.x
    z = sn.z
    lastSnap = sn.snapped
    if (asset?.placement === 'wall') ({ x, z } = flushToWall(fp, x, z, L.room, nearestWall(L.room, x, z).wall))
    if (asset?.placement === 'onTop') y = supportHeight(L, x, z, it.id)
    useDoc.getState().updateItem(it.id, { position: [Math.round(x), Math.round(y), Math.round(z)], rotation: rot })
  }

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    if (d.moved) {
      endGesture()
      useUi.getState().setDragging(null)
      document.body.style.cursor = 'grab'
      lastSnap = []
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
      <ItemObject item={item} ceiling={ceiling} innerRef={pop} />
    </group>
  )
}

function Outline({ f, color, y = 4 }: { f: Footprint2D; color: string; y?: number }) {
  const pts = [...f.corners, f.corners[0]].map(([x, z]) => [x * S, y * S, z * S] as [number, number, number])
  return <Line points={pts} color={color} lineWidth={2.5} transparent opacity={0.95} depthTest={false} renderOrder={10} />
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

function Guides({ f, room }: { f: Footprint2D; room: { width: number; depth: number } }) {
  const g = wallGaps(f, room as never)
  const y = 8 * S
  const midZ = ((f.minZ + f.maxZ) / 2) * S
  const midX = ((f.minX + f.maxX) / 2) * S
  const parts = []
  if (g.west <= g.east) parts.push(<Dim key="x" a={[0, y, midZ]} b={[f.minX * S, y, midZ]} label={`${Math.round(g.west)}`} />)
  else parts.push(<Dim key="x" a={[f.maxX * S, y, midZ]} b={[room.width * S, y, midZ]} label={`${Math.round(g.east)}`} />)
  if (g.north <= g.south) parts.push(<Dim key="z" a={[midX, y, 0]} b={[midX, y, f.minZ * S]} label={`${Math.round(g.north)}`} />)
  else parts.push(<Dim key="z" a={[midX, y, f.maxZ * S]} b={[midX, y, room.depth * S]} label={`${Math.round(g.south)}`} />)
  for (const s of lastSnap) {
    const pts: [number, number, number][] =
      s.axis === 'x'
        ? [
            [s.value * S, y, (f.minZ - 300) * S],
            [s.value * S, y, (f.maxZ + 300) * S],
          ]
        : [
            [(f.minX - 300) * S, y, s.value * S],
            [(f.maxX + 300) * S, y, s.value * S],
          ]
    parts.push(<Line key={`s${s.axis}${s.value}`} points={pts} color={ACCENT} lineWidth={1.5} depthTest={false} renderOrder={11} />)
  }
  return <>{parts}</>
}

function Toolbar({ item, f }: { item: Item; f: Footprint2D }) {
  const { rotate, duplicate, remove, toggleLock } = itemCommands
  const asset = getAsset(item.type)
  const w = Math.round(f.maxX - f.minX)
  const d = Math.round(f.maxZ - f.minZ)
  return (
    <Html position={[((f.minX + f.maxX) / 2) * S, f.maxY * S + 0.12, ((f.minZ + f.maxZ) / 2) * S]} center zIndexRange={[20, 0]}>
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
        <button title="削除 (Delete)" className="danger" onClick={() => remove(item.id)}>
          <Icon.trash />
        </button>
      </div>
    </Html>
  )
}

/** Item commands shared by the toolbar, inspector and keyboard shortcuts. */
export const itemCommands = {
  rotate(id: string, delta: number) {
    const s = useDoc.getState()
    const it = s.layout.items.find((i) => i.id === id)
    if (!it || it.locked) return
    const rotation = (((it.rotation + delta) % 360) + 360) % 360
    // Keep the rotated footprint inside the room.
    const box = localBox(it)
    const fp = (x: number, z: number) => footprint(box, x, it.position[1], z, rotation)
    const L = s.layout
    const sn = snapPosition(fp, it.position[0], it.position[2], L.room, [], { free: true })
    s.updateItem(id, { rotation, position: [Math.round(sn.x), it.position[1], Math.round(sn.z)] })
  },
  duplicate(id: string) {
    const nid = useDoc.getState().duplicateItem(id)
    if (nid) {
      useUi.getState().select({ kind: 'item', id: nid })
      useUi.getState().notify('複製したよ')
    }
  },
  remove(id: string) {
    const it = useDoc.getState().layout.items.find((i) => i.id === id)
    useDoc.getState().removeItem(id)
    useUi.getState().select(null)
    useUi.getState().notify(`${it?.name ?? getAsset(it?.type ?? '')?.label ?? 'アイテム'}を削除したよ（Ctrl+Zで戻せる）`)
  },
  toggleLock(id: string) {
    const it = useDoc.getState().layout.items.find((i) => i.id === id)
    if (!it) return
    useDoc.getState().updateItem(id, { locked: !it.locked || undefined })
  },
  nudge(id: string, dx: number, dz: number) {
    const s = useDoc.getState()
    const it = s.layout.items.find((i) => i.id === id)
    if (!it || it.locked) return
    s.updateItem(id, { position: [it.position[0] + dx, it.position[1], it.position[2] + dz] })
  },
}

export function EditLayer({ cutaway }: { cutaway: boolean }) {
  const layout = useDoc((s) => s.layout)
  const selection = useUi((s) => s.selection)
  const dragging = useUi((s) => s.dragging)
  const view = useUi((s) => s.view)
  const colliding = useMemo(() => collisions(layout), [layout])

  const selected = selection?.kind === 'item' ? layout.items.find((i) => i.id === selection.id) : undefined
  const selFp = selected ? itemFootprint2D(selected, layout) : null

  return (
    <>
      {layout.items.map((it) =>
        getAsset(it.type)?.hideWithCeiling && cutaway ? null : <EditableItem key={it.id} item={it} ceiling={layout.room.height} />,
      )}
      {[...colliding].map((id) => {
        const it = layout.items.find((i) => i.id === id)
        return it && id !== selected?.id ? <Outline key={`c${id}`} f={itemFootprint2D(it, layout)} color={DANGER} /> : null
      })}
      {selected && selFp && (
        <>
          <Outline f={selFp} color={colliding.has(selected.id) ? DANGER : ACCENT} />
          {dragging === selected.id ? <Guides f={selFp} room={layout.room} /> : view !== 'walk' && <Toolbar item={selected} f={selFp} />}
        </>
      )}
    </>
  )
}
