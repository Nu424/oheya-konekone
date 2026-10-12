import { addAfterEffect, addEffect, addTail, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'

declare const __BUILD__: string

const query = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search)

/** `?perf` shows the diagnostics panel. */
export const PERF_PANEL = query.has('perf')

/**
 * Rendering optimisations, switchable from the URL so before / after can be compared on the same build:
 * `?opt=none` turns them all off, `?opt=shadow` keeps only the listed ones. Default: all on.
 */
export type OptKey = 'shadow' | 'motion'
const ALL_OPTS: OptKey[] = ['shadow', 'motion']
const optParam = query.get('opt')
export const OPT: Record<OptKey, boolean> = Object.fromEntries(
  ALL_OPTS.map((k) => [k, optParam === null || optParam === 'all' ? true : optParam.split(',').includes(k)]),
) as Record<OptKey, boolean>

export type PerfMode = 'manual' | 'auto'

export interface PerfReport {
  text: string
  json: string
}

interface PerfState {
  status: 'idle' | 'recording'
  mode: PerfMode
  startedAt: number
  duration: number
  report: PerfReport | null
  start: (mode: PerfMode) => void
  finish: (report: PerfReport) => void
  clear: () => void
}

export const usePerf = create<PerfState>()((set) => ({
  status: 'idle',
  mode: 'manual',
  startedAt: 0,
  duration: 0,
  report: null,
  start: (mode) => set({ status: 'recording', mode, startedAt: performance.now(), duration: mode === 'auto' ? 6000 : 5000, report: null }),
  finish: (report) => set({ status: 'idle', report }),
  clear: () => set({ report: null }),
}))

