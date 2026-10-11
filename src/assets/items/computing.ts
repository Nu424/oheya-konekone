import * as THREE from 'three'
import { mat, printedMat } from '../../three/materials'
import { drawnTexture, rng } from '../../three/textures'
import { box, boxOn, cyl, deg, group, merged, panel, panelOn, roundedRect, extrude } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

/** What a screen shows. Shared by monitors, laptops and the TV. */
export const SCREEN_CONTENT = { off: '消灯', wallpaper: '壁紙', code: 'コード', doc: '文書', sheet: '表計算' } as const
export type ScreenContent = keyof typeof SCREEN_CONTENT

function screenTexture(kind: Exclude<ScreenContent, 'off'>, portrait: boolean) {
  const [w, h] = portrait ? [216, 384] : [384, 216]
  return drawnTexture(`screen-${kind}-${portrait ? 'p' : 'l'}`, w, h, (ctx) => {
    const r = rng(kind.length * 31 + (portrait ? 7 : 0))
    if (kind === 'wallpaper') {
      const g = ctx.createLinearGradient(0, 0, w, h)
      g.addColorStop(0, '#f3a37f')
      g.addColorStop(0.5, '#c97fa8')
      g.addColorStop(1, '#5f78c9')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.beginPath()
      ctx.arc(w * 0.74, h * 0.28, Math.min(w, h) * 0.13, 0, Math.PI * 2)
      ctx.fill()
      // Dock
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(w * 0.3, h - 14, w * 0.4, 9)
      return
    }
    const dark = kind === 'code'
    ctx.fillStyle = dark ? '#1e2128' : '#fbfbfa'
    ctx.fillRect(0, 0, w, h)
    // Title bar
    ctx.fillStyle = dark ? '#2b2f38' : '#e9e9e7'
    ctx.fillRect(0, 0, w, 14)
    if (kind === 'sheet') {
      ctx.strokeStyle = '#d9dcd8'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 34) ctx.strokeRect(x + 0.5, 14.5, 34, h)
      for (let y = 14; y < h; y += 11) ctx.strokeRect(0.5, y + 0.5, w, 11)
      ctx.fillStyle = '#5b8f62'
      for (let y = 28; y < h; y += 11) for (let x = 38; x < w; x += 34) if (r() < 0.6) ctx.fillRect(x, y - 6, 8 + r() * 20, 4)
      ctx.fillStyle = 'rgba(95,140,200,0.35)'
      ctx.fillRect(68, 47, 102, 33)
      return
    }
    const colors = dark ? ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#9aa0aa'] : ['#3b3f45']
    let y = 24
    while (y < h - 6) {
      let x = dark ? 10 + Math.floor(r() * 4) * 10 : 18
      const words = dark ? 1 + Math.floor(r() * 5) : 0
      if (dark) {
        for (let k = 0; k < words && x < w - 10; k++) {
          const len = 10 + r() * 40
          ctx.fillStyle = colors[Math.floor(r() * colors.length)]
          ctx.fillRect(x, y, len, 4)
          x += len + 6
        }
        y += 9
      } else {
        // Paragraphs of grey lines with an occasional heading.
        const heading = r() < 0.12
        ctx.fillStyle = heading ? '#20242a' : '#9aa0a8'
        ctx.fillRect(x, y, heading ? w * 0.35 : w - 36 - r() * w * 0.25, heading ? 6 : 3.5)
        y += heading ? 14 : r() < 0.15 ? 12 : 7
      }
    }
  })
}

/** A flat screen of w × h showing `content`. Faces +Z, centred on the origin. */
export function screenMesh(w: number, h: number, content: ScreenContent, portrait = false) {
  const m = content === 'off' ? mat('screen', '#0c0d10') : printedMat(`screen-${content}-${portrait ? 'p' : 'l'}`, screenTexture(content, portrait), 'screen')
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
  return mesh
}

const BLACKS = ['#1d1d20', '#2b2b2e', '#f2f2f0', '#c9ccd0', '#8e9196']

