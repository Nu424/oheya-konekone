import { addAfterEffect, addEffect, addTail, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { composerRef } from '../three/render/renderScale'
import { buildReport } from './report'
import type { PerfMode, PerfReport } from './store'

export interface Sample {
  /** ms since the recording started */
  t: number
  /** ms since the previous rendered frame */
  dt: number
  /** CPU ms from the start of the frame loop to the end of rendering */
  cpu: number
  /** GPU ms (EXT_disjoint_timer_query_webgl2), null when unavailable */
  gpu: number | null
  /** GPU ms per part of the frame (composer passes, shadow map, other) */
  parts: Record<string, number> | null
  calls: number
  tris: number
  /** draw calls spent re-rendering the shadow map */
  shadow: number
  moving: boolean
  /** false when the frame loop went idle since the previous frame (dt is then a pause, not a slow frame) */
  cont: boolean
  dpr: number
}

type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }

/** Minimal shape of a postprocessing pass, enough to label and time it. */
interface PassLike {
  name: string
  render: (...a: unknown[]) => void
  effects?: { name: string }[]
  configuration?: { aoRadius?: number }
}

/** Stable labels for the GPU breakdown (pass names survive minification, class names do not). */
function passLabel(p: PassLike) {
  if (p.name === 'RenderPass') return 'scene'
  if (p.name === 'EffectPass') return p.effects?.length ? `fx:${p.effects.map((e) => e.name.replace(/Effect$/, '')).join('+')}` : 'fx'
  if (p.configuration?.aoRadius !== undefined) return 'ao'
  return p.name || 'pass'
}

/**
 * Records per-frame timings for a few seconds by hooking the frame loop's global before / after effects.
 * Only renders that actually happen are sampled (the canvas uses on-demand rendering).
 *
 * GPU time is measured with a chain of back-to-back timer queries (they cannot nest): the frame starts
 * in "other", each composer pass and the shadow map switch the running query to their own label and
 * back, so the parts add up to the whole frame.
 */
export class Recorder {
  private samples: Sample[] = []
  private longTasks: number[] = []
  private t0 = performance.now()
  private frameStart = 0
  private calls0 = 0
  private tris0 = 0
  private shadowCalls = 0
  private lastFrame = -1
  private idled = true
  private lastCam = new THREE.Matrix4()
  private lastProj = new THREE.Matrix4()
  private pending: { qs: { q: WebGLQuery; label: string }[]; s: Sample }[] = []
  private frameQs: { q: WebGLQuery; label: string }[] = []
  private cur: { q: WebGLQuery; label: string } | null = null
  private label = 'other'
  private inFrame = false
  private gl2: WebGL2RenderingContext | null
  private ext: TimerExt | null
  private undo: (() => void)[] = []

