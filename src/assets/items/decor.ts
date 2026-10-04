import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { HEADLESS, rng } from '../../three/textures'
import { boxOn, cyl, deg, extrude, group, lathe, rbox, roundedRect, tube } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

// ---------------------------------------------------------------------------
// Rug

const rugTextures = new Map<string, THREE.Texture>()
function rugTexture(pattern: string, color: string, accent: string, round: boolean) {
  const key = `${pattern}|${color}|${accent}|${round}`
  let t = rugTextures.get(key)
  if (t) return t
  if (HEADLESS) return new THREE.Texture()
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = accent
  ctx.fillStyle = accent
  if (pattern === 'border') {
    ctx.lineWidth = 18
    if (round) {
      ctx.beginPath()
      ctx.arc(s / 2, s / 2, s / 2 - 40, 0, Math.PI * 2)
      ctx.stroke()
    } else ctx.strokeRect(36, 36, s - 72, s - 72)
    ctx.lineWidth = 5
    if (round) {
      ctx.beginPath()
      ctx.arc(s / 2, s / 2, s / 2 - 70, 0, Math.PI * 2)
      ctx.stroke()
    } else ctx.strokeRect(66, 66, s - 132, s - 132)
  } else if (pattern === 'stripe') {
    for (let i = 0; i < 9; i++) if (i % 2) ctx.fillRect(0, (s / 9) * i, s, s / 9)
  } else if (pattern === 'check') {
    ctx.globalAlpha = 0.55
    const n = 8
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) if ((i + j) % 2) ctx.fillRect((s / n) * i, (s / n) * j, s / n, s / n)
  } else if (pattern === 'kilim') {
    // Simple diamond motifs
    const n = 4
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const cx = (s / n) * (i + 0.5)
        const cy = (s / n) * (j + 0.5)
        const r = s / n / 2.6
        ctx.beginPath()
        ctx.moveTo(cx, cy - r)
        ctx.lineTo(cx + r, cy)
        ctx.lineTo(cx, cy + r)
        ctx.lineTo(cx - r, cy)
        ctx.closePath()
        ctx.lineWidth = 8
        ctx.stroke()
      }
    ctx.lineWidth = 14
    ctx.strokeRect(20, 20, s - 40, s - 40)
  }
  // Fibre noise
  const img = ctx.getImageData(0, 0, s, s)
  const r = rng(pattern.length * 31 + color.length)
  for (let i = 0; i < s * s; i++) {
    const k = 0.9 + r() * 0.18
    img.data[i * 4] *= k
    img.data[i * 4 + 1] *= k
    img.data[i * 4 + 2] *= k
  }
  ctx.putImageData(img, 0, 0)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  rugTextures.set(key, t)
  return t
}

export const rug = defineAsset({
  type: 'rug',
  label: 'ラグ',
  category: 'decor',
  description: '床に敷くラグ。家具の下に敷いてよい（重なってもOK）',
  placement: 'floor',
  contactShadow: false,
  params: {
    shape: p.select('形', { rect: '四角', round: '丸' }, 'rect'),
    width: p.mm('幅', 600, 3000, 1400),
    depth: p.mm('奥行き', 600, 3000, 2000, { hint: '丸の場合は幅＝直径' }),
    pattern: p.select('柄', { plain: '無地', border: 'ボーダー枠', stripe: 'ストライプ', check: 'チェック', kilim: 'キリム風' }, 'border'),
    pile: p.select('毛足', { flat: '薄手', shaggy: 'シャギー' }, 'flat'),
    color: p.color('ベース色', '#e7dfd2', { swatches: SWATCHES.fabric }),
    accent: p.color('柄の色', '#b9a58c', { swatches: SWATCHES.fabric }),
  },
  build({ shape, width, depth, pattern, pile, color, accent }) {
    const round = shape === 'round'
    const W = width
    const D = round ? width : depth
    const h = pile === 'shaggy' ? 28 : 10
    const tex = rugTexture(pattern, color, accent, round)
    const m = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 1,
      sheen: pile === 'shaggy' ? 1 : 0.5,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.3),
      sheenRoughness: 0.8,
    })
    const shapeGeo = round
      ? (() => {
          const s = new THREE.Shape()
          s.absarc(0, 0, W / 2, 0, Math.PI * 2, false)
          return s
        })()
      : roundedRect(W, D, 30)
    const mesh = extrude(shapeGeo, h, m, [0, h / 2, 0], { bevel: Math.min(4, h / 3), rot: [-Math.PI / 2, 0, 0] })
    // Remap UVs to 0..1 across the footprint so the pattern fits the rug.
    const uv = mesh.geometry.attributes.uv as THREE.BufferAttribute
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / D + 0.5)
    mesh.castShadow = false
    mesh.userData.noShadow = true
    return group(mesh)
  },
})

