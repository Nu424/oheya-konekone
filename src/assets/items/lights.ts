import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { boxOn, cyl, deg, group, lathe, sphere, tube } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

const WARM = '#ffd9a8'

/** Lamp shade. Built around the origin: top rim at y=0, opening downward. */
function shade(style: string, d: number, color: string) {
  const r = d / 2
  const outer = style === 'paper' ? mat('fabric', color, { side: THREE.DoubleSide, roughness: 0.95 }) : mat('plastic', color, { side: THREE.DoubleSide, roughness: 0.45 })
  const g = new THREE.Group()
  switch (style) {
    case 'globe': {
      const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: WARM, emissiveIntensity: 0.6, roughness: 0.5, transmission: 0, transparent: true, opacity: 0.92 })
      g.add(sphere(r, glass, [0, -r, 0], { segments: 40 }))
      break
    }
    case 'cone':
      g.add(lathe([[r * 0.18, 0], [r * 0.25, -r * 0.1], [r, -r * 0.9], [r * 0.98, -r * 0.92]], outer, [0, 0, 0], { segments: 48 }))
      break
    case 'paper': {
      // Ribbed paper lantern
      const pts: [number, number][] = []
      for (let i = 0; i <= 40; i++) {
        const t = i / 40
        const y = -t * d * 0.9
        const rib = 1 - 0.035 * Math.abs(Math.sin(t * Math.PI * 12))
        pts.push([Math.max(r * 0.2, Math.sin(t * Math.PI) * r) * rib, y])
      }
      const lantern = lathe(pts, mat('emissive', '#fff1dc', { intensity: 0.7, side: THREE.DoubleSide }), [0, 0, 0], { segments: 48 })
      g.add(lantern)
      break
    }
    default:
      // dome
      g.add(lathe([[r * 0.15, 0], [r * 0.5, -r * 0.08], [r * 0.85, -r * 0.3], [r, -r * 0.6], [r * 0.99, -r * 0.62]], outer, [0, 0, 0], { segments: 48 }))
  }
  if (style !== 'globe' && style !== 'paper') {
    g.add(sphere(Math.min(45, r * 0.35), mat('emissive', '#fff4e0', { intensity: 4 }), [0, -r * 0.4, 0], { segments: 20 }))
  }
  g.traverse((m) => {
    if (m instanceof THREE.Mesh && (m.material as THREE.MeshStandardMaterial).emissiveIntensity > 1) m.userData.noShadow = true
  })
  return g
}

export const pendantLight = defineAsset({
  type: 'pendantLight',
  label: 'ペンダントライト',
  category: 'light',
  description: '天井から吊るす照明。position yは無視され天井から吊るされる。x,zで位置を決める',
  placement: 'ceiling',
  contactShadow: false,
  params: {
    style: p.select('シェード', { dome: 'ドーム', globe: 'ガラス球', cone: 'コーン', paper: '提灯（和紙）' }, 'dome'),
    diameter: p.mm('直径', 200, 600, 350),
    drop: p.mm('吊り下げの長さ', 300, 1400, 800),
    color: p.color('シェードの色', '#f2efe9', { swatches: [...SWATCHES.paint, '#c9a86a', '#3d4a5c', '#9fb5a5'] }),
  },
  build({ style, diameter, drop, color }) {
    const g = group()
    g.add(cyl(55, 55, 25, mat('plastic', '#f2efe9'), [0, -12, 0]))
    g.add(cyl(3, 3, drop, mat('matte', '#2b2b2b'), [0, -drop / 2, 0]))
    const s = shade(style, diameter, color)
    s.position.y = -drop
    g.add(s)
    return g
  },
  lights: ({ drop, diameter }) => [{ position: [0, -drop - diameter * 0.4, 0], color: '#ffd9a8', intensity: 1.2, distance: 6000 }],
})

export const ceilingLight = defineAsset({
  type: 'ceilingLight',
  label: 'シーリングライト',
  category: 'light',
  description: '天井に直付けする丸い照明。日本の賃貸の定番',
  placement: 'ceiling',
  hideWithCeiling: true,
  contactShadow: false,
  params: {
    diameter: p.mm('直径', 400, 900, 600),
    frame: p.select('縁', { none: 'なし', wood: '木枠' }, 'none'),
    frameColor: p.color('縁の色', '#b8875a', { swatches: SWATCHES.wood }),
  },
  build({ diameter, frame, frameColor }) {
    const r = diameter / 2
    const g = group()
    g.add(lathe([[r * 0.9, 0], [r, -40], [r * 0.95, -95], [0.5, -110]], mat('emissive', '#fffaf2', { intensity: 1.4 }), [0, 0, 0], { segments: 64 }))
    if (frame === 'wood') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 16, 10, 64), mat('wood', frameColor))
      ring.rotation.x = Math.PI / 2
      ring.position.y = -45
      g.add(ring)
    }
    g.traverse((m) => (m.userData.noShadow = true))
    return g
  },
  lights: ({ diameter }) => [{ position: [0, -200, 0], color: '#fff3e2', intensity: 2, distance: 8000 + diameter }],
})

