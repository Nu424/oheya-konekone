import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { stepWalk, walkObstacles } from '../editor/walk'
import { outwardOf, resolvedOpenings } from '../model/plan'
import type { Room } from '../model/schema'
import { useDoc } from '../store/useStore'
import { eyeHeight, markUnlock, useWalk } from '../store/walk'

const S = 0.001
const LOOK = 0.0022
const PITCH_LIMIT = THREE.MathUtils.degToRad(85)

interface Pose {
  /** mm */
  x: number
  z: number
  /** radians; yaw 0 looks north (-Z) */
  yaw: number
  pitch: number
}

/** Just inside the entrance (an exterior door, else any door, else the south side), facing straight in. */
function startPose(room: Room): Pose {
  const doors = resolvedOpenings(room).filter((r) => r.opening.type === 'door')
  const door = doors.find((r) => r.face.exterior) ?? doors[0]
  if (!door) return { x: room.width / 2, z: room.depth - 600, yaw: 0, pitch: -0.05 }
  const mid = (door.from + door.to) / 2
  const [ox, oz] = outwardOf(door.face.side)
  const line = door.face.line - (door.face.axis === 'x' ? oz : ox) * 450
  const [x, z] = door.face.axis === 'x' ? [mid, line] : [line, mid]
  // Yaw 0 looks toward -Z; facing the inward normal (-ox, -oz).
  return { x, z, yaw: Math.atan2(ox, oz), pitch: -0.05 }
}

/**
 * First-person walk mode, like a PC game: click to capture the mouse (pointer lock) and look around by
 * moving it, WASD / arrows to walk, Shift to hurry, Esc to let go. Without a mouse (touch), drag to
 * look and tap the floor to walk there. Walls and furniture stop the walker unless collision is off.
 */
export function WalkRig({ room, camera }: { room: Room; camera: THREE.PerspectiveCamera }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const layout = useDoc((s) => s.layout)
  const { collide, height, speed, sensitivity, resetToken } = useWalk()
  const eye = eyeHeight(height)
  const pose = useRef<Pose>(startPose(room))
  const keys = useRef(new Set<string>())
  const target = useRef<{ x: number; z: number } | null>(null)
  const obstacles = useMemo(() => walkObstacles(layout, eye), [layout, eye])
  const sens = useRef(sensitivity)
  sens.current = sensitivity

  const apply = () => {
    const p = pose.current
    camera.position.set(p.x * S, eye * S, p.z * S)
    camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ')
    camera.updateMatrixWorld()
    invalidate()
  }

  // Start at the entrance, and go back there when asked.
  useEffect(() => {
    pose.current = startPose(useDoc.getState().layout.room)
    target.current = null
    apply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken])
  // A new body height moves the eyes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(apply, [eye])

  useEffect(() => {
    camera.fov = 62
    camera.updateProjectionMatrix()
    return () => {
      camera.fov = 36
      camera.updateProjectionMatrix()
    }
  }, [camera])

  // Looking around: pointer lock with a mouse, dragging otherwise.
  useEffect(() => {
    const el = gl.domElement
    const look = (dx: number, dy: number, k: number) => {
      const p = pose.current
      p.yaw -= dx * k
      p.pitch = THREE.MathUtils.clamp(p.pitch - dy * k, -PITCH_LIMIT, PITCH_LIMIT)
      apply()
    }
    let drag: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (e.pointerType === 'mouse' && 'requestPointerLock' in el && document.pointerLockElement !== el) {
        // The lock may be refused (an iframe, too soon after Esc); dragging still works then.
        void Promise.resolve(el.requestPointerLock()).catch(() => {})
      }
      drag = { x: e.clientX, y: e.clientY }
    }
    const move = (e: PointerEvent) => {
      if (document.pointerLockElement === el) return look(e.movementX, e.movementY, LOOK * sens.current)
      if (!drag) return
      look(e.clientX - drag.x, e.clientY - drag.y, LOOK * 1.6 * sens.current)
      drag = { x: e.clientX, y: e.clientY }
    }
    const up = () => (drag = null)
    const lockChange = () => {
      const locked = document.pointerLockElement === el
      if (!locked && useWalk.getState().locked) markUnlock()
      useWalk.getState().setLocked(locked)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    document.addEventListener('pointerlockchange', lockChange)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.removeEventListener('pointerlockchange', lockChange)
      if (document.pointerLockElement === el) document.exitPointerLock()
      useWalk.getState().setLocked(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])

  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey) return
      keys.current.add(e.key.toLowerCase())
      target.current = null
      invalidate()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [invalidate])

  useFrame((_, dt) => {
    const k = keys.current
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    const p = pose.current
    let dx = 0
    let dz = 0
    const step = speed * 1000 * (k.has('shift') ? 2 : 1) * Math.min(dt, 0.05)
    if (f || r) {
      const len = Math.hypot(f, r)
      // Forward is -Z turned by yaw; right is +X turned by yaw.
      dx = ((-Math.sin(p.yaw) * f + Math.cos(p.yaw) * r) / len) * step
      dz = ((-Math.cos(p.yaw) * f - Math.sin(p.yaw) * r) / len) * step
    } else if (target.current) {
      const tx = target.current.x - p.x
      const tz = target.current.z - p.z
      const d = Math.hypot(tx, tz)
      if (d < 30) target.current = null
      else {
        const s = Math.min(step, d)
        dx = (tx / d) * s
        dz = (tz / d) * s
      }
    }
    if (!dx && !dz) return
    const [nx, nz] = collide ? stepWalk(p.x, p.z, dx, dz, obstacles) : [p.x + dx, p.z + dz]
    if (target.current && nx === p.x && nz === p.z) target.current = null
    p.x = THREE.MathUtils.clamp(nx, -500, room.width + 500)
    p.z = THREE.MathUtils.clamp(nz, -500, room.depth + 500)
    apply()
  })

  return (
    // Tap the floor to walk there (touch; a mouse click captures the pointer instead).
    <mesh
      rotation-x={-Math.PI / 2}
      position={[(room.width / 2) * S, 0.002, (room.depth / 2) * S]}
      onClick={(e) => {
        if (e.delta > 6 || (e.nativeEvent as PointerEvent).pointerType === 'mouse') return
        e.stopPropagation()
        target.current = { x: e.point.x / S, z: e.point.z / S }
        invalidate()
      }}
    >
      <planeGeometry args={[room.width * S, room.depth * S]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}