export const monitor = defineAsset({
  type: 'monitor',
  label: 'モニター',
  category: 'work',
  description: 'PC モニター 1 台。横置き・縦置き、スタンドかモニターアーム。机の上に置く（2 台なら 2 個置く）',
  placement: 'onTop',
  surfaces: () => [],
  contactShadow: false,
  params: {
    inches: p.number({ label: 'サイズ', min: 21, max: 34, step: 1, default: 24, unit: 'インチ', group: 'サイズ' }),
    aspect: p.select('比率', { wide: '16:9', ultrawide: 'ウルトラワイド (21:9)' }, 'wide', { group: '形' }),
    orientation: p.select('向き', { landscape: '横置き', portrait: '縦置き' }, 'landscape', { group: '形' }),
    stand: p.select('スタンド', { stand: '標準スタンド', arm: 'モニターアーム' }, 'stand', { group: '形' }),
    screen: p.select('画面', SCREEN_CONTENT, 'wallpaper'),
    color: p.color('本体', '#1d1d20', { swatches: BLACKS }),
  },
  presets: [
    { name: '縦置き（コード用）', params: { orientation: 'portrait', screen: 'code' } },
    { name: 'ウルトラワイド', params: { inches: 34, aspect: 'ultrawide' } },
    { name: 'アームで浮かせる', params: { stand: 'arm' } },
    { name: '白', params: { color: '#f2f2f0', screen: 'doc' } },
  ],
  build({ inches, aspect, orientation, stand, screen, color }) {
    const diag = inches * 25.4
    const ratio = aspect === 'ultrawide' ? 21 / 9 : 16 / 9
    const sh = diag / Math.sqrt(1 + ratio * ratio)
    const sw = sh * ratio
    const portrait = orientation === 'portrait'
    const body = mat('plastic', color, { roughness: 0.38 })
    const bezel = mat('plastic', color === '#f2f2f0' || color === '#c9ccd0' ? '#202024' : color, { roughness: 0.3 })
    // Panel: thin front with a slim bezel, a thicker housing at the back.
    const head = new THREE.Group()
    const pw = sw + 14
    const ph = sh + 22 // thicker chin at the bottom
    head.add(panel(pw, ph, 12, bezel, [0, -4, 0], { edge: 2 }))
    head.add(panel(pw * 0.72, ph * 0.66, 28, body, [0, -4 - ph * 0.08, -18], { edge: 8 }))
    head.add(panel(110, 110, 16, body, [0, -4 - ph * 0.1, -38], { edge: 4 }))
    // The screen is not part of `head`, which turns on its side in portrait: the picture stays upright.
    const sc = portrait ? screenMesh(sh, sw, screen as ScreenContent, true) : screenMesh(sw, sh, screen as ScreenContent)
    const face = new THREE.Group()
    sc.position.set(portrait ? -1 : 0, portrait ? 0 : 1, 6.2)
    face.add(sc)
    // A small logo bar on the chin and the power LED.
    head.add(box(26, 2, 1, mat('metal', '#9a9ea3'), [0, -ph / 2 - 1, 6.5]))
    head.add(box(3, 3, 1, mat('emissive', '#9fd3ff', { intensity: 1.5 }), [pw / 2 - 18, -ph / 2 - 0.5, 6.5]))
    if (portrait) head.rotation.z = Math.PI / 2
    const g = group()
    const halfH = portrait ? pw / 2 : ph / 2
    if (stand === 'stand') {
      // Base plate, neck, and the panel lifted so its lower edge clears the base.
      const baseW = portrait ? 230 : Math.min(300, sw * 0.5)
      g.add(extrude(roundedRect(baseW, 190, 24), 9, body, [0, 4.5, -40], { rot: [Math.PI / 2, 0, 0], bevel: 2 }))
      const lift = 90
      const neckH = lift + halfH - 30
      g.add(panelOn(54, neckH, 22, body, 0, 8, -82, { edge: 4 }))
      g.add(box(26, 30, 3, mat('matte', '#0e0e10'), [0, neckH * 0.3, -70.5])) // cable hole
      head.position.set(0, lift + halfH, -55)
      head.rotation.x = deg(-4)
    } else {
      // Desk clamp at the back edge, a pole and a two-part arm reaching forward to the panel.
      const alu = mat('aluminum', color === '#1d1d20' ? '#3a3b3e' : '#d7d9dc')
      g.add(panelOn(70, 60, 90, alu, 0, 0, -200, { edge: 3 }))
      g.add(cyl(18, 18, 380, alu, [0, 250, -200], { segments: 20 }))
      const arm1 = panel(46, 30, 230, alu, [0, 0, 0], { edge: 6 })
      arm1.position.set(0, 400, -100)
      arm1.rotation.x = deg(14)
      g.add(arm1)
      const arm2 = panel(40, 26, 200, alu, [0, 0, 0], { edge: 6 })
      arm2.position.set(0, 420, 0)
      arm2.rotation.x = deg(-12)
      g.add(arm2)
      head.position.set(0, 300 + halfH * 0.6, 120)
    }
    face.position.copy(head.position)
    face.rotation.x = head.rotation.x
    g.add(head, face)
    return g
  },
})

