import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Re-renders the shadow map only when something that casts shadows changed, instead of every frame
 * (docs/PERFORMANCE.md A-2). The sun's shadow does not depend on the view, so orbiting the camera never needs a new one.
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
