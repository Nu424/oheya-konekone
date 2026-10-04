import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer'
import { useUi } from '../store/useStore'

export const PHOTO_SAMPLES = 300

/**
 * Photo mode: hands rendering over to a progressive GPU path tracer.
 * Realtime-only helpers (cutaway ghosts, fake contact shadows) are hidden while it runs.
 */
export function PhotoMode() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as THREE.EventDispatcher<{ update: object }> | null
  const setFrameloop = useThree((s) => s.setFrameloop)
  const pt = useRef<WebGLPathTracer | null>(null)
  const last = useRef(0)

  useEffect(() => {
    setFrameloop('always')
    const prevTone = gl.toneMapping
    const prevExposure = gl.toneMappingExposure
    gl.toneMapping = THREE.AgXToneMapping
    gl.toneMappingExposure = 1.1

    // Hide things that only make sense for realtime rendering.
    const hidden: THREE.Object3D[] = []
    const dimmed: [THREE.Light, number][] = []
    const inside = (() => {
      const box = new THREE.Box3()
      scene.traverse((o) => {
        if (o.name === 'floor') box.setFromObject(o)
      })
      const p = camera.position
      return p.x > box.min.x && p.x < box.max.x && p.z > box.min.z && p.z < box.max.z && p.y < 3
    })()
    scene.traverse((o) => {
      const ghost = o instanceof THREE.Mesh && o.userData.orig !== undefined
      if ((o.userData.contactShadow || ghost) && o.visible) {
        o.visible = false
        hidden.push(o)
      }
      // Without a ceiling the sun would flood the room; soften it for dollhouse shots.
      if (!inside && o instanceof THREE.DirectionalLight) {
        dimmed.push([o, o.intensity])
        o.intensity *= 0.35
      }
    })

    const prevEnv = scene.environment
    const prevEnvI = scene.environmentIntensity
    const env = new GradientEquirectTexture(64)
    env.topColor.set('#fff6ea')
    env.bottomColor.set('#8a7564')
    env.exponent = 2
    env.update()
    scene.environment = env
    scene.environmentIntensity = inside ? 0.35 : 0.9

    const tracer = new WebGLPathTracer(gl)
    tracer.bounces = 6
    tracer.transmissiveBounces = 4
    tracer.filterGlossyFactor = 0.5
    tracer.minSamples = 1
    tracer.renderDelay = 0
    tracer.fadeDuration = 0
    tracer.tiles.set(2, 2)
    tracer.setScene(scene, camera)
    pt.current = tracer
    useUi.getState().setPhotoSamples(0)

    const onUpdate = () => {
      tracer.updateCamera()
      useUi.getState().setPhotoSamples(0)
    }
    controls?.addEventListener('update', onUpdate)

    return () => {
      controls?.removeEventListener('update', onUpdate)
      tracer.dispose()
      env.dispose()
      pt.current = null
      scene.environment = prevEnv
      scene.environmentIntensity = prevEnvI
      for (const o of hidden) o.visible = true
      for (const [l, i] of dimmed) l.intensity = i
      gl.toneMapping = prevTone
      gl.toneMappingExposure = prevExposure
      setFrameloop('demand')
    }
  }, [gl, scene, camera, controls, setFrameloop])

  useFrame(() => {
    const t = pt.current
    if (!t) return
    if (t.samples < PHOTO_SAMPLES) t.renderSample()
    else t.pausePathTracing = true
    // Keep showing the converged image.
    if (t.samples >= PHOTO_SAMPLES) t.renderSample()
    const now = performance.now()
    if (now - last.current > 250) {
      last.current = now
      useUi.getState().setPhotoSamples(Math.floor(t.samples))
    }
  }, 1)

  return null
}
