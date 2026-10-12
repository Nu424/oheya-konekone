import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sample } from './recorder'
import type { PerfMode, PerfReport } from './store'

declare const __BUILD__: string

const r1 = (v: number) => Math.round(v * 10) / 10

function stats(v: number[], prec = 10) {
  if (v.length === 0) return null
  const s = [...v].sort((a, b) => a - b)
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]
  const r1 = (x: number) => Math.round(x * prec) / prec
  return { avg: r1(v.reduce((a, b) => a + b, 0) / v.length), min: r1(s[0]), p50: r1(p(0.5)), p95: r1(p(0.95)), p99: r1(p(0.99)), max: r1(s[s.length - 1]) }
}

/** Average GPU ms per part over the frames that have a breakdown, biggest first. */
function gpuParts(samples: Sample[]) {
  const withParts = samples.filter((s) => s.parts)
  if (!withParts.length) return null
  const sum: Record<string, number> = {}
  withParts.forEach((s) => Object.entries(s.parts!).forEach(([k, v]) => (sum[k] = (sum[k] ?? 0) + v)))
  return Object.fromEntries(
    Object.entries(sum)
      .map(([k, v]) => [k, r1(v / withParts.length)] as const)
      .sort((a, b) => b[1] - a[1]),
  )
}

const PART_NAMES: Record<string, string> = { scene: '本体の描画', ao: '遮蔽(AO)', shadow: '影', other: 'その他' }
const partName = (k: string) => PART_NAMES[k] ?? (k.startsWith('fx:') ? `仕上げ(${k.slice(3)})` : k)

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

export function buildReport(
  state: RootState,
  samples: Sample[],
  longTasks: number[],
  meta: { mode: PerfMode; settings: Record<string, unknown>; gpuTimer: boolean },
): PerfReport {
  const { gl, size } = state
  // The recording may end while the motion pixel ratio is still active; report the resting size.
  const restDpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  const buf = { x: Math.round(size.width * restDpr), y: Math.round(size.height * restDpr) }
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
    gpuPartsMs: gpuParts(samples),
    drawCalls: stats(samples.map((s) => s.calls)),
    shadowDrawCalls: stats(samples.map((s) => s.shadow)),
    framesWithShadowUpdate: samples.filter((s) => s.shadow > 0).length,
    triangles: stats(samples.map((s) => s.tris)),
    dpr: stats(samples.map((s) => s.dpr), 100),
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
    megapixels: r1((buf.x * buf.y) / 1e6),
    cpuCores: nav.hardwareConcurrency ?? null,
    deviceMemoryGB: nav.deviceMemory ?? null,
  }
  const data = {
    app: 'oheya-konekone perf',
    build: typeof __BUILD__ === 'undefined' ? 'dev' : __BUILD__,
    recordedAt: new Date().toISOString(),
    url: location.pathname + location.search,
    mode: meta.mode,
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
  env: { gpu: { renderer: string }; devicePixelRatio: number; drawingBuffer: string; megapixels: number; gpuTimer: boolean }
  scene: ReturnType<typeof sceneStats>
  summary: {
    continuousFrames: number
    fps: number | null
    frameIntervalMs: ReturnType<typeof stats>
    cpuMs: ReturnType<typeof stats>
    gpuMs: ReturnType<typeof stats>
    gpuPartsMs: Record<string, number> | null
    drawCalls: ReturnType<typeof stats>
    shadowDrawCalls: ReturnType<typeof stats>
    framesWithShadowUpdate: number
    dpr: ReturnType<typeof stats>
    jank: { over33ms: number; over50ms: number }
    longTasks: { count: number; maxMs: number }
  }
}) {
  const s = d.summary
  const L: string[] = []
  L.push(`おへやこねこね 動作診断 (${d.mode === 'auto' ? '自動で一周' : '手で操作'}) build ${d.build}`)
  L.push(`GPU: ${d.env.gpu.renderer}`)
  L.push(`画面: dpr ${d.env.devicePixelRatio} / 描画バッファ ${d.env.drawingBuffer}（${d.env.megapixels} 百万画素、止まっているとき）`)
  L.push(`シーン: 家具 ${d.scene.items} 点 / メッシュ ${d.scene.meshes} / 三角形 ${d.scene.triangles.toLocaleString()} / 影マップ ${d.scene.shadowMapSize}px`)
  L.push('')
  L.push(`fps: ${s.fps ?? '-'}（連続したフレーム ${s.continuousFrames} 枚）`)
  if (s.frameIntervalMs) L.push(`フレーム間隔 ms: 中央 ${s.frameIntervalMs.p50} / 95% ${s.frameIntervalMs.p95} / 最大 ${s.frameIntervalMs.max}`)
  if (s.cpuMs) L.push(`CPU ms/フレーム: 中央 ${s.cpuMs.p50} / 95% ${s.cpuMs.p95} / 最大 ${s.cpuMs.max}`)
  L.push(s.gpuMs ? `GPU ms/フレーム: 中央 ${s.gpuMs.p50} / 95% ${s.gpuMs.p95} / 最大 ${s.gpuMs.max}` : `GPU ms/フレーム: このブラウザでは測れなかったよ`)
  if (s.gpuPartsMs)
    L.push(
      `GPU の内訳 (平均 ms): ${Object.entries(s.gpuPartsMs)
        .map(([k, v]) => `${partName(k)} ${v}`)
        .join(' / ')}`,
    )
  if (s.drawCalls) L.push(`ドローコール: 平均 ${s.drawCalls.avg}（うち影 ${s.shadowDrawCalls?.avg ?? 0}、影を描き直したフレーム ${s.framesWithShadowUpdate} 枚）`)
  if (s.dpr) L.push(`解像度の倍率（動いている間に下がる）: ${s.dpr.min === s.dpr.max ? s.dpr.max : `${s.dpr.min}〜${s.dpr.max}`}`)
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
  const parts = s.gpuPartsMs
  if (parts) {
    const total = Object.values(parts).reduce((a, b) => a + b, 0) || 1
    const [top, ms] = Object.entries(parts)[0]
    if (ms / total > 0.35) L.push(`- GPU のいちばん大きい出費は「${partName(top)}」で、全体の ${Math.round((ms / total) * 100)}%`)
  }
  if ((s.shadowDrawCalls?.avg ?? 0) > (s.drawCalls?.avg ?? 0) * 0.3) L.push('- 毎フレーム影を描き直してる。視点を動かすだけなら描き直さなくていいはず')
  if (s.jank.over50ms > 2) L.push('- 50ms を超える引っかかりがあるよ。長いタスクと同時ならシェーダーの作り直しやデータの組み立てかも')
  return L.join('\n')
}
