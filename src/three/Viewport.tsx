import { CameraControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Room } from '../model/schema'
import { useDoc, useUi, type ViewMode } from '../store/useStore'
import { Effects } from './Effects'
import { ItemObject } from './ItemObject'
import { Lighting } from './Lighting'
import { RoomMesh } from './RoomMesh'

const S = 0.001

declare global {
  interface Window {
    __oheya?: { frames: number; ready: boolean }
  }
}

/** Counts rendered frames so automated screenshots know when the scene has settled. */
function FrameProbe() {
  useFrame(() => {
    const p = (window.__oheya ??= { frames: 0, ready: false })
    p.frames++
    if (p.frames > 30) p.ready = true
  })
  return null
}

function cameraPose(room: Room, view: ViewMode, azimuthDeg = 35) {
  const W = room.width * S
  const D = room.depth * S
  const H = room.height * S
  const target = new THREE.Vector3(W / 2, view === 'top' ? 0 : H * 0.12, D / 2)
  const size = Math.max(W, D)
  if (view === 'top') {
    return { pos: new THREE.Vector3(W / 2, size * 2.3 + 1, D / 2 + 0.001), target }
  }
  const az = THREE.MathUtils.degToRad(azimuthDeg)
  const polar = THREE.MathUtils.degToRad(52)
  const dist = size * 2.0 + 2.2
  const pos = new THREE.Vector3(
    target.x + dist * Math.sin(polar) * Math.sin(az),
    target.y + dist * Math.cos(polar),
    target.z + dist * Math.sin(polar) * Math.cos(az),
  )
  return { pos, target }
}

function CameraRig({ room }: { room: Room }) {
  const ref = useRef<CameraControlsImpl>(null)
  const view = useUi((s) => s.view)
  const first = useRef(true)
  const size = useThree((s) => s.size)
  const panelOpen = useUi((s) => s.panel !== null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const { pos, target } = cameraPose(room, view)
    c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, !first.current)
    first.current = false
    if (view === 'top') {
      c.minPolarAngle = 0
      c.maxPolarAngle = 0.0001
      c.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK
    } else {
      c.minPolarAngle = 0.05
      c.maxPolarAngle = THREE.MathUtils.degToRad(86)
      c.mouseButtons.left = CameraControlsImpl.ACTION.ROTATE
    }
    // Re-frame only when the view or the room footprint changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, room.width, room.depth])

  // Shift the framing so the room is centred in the area not covered by the side panel.
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const panelPx = panelOpen && size.width > 760 ? 342 : 0
    const cam = c.camera as THREE.PerspectiveCamera
    const dist = c.distance
    const visibleW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect
    c.setFocalOffset((-panelPx / 2 / size.width) * visibleW, 0, 0, true)
  }, [size.width, size.height, panelOpen, view, room.width, room.depth])

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.35}
      draggingSmoothTime={0.12}
      minDistance={0.8}
      maxDistance={18}
      dollySpeed={0.6}
      truckSpeed={1.5}
    />
  )
}

export function Viewport() {
  const room = useDoc((s) => s.layout.room)
  const items = useDoc((s) => s.layout.items)
  const select = useUi((s) => s.select)
  const view = useUi((s) => s.view)

  return (
    <Canvas
      className="viewport"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
      camera={{ fov: 36, near: 0.05, far: 80, position: [6, 6, 8] }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#efe6da']} />
      <Suspense fallback={null}>
        <Lighting room={room} />
        <RoomMesh room={room} plan={view === 'top'} />
        {items.map((it) => (
          <ItemObject
            key={it.id}
            item={it}
            onPointerDown={(e) => {
              e.stopPropagation()
              select({ kind: 'item', id: it.id })
            }}
          />
        ))}
        <Effects />
      </Suspense>
      <CameraRig room={room} />
      <FrameProbe />
    </Canvas>
  )
}
