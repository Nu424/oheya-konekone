import { CameraControls, Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Item, Room } from '../model/schema'
import { getAsset, resolveItemParams } from '../assets/registry'
import { itemFootprint2D, solids, stack } from '../editor/placement'
import { rotateXZ } from '../editor/space'
import { roundY } from '../editor/stacking'
import { useDoc, useUi, type ViewMode } from '../store/useStore'
import { Effects } from './Effects'
import { Lighting, type Lamp } from './Lighting'
import { RoomMesh } from './RoomMesh'
import { clicksSuppressed, EditLayer, suppressClicks } from './EditLayer'
import { FlowOverlay } from './FlowOverlay'
import { PhotoMode } from './PhotoMode'
import { registerScreenToFloor } from '../editor/commands'
import { PERF_PANEL } from './perf'
import { PerfProbe } from './PerfProbe'

const S = 0.001

declare global {
  interface Window {
    __oheya?: {
      frames: number
      ready: boolean
      /** Dev builds only: room point (mm) → client pixel, for scripted checks that need to aim the mouse. */
      project?: (x: number, y: number, z: number) => { x: number; y: number }
    }
  }
}

/** Counts rendered frames so automated screenshots know when the scene has settled. */
function FrameProbe() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    // With on-demand rendering, keep frames coming for a moment so shadows / AO settle.
    let n = 0
    const id = setInterval(() => {
      invalidate()
      if (++n > 20) {
        clearInterval(id)
        const p = (window.__oheya ??= { frames: 0, ready: false })
        p.ready = true
      }
    }, 100)
    return () => clearInterval(id)
  }, [invalidate])
  useFrame(() => {
    const p = (window.__oheya ??= { frames: 0, ready: false })
    p.frames++
  })
  return null
}

/** Lets DOM drag-and-drop convert a screen point to the spot under it: a table top, a shelf or the floor. */
function FloorPicker() {
  const { camera, gl } = useThree()
  useEffect(() => {
    const ray = new THREE.Raycaster()
    registerScreenToFloor((cx, cy) => {
      const r = gl.domElement.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera)
      const o = ray.ray.origin
      const L = useDoc.getState().layout
      const p = stack.pickAlongRay(stack.placedSurfaces(L), { x: o.x / S, y: o.y / S, z: o.z / S }, ray.ray.direction, { x: 0, z: 0 }, { solids: solids(L) })
      return p ? { x: p.x, y: roundY(p.y), z: p.z } : null
    })
    if (import.meta.env.DEV) {
      const p = (window.__oheya ??= { frames: 0, ready: false })
      p.project = (x, y, z) => {
        const r = gl.domElement.getBoundingClientRect()
        const v = new THREE.Vector3(x * S, y * S, z * S).project(camera)
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
      }
    }
    return () => registerScreenToFloor(null)
  }, [camera, gl])
  return null
}

/**
 * Shift + drag draws a rectangle and adds what it catches to the selection (docs/MULTISELECT.md).
 * Dragging to the right takes items entirely inside the rectangle, to the left anything it touches.
 */
function RubberBand() {
  const { gl, camera } = useThree()
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  useEffect(() => {
    const el = gl.domElement
    const host = el.parentElement
    if (!host) return
    const band = document.createElement('div')
    band.className = 'rubber-band'
    band.style.display = 'none'
    host.appendChild(band)
    let start: { x: number; y: number; id: number } | null = null
    let active = false

    const down = (e: PointerEvent) => {
      const ui = useUi.getState()
      if (e.button !== 0 || !e.shiftKey || ui.photo || ui.view === 'walk') return
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      active = false
      // Camera controls must not orbit while the rectangle is being drawn.
      if (controlsRef.current) controlsRef.current.enabled = false
    }
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      if (!active && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) return
      active = true
      const r = host.getBoundingClientRect()
      band.style.display = 'block'
      band.classList.toggle('touch', e.clientX < start.x)
      band.style.left = Math.min(start.x, e.clientX) - r.left + 'px'
      band.style.top = Math.min(start.y, e.clientY) - r.top + 'px'
      band.style.width = Math.abs(e.clientX - start.x) + 'px'
      band.style.height = Math.abs(e.clientY - start.y) + 'px'
    }
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const s0 = start
      start = null
      band.style.display = 'none'
      if (controlsRef.current) controlsRef.current.enabled = true
      if (!active) return
      active = false
      suppressClicks()
      const r = el.getBoundingClientRect()
      const x0 = Math.min(s0.x, e.clientX)
      const x1 = Math.max(s0.x, e.clientX)
      const y0 = Math.min(s0.y, e.clientY)
      const y1 = Math.max(s0.y, e.clientY)
      const touch = e.clientX < s0.x
      const cam = cameraRef.current
      const L = useDoc.getState().layout
      const p = new THREE.Vector3()
      const hits: string[] = []
      for (const it of L.items) {
        // Project the eight corners of the item's body and take their bounds on screen.
        const f = itemFootprint2D(it, L)
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        let behind = false
        for (const [cx, cz] of f.corners)
          for (const cy of [f.minY, f.maxY]) {
            p.set(cx * S, cy * S, cz * S).project(cam)
            if (p.z > 1) behind = true
            const sx = r.left + ((p.x + 1) / 2) * r.width
            const sy = r.top + ((1 - p.y) / 2) * r.height
            minX = Math.min(minX, sx)
            maxX = Math.max(maxX, sx)
            minY = Math.min(minY, sy)
            maxY = Math.max(maxY, sy)
          }
        if (behind) continue
        const inside = minX >= x0 && maxX <= x1 && minY >= y0 && maxY <= y1
        const touches = maxX >= x0 && minX <= x1 && maxY >= y0 && minY <= y1
        if (touch ? touches : inside) hits.push(it.id)
      }
      if (hits.length) useUi.getState().select(hits, 'add')
    }
    // Capture phase on the wrapper: this runs before the camera controls see the press.
    host.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      host.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      band.remove()
    }
  }, [gl])
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

