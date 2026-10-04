import { CameraControls, Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Item, Room } from '../model/schema'
import { getAsset, resolveItemParams } from '../assets/registry'
import { rotateXZ } from '../editor/space'
import { useDoc, useUi, type ViewMode } from '../store/useStore'
import { Effects } from './Effects'
import { Lighting, type Lamp } from './Lighting'
import { RoomMesh } from './RoomMesh'
import { EditLayer } from './EditLayer'
import { FlowOverlay } from './FlowOverlay'
import { registerScreenToFloor } from '../editor/commands'

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

/** Lets DOM drag-and-drop convert a screen point to a floor point. */
function FloorPicker() {
  const { camera, gl } = useThree()
  useEffect(() => {
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const v = new THREE.Vector3()
    registerScreenToFloor((cx, cy) => {
      const r = gl.domElement.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera)
      const p = ray.ray.intersectPlane(plane, v)
      return p ? { x: p.x / S, z: p.z / S } : null
    })
    return () => registerScreenToFloor(null)
  }, [camera, gl])
  return null
}

/** World positions of the light sources of lamp items. */
function collectLamps(items: Item[], room: Room): Lamp[] {
  const out: Lamp[] = []
  for (const it of items) {
    const a = getAsset(it.type)
    if (!a?.lights) continue
    const p = resolveItemParams(it.type, it.params)
    for (const l of a.lights(p as never)) {
      const [ox, oz] = rotateXZ(l.position[0], l.position[2], it.rotation)
      const baseY = a.placement === 'ceiling' ? room.height : it.position[1]
      out.push({ position: [it.position[0] + ox, baseY + l.position[1], it.position[2] + oz], color: l.color, intensity: l.intensity, distance: l.distance })
    }
  }
  return out
}

/** Room dimensions drawn outside the walls in the plan view. */
function PlanDims({ room }: { room: Room }) {
  const W = room.width * S
  const D = room.depth * S
  const off = (room.wallThickness + 260) * S
  return (
    <>
      <Html position={[W / 2, 0.01, -off]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="plan-dim">{room.width.toLocaleString()}</div>
      </Html>
      <Html position={[-off, 0.01, D / 2]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="plan-dim v">{room.depth.toLocaleString()}</div>
      </Html>
      <Html position={[W / 2, 0.01, D + off]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="plan-dim plan-south">南</div>
      </Html>
    </>
  )
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
  const view = useUi((s) => s.view)
  const ortho = view === 'top'
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  // Two cameras; the plan view uses a true orthographic projection.
  const cams = useMemo(() => {
    const persp = new THREE.PerspectiveCamera(36, 1, 0.05, 80)
    persp.position.set(6, 6, 8)
    const orth = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60)
    orth.position.set(0, 20, 0)
    return { persp, orth }
  }, [])
  const cam = ortho ? cams.orth : cams.persp
  useLayoutEffect(() => {
    set({ camera: cam })
  }, [cam, set])
  return <Rig key={ortho ? 'o' : 'p'} room={room} camera={cam} size={size} />
}

function Rig({ room, camera, size }: { room: Room; camera: THREE.Camera; size: { width: number; height: number } }) {
  const ref = useRef<CameraControlsImpl>(null)
  const view = useUi((s) => s.view)
  const panelOpen = useUi((s) => s.panel !== null)
  const ortho = view === 'top'
  const animate = useRef(false)
  // Keep the orthographic frustum in pixels so zoom = pixels per metre.
  useLayoutEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = -size.width / 2
      camera.right = size.width / 2
      camera.top = size.height / 2
      camera.bottom = -size.height / 2
      camera.updateProjectionMatrix()
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = size.width / size.height
      camera.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const { pos, target } = cameraPose(room, view)
    c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, animate.current)
    animate.current = true
    if (ortho) {
      c.minPolarAngle = 0
      c.maxPolarAngle = 0.0001
      c.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK
      c.mouseButtons.wheel = CameraControlsImpl.ACTION.ZOOM
      c.touches.one = CameraControlsImpl.ACTION.TOUCH_TRUCK
    } else {
      c.minPolarAngle = 0.05
      c.maxPolarAngle = THREE.MathUtils.degToRad(86)
      c.mouseButtons.left = CameraControlsImpl.ACTION.ROTATE
    }
    // Re-frame only when the view or the room footprint changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, room.width, room.depth])

  // Fit the plan to the screen (orthographic zoom) and keep the room clear of the side panel.
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const panelPx = panelOpen && size.width > 760 ? 342 : 0
    if (ortho) {
      const m = 1.2 // metres of margin around the room
      const zoom = Math.min((size.width - panelPx - 80) / (room.width * S + m), (size.height - 160) / (room.depth * S + m))
      c.zoomTo(zoom, animate.current)
      c.setFocalOffset(-panelPx / 2 / zoom, 0, 0, false)
      return
    }
    const cam = c.camera as THREE.PerspectiveCamera
    const visibleW = 2 * c.distance * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect
    c.setFocalOffset((-panelPx / 2 / size.width) * visibleW, 0, 0, true)
  }, [size.width, size.height, panelOpen, view, ortho, room.width, room.depth])

  return (
    <CameraControls
      ref={ref}
      camera={camera as THREE.PerspectiveCamera}
      makeDefault
      smoothTime={0.35}
      draggingSmoothTime={0.12}
      minDistance={0.8}
      maxDistance={18}
      minZoom={20}
      maxZoom={600}
      dollySpeed={0.6}
      truckSpeed={1.5}
    />
  )
}

export function Viewport() {
  const room = useDoc((s) => s.layout.room)
  const select = useUi((s) => s.select)
  const view = useUi((s) => s.view)
  const hour = useUi((s) => s.hour)
  const flow = useUi((s) => s.flow)
  const items = useDoc((s) => s.layout.items)
  const lamps = useMemo(() => collectLamps(items, room), [items, room])
  // The ceiling is cut away in every view except walking around inside the room.
  const cutaway = view !== 'walk'

  return (
    <Canvas
      className="viewport"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
      onPointerMissed={() => select(null)}
    >
      <Suspense fallback={null}>
        <Lighting room={room} hour={hour} lamps={lamps} />
        <RoomMesh room={room} plan={view === 'top'} />
        <EditLayer cutaway={cutaway} />
        {flow && <FlowOverlay />}
        <Effects />
      </Suspense>
      <CameraRig room={room} />
      {view === 'top' && <PlanDims room={room} />}
      <FrameProbe />
      <FloorPicker />
    </Canvas>
  )
}