// ---------------------------------------------------------------------------
// Curtain

function pleatPanel(w: number, h: number, folds: number, depth: number, m: THREE.Material) {
  const segX = Math.max(24, Math.round(folds * 8))
  const geo = new THREE.PlaneGeometry(w, h, segX, 6)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const t = (x / w + 0.5) * folds * Math.PI * 2
    // Pleats are deeper at the hem, slightly flared.
    const amp = depth * (0.85 + 0.15 * (0.5 - y / h))
    pos.setZ(i, Math.sin(t) * amp)
  }
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, m)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export const curtain = defineAsset({
  type: 'curtain',
  label: 'カーテン',
  category: 'decor',
  description: '窓にかけるカーテンとレール。背面を窓のある壁につけ、position yはカーテンの下端（掃き出し窓なら10〜20、腰窓なら窓の下端-150くらい）',
  placement: 'wall',
  elevation: 15,
  contactShadow: false,
  params: {
    width: p.mm('幅（レール）', 800, 3600, 1900),
    height: p.mm('丈', 800, 2600, 2100),
    open: p.number({ label: '開き具合', min: 0, max: 100, step: 1, default: 70, unit: '%', group: '形' }),
    lace: p.bool('レースカーテン', true),
    color: p.color('ドレープの色', '#9fb5a5', { swatches: SWATCHES.fabric }),
  },
  presets: [
    { name: '閉じた状態', params: { open: 0 } },
    { name: '腰窓用', params: { width: 1800, height: 1350 } },
  ],
  build({ width: W, height: H, open, lace, color }) {
    const g = group()
    const fab = mat('fabric', color, { side: THREE.DoubleSide })
    const o = open / 100
    // Rail
    const rail = mat('metal', '#d7d9dc', { roughness: 0.35 })
    g.add(boxOn(W + 100, 30, 40, rail, 0, H + 20, -40))
    for (const s of [-1, 1]) g.add(boxOn(20, 40, 80, rail, s * (W / 2 + 40), H + 20, -70))
    // Drape panels: each covers half the rail when closed, gathered toward the sides when open.
    const half = W / 2 + 30
    const pw = Math.max(W * 0.11, half * (1 - o * 0.82))
    const folds = Math.max(3, Math.round(half / 160))
    const amp = 18 + (half / pw) * 14
    for (const s of [-1, 1]) {
      const panel = pleatPanel(pw, H, folds, Math.min(amp, 70), fab)
      panel.position.set(s * (W / 2 + 30 - pw / 2), H / 2, -15)
      g.add(panel)
    }
    if (lace) {
      const lm = mat('fabric', '#fbfaf6', { side: THREE.DoubleSide, roughness: 0.95 })
      const laceM = (lm as THREE.MeshPhysicalMaterial).clone()
      laceM.transparent = true
      laceM.opacity = 0.55
      laceM.depthWrite = false
      const lp = pleatPanel(W + 40, H - 30, Math.round(W / 110), 14, laceM)
      lp.position.set(0, H / 2 + 15, -55)
      lp.castShadow = false
      lp.userData.noShadow = true
      g.add(lp)
    }
    return g
  },
})

// ---------------------------------------------------------------------------
// Plants

