import { addTail, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'

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

/** True while the camera is moving (orbit, zoom, pan, walk, view transitions). */
export const useCameraMotion = create<{ moving: boolean }>()(() => ({ moving: false }))

/** How long the frame loop must stay idle after the camera stops before the full-quality frame is drawn. */
const SETTLE_MS = 250

/**
 * Lighter frames while the camera moves: on high-DPI screens the pixel ratio drops to 1 (a quarter of
 * the pixels at 2×). Once the camera rests, one full-quality frame is drawn, so a still view looks
 * exactly as before. (Switching N8AO to half resolution instead was tried: it rebuilds its passes and
 * stalls for a long frame at every switch, so screens already at 1× keep full quality.)
 *
 * "Rests" means the on-demand frame loop went idle (nothing invalidated it) and stayed so for SETTLE_MS.
 * A wall-clock timeout alone would flip quality back and forth on every frame on slow machines,
 * where one frame can take longer than the timeout.
 */
export function MotionQuality() {
  const camera = useThree((s) => s.camera)
  const setDpr = useThree((s) => s.setDpr)
  const invalidate = useThree((s) => s.invalidate)
  const lastCam = useRef(new THREE.Matrix4())
  const lastProj = useRef(new THREE.Matrix4())
  const moves = useRef(0)

  useEffect(() => {
    // Same range as the Canvas `dpr={[1, 2]}`.
    const base = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    let timer: ReturnType<typeof setTimeout> | undefined
    const rest = () => {
      useCameraMotion.setState({ moving: false })
      setDpr(base())
      invalidate()
    }
    const offTail = addTail(() => {
      if (!useCameraMotion.getState().moving) return
      const seen = moves.current
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (seen === moves.current && useCameraMotion.getState().moving) rest()
      }, SETTLE_MS)
    })
    const unsub = useCameraMotion.subscribe((s, p) => {
      if (s.moving && !p.moving && base() > 1) setDpr(1)
    })
    return () => {
      offTail()
      unsub()
      clearTimeout(timer)
      if (useCameraMotion.getState().moving) rest()
    }
  }, [setDpr, invalidate])

  useFrame(() => {
    camera.updateMatrixWorld()
    const moved = !camera.matrixWorld.equals(lastCam.current) || !camera.projectionMatrix.equals(lastProj.current)
    lastCam.current.copy(camera.matrixWorld)
    lastProj.current.copy(camera.projectionMatrix)
    if (!moved) return
    moves.current++
    if (!useCameraMotion.getState().moving) useCameraMotion.setState({ moving: true })
  })
  return null
}
