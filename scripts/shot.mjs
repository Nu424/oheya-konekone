// Usage: node scripts/shot.mjs <url-path-and-query> <out.png> [width] [height] [waitMs] [actions...]
// actions: key:<Key>  click:<css selector>  wait:<ms>  type:<text>
// Takes a screenshot of the running dev server with the pre-installed Chromium (software WebGL).
import { chromium } from 'playwright-core'

const [path = '/', out = 'shots/shot.png', w = '1440', h = '900', wait = '1500', ...actions] = process.argv.slice(2)
const base = process.env.BASE_URL ?? 'http://localhost:5173'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
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