function leafShape(len: number, wid: number, kind: 'heart' | 'oval' | 'sword' | 'split') {
  const s = new THREE.Shape()
  if (kind === 'sword') {
    s.moveTo(-wid / 2, 0)
    s.quadraticCurveTo(-wid / 2, len * 0.7, 0, len)
    s.quadraticCurveTo(wid / 2, len * 0.7, wid / 2, 0)
    s.closePath()
    return s
  }
  const lobe = kind === 'heart' || kind === 'split' ? wid * 0.15 : 0
  s.moveTo(0, lobe * 0.6)
  s.bezierCurveTo(-wid * 0.15, -lobe, -wid * 0.62, len * 0.05, -wid * 0.5, len * 0.45)
  s.bezierCurveTo(-wid * 0.4, len * 0.8, -wid * 0.1, len * 0.95, 0, len)
  s.bezierCurveTo(wid * 0.1, len * 0.95, wid * 0.4, len * 0.8, wid * 0.5, len * 0.45)
  s.bezierCurveTo(wid * 0.62, len * 0.05, wid * 0.15, -lobe, 0, lobe * 0.6)
  if (kind === 'split') {
    // Monstera fenestrations as holes
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const h = new THREE.Path()
        const y = len * (0.3 + i * 0.18)
        const x = side * wid * (0.22 + i * 0.02)
        h.absellipse(x, y, wid * 0.09, len * 0.035, 0, Math.PI * 2, false, side * 0.6)
        s.holes.push(h)
      }
  }
  return s
}

function leafMesh(shape: THREE.Shape, len: number, curl: number, m: THREE.Material) {
  const geo = new THREE.ShapeGeometry(shape, 10)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    // Fold along the midrib and droop toward the tip.
    pos.setZ(i, -Math.abs(x) * 0.25 - Math.pow(y / len, 2) * curl)
  }
  geo.computeVertexNormals()
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / len + 0.5, pos.getY(i) / len)
  const mesh = new THREE.Mesh(geo, m)
  mesh.castShadow = true
  return mesh
}

