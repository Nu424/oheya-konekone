import { addTail, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useUi } from '../../store/useStore'
import { motionRenderScale } from './quality'
import { useRenderScale } from './renderScale'

/** Wheel zoom has no "release"; it counts as held for this long after the last tick. */
const WHEEL_MS = 160
/** Input held but nothing redrawn for this long: draw the full-quality frame anyway. */
const IDLE_MS = 400

/** What the user is holding right now. Scripted camera motion (the ?perf auto turn) counts as held. */
const input = { pointers: 0, keys: new Set<string>(), wheel: -Infinity, scripted: false }

const inputHeld = () => input.pointers > 0 || input.keys.size > 0 || performance.now() - input.wheel < WHEEL_MS || input.scripted

/** For scripted camera motion that has no pointer held (the ?perf auto turn). */
export function setScriptedMotion(on: boolean) {
  input.scripted = on
}

/**
 * Renders lighter while the user moves the view or drags furniture (docs/PERFORMANCE.md B-1): the
 * composer draws at `motionRenderScale` of the canvas. Full quality comes back the moment the input ends
 * (pointer or keys released, wheel paused, drag finished), not after the camera has eased out.
 */
export function MotionQuality() {
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const get = useThree((s) => s.get)
  const lastCam = useRef(new THREE.Matrix4())
  const lastProj = useRef(new THREE.Matrix4())
  const active = useRef(false)
  const frames = useRef(0)

  useEffect(() => {
    const dragging = () => useUi.getState().dragging !== null
    const rest = () => {
      if (!active.current) return
      active.current = false
      useRenderScale.setState({ scale: null })
      invalidate()
    }
    const maybeRest = () => {
      if (!inputHeld() && !dragging()) rest()
    }
    const down = () => input.pointers++
    // A drag ends in the same pointerup; let it clear `dragging` first.
    const up = () => {
      input.pointers = Math.max(0, input.pointers - 1)
      setTimeout(maybeRest, 0)
    }
    const keyDown = (e: KeyboardEvent) => input.keys.add(e.key.toLowerCase())
    const keyUp = (e: KeyboardEvent) => {
      input.keys.delete(e.key.toLowerCase())
      maybeRest()
    }
    let wheelTimer: ReturnType<typeof setTimeout> | undefined
    const wheel = () => {
      input.wheel = performance.now()
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(maybeRest, WHEEL_MS + 10)
    }
    const blur = () => {
      input.pointers = 0
      input.keys.clear()
      maybeRest()
    }
    // Held but still: the on-demand loop goes idle, so nothing would ever redraw at full quality.
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const offTail = addTail(() => {
      clearTimeout(idleTimer)
      const seen = frames.current
      idleTimer = setTimeout(() => {
        if (seen === frames.current && !input.scripted) rest()
      }, IDLE_MS)
    })
    const offUi = useUi.subscribe((s, p) => {
      if (p.dragging !== null && s.dragging === null) maybeRest()
    })
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('wheel', wheel, { capture: true, passive: true })
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('wheel', wheel, true)
      window.removeEventListener('blur', blur)
      offUi()
      offTail()
      clearTimeout(wheelTimer)
      clearTimeout(idleTimer)
      rest()
    }
  }, [invalidate])

  useFrame(() => {
    frames.current++
    camera.updateMatrixWorld()
    const moved = !camera.matrixWorld.equals(lastCam.current) || !camera.projectionMatrix.equals(lastProj.current)
    lastCam.current.copy(camera.matrixWorld)
    lastProj.current.copy(camera.projectionMatrix)
    // The camera moving under the user's hand, or furniture being dragged (it redraws every frame too).
    // Camera motion with nothing held (easing out, view transitions) stays at full quality.
    if (active.current || !((moved && inputHeld()) || useUi.getState().dragging !== null)) return
    active.current = true
    const { size } = get()
    useRenderScale.setState({ scale: motionRenderScale(size.width, size.height, window.devicePixelRatio) })
  })
  return null
}
