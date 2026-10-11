// Usage: node scripts/shot.mjs <url-path-and-query> <out.png> [width] [height] [waitMs] [actions...]
// actions: key:<Key>  keydown:<Key>  keyup:<Key>  click:<css selector>  mouse:<x,y>  drag:<x1,y1,x2,y2>  wait:<ms>  type:<text>
// Takes a screenshot of the running dev server with the pre-installed Chromium (software WebGL).
import { existsSync, mkdirSync, rmdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium } from 'playwright-core'

// On Windows the node shim splits arguments at "&", so wrap the path in double quotes inside single
// quotes: node scripts/shot.mjs '"/?gallery&type=desk"' shots/x.png
const [rawPath = '/', out = 'shots/shot.png', w = '1440', h = '900', wait = '1500', ...actions] = process.argv.slice(2)
const path = rawPath.replace(/^"|"$/g, '')
const base = process.env.BASE_URL ?? 'http://localhost:5173'
const candidates = [
  process.env.CHROMIUM,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter((p) => p && existsSync(p))
// Software WebGL by default (works everywhere); SHOT_GPU=1 uses the real GPU where there is one.
const gl = process.env.SHOT_GPU ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

// One screenshot at a time: several headless browsers rendering at once starve each other.
mkdirSync(dirname(out), { recursive: true })
mkdirSync('shots', { recursive: true })
const lock = 'shots/.lock'
for (let waited = 0; ; waited += 500) {
  try {
    mkdirSync(lock)
    break
  } catch {
    // A lock older than 4 minutes belongs to a run that died.
    try {
      if (Date.now() - statSync(lock).mtimeMs > 240000) rmdirSync(lock)
    } catch {}
    if (waited > 600000) throw new Error('shot: timed out waiting for another screenshot to finish')
    await new Promise((r) => setTimeout(r, 500))
  }
}
const unlock = () => {
  try {
    rmdirSync(lock)
  } catch {}
}
process.on('exit', unlock)
process.on('SIGINT', () => process.exit(1))

const browser = await chromium.launch({ executablePath: candidates[0], args: gl })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(base + path, { waitUntil: 'networkidle' })
await page
  .waitForFunction(() => window.__oheya?.ready === true, null, { timeout: 120000 })
  .catch(() => logs.push('[shot] ready flag not reached'))
await page.waitForTimeout(+wait)
for (const a of actions) {
  const i = a.indexOf(':')
  const [kind, arg] = [a.slice(0, i), a.slice(i + 1)]
  if (kind === 'key') await page.keyboard.press(arg)
  else if (kind === 'click') await page.click(arg)
  else if (kind === 'keydown') await page.keyboard.down(arg)
  else if (kind === 'keyup') await page.keyboard.up(arg)
  else if (kind === 'wait') await page.waitForTimeout(+arg)
  else if (kind === 'type') await page.keyboard.type(arg)
  else if (kind === 'mouse') {
    const [x, y] = arg.split(',').map(Number)
    await page.mouse.click(x, y)
  } else if (kind === 'drag') {
    const [x1, y1, x2, y2] = arg.split(',').map(Number)
    await page.mouse.move(x1, y1)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(x1 + ((x2 - x1) * i) / 8, y1 + ((y2 - y1) * i) / 8)
      await page.waitForTimeout(400)
    }
    await page.waitForTimeout(1500)
    if (!process.env.HOLD) await page.mouse.up()
  }
}
await page.screenshot({ path: out })
await browser.close()
const interesting = logs.filter((l) => !l.includes('[vite]') && !l.includes('React DevTools'))
if (interesting.length) console.log(interesting.join('\n'))
console.log('saved', out)
