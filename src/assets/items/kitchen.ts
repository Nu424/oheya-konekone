import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { cyl, group, lathe, merged, panelOn, rbox, tube } from '../kit'
import { p } from '../params'
import { hollowCylinder } from '../parts'
import { defineAsset } from '../types'

export const miniKitchen = defineAsset({
  type: 'miniKitchen',
  label: 'ミニキッチン',
  category: 'kitchen',
  description: '1K/ワンルームによくある備え付けキッチン。シンク・コンロ・吊り戸棚。背面を壁につけて置く（locked推奨）',
  placement: 'floor',
  surfaces: ({ width: W, depth: D, upper }) => [{ y: 850, minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2, label: 'カウンター', ...(upper ? { clearance: 690 } : {}) }],
  params: {
    width: p.mm('幅', 900, 2400, 1500),
    depth: p.mm('奥行き', 450, 650, 550),
    stove: p.select('コンロ', { ih1: 'IH 1口', ih2: 'IH 2口', gas2: 'ガス 2口', none: 'なし' }, 'ih1'),
    sinkSide: p.select('シンクの位置', { left: '左', right: '右' }, 'left'),
    upper: p.bool('吊り戸棚', true),
    color: p.color('扉の色', '#f2efe9', { swatches: [...SWATCHES.paint, '#d2ad7c', '#6b4a34'] }),
    fridgeSpace: p.bool('下に小型冷蔵庫', false),
  },
  presets: [
    { name: 'コンパクト', params: { width: 1000, stove: 'ih1', depth: 500 } },
    { name: '2口コンロ', params: { width: 1800, stove: 'gas2', color: '#d2ad7c' } },
  ],
  build({ width: W, depth: D, stove, sinkSide, upper, color, fridgeSpace }) {
    const g = group()
    const H = 850
    const door = mat('matte', color, { roughness: 0.5 })
    const steel = mat('metal', '#d9dcdf', { roughness: 0.28 })
    const toe = 80
    const counterT = 30
    const cabH = H - counterT - toe
    g.add(panelOn(W - 40, toe, D - 60, mat('matte', '#3b3633'), 0, 0, -10))
    g.add(panelOn(W, cabH, D - 20, door, 0, toe, -10))

    // Layout along the counter: sink ~ 600, stove ~ 400 (1口) / 600 (2口), rest is worktop.
    const sinkW = Math.min(600, W * 0.42)
    const stoveW = stove === 'none' ? 0 : stove === 'ih1' ? 330 : Math.min(600, W * 0.4)
    const sx = sinkSide === 'left' ? -1 : 1
    const sinkX = sx * (W / 2 - 60 - sinkW / 2)
    const stoveX = -sx * (W / 2 - 50 - stoveW / 2)

    // Counter with the sink cut out: two pieces either side plus front/back strips.
    const top = H - counterT
    const cutL = sinkX - sinkW / 2
    const cutR = sinkX + sinkW / 2
    const sinkD = D - 200
    if (cutL > -W / 2) g.add(panelOn(cutL + W / 2, counterT, D, steel, (-W / 2 + cutL) / 2, top, 0))
    if (cutR < W / 2) g.add(panelOn(W / 2 - cutR, counterT, D, steel, (cutR + W / 2) / 2, top, 0))
    g.add(panelOn(sinkW, counterT, (D - sinkD) / 2 + 40, steel, sinkX, top, D / 2 - ((D - sinkD) / 2 + 40) / 2))
    g.add(panelOn(sinkW, counterT, (D - sinkD) / 2 - 40, steel, sinkX, top, -D / 2 + ((D - sinkD) / 2 - 40) / 2))
    // Sink basin
    const basin = mat('metal', '#bfc3c7', { roughness: 0.35 })
    g.add(panelOn(sinkW, 8, sinkD, basin, sinkX, top - 180, 40 - 0))
    for (const s of [-1, 1]) {
      g.add(panelOn(6, 180, sinkD, basin, sinkX + s * (sinkW / 2 - 3), top - 180, 40))
    }
    g.add(panelOn(sinkW, 180, 6, basin, sinkX, top - 180, 40 + sinkD / 2 - 3))
    g.add(panelOn(sinkW, 180, 6, basin, sinkX, top - 180, 40 - sinkD / 2 + 3))
    // Faucet
    g.add(cyl(18, 22, 40, steel, [sinkX, H + 20, -D / 2 + 70]))
    g.add(tube([[sinkX, H + 30, -D / 2 + 70], [sinkX, H + 260, -D / 2 + 80], [sinkX, H + 280, -D / 2 + 180], [sinkX, H + 200, -D / 2 + 230]], 12, steel))
    g.add(panelOn(20, 20, 90, steel, sinkX + 40, H + 30, -D / 2 + 80))

    // Stove
    if (stove === 'ih1' || stove === 'ih2') {
      const glass = mat('gloss', '#18191b', { roughness: 0.08 })
      g.add(rbox(stoveW, 10, D - 120, 6, glass, [stoveX, H + 5, 0]))
      const n = stove === 'ih1' ? 1 : 2
      for (let i = 0; i < n; i++) {
        const x = stoveX + (n === 1 ? 0 : (i - 0.5) * stoveW * 0.5)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(85, 3, 6, 40), mat('matte', '#6a6d72'))
        ring.rotation.x = Math.PI / 2
        ring.position.set(x, H + 11, -20)
        g.add(ring)
      }
    } else if (stove === 'gas2') {
      g.add(rbox(stoveW, 60, D - 80, 8, mat('metal', '#2b2b2b', { roughness: 0.45 }), [stoveX, H + 30, 0]))
      for (const dx of [-1, 1]) {
        const x = stoveX + dx * stoveW * 0.25
        g.add(cyl(45, 50, 25, mat('metal', '#3a3b3e'), [x, H + 72, -20]))
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2
          const bar = panelOn(150, 12, 14, mat('metal', '#1d1d1d'), x, H + 70, -20)
          bar.rotation.y = a
          g.add(bar)
        }
      }
    }

    // Door seams and handles
    const doorsN = Math.max(2, Math.round(W / 450))
    const dw = W / doorsN
    for (let i = 0; i < doorsN; i++) {
      const x = -W / 2 + dw * (i + 0.5)
      if (fridgeSpace && i === doorsN - 1) {
        g.add(rbox(dw - 20, cabH - 20, 20, 8, mat('plastic', '#f4f4f2'), [x, toe + cabH / 2, D / 2 - 18]))
        continue
      }
      g.add(panelOn(dw - 8, cabH - 10, 16, door, x, toe + 5, D / 2 - 22))
      g.add(panelOn(Math.min(140, dw * 0.4), 12, 14, steel, x, toe + cabH - 50, D / 2 - 8))
    }

    if (upper) {
      // Wall cabinet + range hood
      const uy = 1500
      const uh = 600
      const ud = 330
      g.add(panelOn(W, uh, ud, door, 0, uy + 200, -D / 2 + ud / 2))
      for (let i = 0; i < doorsN; i++) g.add(panelOn(W / doorsN - 8, uh - 10, 6, door, -W / 2 + (W / doorsN) * (i + 0.5), uy + 205, -D / 2 + ud + 2))
      if (stove !== 'none') {
        g.add(panelOn(Math.max(stoveW + 100, 500), 160, 450, mat('metal', '#d9dcdf', { roughness: 0.3 }), stoveX, uy + 40, -D / 2 + 225))
        g.add(panelOn(Math.max(stoveW + 60, 460), 6, 400, mat('emissive', '#fff3dc', { intensity: 0.6 }), stoveX, uy + 36, -D / 2 + 225))
      }
      // Backsplash
      g.add(panelOn(W, uy + 200 - H, 10, mat('ceramic', '#f6f4f0'), 0, H, -D / 2 + 5))
    }
    return g
  },
})