function cameraPose(room: Room, view: ViewMode, aspect = 1.6, azimuthDeg = 35) {
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
  // Portrait screens need to back off so the whole room fits horizontally.
  const dist = (size * 2.0 + 2.2) * Math.max(1, Math.pow(1.25 / aspect, 0.85))
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
  return view === 'walk' ? <WalkRig room={room} camera={cams.persp} /> : <Rig key={ortho ? 'o' : 'p'} room={room} camera={cam} size={size} />
}

const EYE = 1.5

/** First-person walk mode: drag to look around, WASD / arrows to walk, click the floor to go there. */
function WalkRig({ room, camera }: { room: Room; camera: THREE.PerspectiveCamera }) {
  const ref = useRef<CameraControlsImpl>(null)
  const keys = useRef(new Set<string>())
  const invalidate = useThree((s) => s.invalidate)
  const W = room.width * S
  const D = room.depth * S

  useEffect(() => {
    const c = ref.current
    if (!c) return
    // Start just inside the first door (or the south side), looking at the room centre.
    const door = room.openings.find((o) => o.type === 'door')
    let x = W / 2
    let z = D - 0.6
    if (door) {
      const mid = (door.offset + door.width / 2) * S
      const inset = 0.7
      ;[x, z] = door.wall === 'north' ? [mid, inset] : door.wall === 'south' ? [mid, D - inset] : door.wall === 'west' ? [inset, mid] : [W - inset, mid]
    }
    const dir = new THREE.Vector3(W / 2 - x, 0, D / 2 - z).normalize()
    c.setLookAt(x, EYE, z, x + dir.x * 0.01, EYE - 0.002, z + dir.z * 0.01, false)
    c.minDistance = c.maxDistance = 0.01
    c.minPolarAngle = THREE.MathUtils.degToRad(20)
    c.maxPolarAngle = THREE.MathUtils.degToRad(160)
    c.azimuthRotateSpeed = -0.35
    c.polarRotateSpeed = -0.35
    c.mouseButtons.left = CameraControlsImpl.ACTION.ROTATE
    c.mouseButtons.right = CameraControlsImpl.ACTION.NONE
    c.mouseButtons.wheel = CameraControlsImpl.ACTION.NONE
    c.touches.one = CameraControlsImpl.ACTION.TOUCH_ROTATE
    c.touches.two = CameraControlsImpl.ACTION.NONE
    c.setBoundary(new THREE.Box3(new THREE.Vector3(0.25, EYE - 0.01, 0.25), new THREE.Vector3(W - 0.25, EYE + 0.01, D - 0.25)))
    camera.fov = 62
    camera.updateProjectionMatrix()
    return () => {
      camera.fov = 36
      camera.updateProjectionMatrix()
    }
  }, [room, W, D, camera, room.openings])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      keys.current.add(e.key.toLowerCase())
      invalidate()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [invalidate])

  useFrame((_, dt) => {
    const c = ref.current
    if (!c || keys.current.size === 0) return
    invalidate()
    const k = keys.current
    const v = 1.6 * Math.min(dt, 0.05)
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    if (f) c.forward(f * v, false)
    if (r) c.truck(r * v, 0, false)
  })

  return (
    <>
      <CameraControls ref={ref} camera={camera} makeDefault smoothTime={0.25} draggingSmoothTime={0.08} />
      {/* Click anywhere on the floor to walk there. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[W / 2, 0.002, D / 2]}
        onClick={(e) => {
          if (e.delta > 4) return
          e.stopPropagation()
          ref.current?.moveTo(e.point.x, EYE, e.point.z, true)
        }}
      >
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  )
}

function Rig({ room, camera, size }: { room: Room; camera: THREE.Camera; size: { width: number; height: number } }) {
  const ref = useRef<CameraControlsImpl>(null)
  const view = useUi((s) => s.view)
  // Photo mode hides the side panel, so frame the room in the middle of the screen.
  const panelOpen = useUi((s) => s.panel !== null && !s.photo)
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
    const { pos, target } = cameraPose(room, view, size.width / size.height)
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
  const photo = useUi((s) => s.photo)
  const items = useDoc((s) => s.layout.items)
  const lamps = useMemo(() => collectLamps(items, room), [items, room])
  // The ceiling is cut away in every view except walking around inside the room.
  const cutaway = view !== 'walk'

  return (
    <Canvas
      className="viewport"
      frameloop="demand"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
      onPointerMissed={(e) => {
        // Shift / Ctrl + click on nothing keeps the selection (the user is adding to it), as does the end of a rubber band.
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !clicksSuppressed()) select(null)
      }}
    >
      <Suspense fallback={null}>
        <Lighting room={room} hour={hour} lamps={lamps} />
        <RoomMesh room={room} plan={view === 'top'} />
        <EditLayer cutaway={cutaway} />
        {flow && <FlowOverlay />}
        {photo ? <PhotoMode /> : <Effects />}
      </Suspense>
      <CameraRig room={room} />
      {view === 'top' && <PlanDims room={room} />}
      <FrameProbe />
      <FloorPicker />
      <RubberBand />
      {PERF_PANEL && <PerfProbe />}
    </Canvas>
  )
}
