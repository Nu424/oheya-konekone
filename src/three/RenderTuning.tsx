import { addTail, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useUi } from '../store/useStore'

/**
 * Re-renders the shadow map only when something that casts shadows changed, instead of every frame.
 * The sun's shadow does not depend on the view, so orbiting the camera never needs a new one.
 * Change detection is a per-frame snapshot of every visible caster (id, geometry, material, world matrix)
 * and the shadow-casting lights, so new code that moves things does not have to remember to flag it.
 */
export function ShadowOnDemand() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const prev = useRef<number[]>([])
  const next = useRef<number[]>([])

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])

  // Priority 0.5: after everything that moves objects in useFrame (priority 0), before the composer renders (1).
  useFrame(() => {
    scene.updateMatrixWorld()
    const cur = next.current
    cur.length = 0
    scene.traverseVisible((o) => {
      const light = o as THREE.DirectionalLight
      if (light.isLight && light.castShadow) {
        const c = light.shadow.camera
        const e = light.matrixWorld.elements
        const t = light.target.matrixWorld.elements
        cur.push(light.id, e[12], e[13], e[14], t[12], t[13], t[14], c.left, c.right, c.top, c.bottom, c.near, c.far, light.shadow.mapSize.x)
        return
      }
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.castShadow) return
      const e = m.matrixWorld.elements
      // Material ids exist at runtime; the typings only expose them on some subclasses.
      const mat = m.material as unknown as { id: number }
      cur.push(m.id, m.geometry.id, mat.id, e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], e[12], e[13], e[14])
    })
    const old = prev.current
    let same = old.length === cur.length
    for (let i = 0; same && i < cur.length; i++) same = old[i] === cur[i]
    if (!same) gl.shadowMap.needsUpdate = true
    prev.current = cur
    next.current = old
  }, 0.5)
  return null
}

/**
 * Lighter rendering while the view changes. `scale` is the fraction of the drawing buffer the composer
 * renders at (null = full). Only the composer's internal buffers shrink; the canvas keeps its size and the
 * final pass stretches the image over it. (Resizing the canvas instead, via the pixel ratio, cleared it
 * and flashed an empty frame at every switch.)
 */
export const useCameraMotion = create<{ moving: boolean; scale: number | null }>()(() => ({ moving: false, scale: null }))

/** Fallback: if input is held but nothing redraws for this long, draw the full-quality frame anyway. */
const IDLE_MS = 400
/** Wheel zoom has no "release"; it counts as held for this long after the last tick. */
const WHEEL_MS = 160

/**
 * Pixel budget while the view changes. Frame cost is mostly per pixel (AO, SMAA, lighting), so a big
 * canvas is drawn smaller meanwhile: about a 1920×940 canvas worth of pixels.
 */
const MOTION_PIXELS = 1.8e6

/** Pixel ratio to use while moving: at most 1×, lower when the canvas is bigger than the budget. */
export function motionDpr(cssWidth: number, cssHeight: number) {
  const fit = Math.sqrt(MOTION_PIXELS / Math.max(1, cssWidth * cssHeight))
  return Math.max(0.5, Math.min(1, Math.floor(fit * 20) / 20))
}

/** Extra signal for scripted camera motion (the ?perf auto turn) that has no pointer held. */
export const motionInput = { auto: false }

/**
 * Lighter frames while the user is moving the view or dragging furniture: the composer renders at
 * `motionDpr` (1× on high-DPI laptops, below 1× on big canvases). The full-quality frame comes back the
 * moment the input ends (pointer released, keys up, wheel paused, drag finished), not after the camera
 * has eased out: the last bit of easing is slow enough to draw at full quality, and waiting for it made
 * the switch back feel late. (Switching N8AO to half resolution instead was tried: it rebuilds its
 * passes and stalls for a long frame at every switch.)
 */
export function MotionQuality() {
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const get = useThree((s) => s.get)
  const lastCam = useRef(new THREE.Matrix4())
  const lastProj = useRef(new THREE.Matrix4())
  const input = useRef({ pointers: 0, keys: new Set<string>(), wheel: 0 })
  const lastFrame = useRef(0)

  useEffect(() => {
    const i = input.current
    const held = () => i.pointers > 0 || i.keys.size > 0 || performance.now() - i.wheel < WHEEL_MS || useUi.getState().dragging !== null || motionInput.auto
    const rest = () => {
      if (!useCameraMotion.getState().moving) return
      useCameraMotion.setState({ moving: false, scale: null })
      invalidate()
    }
    const maybeRest = () => {
      if (!held()) rest()
    }
    const down = () => i.pointers++
    const up = () => {
      i.pointers = Math.max(0, i.pointers - 1)
      // A drag ends in the same pointerup; let it clear `dragging` first.
      setTimeout(maybeRest, 0)
    }
    const keyDown = (e: KeyboardEvent) => i.keys.add(e.key.toLowerCase())
    const keyUp = (e: KeyboardEvent) => {
      i.keys.delete(e.key.toLowerCase())
      maybeRest()
    }
    let wheelTimer: ReturnType<typeof setTimeout> | undefined
    const wheel = () => {
      i.wheel = performance.now()
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(maybeRest, WHEEL_MS + 10)
    }
    const blur = () => {
      i.pointers = 0
      i.keys.clear()
      maybeRest()
    }
    // Fallback for input that is held still: nothing redraws, so draw the full-quality frame.
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const offTail = addTail(() => {
      clearTimeout(idleTimer)
      const seen = lastFrame.current
      idleTimer = setTimeout(() => {
        if (seen === lastFrame.current && !motionInput.auto) rest()
      }, IDLE_MS)
    })
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('wheel', wheel, { capture: true, passive: true })
    window.addEventListener('blur', blur)
    const unsubUi = useUi.subscribe((s, p) => {
      if (p.dragging !== null && s.dragging === null) maybeRest()
    })
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('wheel', wheel, true)
      window.removeEventListener('blur', blur)
      unsubUi()
      offTail()
      clearTimeout(wheelTimer)
      clearTimeout(idleTimer)
      rest()
    }
  }, [invalidate])

  useFrame(() => {
    lastFrame.current++
    camera.updateMatrixWorld()
    const moved = !camera.matrixWorld.equals(lastCam.current) || !camera.projectionMatrix.equals(lastProj.current)
    lastCam.current.copy(camera.matrixWorld)
    lastProj.current.copy(camera.projectionMatrix)
    const i = input.current
    const held = i.pointers > 0 || i.keys.size > 0 || performance.now() - i.wheel < WHEEL_MS || motionInput.auto
    // Dragging furniture redraws every frame too (and re-renders the shadow map), so it counts as motion.
    const active = (moved && held) || useUi.getState().dragging !== null
    if (!active || useCameraMotion.getState().moving) return
    const { size } = get()
    const base = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    const scale = motionDpr(size.width, size.height) / base
    useCameraMotion.setState({ moving: true, scale: scale < 0.99 ? scale : null })
  })
  return null
}
