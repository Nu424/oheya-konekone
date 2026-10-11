import * as THREE from 'three'
import { mat, SWATCHES } from '../../three/materials'
import { boxOn, cyl, group, rbox, tube } from '../kit'
import { p } from '../params'
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
    g.add(boxOn(W - 40, toe, D - 60, mat('matte', '#3b3633'), 0, 0, -10))
    g.add(boxOn(W, cabH, D - 20, door, 0, toe, -10))

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
    if (cutL > -W / 2) g.add(boxOn(cutL + W / 2, counterT, D, steel, (-W / 2 + cutL) / 2, top, 0))
    if (cutR < W / 2) g.add(boxOn(W / 2 - cutR, counterT, D, steel, (cutR + W / 2) / 2, top, 0))
    g.add(boxOn(sinkW, counterT, (D - sinkD) / 2 + 40, steel, sinkX, top, D / 2 - ((D - sinkD) / 2 + 40) / 2))
    g.add(boxOn(sinkW, counterT, (D - sinkD) / 2 - 40, steel, sinkX, top, -D / 2 + ((D - sinkD) / 2 - 40) / 2))
    // Sink basin
    const basin = mat('metal', '#bfc3c7', { roughness: 0.35 })
    g.add(boxOn(sinkW, 8, sinkD, basin, sinkX, top - 180, 40 - 0))
    for (const s of [-1, 1]) {
      g.add(boxOn(6, 180, sinkD, basin, sinkX + s * (sinkW / 2 - 3), top - 180, 40))
    }
    g.add(boxOn(sinkW, 180, 6, basin, sinkX, top - 180, 40 + sinkD / 2 - 3))
    g.add(boxOn(sinkW, 180, 6, basin, sinkX, top - 180, 40 - sinkD / 2 + 3))
    // Faucet
    g.add(cyl(18, 22, 40, steel, [sinkX, H + 20, -D / 2 + 70]))
    g.add(tube([[sinkX, H + 30, -D / 2 + 70], [sinkX, H + 260, -D / 2 + 80], [sinkX, H + 280, -D / 2 + 180], [sinkX, H + 200, -D / 2 + 230]], 12, steel))
    g.add(boxOn(20, 20, 90, steel, sinkX + 40, H + 30, -D / 2 + 80))

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
          const bar = boxOn(150, 12, 14, mat('metal', '#1d1d1d'), x, H + 70, -20)
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
      g.add(boxOn(dw - 8, cabH - 10, 16, door, x, toe + 5, D / 2 - 22))
      g.add(boxOn(Math.min(140, dw * 0.4), 12, 14, steel, x, toe + cabH - 50, D / 2 - 8))
    }

    if (upper) {
      // Wall cabinet + range hood
      const uy = 1500
      const uh = 600
      const ud = 330
      g.add(boxOn(W, uh, ud, door, 0, uy + 200, -D / 2 + ud / 2))
      for (let i = 0; i < doorsN; i++) g.add(boxOn(W / doorsN - 8, uh - 10, 6, door, -W / 2 + (W / doorsN) * (i + 0.5), uy + 205, -D / 2 + ud + 2))
      if (stove !== 'none') {
        g.add(boxOn(Math.max(stoveW + 100, 500), 160, 450, mat('metal', '#d9dcdf', { roughness: 0.3 }), stoveX, uy + 40, -D / 2 + 225))
        g.add(boxOn(Math.max(stoveW + 60, 460), 6, 400, mat('emissive', '#fff3dc', { intensity: 0.6 }), stoveX, uy + 36, -D / 2 + 225))
      }
      // Backsplash
      g.add(boxOn(W, uy + 200 - H, 10, mat('ceramic', '#f6f4f0'), 0, H, -D / 2 + 5))
    }
    return g
  },
})