export const laptop = defineAsset({
  type: 'laptop',
  label: 'ノートPC',
  category: 'work',
  description: 'ノートパソコン。開く角度を変えられる。机の上に置く',
  placement: 'onTop',
  surfaces: () => [],
  contactShadow: false,
  params: {
    inches: p.number({ label: 'サイズ', min: 11, max: 17, step: 1, default: 14, unit: 'インチ', group: 'サイズ' }),
    open: p.number({ label: '開く角度', min: 0, max: 135, step: 5, default: 110, unit: '°', group: '形' }),
    screen: p.select('画面', SCREEN_CONTENT, 'doc'),
    color: p.color('本体', '#c9ccd0', { swatches: ['#c9ccd0', '#8e9196', '#2b2b2e', '#e6d7c7', '#cfd8e3'] }),
  },
  presets: [
    { name: '閉じている', params: { open: 0 } },
    { name: '黒・16インチ', params: { inches: 16, color: '#2b2b2e', screen: 'code' } },
  ],
  build({ inches, open, screen, color }) {
    const diag = inches * 25.4
    const sh = diag / Math.sqrt(1 + (16 / 10) ** 2)
    const sw = sh * 1.6
    const W = sw + 24
    const D = sh + 34
    const shell = mat('aluminum', color)
    const dark = mat('plastic', '#1a1a1c', { roughness: 0.5 })
    const g = group()
    // Base with a keyboard area and a trackpad.
    g.add(panelOn(W, 12, D, shell, 0, 0, 0, { edge: 3 }))
    g.add(boxOn(W * 0.86, 1, D * 0.42, dark, 0, 11.6, -D * 0.12))
    g.add(keycaps(W * 0.84, D * 0.4, 0, 12.2, -D * 0.12, shell, 13))
    g.add(panelOn(W * 0.36, 0.8, D * 0.28, mat('aluminum', color, { roughness: 0.25 }), 0, 11.8, D * 0.3, { edge: 1 }))
    // Lid hinged at the back edge.
    const lid = new THREE.Group()
    lid.add(panelOn(W, D - 6, 6, shell, 0, 0, -3, { edge: 2.5 }))
    const sc = screenMesh(sw, sh, open > 0 ? (screen as ScreenContent) : 'off')
    sc.position.set(0, (D - 6) / 2 + 4, 0.4)
    lid.add(sc)
    // Bezel around the screen.
    lid.add(boxOn(W - 4, D - 10, 0.3, mat('plastic', '#0f0f11', { roughness: 0.3 }), 0, 2, 0.1))
    lid.position.set(0, 12, -D / 2 + 3)
    // 90° is upright; 0 folds the lid flat onto the base, screen down.
    lid.rotation.x = Math.PI / 2 - deg(open)
    g.add(lid)
    return g
  },
})

/**
 * Key caps on a keyboard: one merged mesh of small boxes laid out in rows.
 * `cols` sets the number of keys in the widest row.
 */
function keycaps(w: number, d: number, x: number, y: number, z: number, material: THREE.Material, cols: number, rows = 5) {
  const pitch = w / cols
  const cap = pitch * 0.82
  const rowD = d / rows
  const meshes: THREE.Mesh[] = []
  for (let r = 0; r < rows; r++) {
    const zz = z - d / 2 + rowD * (r + 0.5)
    if (r === rows - 1) {
      // Bottom row: modifiers and a long space bar.
      const space = w * 0.42
      meshes.push(box(space, 2.2, rowD * 0.8, material, [x, y + 1.1, zz]))
      for (let k = 0; k < 3; k++) {
        meshes.push(box(cap * 1.2, 2.2, rowD * 0.8, material, [x - space / 2 - (k + 0.6) * pitch * 1.25, y + 1.1, zz]))
        meshes.push(box(cap * 1.2, 2.2, rowD * 0.8, material, [x + space / 2 + (k + 0.6) * pitch * 1.25, y + 1.1, zz]))
      }
      continue
    }
    const n = cols - (r === 0 ? 0 : r === 1 ? 1 : 2)
    const pw = w / n
    for (let k = 0; k < n; k++) meshes.push(box(pw * 0.82, 2.2, rowD * 0.8, material, [x - w / 2 + pw * (k + 0.5), y + 1.1, zz]))
  }
  return merged(meshes, material, { castShadow: false })
}

