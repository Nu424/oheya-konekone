import { useFrame, useThree } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useUi } from '../store/useStore'
import { AO_QUALITY, Recorder, usePerf } from './perf'

/** Runs a recording started from the diagnostics panel; in "auto" mode it also turns the camera once around. */
export function PerfProbe() {
  const get = useThree((s) => s.get)
  const status = usePerf((s) => s.status)
  const mode = usePerf((s) => s.mode)
  const auto = useRef<{ pos: [number, number, number]; target: [number, number, number] } | null>(null)

  useEffect(() => {
    if (status !== 'recording') return
    const { duration, mode } = usePerf.getState()
    const rec = new Recorder(get)
    const controls = get().controls as unknown as CameraControlsImpl | null
    if (mode === 'auto' && controls) {
      const p = controls.getPosition(new THREE.Vector3())
      const t = controls.getTarget(new THREE.Vector3())
      auto.current = { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z] }
    }
    get().invalidate()
    let done = false
    const id = setTimeout(async () => {
      done = true
      const a = auto.current
      auto.current = null
      const ui = useUi.getState()
      const report = await rec.stop({
        mode,
        settings: { aoQuality: AO_QUALITY, view: ui.view, hour: ui.hour, photo: ui.photo, flow: ui.flow, overlaps: ui.overlaps, selected: ui.selection.length, panel: ui.panel },
      })
      if (a && controls) controls.setLookAt(...a.pos, ...a.target, false)
      get().invalidate()
      usePerf.getState().finish(report)
    }, duration)
    return () => {
      clearTimeout(id)
      if (!done) rec.stop({ mode, settings: {} })
    }
  }, [status, get])

  useFrame((_, dt) => {
    if (status !== 'recording' || mode !== 'auto') return
    const controls = get().controls as unknown as CameraControlsImpl | null
    if (!controls) return
    // One full turn over the recording.
    controls.rotate((Math.PI * 2 * Math.min(dt, 0.1) * 1000) / usePerf.getState().duration, 0, false)
    get().invalidate()
  })
  return null
}
