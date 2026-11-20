import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { edgeGroup, edgeOf, moveEdgeShift, type Edge } from '../editor/planEdit'
import type { Layout, Room, WallSide } from '../model/schema'
import { beginGesture, endGesture, useDoc, useUi } from '../store/useStore'
import { Line } from './Line'

const S = 0.001
/** Marker in `useUi.dragging` while a plan edge is being dragged (the camera stays put). */
export const PLAN_DRAG = '__plan'
const ACCENT = '#e8865f'
const SIDES: WallSide[] = ['north', 'south', 'west', 'east']
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

interface Handle {
  key: string
  /** The edge the drag is applied to (any member of the group moves them all). */
  edge: Edge
  lo: number
  hi: number
}

/** One handle per wall line: the edges that move together share it (see planEdit.edgeGroup). */
function handlesOf(room: Room): Handle[] {
  const spaces = room.spaces ?? []
  const seen = new Set<string>()
  const out: Handle[] = []
  for (const s of spaces)
    for (const side of SIDES) {
      const k = `${s.id}:${side}`
      if (seen.has(k)) continue
      const g = edgeGroup(spaces, s.id, side)
      for (const e of g) seen.add(`${e.space}:${e.side}`)
      out.push({ key: k, edge: edgeOf(s, side), lo: Math.min(...g.map((e) => e.lo)), hi: Math.max(...g.map((e) => e.hi)) })
    }
  return out
}

/**
 * Draggable wall lines of the plan in the top view (docs/FLOORPLAN.md). Dragging a line moves every
 * space edge on it; neighbours stay attached. Snaps to a 50 mm grid and to the other walls' lines.
 */
export function PlanHandles() {
  const room = useDoc((s) => s.layout.room)
  const handles = useMemo(() => handlesOf(room), [room])
  const y = (room.height + 60) * S
  return (
    <group>
      {handles.map((h) => (
        <EdgeHandle key={h.key} h={h} y={y} />
      ))}
    </group>
  )
}

function EdgeHandle({ h, y }: { h: Handle; y: number }) {
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const [hover, setHover] = useState(false)
  const drag = useRef<{ start: Layout; shift: [number, number]; lines: number[] } | null>(null)
  const { edge } = h
  const alongX = edge.axis === 'x'
  const mid = (h.lo + h.hi) / 2
  const len = h.hi - h.lo
  const pts = useMemo<[number, number, number][]>(
    () => (alongX ? [[h.lo * S, y, edge.line * S], [h.hi * S, y, edge.line * S]] : [[edge.line * S, y, h.lo * S], [edge.line * S, y, h.hi * S]]),
    [alongX, h.lo, h.hi, edge.line, y],
  )
  const hit = new THREE.Vector3()

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    ;(e.target as unknown as Element).setPointerCapture?.(e.pointerId)
    const start = useDoc.getState().layout
    // Other wall lines on the same axis to snap to.
    const lines = (start.room.spaces ?? []).flatMap((s) => SIDES.map((sd) => edgeOf(s, sd))).filter((x) => x.axis === edge.axis && Math.abs(x.line - edge.line) > 1).map((x) => x.line)
    drag.current = { start, shift: [0, 0], lines }
    if (controls) controls.enabled = false
    beginGesture()
    useUi.getState().setDragging(PLAN_DRAG)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    if (!e.ray.intersectPlane(FLOOR, hit)) return
    // Pointer in the layout's current coordinates → the coordinates of the layout the drag started from.
    let to = (alongX ? hit.z / S + d.shift[1] : hit.x / S + d.shift[0])
    const near = d.lines.find((l) => Math.abs(l - to) < 80)
    to = near ?? Math.round(to / 50) * 50
    const r = moveEdgeShift(d.start, edge.space, edge.side, to)
    d.shift = r.shift
    useDoc.getState().setLayout(r.layout)
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
    drag.current = null
    if (controls) controls.enabled = true
    endGesture()
    useUi.getState().setDragging(null)
  }

  const active = hover || drag.current !== null
  return (
    <group>
      <Line points={pts} color={ACCENT} lineWidth={active ? 5 : 3} depthTest={false} renderOrder={20} transparent opacity={active ? 1 : 0.75} />
      <mesh
        position={alongX ? [mid * S, y, edge.line * S] : [edge.line * S, y, mid * S]}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={() => {
          setHover(true)
          gl.domElement.style.cursor = alongX ? 'ns-resize' : 'ew-resize'
        }}
        onPointerOut={() => {
          setHover(false)
          if (!drag.current) gl.domElement.style.cursor = ''
        }}
        renderOrder={21}
      >
        <boxGeometry args={alongX ? [len * S, 0.01, 0.24] : [0.24, 0.01, len * S]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={active ? 0.25 : 0.0} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={alongX ? [mid * S, y + 0.01, edge.line * S] : [edge.line * S, y + 0.01, mid * S]} rotation={[-Math.PI / 2, 0, alongX ? 0 : Math.PI / 2]} renderOrder={22} raycast={() => null}>
        <planeGeometry args={[0.28, 0.1]} />
        <meshBasicMaterial color={active ? ACCENT : '#fffbf6'} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
