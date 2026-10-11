import * as THREE from 'three'
import { mat } from '../../three/materials'
import { box, boxOn, cyl, deg, group, lathe, panel, panelOn, tube } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

/** Small kitchen appliances that sit on racks, counters and shelves. */

const WHITES = ['#f4f4f2', '#e9e6df', '#2b2b2e', '#c9ccd0', '#c94a3c', '#9fb5a5']

export const microwave = defineAsset({
  type: 'microwave',
  label: '電子レンジ',
  category: 'kitchen',
  description: '電子レンジ・オーブンレンジ。レンジ台や棚の段、冷蔵庫の上に置く。上にも物を置ける',
  placement: 'onTop',
  params: {
    size: p.select('大きさ', { compact: '単機能 (17L)', oven: 'オーブンレンジ (26L)' }, 'compact', { group: 'サイズ' }),
    door: p.select('扉', { side: '横開き', drop: '縦開き（下に倒す）' }, 'side', { group: '形' }),
    open: p.number({ label: '扉の開き', min: 0, max: 1, step: 0.05, default: 0, group: '形' }),
    color: p.color('本体', '#f4f4f2', { swatches: WHITES }),
  },
  surfaces: ({ size }) => {
    const [W, , D] = microSize(size)
    return [{ y: microSize(size)[1], minX: -W / 2 + 15, maxX: W / 2 - 15, minZ: -D / 2 + 15, maxZ: D / 2 - 15, label: '天面' }]
  },
  build({ size, door, open, color }) {
    const [W, H, D] = microSize(size)
    const body = mat('powder', color)
    const dark = mat('plastic', '#1b1c1f', { roughness: 0.3 })
    const g = group()
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(10, 10, 8, mat('rubber', '#2a2a2a'), [sx * (W / 2 - 30), 4, sz * (D / 2 - 40)], { segments: 12 }))
    g.add(panelOn(W, H - 8, D - 20, body, 0, 8, -10, { edge: 6 }))
    // Front: door with a dark window on the left, control panel on the right.
    const panelW = Math.min(120, W * 0.24)
    const doorW = W - panelW - 6
    const dx = -W / 2 + doorW / 2 + 3
    g.add(panelOn(panelW - 6, H - 22, 6, dark, W / 2 - panelW / 2 - 3, 15, D / 2 - 20 + 3, { edge: 2 }))
    g.add(box(panelW * 0.6, 22, 1, mat('screen', '#0c0f12'), [W / 2 - panelW / 2 - 3, H - 50, D / 2 - 10.5]))
    g.add(box(panelW * 0.5, 14, 1, mat('emissive', '#7fd6a8', { intensity: 0.8 }), [W / 2 - panelW / 2 - 3, H - 50, D / 2 - 9.8]))
    for (let i = 0; i < 4; i++) g.add(panel(panelW * 0.55, 12, 4, mat('plastic', '#3a3b3e'), [W / 2 - panelW / 2 - 3, H * 0.6 - i * 24, D / 2 - 9], { edge: 2 }))
    g.add(cyl(18, 18, 8, mat('chrome', '#cfd2d5'), [W / 2 - panelW / 2 - 3, 50, D / 2 - 7], { rot: [Math.PI / 2, 0, 0], segments: 24 }))
    const leaf = new THREE.Group()
    const dh = H - 22
    leaf.add(panelOn(doorW, dh, 10, body, 0, 0, 5, { edge: 3 }))
    leaf.add(panelOn(doorW * 0.72, dh * 0.64, 2, mat('glass', '#14171b', { opacity: 0.85 }), -doorW * 0.06, dh * 0.18, 10.5, { edge: 2 }))
    // Handle: a vertical grip on side-opening doors, a bar on top for drop-down doors.
    if (door === 'side') leaf.add(panelOn(16, dh * 0.7, 14, body, doorW / 2 - 16, dh * 0.15, 14, { edge: 5 }))
    else leaf.add(panelOn(doorW * 0.7, 16, 14, body, 0, dh - 30, 14, { edge: 5 }))
    const pivot = new THREE.Group()
    if (door === 'side') {
      pivot.position.set(dx - doorW / 2, 15, D / 2 - 20)
      leaf.position.x = doorW / 2
      pivot.rotation.y = -deg(open * 95)
    } else {
      pivot.position.set(dx, 15, D / 2 - 20)
      pivot.rotation.x = deg(open * 88)
    }
    pivot.add(leaf)
    g.add(pivot)
    if (open > 0.05) {
      // The lit cavity and the turntable inside.
      g.add(boxOn(doorW - 30, dh - 30, D - 70, mat('matte', '#e8e6df'), dx, 30, -10))
      g.add(cyl(doorW * 0.32, doorW * 0.32, 4, mat('glass', '#cfe2ea', { opacity: 0.5 }), [dx, 36, -10], { segments: 32 }))
    }
    return g
  },
})

function microSize(size: string): [number, number, number] {
  return size === 'oven' ? [490, 345, 420] : [460, 280, 350]
}

