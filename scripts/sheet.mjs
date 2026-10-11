// Contact sheet: render several gallery views in one browser session and tile them into one PNG.
// Usage: node scripts/sheet.mjs shots/out.png [cols] <query> [<query>...]
//   query examples: "type=desk&only=1"   "type=shelf"   "types=a,b,c"
//   Each query is opened as /?gallery&<query>; with `&only=` the gallery shows one cell up close.
// Env: CELL=520x420 (size of each tile), WAIT=2500 (ms after the scene is ready), BASE_URL.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [out = 'shots/sheet.png', colsArg, ...queries] = process.argv.slice(2)
const cols = Number(colsArg) || 3
const [cw, ch] = (process.env.CELL ?? '520x420').split('x').map(Number)
const wait = Number(process.env.WAIT ?? 2500)
const base = process.env.BASE_URL ?? 'http://localhost:5173'
mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: cw, height: ch }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const shots = []
for (const q of queries) {
  await page.goto(`${base}/?gallery&${q}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__oheya?.ready === true, null, { timeout: 120000 }).catch(() => errors.push(`not ready: ${q}`))
  await page.waitForTimeout(wait)
  shots.push((await page.screenshot()).toString('base64'))
}
// Tile in a blank page with a canvas.
const rows = Math.ceil(shots.length / cols)
await page.setViewportSize({ width: cw * cols, height: ch * rows })
await page.goto('about:blank')
const data = await page.evaluate(
  async ({ shots, cols, cw, ch, labels }) => {
    const c = document.createElement('canvas')
    c.width = cw * cols
    c.height = ch * Math.ceil(shots.length / cols)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ddd'
    ctx.fillRect(0, 0, c.width, c.height)
    for (let i = 0; i < shots.length; i++) {
      const img = new Image()
      img.src = 'data:image/png;base64,' + shots[i]
      await img.decode()
      const x = (i % cols) * cw
      const y = Math.floor(i / cols) * ch
      ctx.drawImage(img, x, y)
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(x, y, cw, 18)
      ctx.fillStyle = '#fff'
      ctx.font = '12px sans-serif'
      ctx.fillText(labels[i], x + 6, y + 13)
      ctx.strokeStyle = '#999'
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1)
    }
    return c.toDataURL('image/png').split(',')[1]
  },
  { shots, cols, cw, ch, labels: queries },
)
const { writeFileSync } = await import('node:fs')
writeFileSync(out, Buffer.from(data, 'base64'))
await browser.close()
if (errors.length) console.log(errors.join('\n'))
console.log('saved', out)