export const plant = defineAsset({
  type: 'plant',
  label: '観葉植物',
  category: 'decor',
  description: '鉢植えの観葉植物。種類と高さを変えられる',
  placement: 'floor',
  params: {
    kind: p.select('種類', { monstera: 'モンステラ', umbellata: 'ウンベラータ', sansevieria: 'サンスベリア', olive: 'オリーブ' }, 'monstera'),
    height: p.mm('高さ', 300, 1900, 900),
    potColor: p.color('鉢の色', '#e9e4dc', { swatches: ['#e9e4dc', '#c87f5c', '#2f2f31', '#8c8a86', '#b8875a', '#dfe8ec'] }),
    potStyle: p.select('鉢', { round: '丸', cylinder: '円筒', basket: 'バスケット' }, 'round'),
  },
  presets: [
    { name: '小さめ', params: { height: 450, kind: 'sansevieria', potColor: '#c87f5c' } },
    { name: '大きめ', params: { height: 1700, kind: 'umbellata', potStyle: 'basket' } },
  ],
  build({ kind, height: H, potColor, potStyle }) {
    const g = group()
    const r = rng(kind.length * 97 + Math.round(H))
    const potH = Math.max(150, Math.min(380, H * 0.28))
    const potR = potH * 0.62
    const pm = potStyle === 'basket' ? mat('fabric', '#c8b08a', { roughness: 1 }) : mat('ceramic', potColor, { roughness: 0.5 })
    if (potStyle === 'cylinder') g.add(cyl(potR, potR, potH, pm, [0, potH / 2, 0], { segments: 40 }))
    else if (potStyle === 'basket') {
      g.add(cyl(potR * 1.05, potR * 0.9, potH, pm, [0, potH / 2, 0], { segments: 40 }))
      const band = new THREE.Mesh(new THREE.TorusGeometry(potR * 1.05, 10, 6, 40), mat('fabric', '#a68a64'))
      band.rotation.x = Math.PI / 2
      band.position.y = potH
      g.add(band)
    } else
      g.add(
        lathe(
          [
            [potR * 0.6, 0],
            [potR * 0.95, potH * 0.35],
            [potR, potH * 0.8],
            [potR * 0.93, potH],
            [potR * 0.88, potH * 0.98],
          ],
          pm,
          [0, 0, 0],
          { segments: 40 },
        ),
      )
    g.add(cyl(potR * 0.88, potR * 0.88, 10, mat('matte', '#4a3a2c', { roughness: 1 }), [0, potH - 15, 0]))

    const leafGreen = kind === 'olive' ? '#7f9a6a' : kind === 'sansevieria' ? '#4f6e45' : '#3f6b3a'
    const lm = mat('leaf', leafGreen)
    const stemM = mat('matte', kind === 'umbellata' || kind === 'olive' ? '#7a634d' : '#4f6e3a')
    const top = H - potH

    if (kind === 'sansevieria') {
      const n = 9
      for (let i = 0; i < n; i++) {
        const len = top * (0.6 + r() * 0.4)
        const leaf = leafMesh(leafShape(len, 70 + r() * 30, 'sword'), len, 30, mat('leaf', i % 3 ? '#4f6e45' : '#6f8c4a'))
        const a = (i / n) * Math.PI * 2 + r()
        leaf.position.set(Math.cos(a) * 40, potH - 10, Math.sin(a) * 40)
        leaf.rotation.set(0, -a + Math.PI / 2, 0)
        leaf.rotateX(-deg(6 + r() * 8))
        g.add(leaf)
      }
      return g
    }

    if (kind === 'monstera') {
      const n = Math.max(5, Math.round(top / 110))
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.6
        const reach = top * (0.35 + r() * 0.35)
        const stemTop: [number, number, number] = [Math.cos(a) * reach * 0.6, potH + top * (0.45 + r() * 0.45), Math.sin(a) * reach * 0.6]
        g.add(tube([[0, potH - 10, 0], [stemTop[0] * 0.4, (potH + stemTop[1]) / 2, stemTop[2] * 0.4], stemTop], 7, stemM))
        const len = Math.min(420, top * 0.45) * (0.7 + r() * 0.4)
        const leaf = leafMesh(leafShape(len, len * 0.95, len > 200 ? 'split' : 'heart'), len, len * 0.3, lm)
        leaf.position.set(...stemTop)
        leaf.rotation.order = 'YXZ'
        leaf.rotation.set(-deg(55 + r() * 25), -a + Math.PI / 2, 0)
        g.add(leaf)
      }
      return g
    }

    // Tree types: trunk + leaves clustered at the top
    const trunkTop = potH + top * 0.55
    g.add(tube([[0, potH - 10, 0], [20, potH + top * 0.25, -10], [-10, trunkTop, 15]], kind === 'olive' ? 10 : 14, stemM))
    const crownY = potH + top * 0.72
    const crownR = top * (kind === 'olive' ? 0.28 : 0.32)
    const n = kind === 'olive' ? 70 : Math.max(16, Math.round(top / 45))
    for (let i = 0; i < n; i++) {
      const u = r()
      const v = r()
      const th = u * Math.PI * 2
      const ph = Math.acos(2 * v - 1)
      const rr = crownR * (0.55 + r() * 0.45)
      const pos: [number, number, number] = [Math.sin(ph) * Math.cos(th) * rr, crownY + Math.cos(ph) * rr * 0.75, Math.sin(ph) * Math.sin(th) * rr]
      const len = kind === 'olive' ? 70 + r() * 20 : Math.min(320, top * 0.24) * (0.7 + r() * 0.4)
      const leaf = leafMesh(leafShape(len, kind === 'olive' ? len * 0.25 : len * 0.95, kind === 'olive' ? 'oval' : 'heart'), len, len * 0.2, lm)
      leaf.position.set(...pos)
      leaf.lookAt(pos[0] * 3, pos[1] + crownR, pos[2] * 3)
      leaf.rotateX(deg(70))
      g.add(leaf)
      if (kind === 'umbellata' && i % 2 === 0) g.add(tube([[0, trunkTop - 40, 0], [pos[0] * 0.6, (trunkTop + pos[1]) / 2, pos[2] * 0.6], pos], 5, stemM))
    }
    return g
  },
})

// ---------------------------------------------------------------------------
// Mirror, trash can, cushion

let mirrorMat: THREE.Material | undefined
/** Fake reflection: a soft gradient of wall and floor tones plus real env reflections on top. */
function mirrorMaterial() {
  if (mirrorMat) return mirrorMat
  if (HEADLESS) return new THREE.MeshStandardMaterial()
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, '#d9dde0')
  g.addColorStop(0.55, '#e8e4dd')
  g.addColorStop(0.7, '#c9b49a')
  g.addColorStop(1, '#a88a6a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  mirrorMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 })
  return mirrorMat
}

