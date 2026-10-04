import * as THREE from 'three'
import { mat } from '../../three/materials'
import { HEADLESS } from '../../three/textures'
import { boxOn, cyl, deg, group, rbox } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

let screenMat: THREE.Material | undefined

/** Screen with a subtle bright wallpaper so it does not read as a black hole. */
function screen(w: number, h: number, on: boolean) {
  if (!on) return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat('screen', '#0c0d10'))
  if (screenMat) return new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat)
  if (HEADLESS) return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat('screen', '#0c0d10'))
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 144
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 256, 144)
  g.addColorStop(0, '#f3a37f')
  g.addColorStop(0.5, '#c97fa8')
  g.addColorStop(1, '#5f78c9')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 144)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.arc(190, 40, 26, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  screenMat = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.2 })
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat)
}

export const tv = defineAsset({
  type: 'tv',
  label: 'テレビ',
  category: 'av',
  description: '薄型テレビ。インチ数でサイズが変わる。テレビ台の上(y=テレビ台の高さ)に置く',
  placement: 'onTop',
  elevation: 400,
  contactShadow: false,
  params: {
    inches: p.number({ label: 'サイズ', min: 19, max: 75, step: 1, default: 43, unit: 'インチ', group: 'サイズ' }),
    stand: p.select('スタンド', { center: '中央', feet: '両端の脚', wall: '壁掛け' }, 'center'),
    on: p.bool('画面をつける', false),
  },
  build({ inches, stand, on }) {
    const diag = inches * 25.4
    const w = diag * 0.8716
    const h = diag * 0.4903
    const bezel = mat('plastic', '#141416', { roughness: 0.3 })
    const g = group()
    const lift = stand === 'wall' ? 0 : 70
    const panel = rbox(w + 16, h + 16, 45, 6, bezel, [0, lift + h / 2 + 8, 0])
    g.add(panel)
    const sc = screen(w, h, on)
    sc.position.set(0, lift + h / 2 + 8, 23)
    g.add(sc)
    if (stand === 'center') {
      g.add(rbox(Math.min(380, w * 0.35), 14, 220, 6, bezel, [0, 7, 30]))
      g.add(boxOn(70, lift, 30, bezel, 0, 0, -5))
    } else if (stand === 'feet') {
      for (const s of [-1, 1]) {
        const foot = boxOn(30, lift + 30, 200, bezel, s * (w / 2 - 80), 0, 20)
        foot.rotation.x = deg(-10)
        g.add(foot)
      }
    }
    return g
  },
})

export const monitor = defineAsset({
  type: 'monitor',
  label: 'モニター',
  category: 'work',
  description: 'PCモニター。デスクの上(y=デスクの高さ)に置く。2枚並べることもできる',
  placement: 'onTop',
  elevation: 720,
  contactShadow: false,
  params: {
    inches: p.number({ label: 'サイズ', min: 21, max: 34, step: 1, default: 24, unit: 'インチ', group: 'サイズ' }),
    count: p.number({ label: '枚数', min: 1, max: 2, step: 1, default: 1, group: '形' }),
    ultrawide: p.bool('ウルトラワイド', false),
    laptop: p.bool('ノートPCも置く', true),
    keyboard: p.bool('キーボード', true),
    color: p.color('色', '#1d1d20', { swatches: ['#1d1d20', '#f2efe9', '#a7aaae'] }),
    on: p.bool('画面をつける', true),
  },
  build({ inches, count, ultrawide, laptop, keyboard, color, on }) {
    const diag = inches * 25.4
    const ratio = ultrawide ? 21 / 9 : 16 / 9
    const h = diag / Math.sqrt(1 + ratio * ratio)
    const w = h * ratio
    const body = mat('plastic', color, { roughness: 0.35 })
    const g = group()
    const n = Math.round(count)
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : (i - 0.5) * (w + 20)
      const yaw = n === 1 ? 0 : (i === 0 ? 1 : -1) * deg(12)
      const m = new THREE.Group()
      const y0 = 110
      m.add(rbox(w + 14, h + 14, 22, 4, body, [0, y0 + h / 2, 0]))
      const sc = screen(w, h, on)
      sc.position.set(0, y0 + h / 2, 12)
      m.add(sc)
      m.add(boxOn(50, y0 + h / 2, 20, body, 0, 0, -30))
      m.add(rbox(220, 10, 180, 4, body, [0, 5, -20]))
      m.position.set(x, 0, -60)
      m.rotation.y = yaw
      g.add(m)
    }
    if (keyboard) {
      g.add(rbox(440, 22, 140, 6, mat('plastic', color === '#1d1d20' ? '#2b2b2e' : '#e7e7e7', { roughness: 0.5 }), [-40, 11, 180]))
      g.add(rbox(65, 30, 110, 25, mat('plastic', color, { roughness: 0.4 }), [260, 15, 190]))
    }
    if (laptop) {
      const lx = n === 1 ? -w / 2 - 230 : -w - 200
      const lm = mat('metal', '#c9ccd0', { roughness: 0.3 })
      const lap = new THREE.Group()
      lap.add(rbox(320, 16, 220, 5, lm, [0, 8, 0]))
      const lid = new THREE.Group()
      lid.add(rbox(320, 210, 8, 4, lm, [0, 105, 0]))
      const ls = screen(290, 180, on)
      ls.position.set(0, 105, 5)
      lid.add(ls)
      lid.position.set(0, 16, -110)
      lid.rotation.x = deg(-15)
      lap.add(lid)
      lap.position.set(lx, 0, 80)
      lap.rotation.y = deg(18)
      g.add(lap)
    }
    return g
  },
})