const PLATES = ['#f7f5f0', '#eae4d8', '#c9d6df', '#d8a48f', '#9fb59a', '#2f3a45']

export const dishRack = defineAsset({
  type: 'dishRack',
  label: '水切りかご',
  category: 'kitchen',
  description: '洗った食器を立てておくワイヤーのかごと水受けトレー。シンク横やカウンターに置く',
  placement: 'onTop',
  surfaces: () => [],
  params: {
    width: p.mm('幅', 300, 560, 420),
    depth: p.mm('奥行き', 240, 400, 300),
    tiers: p.number({ label: '段数', min: 1, max: 2, step: 1, default: 1, group: '形' }),
    material: p.select('材質', { stainless: 'ステンレス', white: '白い樹脂コート', black: '黒い樹脂コート' }, 'stainless', { group: '色・素材' }),
    tray: p.bool('水受けトレー', true),
    cutlery: p.bool('はし立て', true),
    dishes: p.number({ label: '食器の数', min: 0, max: 10, step: 1, default: 5, group: '形' }),
  },
  presets: [
    { name: 'スリム', params: { width: 320, depth: 260, dishes: 3 } },
    { name: '2 段（白）', params: { tiers: 2, material: 'white', width: 450, dishes: 7 } },
    { name: '空っぽ', params: { dishes: 0 } },
  ],
  build({ width: W, depth: D, tiers, material, tray, cutlery, dishes }) {
    const g = group()
    const wire = material === 'stainless' ? mat('stainless', '#d4d7da') : mat('plastic', material === 'white' ? '#f2f2ef' : '#2b2b2e', { roughness: 0.4 })
    const wires: THREE.Mesh[] = []
    const r = 2
    const trayH = tray ? 22 : 0
    if (tray) {
      // Shallow tray with a spout at the front left.
      const tm = mat('plastic', material === 'black' ? '#3a3b3e' : '#f4f4f2', { roughness: 0.35 })
      g.add(panelOn(W + 20, 3, D + 20, tm, 0, 0, 0, { edge: 1.5 }))
      for (const s of [-1, 1]) {
        g.add(panelOn(W + 20, trayH, 3, tm, 0, 0, s * (D / 2 + 8.5), { edge: 1 }))
        g.add(panelOn(3, trayH, D + 20, tm, s * (W / 2 + 8.5), 0, 0, { edge: 1 }))
      }
      g.add(panelOn(40, 6, 30, tm, -W / 2 + 40, trayH - 8, D / 2 + 22, { edge: 1.5 }))
    }
    const bar = (a: [number, number, number], b: [number, number, number], rr = r) => {
      const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, dir.length(), 6), wire)
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
      wires.push(m)
    }
    const y0 = trayH + 18
    const H = 120
    // Feet, floor grid, rims and uprights of the basket.
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) bar([x * (W / 2 - 15), trayH, z * (D / 2 - 15)], [x * (W / 2 - 15), y0, z * (D / 2 - 15)], 3)
    for (let x = -W / 2; x <= W / 2 + 0.1; x += W / Math.round(W / 22)) bar([x, y0, -D / 2], [x, y0, D / 2])
    for (const z of [-D / 2, -D / 6, D / 6, D / 2]) bar([-W / 2, y0, z], [W / 2, y0, z])
    for (const y of [y0 + H * 0.5, y0 + H]) {
      for (const z of [-D / 2, D / 2]) bar([-W / 2, y, z], [W / 2, y, z], 2.5)
      for (const x of [-W / 2, W / 2]) bar([x, y, -D / 2], [x, y, D / 2], 2.5)
    }
    for (let x = -W / 2; x <= W / 2 + 0.1; x += W / Math.round(W / 40)) for (const z of [-D / 2, D / 2]) bar([x, y0, z], [x, y0 + H, z], 1.6)
    for (let z = -D / 2; z <= D / 2 + 0.1; z += D / Math.round(D / 40)) for (const x of [-W / 2, W / 2]) bar([x, y0, z], [x, y0 + H, z], 1.6)
    // Plate dividers: a row of wire hoops across the back half.
    const slots = Math.max(4, Math.round((W - 120) / 28))
    const slotX = (i: number) => -W / 2 + 30 + ((W - 140) * i) / (slots - 1)
    for (let i = 0; i < slots; i++) {
      const x = slotX(i)
      bar([x, y0, -D / 2 + 20], [x, y0 + 90, -D / 2 + 30], 1.8)
      bar([x, y0 + 90, -D / 2 + 30], [x, y0 + 90, -D / 8], 1.8)
      bar([x, y0 + 90, -D / 8], [x, y0, -D / 8 + 10], 1.8)
    }
    let top = y0 + H
    if (tiers >= 2) {
      // Upper rack on four posts for cups and small bowls.
      const y1 = y0 + H + 110
      for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) bar([x, y0 + H, z], [x, y1, z], 3)
      for (let x = -W / 2; x <= W / 2 + 0.1; x += W / Math.round(W / 25)) bar([x, y1, -D / 2], [x, y1, D / 2])
      for (const z of [-D / 2, D / 2]) bar([-W / 2, y1 + 25, z], [W / 2, y1 + 25, z], 2.5)
      for (const x of [-W / 2, W / 2]) bar([x, y1 + 25, -D / 2], [x, y1 + 25, D / 2], 2.5)
      top = y1
    }
    g.add(merged(wires, wire))
    if (cutlery) {
      const cm = mat('plastic', material === 'black' ? '#3a3b3e' : '#f4f4f2', { roughness: 0.35 })
      const holder = hollowCylinder(32, 110, 3, cm, { segments: 24 })
      holder.position.set(W / 2 - 50, y0, D / 2 - 50)
      g.add(holder)
      if (dishes > 0) {
        const steel = mat('stainless', '#d4d7da')
        for (let k = 0; k < 4; k++) g.add(cyl(2.5, 2, 170, k % 2 ? steel : mat('wood', '#6b4a34'), [W / 2 - 50 + (k - 1.5) * 9, y0 + 85, D / 2 - 50 + (k % 2 ? 6 : -6)], { rot: [0.08 * (k - 1.5), 0, 0.1 * (k - 1.5)], segments: 6 }))
      }
    }
    // Dishes: plates stand in the slots (largest at the back), bowls and cups face down in front.
    const n = Math.round(dishes)
    const plates = Math.min(slots, Math.ceil(n * 0.6))
    for (let i = 0; i < plates; i++) {
      const R = 95 + ((i * 37) % 3) * 12
      const plate = lathe(
        [
          [0, 0],
          [R * 0.55, 0],
          [R * 0.62, 6],
          [R, 16],
          [R, 19],
          [R * 0.6, 9],
          [0, 9],
        ],
        mat('ceramic', PLATES[(i * 3) % PLATES.length]),
        [0, 0, 0],
        { segments: 40 },
      )
      plate.rotation.z = Math.PI / 2
      plate.rotation.y = 0.12
      plate.position.set(slotX(Math.round((i * (slots - 1)) / Math.max(1, plates - 1))) + 8, y0 + R + 4, -D / 2 + D * 0.27)
      g.add(plate)
    }
    const rest = n - plates
    for (let k = 0; k < rest; k++) {
      const cup = k % 2 === 0
      const col = PLATES[(k * 5 + 1) % PLATES.length]
      const piece = cup ? hollowCylinder(38, 85, 3, mat('ceramic', col), { segments: 28 }) : lathe([[0, 0], [30, 0], [62, 45], [65, 48], [58, 48], [28, 4], [0, 4]], mat('ceramic', col), [0, 0, 0], { segments: 32 })
      piece.rotation.x = Math.PI // upside down to drain
      const x = -W / 2 + 70 + (k % 3) * 110
      const onTop = tiers >= 2 && k >= 2
      piece.position.set(Math.min(W / 2 - 110, x), (onTop ? top : y0) + (cup ? 85 : 48) + 2, onTop ? (k % 2 ? -D / 5 : D / 5) : D / 2 - 70)
      g.add(piece)
    }
    return g
  },
})