export const mirror = defineAsset({
  type: 'mirror',
  label: '姿見',
  category: 'decor',
  description: '全身が映る鏡。壁に立てかけるかスタンド式',
  placement: 'floor',
  params: {
    width: p.mm('幅', 300, 900, 450),
    height: p.mm('高さ', 1000, 1900, 1500),
    style: p.select('置き方', { lean: '立てかけ', stand: 'スタンド' }, 'lean'),
    frame: p.select('フレーム', { thin: '細い', wide: '太い', none: 'なし' }, 'thin'),
    frameColor: p.color('フレームの色', '#b8875a', { swatches: [...SWATCHES.wood, ...SWATCHES.metal] }),
  },
  build({ width: W, height: H, style, frame, frameColor }) {
    const g = group()
    const fw = frame === 'none' ? 0 : frame === 'thin' ? 25 : 60
    const fm = mat('wood', frameColor)
    const glass = mirrorMaterial()
    const m = new THREE.Group()
    if (fw > 0) m.add(extrude(roundedRect(W, H, frame === 'wide' ? 20 : 8), 30, fm, [0, H / 2, 0]))
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(W - fw * 2, H - fw * 2), glass)
    pane.position.set(0, H / 2, 16)
    m.add(pane)
    if (style === 'lean') {
      m.rotation.x = -deg(8)
      m.position.z = H * Math.sin(deg(8)) * 0.5 - 40
      g.add(m)
    } else {
      m.position.y = 60
      g.add(m)
      for (const s of [-1, 1]) {
        const leg = boxOn(25, H * 0.5, 25, fm, s * (W / 2 - 40), 0, -120)
        leg.rotation.x = deg(-12)
        g.add(leg)
      }
    }
    return g
  },
})

export const trashCan = defineAsset({
  type: 'trashCan',
  label: 'ゴミ箱',
  category: 'decor',
  description: 'ゴミ箱',
  placement: 'floor',
  params: {
    shape: p.select('形', { round: '丸', square: '角', slim: 'スリム（分別）' }, 'round'),
    height: p.mm('高さ', 250, 700, 380),
    lid: p.bool('フタ', true),
    color: p.color('色', '#f2efe9', { swatches: ['#f2efe9', '#2f2f31', '#c9ccd0', '#b8875a', '#9fb5a5', '#e8c76a'] }),
  },
  build({ shape, height: H, lid, color }) {
    const g = group()
    const m = mat('plastic', color, { roughness: 0.35 })
    const bodyH = lid ? H - 30 : H
    if (shape === 'round') {
      g.add(cyl(130, 110, bodyH, m, [0, bodyH / 2, 0], { open: !lid, segments: 40 }))
      if (lid) g.add(cyl(135, 135, 30, m, [0, bodyH + 15, 0], { segments: 40 }))
      else g.add(cyl(110, 110, 4, mat('matte', '#3b3633'), [0, bodyH - 30, 0]))
    } else {
      const w = shape === 'slim' ? 200 : 260
      const d = shape === 'slim' ? 400 : 260
      g.add(rbox(w, bodyH, d, 20, m, [0, bodyH / 2, 0]))
      if (lid) {
        g.add(rbox(w + 6, 30, d + 6, 15, m, [0, bodyH + 15, 0]))
        g.add(boxOn(60, 10, 20, mat('matte', '#3b3633'), 0, bodyH + 30, d / 2 - 30))
      }
    }
    return g
  },
})

export const cushion = defineAsset({
  type: 'cushion',
  label: 'クッション',
  category: 'decor',
  description: '床やソファに置くクッション・座布団',
  placement: 'floor',
  params: {
    kind: p.select('種類', { square: '四角クッション', zabuton: '座布団', round: '丸クッション' }, 'zabuton'),
    size: p.mm('大きさ', 350, 650, 550),
    color: p.color('色', '#e8c76a', { swatches: SWATCHES.fabric }),
  },
  build({ kind, size, color }) {
    const m = mat('fabric', color)
    if (kind === 'round') return group(cyl(size / 2, size / 2, 120, m, [0, 60, 0], { segments: 40 }))
    if (kind === 'square') return group(rbox(size, size * 0.3, size, size * 0.14, m, [0, size * 0.15, 0]))
    return group(rbox(size, 70, size * 1.06, 32, m, [0, 35, 0]))
  },
})
