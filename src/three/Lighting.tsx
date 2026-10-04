import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import type { Room, WallSide } from '../model/schema'

RectAreaLightUniformsLib.init()

const S = 0.001

const OUTWARD: Record<WallSide, THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, -1),
  south: new THREE.Vector3(0, 0, 1),
  west: new THREE.Vector3(-1, 0, 0),
  east: new THREE.Vector3(1, 0, 0),
}

/** Soft studio-like image based lighting, generated locally (no HDR download). */
function useRoomEnvironment(intensity: number) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  useEffect(() => {
    scene.environmentIntensity = intensity
  }, [scene, intensity])
}

export interface LightingProps {
  room: Room
  /** 0..24, hour of day. */
  hour?: number
}

/**
 * Daylight through the windows: a shadow-casting sun aimed through the biggest window,
 * a soft sky area light at each window, and a dim environment for bounce light.
 */
export function Lighting({ room, hour = 14 }: LightingProps) {
  const sun = useRef<THREE.DirectionalLight>(null)
  const W = room.width * S
  const D = room.depth * S
  const H = room.height * S
  const center = useMemo(() => new THREE.Vector3(W / 2, 0, D / 2), [W, D])

  const windows = room.openings.filter((o) => o.type === 'window')
  const main = [...windows].sort((a, b) => b.width * b.height - a.width * a.height)[0]
  const outward = OUTWARD[main?.wall ?? 'south']

  // Sun direction: arc across the sky by hour, biased toward the main window side.
  const day = Math.max(0, Math.min(1, (hour - 6) / 12))
  const elevation = THREE.MathUtils.degToRad(12 + Math.sin(day * Math.PI) * 38)
  const swing = THREE.MathUtils.degToRad((day - 0.5) * 100)
  const dir = outward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), swing)
  dir.y = Math.tan(elevation)
  dir.normalize()
  const sunPos = center.clone().add(dir.clone().multiplyScalar(8))
  const warm = new THREE.Color('#ffd7a8').lerp(new THREE.Color('#fff4e6'), Math.sin(day * Math.PI))
  const daylight = hour > 6 && hour < 18.5 ? Math.sin(Math.max(0.05, day) * Math.PI) : 0

  useRoomEnvironment(0.12 + daylight * 0.12)

  useLayoutEffect(() => {
    const l = sun.current
    if (!l) return
    l.target.position.copy(center)
    l.target.updateMatrixWorld()
    const r = Math.max(W, D) * 0.75 + 0.5
    const cam = l.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 20
    cam.updateProjectionMatrix()
    l.shadow.needsUpdate = true
  }, [center, W, D, sunPos.x, sunPos.y, sunPos.z])

  return (
    <>
      <hemisphereLight args={['#f4f1ff', '#b39a80', 0.15 + daylight * 0.15]} />
      <directionalLight
        ref={sun}
        position={sunPos}
        color={warm}
        intensity={daylight * 4.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      {windows.map((o) => {
        const u = (o.offset + o.width / 2) * S
        const v = (o.sill + o.height / 2) * S
        const out = OUTWARD[o.wall]
        const pos =
          o.wall === 'north'
            ? new THREE.Vector3(u, v, 0.01)
            : o.wall === 'south'
              ? new THREE.Vector3(u, v, D - 0.01)
              : o.wall === 'west'
                ? new THREE.Vector3(0.01, v, u)
                : new THREE.Vector3(W - 0.01, v, u)
        const target = pos.clone().sub(out)
        return (
          <rectAreaLight
            key={o.id}
            position={pos}
            width={o.width * S}
            height={o.height * S}
            color="#e6eeff"
            intensity={0.8 + daylight * 5}
            onUpdate={(self) => self.lookAt(target)}
          />
        )
      })}
      {/* Gentle overhead fill so the room never goes muddy. */}
      <pointLight position={[W / 2, H - 0.25, D / 2]} intensity={0.25 + (1 - daylight) * 3} distance={0} decay={2} color="#fff1df" />
    </>
  )
}