export const riceCooker = defineAsset({
  type: 'riceCooker',
  label: '炊飯器',
  category: 'kitchen',
  description: '炊飯器。レンジ台や棚、キッチンのカウンターに置く',
  placement: 'onTop',
  surfaces: () => [],
  params: {
    size: p.select('大きさ', { small: '3合', medium: '5.5合' }, 'small', { group: 'サイズ' }),
    open: p.bool('フタを開ける', false),
    color: p.color('本体', '#f4f4f2', { swatches: WHITES }),
  },
  build({ size, open, color }) {
    const s = size === 'medium' ? 1.15 : 1
    const W = 250 * s
    const D = 300 * s
    const H = 200 * s
    const body = mat('plastic', color, { roughness: 0.32 })
    const g = group()
    // Rounded body: a lathe profile scaled into an oval.
    const shell = lathe(
      [
        [0, 0],
        [0.44, 0],
        [0.5, 0.06],
        [0.5, 0.8],
        [0.46, 0.92],
        [0, 0.92],
      ],
      body,
      [0, 0, 0],
      { segments: 40 },
    )
    shell.scale.set(W, H, D)
    g.add(shell)
    // Front control panel with a small display.
    // A flush control panel on the curved front, with a small display.
    g.add(panel(W * 0.34, H * 0.24, 6, mat('plastic', '#2b2b2e', { roughness: 0.3 }), [0, H * 0.5, D / 2 - 2.5], { edge: 3 }))
    g.add(box(W * 0.2, H * 0.07, 1, mat('emissive', '#ffb36b', { intensity: 0.6 }), [0, H * 0.53, D / 2 + 1]))
    for (const s of [-1, 0, 1]) g.add(cyl(5, 5, 2, mat('plastic', '#d9dcdf'), [s * 22, H * 0.43, D / 2 + 1], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
    // Lid with the release button; hinged at the back.
    const lid = new THREE.Group()
    const top = lathe(
      [
        [0, 0],
        [0.47, 0],
        [0.44, 0.06],
        [0.3, 0.1],
        [0, 0.11],
      ],
      body,
      [0, 0, 0],
      { segments: 40 },
    )
    top.scale.set(W, H, D)
    top.position.z = D / 2
    lid.add(top)
    lid.add(panel(W * 0.22, 14, 34, mat('plastic', '#d9dcdf'), [0, H * 0.04, D * 0.9], { edge: 6 }))
    lid.position.set(0, H * 0.92, -D / 2)
    lid.rotation.x = open ? -deg(80) : 0
    g.add(lid)
    if (open) g.add(cyl(W * 0.38, W * 0.38, 2, mat('ceramic', '#f7f4ec'), [0, H * 0.86, 0], { segments: 32 }))
    return g
  },
})

export const kettle = defineAsset({
  type: 'kettle',
  label: '電気ケトル',
  category: 'kitchen',
  description: '電気ケトル（台座つき）。カウンターや棚に置く',
  placement: 'onTop',
  surfaces: () => [],
  params: {
    style: p.select('形', { round: '丸い', slim: 'ドリップ（細口）' }, 'round', { group: '形' }),
    color: p.color('本体', '#2b2b2e', { swatches: [...WHITES, '#d7d9dc'] }),
  },
  build({ style, color }) {
    const g = group()
    const body = color === '#d7d9dc' ? mat('stainless', color) : mat('plastic', color, { roughness: 0.3 })
    g.add(cyl(88, 92, 18, mat('plastic', '#1f1f22', { roughness: 0.4 }), [0, 9, 0], { segments: 36 }))
    if (style === 'round') {
      g.add(
        lathe(
          [
            [0, 18],
            [78, 18],
            [84, 60],
            [80, 170],
            [64, 200],
            [0, 205],
          ],
          body,
          [0, 0, 0],
          { segments: 40 },
        ),
      )
      g.add(cyl(30, 30, 14, mat('plastic', '#3a3b3e'), [0, 205, 0], { segments: 24 }))
      // Handle on the back, spout at the front.
      g.add(tube([[0, 55, -78], [0, 62, -128], [0, 165, -128], [0, 182, -66]], 13, mat('plastic', '#1f1f22', { roughness: 0.35 }), { segments: 28, tension: 0.4 }))
      // Spout: a short tapered tube rising forward from the upper front.
      const spout = cyl(9, 20, 80, body, [0, 0, 0], { segments: 18 })
      spout.position.set(0, 168, 92)
      spout.rotation.x = deg(52)
      g.add(spout)
    } else {
      g.add(cyl(62, 66, 160, body, [0, 98, 0], { segments: 36 }))
      g.add(cyl(52, 62, 14, body, [0, 185, 0], { segments: 36 }))
      g.add(cyl(14, 14, 18, mat('wood', '#6b4a34'), [0, 200, 0], { segments: 16 }))
      g.add(tube([[0, 70, -60], [0, 80, -100], [0, 170, -100], [0, 180, -58]], 10, mat('wood', '#6b4a34'), { segments: 24, tension: 0.4 }))
      // Gooseneck spout.
      g.add(tube([[0, 40, 60], [0, 60, 110], [0, 140, 140], [0, 190, 175]], 6, body, { segments: 30, tension: 0.5 }))
    }
    return g
  },
})

export const toaster = defineAsset({
  type: 'toaster',
  label: 'トースター',
  category: 'kitchen',
  description: 'オーブントースター。レンジ台や棚、カウンターに置く。上にも物を置ける',
  placement: 'onTop',
  params: {
    color: p.color('本体', '#f4f4f2', { swatches: WHITES }),
  },
  surfaces: () => [{ y: 220, minX: -150, maxX: 150, minZ: -110, maxZ: 110, label: '天面' }],
  build({ color }) {
    const g = group()
    const body = mat('powder', color)
    g.add(panelOn(360, 212, 280, body, 0, 8, 0, { edge: 5 }))
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(8, 8, 8, mat('rubber', '#2a2a2a'), [sx * 150, 4, sz * 110], { segments: 12 }))
    g.add(panelOn(250, 150, 3, mat('glass', '#14171b', { opacity: 0.8 }), -40, 38, 141, { edge: 2 }))
    g.add(panelOn(230, 12, 14, mat('stainless', '#c9ccd0'), -40, 176, 148, { edge: 5 }))
    for (const y of [70, 130]) g.add(cyl(16, 16, 14, mat('plastic', '#2b2b2e'), [130, y, 146], { rot: [Math.PI / 2, 0, 0], segments: 20 }))
    return g
  },
})