export const fridge = defineAsset({
  type: 'fridge',
  label: '冷蔵庫',
  category: 'appliance',
  description: '冷蔵庫。容量でサイズが変わる。一人暮らしなら150L前後の2ドアが定番',
  placement: 'floor',
  params: {
    capacity: p.select('容量', { mini: '小型 (90L)', small: '2ドア (150L)', medium: '3ドア (300L)', large: '大型 (450L)' }, 'small', { group: 'サイズ' }),
    color: p.color('色', '#f4f4f2', { swatches: ['#f4f4f2', '#2f2f31', '#c9ccd0', '#e9dccb', '#9fb5a5'] }),
    finish: p.select('仕上げ', { matte: 'マット', gloss: 'つや' }, 'matte', { group: '色・素材' }),
    magnets: p.bool('マグネット・メモ', true),
  },
  build({ capacity, color, finish, magnets }) {
    const dims = { mini: [480, 850, 530], small: [480, 1220, 580], medium: [600, 1680, 660], large: [685, 1820, 700] }[capacity]
    const [W, H, D] = dims
    const body = finish === 'gloss' ? mat('gloss', color) : mat('plastic', color, { roughness: 0.45 })
    const dark = mat('matte', '#2b2b2b')
    const g = group()
    g.add(rbox(W, H - 20, D - 30, 18, body, [0, (H - 20) / 2 + 20, -15]))
    g.add(boxOn(W - 40, 20, D - 60, dark, 0, 0, -10))
    // Door split(s)
    const splits = capacity === 'mini' ? [0.82] : capacity === 'small' ? [0.36] : capacity === 'medium' ? [0.28, 0.48] : [0.22, 0.4, 0.55]
    const doors = [0, ...splits, 1]
    for (let i = 0; i < doors.length - 1; i++) {
      const y0 = 20 + (H - 20) * doors[i]
      const y1 = 20 + (H - 20) * doors[i + 1]
      const dh = y1 - y0 - 6
      g.add(rbox(W - 4, dh, 30, 14, body, [0, y0 + 3 + dh / 2, D / 2 - 30]))
      // Recessed handle groove
      const top = i === doors.length - 2
      g.add(boxOn(10, Math.min(260, dh * 0.5), 14, mat('metal', '#b9bcc0', { roughness: 0.3 }), W / 2 - 40, top ? y0 + 40 : y1 - 40 - Math.min(260, dh * 0.5), D / 2 - 10))
    }
    if (magnets) {
      const y = 20 + (H - 20) * (splits[splits.length - 1] + (1 - splits[splits.length - 1]) * 0.55)
      g.add(boxOn(140, 180, 3, mat('matte', '#fff8e6'), -60, y, D / 2 + 2))
      g.add(cyl(14, 14, 10, mat('plastic', '#e8835c'), [-60, y + 170, D / 2 + 6], { rot: [Math.PI / 2, 0, 0] }))
      g.add(boxOn(90, 110, 3, mat('matte', '#dfe8ec'), 80, y - 60, D / 2 + 2))
      g.add(cyl(12, 12, 10, mat('plastic', '#5d7a8c'), [80, y + 40, D / 2 + 6], { rot: [Math.PI / 2, 0, 0] }))
    }
    return g
  },
})

