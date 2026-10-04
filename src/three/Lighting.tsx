import { useThree } from '@react-three/fiber'
import { skyMaterial } from './RoomMesh'
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

export interface Lamp {
  position: [number, number, number]
  color: string
  intensity: number
  distance?: number
}

export interface LightingProps {
  room: Room
  /** 0..24, hour of day. */
  hour?: number
  /** Light sources from lamp items (room mm). Switched on automatically when it gets dark. */
  lamps?: Lamp[]
}

/** Sky tint, background and lamp state for an hour of the day. */
export function timeOfDay(hour: number) {
  const day = Math.max(0, Math.min(1, (hour - 6) / 12))
  const daylight = hour > 6 && hour < 18.5 ? Math.sin(Math.max(0.05, day) * Math.PI) : 0
  // 0 at noon, 1 around sunrise / sunset
  const golden = Math.max(0, 1 - Math.abs(hour < 12 ? hour - 6.5 : hour - 17.5) / 1.8)
  const night = hour < 6 || hour > 18.5 ? 1 : hour < 7 ? 7 - hour : hour > 17.5 ? hour - 17.5 : 0
  const lampsOn = hour < 6.5 || hour > 17
  return { day, daylight, golden, night: Math.min(1, night), lampsOn }
}

const SKY_DAY = new THREE.Color(1.15, 1.15, 1.15)
const SKY_GOLD = new THREE.Color(1.25, 0.88, 0.68)
const SKY_NIGHT = new THREE.Color(0.1, 0.12, 0.26)
const BG_DAY = new THREE.Color('#efe6da')
const BG_GOLD = new THREE.Color('#ecd7c4')
const BG_NIGHT = new THREE.Color('#2b2836')

/**
 * Daylight through the windows: a shadow-casting sun aimed through the biggest window,
 * a soft sky area light at each window, and a dim environment for bounce light.
 */
export function Lighting({ room, hour = 14, lamps = [] }: LightingProps) {
  const scene = useThree((s) => s.scene)
  const tod = timeOfDay(hour)
  useEffect(() => {
    const sky = skyMaterial()
    sky.color.copy(SKY_DAY).lerp(SKY_GOLD, tod.golden * 0.8).lerp(SKY_NIGHT, tod.night)
    const bg = BG_DAY.clone().lerp(BG_GOLD, tod.golden * 0.6).lerp(BG_NIGHT, tod.night)
    scene.background = bg
  }, [scene, tod.golden, tod.night])
  const lampsOn = tod.lampsOn && lamps.length > 0
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
  const warm = new THREE.Color('#ffd7a8').lerp(new THREE.Color('#fff4e6'), Math.sin(day * Math.PI)).lerp(new THREE.Color('#ffb27a'), tod.golden * 0.6)
  const daylight = tod.daylight

  useRoomEnvironment(0.05 + daylight * 0.19)

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
      <hemisphereLight args={['#f4f1ff', '#b39a80', 0.04 + daylight * 0.26]} />
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
            color={tod.night > 0.5 ? '#4a5a8a' : '#e6eeff'}
            intensity={0.15 + daylight * 5.6}
            onUpdate={(self) => self.lookAt(target)}
          />
        )
      })}
      {/* Gentle overhead fill so the room never goes muddy (stands in for room lights when there are no lamps). */}
      <pointLight position={[W / 2, H - 0.25, D / 2]} intensity={lampsOn ? 0.15 : 0.25 + (1 - daylight) * 2.5} distance={0} decay={2} color="#fff1df" />
      {lampsOn &&
        lamps.slice(0, 6).map((l, i) => (
          <pointLight key={i} position={[l.position[0] * S, l.position[1] * S, l.position[2] * S]} color={l.color} intensity={l.intensity * 3.2} distance={(l.distance ?? 6000) * S} decay={1.6} />
        ))}
    </>
  )
}
