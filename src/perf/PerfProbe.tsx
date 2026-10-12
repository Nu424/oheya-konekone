import { useFrame, useThree } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { itemCommands } from '../editor/commands'
import { beginGesture, endGesture, useDoc, useUi } from '../store/useStore'
import { setScriptedMotion } from '../three/render/MotionQuality'
import { AO_QUALITY } from '../three/render/quality'
import { composerRef, useRenderScale } from '../three/render/renderScale'
import { Recorder } from './recorder'
import { usePerf } from './store'

/**
 * Inside the Canvas with `?perf`: runs a recording started from the panel (in "auto" mode it also turns
 * the camera once around), and exposes the renderer and edit commands to scripted checks
 * (`window.__oheya.perf`, used by scripts/perf-check.mjs; production builds have no /src imports).
 */
export function PerfProbe() {
  const get = useThree((s) => s.get)
  const status = usePerf((s) => s.status)
  const mode = usePerf((s) => s.mode)
  const auto = useRef<{ pos: [number, number, number]; target: [number, number, number] } | null>(null)

  useEffect(() => {
    const o = (window.__oheya ??= { frames: 0, ready: false })
    o.perf = { three: get, composer: composerRef, useDoc, useUi, useRenderScale, itemCommands, beginGesture, endGesture }
    return () => {
      delete o.perf
    }
  }, [get])

  useEffect(() => {
    if (status !== 'recording') return
    const { duration, mode } = usePerf.getState()
    const rec = new Recorder(get, () => useRenderScale.getState().scale ?? 1)
    setScriptedMotion(mode === 'auto')
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
      setScriptedMotion(false)
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
      setScriptedMotion(false)
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