interface Sample {
  /** ms since the recording started */
  t: number
  /** ms since the previous rendered frame */
  dt: number
  /** CPU ms from the start of the frame loop to the end of rendering */
  cpu: number
  /** GPU ms (EXT_disjoint_timer_query_webgl2), null when unavailable */
  gpu: number | null
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

/**
 * Records per-frame timings for a few seconds by hooking the frame loop's global before / after effects.
 * Only renders that actually happen are sampled (the canvas uses on-demand rendering).
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
  private pending: { q: WebGLQuery; s: Sample }[] = []
  private active: WebGLQuery | null = null
  private gl2: WebGL2RenderingContext | null
  private ext: TimerExt | null
  private undo: (() => void)[] = []

  constructor(private get: () => RootState) {
    const { gl } = get()
    const ctx = gl.getContext()
    this.gl2 = typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext ? ctx : null
    this.ext = (this.gl2?.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) ?? null

    const autoReset = gl.info.autoReset
    gl.info.autoReset = false
    this.undo.push(() => (gl.info.autoReset = autoReset))

    // Count the draw calls spent on the shadow map separately.
    const sm = gl.shadowMap as THREE.WebGLShadowMap & { render: (...a: unknown[]) => void }
    const render = sm.render
    sm.render = (...a: unknown[]) => {
      const c = gl.info.render.calls
      render.apply(sm, a)
      this.shadowCalls += gl.info.render.calls - c
    }
    this.undo.push(() => (sm.render = render))

    this.undo.push(addEffect(() => this.before()))
    this.undo.push(addAfterEffect(() => this.after()))
    this.undo.push(addTail(() => (this.idled = true)))

    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      const po = new PerformanceObserver((list) => list.getEntries().forEach((e) => this.longTasks.push(e.duration)))
      po.observe({ type: 'longtask', buffered: false })
      this.undo.push(() => po.disconnect())
    }
  }

  private before() {
    const { gl } = this.get()
    this.poll()
    this.frameStart = performance.now()
    this.calls0 = gl.info.render.calls
    this.tris0 = gl.info.render.triangles
    this.shadowCalls = 0
    if (this.gl2 && this.ext && !this.active) {
      const q = this.gl2.createQuery()
      if (q) {
        this.gl2.beginQuery(this.ext.TIME_ELAPSED_EXT, q)
        this.active = q
      }
    }
  }

  private after() {
    const { gl, camera } = this.get()
    const now = performance.now()
    const calls = gl.info.render.calls - this.calls0
    const q = this.active
    if (q && this.gl2 && this.ext) {
      this.gl2.endQuery(this.ext.TIME_ELAPSED_EXT)
      this.active = null
    }
    // The loop also runs one idle iteration before it stops; that is not a frame.
    if (calls === 0) {
      if (q) this.gl2?.deleteQuery(q)
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
      calls,
      tris: gl.info.render.triangles - this.tris0,
      shadow: this.shadowCalls,
      moving: this.samples.length > 0 && moving,
      cont: !this.idled,
      dpr: gl.getPixelRatio(),
    }
    this.lastFrame = this.frameStart
    this.idled = false
    this.samples.push(s)
    if (q) this.pending.push({ q, s })
  }

  private poll() {
    const g = this.gl2
    const ext = this.ext
    if (!g || !ext || this.pending.length === 0) return
    const disjoint = g.getParameter(ext.GPU_DISJOINT_EXT)
    this.pending = this.pending.filter(({ q, s }) => {
      if (!g.getQueryParameter(q, g.QUERY_RESULT_AVAILABLE)) return true
      if (!disjoint) s.gpu = g.getQueryParameter(q, g.QUERY_RESULT) / 1e6
      g.deleteQuery(q)
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
    this.pending.forEach(({ q }) => this.gl2?.deleteQuery(q))
    return buildReport(this.get(), this.samples, this.longTasks, { ...meta, gpuTimer: !!this.ext })
  }
}

// ---------- report ----------

const r1 = (v: number) => Math.round(v * 10) / 10

function stats(v: number[]) {
  if (v.length === 0) return null
  const s = [...v].sort((a, b) => a - b)
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]
  return { avg: r1(v.reduce((a, b) => a + b, 0) / v.length), min: r1(s[0]), p50: r1(p(0.5)), p95: r1(p(0.95)), p99: r1(p(0.99)), max: r1(s[s.length - 1]) }
}

function gpuName(gl: THREE.WebGLRenderer) {
  const ctx = gl.getContext()
  const dbg = ctx.getExtension('WEBGL_debug_renderer_info')
  return {
    vendor: String(dbg ? ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : ctx.getParameter(ctx.VENDOR)),
    renderer: String(dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)),
  }
}

function sceneStats(state: RootState) {
  const { scene, gl } = state
  let meshes = 0
  let casters = 0
  let tris = 0
  let transparent = 0
  let lights = 0
  let items = 0
  const materials = new Set<THREE.Material>()
  scene.traverseVisible((o) => {
    if ((o as THREE.Light).isLight) lights++
    if (o.userData.footprint) items++
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    meshes++
    if (m.castShadow) casters++
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    mats.forEach((x) => {
      materials.add(x)
      if (x.transparent) transparent++
    })
    const g = m.geometry
    tris += (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3
  })
  const sun = scene.getObjectsByProperty('isDirectionalLight', true)[0] as THREE.DirectionalLight | undefined
  return {
    items,
    meshes,
    shadowCasters: casters,
    triangles: Math.round(tris),
    materials: materials.size,
    transparentMeshes: transparent,
    lights,
    shaderPrograms: gl.info.programs?.length ?? 0,
    geometriesInMemory: gl.info.memory.geometries,
    texturesInMemory: gl.info.memory.textures,
    shadowMapSize: sun?.shadow.mapSize.x ?? 0,
    shadowAutoUpdate: gl.shadowMap.autoUpdate,
  }
}

function buildReport(
  state: RootState,
  samples: Sample[],
  longTasks: number[],
  meta: { mode: PerfMode; settings: Record<string, unknown>; gpuTimer: boolean },
): PerfReport {
  const { gl, size } = state
  const buf = gl.getDrawingBufferSize(new THREE.Vector2())
  // Frames drawn back to back are "continuous"; pauses where on-demand rendering went idle are left out.
  const cont = samples.filter((s) => s.cont)
  const moving = cont.filter((s) => s.moving)
  const dts = cont.map((s) => s.dt)
  const fps = dts.length ? r1(1000 / (dts.reduce((a, b) => a + b, 0) / dts.length)) : null
  const gpus = samples.map((s) => s.gpu).filter((v): v is number => v !== null)
  const summary = {
    frames: samples.length,
    continuousFrames: cont.length,
    movingFrames: moving.length,
    fps,
    frameIntervalMs: stats(dts),
    movingFrameIntervalMs: stats(moving.map((s) => s.dt)),
    cpuMs: stats(samples.map((s) => s.cpu)),
    gpuMs: stats(gpus),
    drawCalls: stats(samples.map((s) => s.calls)),
    shadowDrawCalls: stats(samples.map((s) => s.shadow)),
    framesWithShadowUpdate: samples.filter((s) => s.shadow > 0).length,
    triangles: stats(samples.map((s) => s.tris)),
    dpr: stats(samples.map((s) => s.dpr)),
    jank: { over33ms: dts.filter((d) => d > 33.4).length, over50ms: dts.filter((d) => d > 50).length, over100ms: dts.filter((d) => d > 100).length },
    longTasks: { count: longTasks.length, totalMs: r1(longTasks.reduce((a, b) => a + b, 0)), maxMs: r1(Math.max(0, ...longTasks)) },
  }
  const nav = navigator as Navigator & { deviceMemory?: number }
  const env = {
    userAgent: nav.userAgent,
    gpu: gpuName(gl),
    gpuTimer: meta.gpuTimer,
    devicePixelRatio: window.devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
    canvasCss: `${Math.round(size.width)}x${Math.round(size.height)}`,
    drawingBuffer: `${buf.x}x${buf.y}`,
    cpuCores: nav.hardwareConcurrency ?? null,
    deviceMemoryGB: nav.deviceMemory ?? null,
  }
  const data = {
    app: 'oheya-konekone perf',
    build: typeof __BUILD__ === 'undefined' ? 'dev' : __BUILD__,
    recordedAt: new Date().toISOString(),
    url: location.pathname + location.search,
    mode: meta.mode,
    opt: OPT,
    settings: meta.settings,
    env,
    scene: sceneStats(state),
    summary,
    frames: {
      columns: ['t', 'dt', 'cpu', 'gpu', 'calls', 'shadowCalls', 'tris', 'moving', 'continuous', 'dpr'],
      rows: samples.map((s) => [Math.round(s.t), r1(s.dt), r1(s.cpu), s.gpu === null ? null : r1(s.gpu), s.calls, s.shadow, s.tris, s.moving ? 1 : 0, s.cont ? 1 : 0, s.dpr]),
    },
  }
  return { text: describe(data), json: JSON.stringify(data, null, 1) }
}

/** Human-readable summary with a first guess at where the time goes. */
function describe(d: {
  build: string
  mode: PerfMode
  opt: Record<OptKey, boolean>
  env: { gpu: { renderer: string }; devicePixelRatio: number; drawingBuffer: string; gpuTimer: boolean }
  scene: ReturnType<typeof sceneStats>
  summary: {
    continuousFrames: number
    fps: number | null
    frameIntervalMs: ReturnType<typeof stats>
    cpuMs: ReturnType<typeof stats>
    gpuMs: ReturnType<typeof stats>
    drawCalls: ReturnType<typeof stats>
    shadowDrawCalls: ReturnType<typeof stats>
    framesWithShadowUpdate: number
    dpr: ReturnType<typeof stats>
    jank: { over33ms: number; over50ms: number }
    longTasks: { count: number; maxMs: number }
  }
}) {
  const s = d.summary
  const opts = Object.entries(d.opt)
    .map(([k, v]) => `${k}:${v ? 'on' : 'off'}`)
    .join(' ')
  const L: string[] = []
  L.push(`おへやこねこね 動作診断 (${d.mode === 'auto' ? '自動で一周' : '手で操作'}) build ${d.build} / ${opts}`)
  L.push(`GPU: ${d.env.gpu.renderer}`)
  L.push(`画面: dpr ${d.env.devicePixelRatio} / 描画バッファ ${d.env.drawingBuffer}`)
  L.push(`シーン: 家具 ${d.scene.items} 点 / メッシュ ${d.scene.meshes} / 三角形 ${d.scene.triangles.toLocaleString()} / 影マップ ${d.scene.shadowMapSize}px`)
  L.push('')
  L.push(`fps: ${s.fps ?? '-'}（連続したフレーム ${s.continuousFrames} 枚）`)
  if (s.frameIntervalMs) L.push(`フレーム間隔 ms: 中央 ${s.frameIntervalMs.p50} / 95% ${s.frameIntervalMs.p95} / 最大 ${s.frameIntervalMs.max}`)
  if (s.cpuMs) L.push(`CPU ms/フレーム: 中央 ${s.cpuMs.p50} / 95% ${s.cpuMs.p95} / 最大 ${s.cpuMs.max}`)
  L.push(s.gpuMs ? `GPU ms/フレーム: 中央 ${s.gpuMs.p50} / 95% ${s.gpuMs.p95} / 最大 ${s.gpuMs.max}` : `GPU ms/フレーム: このブラウザでは測れなかったよ`)
  if (s.drawCalls) L.push(`ドローコール: 平均 ${s.drawCalls.avg}（うち影 ${s.shadowDrawCalls?.avg ?? 0}、影を描き直したフレーム ${s.framesWithShadowUpdate} 枚）`)
  if (s.dpr) L.push(`解像度の倍率: ${s.dpr.min === s.dpr.max ? s.dpr.max : `${s.dpr.min}〜${s.dpr.max}`}`)
  L.push(`カクつき: 33ms 超 ${s.jank.over33ms} 回 / 50ms 超 ${s.jank.over50ms} 回 / 長いタスク ${s.longTasks.count} 回（最大 ${s.longTasks.maxMs}ms）`)
  L.push('')
  L.push('見立て:')
  if (s.continuousFrames < 20) L.push('- 連続して描いたフレームが少ないよ。記録中は視点をぐるぐる回し続けてね（「自動で一周」も使えるよ）')
  const cpu = s.cpuMs?.p50 ?? 0
  const gpu = s.gpuMs?.p50
  const interval = s.frameIntervalMs?.p50 ?? 0
  if (interval && interval < 18 && s.jank.over33ms === 0) L.push('- ほぼ 60fps で描けてる。画面のリフレッシュレートが上限になってる状態だよ')
  if (gpu !== undefined && gpu > cpu * 1.3 && gpu > 8) L.push('- GPU 側が重め：塗る画素の数（解像度）・遮蔽(AO)・影・光の計算が効いてる')
  if (cpu > 8 && (gpu === undefined || cpu >= gpu)) L.push('- CPU 側が重め：ドローコールの多さ（部品の数・影の描き直し）が効いてる')
  if ((s.shadowDrawCalls?.avg ?? 0) > (s.drawCalls?.avg ?? 0) * 0.3) L.push('- 毎フレーム影を描き直してる。視点を動かすだけなら描き直さなくていいはず')
  if (s.jank.over50ms > 2) L.push('- 50ms を超える引っかかりがあるよ。長いタスクと同時ならシェーダーの作り直しやデータの組み立てかも')
  return L.join('\n')
}