export const keyboardMouse = defineAsset({
  type: 'keyboardMouse',
  label: 'キーボード・マウス',
  category: 'work',
  description: 'キーボードとマウス（マウスパッド付きにもできる）。机の上に置く',
  placement: 'onTop',
  surfaces: () => [],
  contactShadow: false,
  params: {
    layout: p.select('キーボード', { full: 'フルサイズ', tenkeyless: 'テンキーなし', compact: 'コンパクト' }, 'tenkeyless'),
    mouse: p.bool('マウス', true),
    pad: p.select('マウスパッド', { none: 'なし', small: '小', desk: 'デスクマット' }, 'small'),
    color: p.color('キーボード', '#2b2b2e', { swatches: BLACKS }),
    padColor: p.color('マット', '#3d4a5c', { swatches: ['#2b2b2e', '#3d4a5c', '#8fa9bf', '#9fb59a', '#d9cbb4', '#c5687a'] }),
  },
  build({ layout, mouse, pad, color, padColor }) {
    const g = group()
    const kw = layout === 'full' ? 440 : layout === 'tenkeyless' ? 360 : 295
    const kd = layout === 'compact' ? 105 : 135
    const light = color === '#f2f2f0' || color === '#c9ccd0'
    const frame = mat('plastic', color, { roughness: 0.45 })
    const caps = mat('plastic', light ? '#fafaf8' : color === '#2b2b2e' ? '#3a3a3e' : color, { roughness: 0.6 })
    const padMat = mat('fabric', padColor, { roughness: 0.95 })
    let x0 = 0
    if (pad === 'desk') {
      g.add(panelOn(800, 3, 330, padMat, 60, 0, 0, { edge: 1.5 }))
    }
    const lift = pad === 'desk' ? 3 : 0
    const kb = new THREE.Group()
    kb.add(panelOn(kw, 16, kd, frame, 0, 0, 0, { edge: 3 }))
    kb.add(keycaps(kw - 18, kd - 18, 0, 16, 0, caps, layout === 'full' ? 21 : layout === 'tenkeyless' ? 17 : 14))
    kb.rotation.x = deg(-2)
    kb.position.set(x0, lift, 0)
    g.add(kb)
    x0 = kw / 2 + 110
    if (pad === 'small') g.add(panelOn(250, 3, 210, padMat, x0, 0, 10, { edge: 1.5 }))
    if (mouse) {
      const ms = new THREE.Group()
      const shell = mat('plastic', light ? '#f2f2f0' : '#26262a', { roughness: 0.35 })
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), shell)
      m.scale.set(32, 19, 58)
      m.position.y = 0
      m.castShadow = true
      ms.add(m)
      ms.add(cyl(4, 4, 10, mat('rubber', '#555'), [0, 17, -26], { rot: [0, 0, Math.PI / 2], segments: 12 }))
      ms.position.set(x0, lift + (pad === 'small' ? 3 : 0), 10)
      g.add(ms)
    }
    return g
  },
})