  constructor(
    private get: () => RootState,
    private renderScale: () => number = () => 1,
  ) {
    const { gl } = get()
    const ctx = gl.getContext()
    this.gl2 = typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext ? ctx : null
    this.ext = (this.gl2?.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) ?? null

    const autoReset = gl.info.autoReset
    gl.info.autoReset = false
    this.undo.push(() => (gl.info.autoReset = autoReset))

    // Count (and time) the shadow map separately.
    const sm = gl.shadowMap as unknown as { render: (...a: unknown[]) => void }
    this.wrap(sm, 'shadow', (call) => {
      const c = gl.info.render.calls
      call()
      this.shadowCalls += gl.info.render.calls - c
    })
    ;(composerRef.current?.passes as unknown as PassLike[] | undefined)?.forEach((p) => this.wrap(p, passLabel(p)))

    this.undo.push(addEffect(() => this.before()))
    this.undo.push(addAfterEffect(() => this.after()))
    this.undo.push(addTail(() => (this.idled = true)))

    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      const po = new PerformanceObserver((list) => list.getEntries().forEach((e) => this.longTasks.push(e.duration)))
      po.observe({ type: 'longtask', buffered: false })
      this.undo.push(() => po.disconnect())
    }
  }

  /** Replaces obj.render so that its GPU time is booked under `label`. */
  private wrap(obj: { render: (...a: unknown[]) => void }, label: string, around?: (call: () => void) => void) {
    const render = obj.render
    obj.render = (...a: unknown[]) => {
      const prev = this.label
      this.switchTo(label)
      try {
        if (around) around(() => render.apply(obj, a))
        else render.apply(obj, a)
      } finally {
        this.switchTo(prev)
      }
    }
    this.undo.push(() => (obj.render = render))
  }

  /** Ends the running timer query and starts one for `label`. */
  private switchTo(label: string) {
    this.label = label
    const g = this.gl2
    const ext = this.ext
    if (!g || !ext || !this.inFrame) return
    if (this.cur) {
      g.endQuery(ext.TIME_ELAPSED_EXT)
      this.frameQs.push(this.cur)
      this.cur = null
    }
    const q = g.createQuery()
    if (!q) return
    g.beginQuery(ext.TIME_ELAPSED_EXT, q)
    this.cur = { q, label }
  }

  private before() {
    const { gl } = this.get()
    this.poll()
    this.frameStart = performance.now()
    this.calls0 = gl.info.render.calls
    this.tris0 = gl.info.render.triangles
    this.shadowCalls = 0
    this.frameQs = []
    this.inFrame = true
    this.switchTo('other')
  }

  private after() {
    const { gl, camera } = this.get()
    const now = performance.now()
    const calls = gl.info.render.calls - this.calls0
    if (this.cur && this.gl2 && this.ext) {
      this.gl2.endQuery(this.ext.TIME_ELAPSED_EXT)
      this.frameQs.push(this.cur)
      this.cur = null
    }
    this.inFrame = false
    const qs = this.frameQs
    this.frameQs = []
    // The loop also runs one idle iteration before it stops; that is not a frame.
    if (calls === 0) {
      qs.forEach(({ q }) => this.gl2?.deleteQuery(q))
      return
    }
    const moving = !camera.matrixWorld.equals(this.lastCam) || !camera.projectionMatrix.equals(this.lastProj)
    this.lastCam.copy(camera.matrixWorld)
    this.lastProj.copy(camera.projectionMatrix)
    const t = this.frameStart - this.t0
    const s: Sample = {
      t,
      dt: this.lastFrame < 0 ? 0 : this.frameStart - this.lastFrame,
      cpu: now - this.frameStart,
      gpu: null,
      parts: null,
      calls,
      tris: gl.info.render.triangles - this.tris0,
      shadow: this.shadowCalls,
      moving: this.samples.length > 0 && moving,
      cont: !this.idled,
      dpr: gl.getPixelRatio() * this.renderScale(),
    }
    this.lastFrame = this.frameStart
    this.idled = false
    this.samples.push(s)
    if (qs.length) this.pending.push({ qs, s })
  }

  private poll() {
    const g = this.gl2
    const ext = this.ext
    if (!g || !ext || this.pending.length === 0) return
    const disjoint = g.getParameter(ext.GPU_DISJOINT_EXT)
    this.pending = this.pending.filter(({ qs, s }) => {
      // Queries finish in order, so the last one being ready means the whole frame is.
      if (!g.getQueryParameter(qs[qs.length - 1].q, g.QUERY_RESULT_AVAILABLE)) return true
      if (!disjoint) {
        const parts: Record<string, number> = {}
        for (const { q, label } of qs) parts[label] = (parts[label] ?? 0) + g.getQueryParameter(q, g.QUERY_RESULT) / 1e6
        s.parts = parts
        s.gpu = Object.values(parts).reduce((a, b) => a + b, 0)
      }
      qs.forEach(({ q }) => g.deleteQuery(q))
      return false
    })
  }

  /** Stops hooking the loop, waits briefly for the last GPU timings and builds the report. */
  async stop(meta: { mode: PerfMode; settings: Record<string, unknown> }): Promise<PerfReport> {
    this.undo.forEach((f) => f())
    for (let i = 0; i < 10 && this.pending.length; i++) {
      await new Promise((r) => setTimeout(r, 50))
      this.poll()
    }
    this.pending.forEach(({ qs }) => qs.forEach(({ q }) => this.gl2?.deleteQuery(q)))
    return buildReport(this.get(), this.samples, this.longTasks, { ...meta, gpuTimer: !!this.ext })
  }
}