export const floorLamp = defineAsset({
  type: 'floorLamp',
  label: 'フロアランプ',
  category: 'light',
  description: '床置きの照明。スタンド・アーチ・三脚',
  placement: 'floor',
  params: {
    style: p.select('形', { stick: 'スタンド', arc: 'アーチ', tripod: '三脚' }, 'stick'),
    height: p.mm('高さ', 1000, 2000, 1500),
    shadeColor: p.color('シェード', '#f2ebe0', { swatches: [...SWATCHES.fabric] }),
    frameColor: p.color('フレーム', '#2b2b2b', { swatches: [...SWATCHES.metal, '#b8875a'] }),
  },
  build({ style, height: H, shadeColor, frameColor }) {
    const g = group()
    const fm = style === 'tripod' && frameColor === '#b8875a' ? mat('wood', frameColor) : mat('metal', frameColor, { roughness: 0.35 })
    const shadeM = mat('fabric', shadeColor, { side: THREE.DoubleSide })
    const bulb = mat('emissive', '#fff1dc', { intensity: 3 })
    const drum = (y: number, r: number, h: number) => {
      const s = new THREE.Group()
      s.add(cyl(r * 0.85, r, h, shadeM, [0, 0, 0], { open: true, segments: 40 }))
      const glow = sphere(r * 0.25, bulb, [0, -h * 0.1, 0], { segments: 16 })
      glow.userData.noShadow = true
      s.add(glow)
      s.position.y = y
      return s
    }
    if (style === 'stick') {
      g.add(cyl(140, 150, 25, fm, [0, 12, 0], { segments: 40 }))
      g.add(cyl(10, 10, H - 200, fm, [0, (H - 200) / 2, 0]))
      g.add(drum(H - 140, 190, 280))
    } else if (style === 'tripod') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2
        g.add(tube([[Math.cos(a) * 280, 0, Math.sin(a) * 280], [0, H - 320, 0]], 14, fm))
      }
      g.add(drum(H - 180, 230, 320))
    } else {
      g.add(boxOn(260, 60, 260, mat('ceramic', '#e9e4dc', { roughness: 0.3 }), 0, 0, -400))
      const reach = Math.min(1400, H * 0.8)
      g.add(tube([[0, 60, -400], [0, H * 0.75, -380], [0, H, -100], [0, H * 0.92, reach - 400]], 12, fm, { segments: 60, tension: 0.5 }))
      const sh = shade('dome', 380, frameColor === '#2b2b2b' ? '#2b2b2b' : '#d7d9dc')
      sh.position.set(0, H * 0.92 - 10, reach - 400)
      g.add(sh)
    }
    return g
  },
  lights: ({ style, height }) => [
    style === 'arc'
      ? { position: [0, height * 0.92 - 150, Math.min(1400, height * 0.8) - 400], color: '#ffd9a8', intensity: 0.8, distance: 4000 }
      : { position: [0, height - 200, 0], color: '#ffd9a8', intensity: 0.8, distance: 4000 },
  ],
})

export const deskLamp = defineAsset({
  type: 'deskLamp',
  label: 'デスクライト',
  category: 'light',
  description: '机の上に置くアーム式ライト。y=机の高さ',
  placement: 'onTop',
  elevation: 720,
  contactShadow: false,
  params: {
    color: p.color('色', '#2b2b2b', { swatches: ['#2b2b2b', '#f2efe9', '#e8835c', '#9fb5a5', '#d7d9dc'] }),
  },
  build({ color }) {
    const m = mat('metal', color, { roughness: 0.4 })
    const g = group(cyl(80, 90, 20, m, [0, 10, 0], { segments: 32 }))
    g.add(tube([[0, 20, 0], [0, 260, -60]], 8, m))
    g.add(tube([[0, 260, -60], [0, 380, 120]], 8, m))
    const head = shade('cone', 150, color)
    head.position.set(0, 400, 150)
    head.rotation.x = deg(25)
    g.add(head)
    return g
  },
})