export const washer = defineAsset({
  type: 'washer',
  label: '洗濯機',
  category: 'appliance',
  description: '洗濯機。縦型かドラム式。防水パンも付けられる',
  placement: 'floor',
  params: {
    kind: p.select('タイプ', { vertical: '縦型', drum: 'ドラム式' }, 'vertical'),
    pan: p.bool('防水パン', true),
    color: p.color('色', '#f4f4f2', { swatches: ['#f4f4f2', '#2f2f31', '#c9ccd0', '#e9dccb'] }),
  },
  build({ kind, pan, color }) {
    const body = mat('plastic', color, { roughness: 0.35 })
    const g = group()
    const base = pan ? 90 : 0
    if (pan) {
      g.add(rbox(640, 80, 640, 20, mat('plastic', '#eeeeee', { roughness: 0.4 }), [0, 40, 0]))
      g.add(boxOn(560, 10, 560, mat('plastic', '#d8d8d8'), 0, 80, 0))
    }
    if (kind === 'vertical') {
      const W = 565
      const H = 950
      const D = 560
      g.add(rbox(W, H, D, 25, body, [0, base + H / 2, 0]))
      // Lid with a window
      g.add(rbox(W - 40, 20, D - 160, 10, body, [0, base + H + 6, 40]))
      g.add(rbox(W - 160, 6, D - 280, 20, mat('glass', '#9fb8c8', { opacity: 0.6 }), [0, base + H + 18, 50]))
      // Control panel at the back
      g.add(rbox(W - 20, 70, 130, 15, body, [0, base + H + 20, -D / 2 + 70]))
      g.add(boxOn(160, 6, 60, mat('screen', '#20242a'), 0, base + H + 55, -D / 2 + 70))
    } else {
      const W = 600
      const H = 1020
      const D = 620
      g.add(rbox(W, H, D, 25, body, [0, base + H / 2, 0]))
      const door = new THREE.Mesh(new THREE.TorusGeometry(170, 32, 16, 48), mat('plastic', '#c9ccd0', { roughness: 0.25 }))
      door.position.set(0, base + H * 0.48, D / 2 + 10)
      door.castShadow = true
      g.add(door)
      g.add(cyl(150, 150, 10, mat('glass', '#7f98a8', { opacity: 0.7 }), [0, base + H * 0.48, D / 2 + 12], { rot: [Math.PI / 2, 0, 0] }))
      g.add(boxOn(W - 60, 70, 10, mat('screen', '#20242a'), 0, base + H - 120, D / 2 + 2))
      g.add(cyl(30, 30, 20, body, [W / 2 - 90, base + H - 85, D / 2 + 10], { rot: [Math.PI / 2, 0, 0] }))
    }
    return g
  },
})

export const aircon = defineAsset({
  type: 'aircon',
  label: 'エアコン',
  category: 'appliance',
  description: '壁掛けエアコン。壁に背面をつけ、position yは本体の下端（通常1900〜2000）',
  placement: 'wall',
  elevation: 1950,
  contactShadow: false,
  params: {
    width: p.mm('幅', 700, 950, 800),
    color: p.color('色', '#f6f5f2', { swatches: ['#f6f5f2', '#d7d9dc', '#2f2f31'] }),
  },
  build({ width: W, color }) {
    const body = mat('plastic', color, { roughness: 0.4 })
    const H = 290
    const D = 240
    const g = group()
    g.add(rbox(W, H, D, 40, body, [0, H / 2, 0]))
    g.add(boxOn(W - 60, 18, 8, mat('matte', '#3a3b3e'), 0, 40, D / 2 - 30))
    const flap = rbox(W - 80, 14, 80, 6, body, [0, 30, D / 2 - 40], { rot: [deg(20), 0, 0] })
    g.add(flap)
    g.add(cyl(5, 5, 4, mat('emissive', '#7fe0a8', { intensity: 3 }), [W / 2 - 60, 80, D / 2 + 1], { rot: [Math.PI / 2, 0, 0] }))
    return g
  },
})
