// Usage: node scripts/perf-check.mjs [template]   (dev server running; BASE_URL / CHROMIUM like scripts/shot.mjs)
// Regression checks for the rendering optimisations in docs/PERFORMANCE.md, with headless Chromium:
//   A-3  dragging furniture does not relink any shader
//   B-1  while dragging, only the composer shrinks (the canvas keeps its size); releasing restores it
//   A-2  after furniture moves, the shadow map is current (forcing a redraw changes no pixel)
// Exits with code 1 when a check fails.
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const template = process.argv[2] ?? '1k-6'
const base = process.env.BASE_URL ?? 'http://localhost:5173'
const exe = [process.env.CHROMIUM, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && existsSync(p))
const gl = process.env.SHOT_GPU ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

const browser = await chromium.launch({ executablePath: exe, args: gl })
// Big enough to be over the motion pixel budget, so the render scale kicks in.
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto(`${base}/?perf&template=${template}`)
await page.waitForFunction(() => window.__oheya?.ready && window.__oheya.perf, null, { timeout: 120000 })
await page.waitForTimeout(1500)

const results = await page.evaluate(async () => {
  const P = window.__oheya.perf
  const { gl, invalidate } = P.three()
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  // Software WebGL can take a second per frame: wait for frames, not for time.
  const frames = async (n) => {
    const target = window.__oheya.frames + n
    for (let t = 0; window.__oheya.frames < target && t < 20000; t += 50) await wait(50)
  }
  const ctx = gl.getContext()
  let links = 0
  const link = ctx.linkProgram.bind(ctx)
  ctx.linkProgram = (p) => {
    links++
    return link(p)
  }
  const canvas = gl.domElement
  const sizes = () => ({ canvas: canvas.width, composer: P.composer.current?.inputBuffer.width })
  const layout = P.useDoc.getState().layout
  const it = layout.items.find((i) => i.type !== 'rug' && i.type !== 'curtain' && !i.locked) ?? layout.items[0]

  // One drag: select, hold, a few steps, release (what the pointer handlers do, minus the ray picking).
  const drag = async (dx, onStep) => {
    P.useUi.getState().select(it.id)
    P.beginGesture()
    P.useUi.getState().setDragging(it.id)
    for (let i = 1; i <= 6; i++) {
      const at = P.useDoc.getState().layout.items.find((x) => x.id === it.id)
      P.itemCommands.dragTo(it.id, { position: [at.position[0] + dx, at.position[1], at.position[2]], rotation: at.rotation }, [it.id])
      await frames(1)
      onStep?.()
    }
    P.useUi.getState().setDragging(null)
    P.endGesture()
    await frames(2)
  }

  const out = { item: it.id, rest: sizes() }
  // The first drag may compile the drag-only line shaders once; the next one must compile nothing.
  await drag(40)
  links = 0
  const during = []
  await drag(-40, () => during.push(sizes()))
  out.linksDuringDrag = links
  out.during = during[during.length - 1]
  out.released = sizes()

  // Shadow map: wait for the last frames, grab the canvas, force a shadow redraw, grab again.
  await frames(3)
  const grab = () => canvas.toDataURL('image/png')
  const before = grab()
  gl.shadowMap.needsUpdate = true
  invalidate()
  await frames(2)
  out.shadowCurrent = before === grab()
  return out
})

const checks = [
  ['ドラッグ中にシェーダーを作り直さない (A-3)', results.linksDuringDrag === 0, `link ${results.linksDuringDrag} 回`],
  ['ドラッグ中もキャンバスの大きさは同じ (B-1)', results.during.canvas === results.rest.canvas, `${results.rest.canvas} → ${results.during.canvas}`],
  ['ドラッグ中はコンポーザーが縮む (B-1)', results.during.composer < results.rest.canvas, `コンポーザー ${results.during.composer}px`],
  ['離したらコンポーザーが元に戻る (B-1)', results.released.composer === results.rest.canvas, `コンポーザー ${results.released.composer}px`],
  ['動かしたあとの影が最新 (A-2)', results.shadowCurrent, results.shadowCurrent ? '描き直しても同じ絵' : '描き直すと絵が変わる'],
]
let failed = 0
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`)
  if (!ok) failed++
}
await browser.close()
process.exit(failed ? 1 : 0)