export const desktopPC = defineAsset({
  type: 'desktopPC',
  label: 'デスクトップPC',
  category: 'work',
  description: 'PC の本体。タワー型・小型・ミニ PC。床にも机の上にも置ける',
  placement: 'floor',
  params: {
    form: p.select('形', { tower: 'ミドルタワー', mini: 'ミニタワー', mini_pc: 'ミニ PC' }, 'tower'),
    glass: p.bool('ガラスの横板', true),
    glow: p.color('光の色', '#8ab4ff', { swatches: ['#8ab4ff', '#ff7ab6', '#7cf0c2', '#ffd36e', '#ffffff'] }),
    color: p.color('本体', '#1d1d20', { swatches: BLACKS }),
  },
  presets: [
    { name: '白いゲーミング', params: { color: '#f2f2f0', glow: '#ff7ab6' } },
    { name: '光らない', params: { glass: false } },
    { name: 'ミニ PC', params: { form: 'mini_pc' } },
  ],
  build({ form, glass, glow, color }) {
    const g = group()
    const body = mat('powder', color)
    const [W, H, D] = form === 'tower' ? [220, 470, 450] : form === 'mini' ? [190, 380, 390] : [120, 45, 120]
    if (form === 'mini_pc') {
      g.add(panelOn(W, H, D, mat('aluminum', color === '#1d1d20' ? '#4d5055' : '#c9ccd0'), 0, 0, 0, { edge: 6 }))
      g.add(box(W - 40, 1, 2, mat('matte', '#111'), [0, H * 0.35, D / 2 + 0.6]))
      g.add(cyl(3, 3, 1, mat('emissive', glow, { intensity: 2 }), [W / 2 - 16, H * 0.6, D / 2 + 0.6], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
      return g
    }
    const foot = 14
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(panelOn(30, foot, 50, mat('rubber', '#1f1f20'), sx * (W / 2 - 25), 0, sz * (D / 2 - 40), { edge: 3 }))
    // Shell: the right side, top, bottom and back are steel; the left side is glass (or steel) over
    // an open bay, so the parts inside can be seen.
    const bay = glass ? 26 : 0
    g.add(panelOn(W - bay, H, D, body, bay / 2, foot, 0, { edge: 3 }))
    if (glass) {
      for (const y of [foot, foot + H - 12]) g.add(panelOn(bay, 12, D, body, -W / 2 + bay / 2, y, 0, { edge: 2 }))
      for (const z of [-D / 2 + 6, D / 2 - 6]) g.add(panelOn(bay, H, 12, body, -W / 2 + bay / 2, foot, z, { edge: 2 }))
      g.add(boxOn(3, H - 20, D - 20, mat('glass', '#8a95a3', { opacity: 0.28 }), -W / 2 + 1.5, foot + 10, 0))
      const light = mat('emissive', glow, { intensity: 2.2 })
      const fanFrame = mat('plastic', '#1b1c1f', { roughness: 0.5 })
      for (const k of [0, 1]) {
        const y = foot + H * (0.66 - k * 0.3)
        const z = D / 2 - 80
        g.add(panel(4, 124, 124, fanFrame, [-W / 2 + bay - 2, y, z], { edge: 2 }))
        const ring = new THREE.Mesh(new THREE.TorusGeometry(52, 3.5, 8, 32), light)
        ring.position.set(-W / 2 + bay - 6, y, z)
        ring.rotation.y = Math.PI / 2
        g.add(ring)
        g.add(cyl(14, 14, 4, fanFrame, [-W / 2 + bay - 6, y, z], { rot: [0, 0, Math.PI / 2], segments: 16 }))
      }
      // Motherboard on the far wall of the bay, a graphics card across it, a glowing strip on top.
      g.add(boxOn(2, H * 0.62, D * 0.6, mat('matte', '#22252b'), -W / 2 + bay - 1, foot + H * 0.3, -D * 0.12))
      g.add(boxOn(bay - 6, 46, D * 0.58, mat('powder', '#2b2b2e'), -W / 2 + bay / 2 + 1, foot + H * 0.34, -D * 0.1))
      g.add(boxOn(1, 4, D * 0.56, light, -W / 2 + 5, foot + H * 0.34 + 40, -D * 0.1))
      g.add(boxOn(4, 5, D - 60, light, -W / 2 + bay - 4, foot + H - 30, 0))
    } else {
      g.add(boxOn(2, H * 0.3, D * 0.5, mat('matte', '#202022'), -W / 2 - 0.5, foot + H * 0.6, -D * 0.15))
    }
    // Front panel with a mesh intake and a power button.
    g.add(panelOn(W + 4, H - 6, 14, body, 0, foot + 3, D / 2, { edge: 4 }))
    g.add(panelOn(W - 50, H * 0.7, 2, mat('matte', '#202022'), 0, foot + H * 0.12, D / 2 + 7.5, { edge: 1 }))
    g.add(cyl(9, 9, 4, mat('chrome', '#d0d3d6'), [W / 2 - 34, foot + H - 40, D / 2 + 8], { rot: [Math.PI / 2, 0, 0], segments: 20 }))
    g.add(cyl(10, 10, 2, mat('emissive', glow, { intensity: 1.6 }), [W / 2 - 34, foot + H - 40, D / 2 + 7.5], { rot: [Math.PI / 2, 0, 0], segments: 20 }))
    return g
  },
})
