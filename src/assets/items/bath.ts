import * as THREE from 'three'
import { mat } from '../../three/materials'
import { cyl, group, lathe, panelOn, tube } from '../kit'
import { p } from '../params'
import { hollowBox, hollowCylinder } from '../parts'
import { buildStorage } from '../storageKit'
import { defineAsset } from '../types'

/** Bathroom fittings: bathtub, toilet, washbasin. Back against the wall (-Z), front +Z. */

const SANITARY = ['#f6f4ef', '#ffffff', '#efe6d6', '#e9d9d6', '#d9e4ea', '#2f2f31']

/** A chrome single-lever mixer tap, its spout pointing +Z. Origin: where it meets the wall / deck. */
function mixer(chrome: THREE.Material, wall: boolean) {
  const g = group()
  if (wall) {
    // Wall-mounted thermostatic mixer: a horizontal body with two knobs and a spout below.
    g.add(cyl(22, 22, 300, chrome, [0, 0, 45], { rot: [0, 0, Math.PI / 2], segments: 24 }))
    for (const s of [-1, 1]) g.add(cyl(30, 30, 40, chrome, [s * 170, 0, 45], { rot: [0, 0, Math.PI / 2], segments: 24 }))
    for (const s of [-1, 1]) g.add(cyl(12, 12, 45, chrome, [s * 90, 0, 22], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
    g.add(cyl(12, 9, 110, chrome, [0, -30, 100], { rot: [Math.PI / 2 - 0.25, 0, 0], segments: 14 }))
  } else {
    g.add(cyl(22, 25, 150, chrome, [0, 75, 0], { segments: 24 }))
    g.add(tube([[0, 140, 0], [0, 170, 40], [0, 165, 110], [0, 140, 130]], 11, chrome, { segments: 20, tension: 0.4 }))
    g.add(cyl(6, 6, 90, chrome, [0, 160, -40], { rot: [Math.PI / 2 - 0.4, 0, 0], segments: 10 }))
  }
  return g
}

export const bathtub = defineAsset({
  type: 'bathtub',
  label: '浴槽',
  category: 'bath',
  description: '浴室の浴槽（エプロン付き）。背面(-Z)を壁につける。中は空洞で、お湯を張った状態も表示できる。水栓とシャワーは別の「水栓・シャワー」を壁に付ける',
  placement: 'floor',
  surfaces: () => [],
  params: {
    length: p.mm('長さ', 1000, 1800, 1300, { hardMax: 2000, hint: 'ユニットバスなら 1116 → 1100、1216 → 1200、1418 → 1400 くらい' }),
    width: p.mm('幅（奥行き）', 650, 900, 750, { hardMax: 1000 }),
    height: p.mm('高さ', 400, 650, 550, { hardMax: 700, hint: 'またぎの高さ' }),
    water: p.bool('お湯を張る', false),
    lid: p.bool('風呂ふた', false),
    color: p.color('色', '#f6f4ef', { swatches: SANITARY }),
  },
  presets: [
    { name: 'ユニットバス 1116', params: { length: 1100, width: 700, height: 550 } },
    { name: 'ゆったり 1418', params: { length: 1400, width: 800, water: true } },
    { name: 'ふたをした状態', params: { lid: true } },
  ],
  body: ({ length: L, width: W, height: H }) => ({ min: { x: -L / 2, y: 0, z: -W / 2 }, max: { x: L / 2, y: H, z: W / 2 } }),
  build({ length: L, width: W, height: H, water, lid, color }) {
    const g = group()
    const shell = mat('gloss', color, { roughness: 0.18 })
    const chrome = mat('chrome', '#d9dcdf', { roughness: 0.12 })
    // The tub: thick walls with a flat rim, open on top; the inside a shade lighter.
    g.add(hollowBox(L, H, W, 70, shell, { open: 'top', edge: 18, inner: mat('gloss', color, { roughness: 0.12 }) }))
    // Apron: the front face is a slightly proud panel with a shadow line along the floor.
    g.add(panelOn(L - 10, H - 30, 8, shell, 0, 20, W / 2 + 2, { edge: 4 }))
    g.add(panelOn(L - 20, 20, 6, mat('matte', '#8f8a84'), 0, 0, W / 2 - 4))
    g.add(cyl(18, 18, 3, chrome, [L / 2 - 180, 72, -W / 2 + 180], { segments: 20 })) // drain
    if (water) {
      const m = mat('glass', '#bfe0e9', { opacity: 0.45 })
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(L - 150, W - 150), m)
      surf.rotation.x = -Math.PI / 2
      surf.position.y = H * 0.72
      surf.userData.noShadow = true
      g.add(surf)
    }
    if (lid) {
      // A roll-up lid laid flat on the rim: slats across the tub.
      const slats: THREE.Mesh[] = []
      const lm = mat('plastic', '#e7ecef', { roughness: 0.35 })
      const n = Math.round((L - 40) / 60)
      for (let i = 0; i < n; i++) slats.push(cyl(14, 14, W - 30, lm, [-L / 2 + 20 + (i + 0.5) * ((L - 40) / n), H + 14, 0], { rot: [Math.PI / 2, 0, 0], segments: 10 }))
      for (const m of slats) g.add(m)
    }
    return g
  },
})

export const toilet = defineAsset({
  type: 'toilet',
  label: 'トイレ',
  category: 'bath',
  description: '洋式トイレ。タンク付き・タンクレス、温水洗浄便座、フタの開け閉め。背面(-Z)を壁につける',
  placement: 'floor',
  surfaces: () => [],
  params: {
    tank: p.select('タンク', { tank: 'タンク付き', tankless: 'タンクレス' }, 'tank'),
    lid: p.select('フタ', { closed: '閉じる', open: '開ける', seatUp: '便座も上げる' }, 'closed'),
    washlet: p.bool('温水洗浄便座', true),
    color: p.color('色', '#f6f4ef', { swatches: SANITARY }),
  },
  presets: [
    { name: 'タンクレス', params: { tank: 'tankless' } },
    { name: 'フタを開けた状態', params: { lid: 'open' } },
  ],
  build({ tank, lid, washlet, color }) {
    const g = group()
    const china = mat('ceramic', color)
    const seatM = mat('plastic', color === '#2f2f31' ? '#2f2f31' : '#fbfaf7', { roughness: 0.3 })
    const back = tank === 'tank' ? -330 : -300
    // Bowl: an oval china pot on a narrower foot, hollow so an open lid shows the water inside.
    const oval = 1.35
    const foot = lathe([[0, 0], [125, 0], [135, 160], [170, 300], [0, 300]], china, [0, 0, 0], { segments: 40 })
    foot.scale.z = oval
    foot.position.z = 20
    const bowl = hollowCylinder(185, 90, 22, china, { segments: 48 })
    bowl.position.set(0, 300, 20)
    bowl.scale.z = oval
    const water = new THREE.Mesh(new THREE.CircleGeometry(95, 32), mat('glass', '#cfe6ee', { opacity: 0.6 }))
    water.rotation.x = -Math.PI / 2
    water.position.set(0, 335, 0)
    water.scale.y = 1.3
    g.add(foot, bowl, water)
    // Rear deck the seat hinges on, joined to the back.
    g.add(panelOn(320, 70, 200, china, 0, 320, back + 100, { edge: 20 }))
    const seatY = 392
    const hingeZ = back + 160
    // Seat ring and lid hinge at the back; they swing up around it.
    const seat = new THREE.Mesh(new THREE.TorusGeometry(150, 22, 12, 40), seatM)
    seat.rotation.x = Math.PI / 2
    seat.scale.set(1, oval * 0.95, 0.45)
    const seatG = group(seat)
    seat.position.set(0, 0, 20 - hingeZ + 10)
    seatG.position.set(0, seatY, hingeZ)
    if (lid === 'seatUp') seatG.rotation.x = -Math.PI / 2 + 0.12
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(180, 182, 22, 40), seatM)
    lidM.scale.z = oval
    lidM.position.set(0, 21, 20 - hingeZ + 10)
    const lidG = group(lidM)
    lidG.position.set(0, seatY, hingeZ)
    if (lid !== 'closed') lidG.rotation.x = -Math.PI / 2 + 0.08
    g.add(seatG, lidG)
    if (washlet) {
      // The washlet unit at the back of the seat and a control arm on the right.
      g.add(panelOn(380, 90, 160, seatM, 0, seatY - 20, back + 110, { edge: 25 }))
      g.add(panelOn(70, 40, 230, seatM, 245, seatY - 10, back + 260, { edge: 12 }))
      for (let i = 0; i < 4; i++) g.add(cyl(7, 7, 4, mat('plastic', i === 0 ? '#e0533d' : '#5b7c99'), [245, seatY + 32, back + 200 + i * 30], { segments: 12 }))
    }
    if (tank === 'tank') {
      // Cistern against the wall with a lid and a lever on the left; a small hand-wash bowl on top.
      g.add(panelOn(430, 380, 200, china, 0, seatY + 20, back + 20, { edge: 24 }))
      g.add(panelOn(450, 30, 215, china, 0, seatY + 400, back + 20, { edge: 14 }))
      g.add(cyl(26, 26, 8, mat('ceramic', '#d9dcdf'), [0, seatY + 432, back + 30], { segments: 24 }))
      g.add(cyl(8, 8, 70, mat('chrome', '#d9dcdf'), [-190, seatY + 340, back + 125], { rot: [0, 0, Math.PI / 2], segments: 10 }))
    } else {
      g.add(panelOn(400, 160, 230, china, 0, seatY - 30, back + 100, { edge: 30 }))
    }
    return g
  },
})

export const washbasin = defineAsset({
  type: 'washbasin',
  label: '洗面台',
  category: 'bath',
  description: '洗面化粧台（収納の上に洗面ボウル、上に鏡）か、柱の上の洗面器。背面(-Z)を壁につける',
  placement: 'floor',
  surfaces: () => [],
  params: {
    style: p.select('形', { vanity: '洗面化粧台', pedestal: '柱の洗面器' }, 'vanity'),
    width: p.mm('幅', 450, 1200, 750, { hardMax: 1500, hint: '洗面化粧台は 600 / 750 / 900 が定番' }),
    mirror: p.select('鏡', { cabinet: '収納付きの鏡', mirror: '鏡だけ', none: 'なし' }, 'cabinet'),
    open: p.number({ label: '開き具合', min: 0, max: 1, step: 0.05, default: 0, group: '形' }),
    color: p.color('本体', '#f4f4f2', { swatches: ['#f4f4f2', '#efe6d6', '#d2ad7c', '#8f5f3d', '#4d5055'] }),
  },
  presets: [
    { name: '600 の洗面化粧台', params: { width: 600 } },
    { name: '木目の洗面台', params: { width: 900, color: '#b8875a', mirror: 'mirror' } },
    { name: '小さな洗面器', params: { style: 'pedestal', width: 500, mirror: 'mirror' } },
  ],
  body: ({ style, width: W }) => ({ min: { x: -W / 2, y: 0, z: style === 'vanity' ? -270 : -230 }, max: { x: W / 2, y: style === 'vanity' ? 850 : 860, z: style === 'vanity' ? 280 : 230 } }),
  build({ style, width: W, mirror, open, color }) {
    const g = group()
    const china = mat('ceramic', '#fbfaf7')
    const chrome = mat('chrome', '#d9dcdf', { roughness: 0.12 })
    const D = style === 'vanity' ? 540 : 440
    const top = style === 'vanity' ? 800 : 820
    if (style === 'vanity') {
      // Cabinet with two doors (or one when narrow), a china top with the bowl set into it.
      const cab = buildStorage({ W, H: top - 20, D: D - 20, finish: 'melamine', color, cols: 1, sections: [{ kind: 'hinged', rows: 1, weight: 1 }], span: 'whole', open, handle: 'bar', base: 'plinth', back: true })
      cab.position.z = -10
      g.add(cab)
      g.add(panelOn(W, 25, D, china, 0, top - 25, 0, { edge: 10 }))
      const bowl = hollowCylinder(Math.min(200, W * 0.3), 130, 12, china, { segments: 40, lip: 8 })
      bowl.scale.z = 0.75
      bowl.position.set(0, top - 120, 30)
      g.add(bowl)
    } else {
      // A wall-hung basin on a china column.
      g.add(lathe([[0, 0], [110, 0], [80, 40], [70, 640], [0, 640]], china, [0, 0, -40], { segments: 32 }))
      const bowl = hollowCylinder(Math.min(240, W * 0.45), 160, 18, china, { segments: 40, lip: 10 })
      bowl.scale.z = 0.8
      bowl.position.set(0, top - 160, 0)
      g.add(bowl)
      g.add(panelOn(W * 0.9, 40, 120, china, 0, top - 40, -D / 2 + 60, { edge: 12 }))
    }
    const tap = mixer(chrome, false)
    tap.position.set(0, top, -D / 2 + 70)
    g.add(tap)
    if (mirror !== 'none') {
      const mw = style === 'vanity' ? W : Math.min(W, 450)
      const mh = mirror === 'cabinet' ? 750 : 600
      const md = mirror === 'cabinet' ? 140 : 20
      const y0 = top + 280
      if (mirror === 'cabinet') {
        // Mirror cabinet: a box with a mirrored front and a light bar on top.
        g.add(hollowBox(mw, mh, md, 15, mat('matte', color, { roughness: 0.55 }), { open: 'front', edge: 3 }).translateY(y0).translateZ(-D / 2 + md / 2))
        const panes = mw > 700 ? 3 : 2
        for (let i = 0; i < panes; i++) {
          const pw = mw / panes - 4
          const pane = panelOn(pw, mh - 70, 6, mat('mirror', '#ffffff'), -mw / 2 + (i + 0.5) * (mw / panes), y0 + 10, -D / 2 + md + 3, { edge: 1 })
          g.add(pane)
        }
        g.add(panelOn(mw, 50, md, mat('matte', color, { roughness: 0.55 }), 0, y0 + mh - 50, -D / 2 + md / 2, { edge: 3 }))
        g.add(panelOn(mw - 60, 12, 4, mat('emissive', '#fff4e0', { intensity: 0.9 }), 0, y0 + mh - 35, -D / 2 + md + 1, { edge: 1 }))
      } else {
        g.add(panelOn(mw, mh, 8, mat('mirror', '#ffffff'), 0, y0, -D / 2 + 10, { edge: 4 }))
      }
    }
    return g
  },
})

// ---- On the wall ----------------------------------------------------------------------------------

const FITTING_COLORS = ['#d9dcdf', '#2b2b2e', '#f4f4f2', '#c9a86a']
/** Chrome stays mirror-bright; other finishes are powder coat. */
const fittingMat = (color: string) => (color === '#d9dcdf' ? mat('chrome', color, { roughness: 0.12 }) : mat('powder', color))

const FAUCETS = { bath: '水栓とシャワー（スライドバー）', mixer: '水栓だけ', fixed: 'シャワーヘッド固定（頭の上）', tap: '蛇口ひとつ（洗濯機・ベランダ）' } as const

export const faucetShower = defineAsset({
  type: 'faucetShower',
  label: '水栓・シャワー',
  category: 'bath',
  description: '壁に付ける水栓とシャワー。浴槽の上の壁、洗い場、洗濯機の横など。背面を壁につけ、position y は水栓の下端（浴槽の上なら浴槽の高さ＋200 くらい）',
  placement: 'wall',
  elevation: (q) => (q.kind === 'tap' ? 1100 : 750),
  contactShadow: false,
  surfaces: () => [],
  params: {
    kind: p.select('種類', FAUCETS, 'bath', { group: '形' }),
    bar: p.mm('スライドバーの長さ', 500, 1200, 900, { hint: '水栓とシャワーのとき', hardMax: 1500 }),
    spread: p.mm('水栓からバーまで', -900, 900, 380, { hint: '水栓とシャワーのとき。プラスで右、マイナスで左（壁に向かって）' }),
    color: p.color('色', '#d9dcdf', { swatches: FITTING_COLORS }),
  },
  presets: [
    { name: '水栓だけ', params: { kind: 'mixer' } },
    { name: '黒いシャワー', params: { color: '#2b2b2e' } },
    { name: '洗濯機の蛇口', params: { kind: 'tap' } },
  ],
  build({ kind, bar, spread, color }) {
    const g = group()
    const m = fittingMat(color)
    const back = -70
    if (kind === 'tap') {
      // One tap: a short spout with a lever and a hose connector, for a washing machine.
      g.add(cyl(26, 26, 14, m, [0, 40, back + 7], { rot: [Math.PI / 2, 0, 0], segments: 20 }))
      g.add(cyl(11, 11, 90, m, [0, 40, back + 55], { rot: [Math.PI / 2, 0, 0], segments: 14 }))
      g.add(cyl(11, 9, 50, m, [0, 15, back + 98], { segments: 14 }))
      g.add(panelOn(70, 10, 14, m, 0, 62, back + 40, { edge: 3 }))
      return g
    }
    // Thermostatic mixer on two elbows, its spout pointing down.
    const tap = mixer(m, true)
    tap.position.set(0, 60, back)
    g.add(tap)
    if (kind === 'bath') {
      // Slide bar beside the mixer with the hand shower clipped near the top, its hose looping down.
      const x = spread
      const y0 = 260
      g.add(cyl(12, 12, bar, m, [x, y0 + bar / 2, back + 30], { segments: 14 }))
      for (const y of [y0, y0 + bar]) g.add(cyl(14, 14, 30, m, [x, y, back + 15], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
      const hy = y0 + bar - 50
      const head = group(cyl(14, 10, 200, m, [0, -100, 0], { segments: 14 }), cyl(42, 38, 22, m, [0, 6, 18], { rot: [Math.PI / 2 - 0.3, 0, 0], segments: 24 }))
      head.position.set(x, hy, back + 60)
      g.add(head)
      g.add(tube([[x, hy - 200, back + 60], [x - 30, (hy - 200) / 2 + 40, back + 120], [x * 0.4, 0, back + 110], [140, 40, back + 70]], 7, mat('chrome', '#c9cdd1', { roughness: 0.3 }), { segments: 40, tension: 0.5 }))
    }
    if (kind === 'fixed') {
      // A riser pipe from the mixer up to a wide head on an arm.
      g.add(cyl(12, 12, 1150, m, [170, 60 + 575, back + 30], { segments: 14 }))
      g.add(cyl(10, 10, 300, m, [170, 1210, back + 180], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
      g.add(cyl(110, 110, 12, m, [170, 1195, back + 300], { segments: 40 }))
    }
    return g
  },
})

const ACCESSORIES = {
  towelBar: 'タオル掛け（バー）',
  towelRing: 'タオルリング',
  paper: 'トイレットペーパーホルダー',
  paperDouble: 'ペーパーホルダー（2 連・棚つき）',
  hooks: 'フック',
  grab: '手すり',
} as const
type Accessory = keyof typeof ACCESSORIES

export const wallAccessory = defineAsset({
  type: 'wallAccessory',
  label: '壁の小物',
  category: 'bath',
  description: '壁に付ける小物。タオル掛け・タオルリング・トイレットペーパーホルダー・フック・手すり。浴室・トイレ・洗面所・キッチン・玄関に。背面を壁につける',
  placement: 'wall',
  elevation: (q) => ({ towelBar: 1000, towelRing: 1100, paper: 650, paperDouble: 650, hooks: 1600, grab: 650 })[q.kind as Accessory] ?? 1000,
  contactShadow: false,
  surfaces: () => [],
  params: {
    kind: p.select('種類', ACCESSORIES, 'towelBar', { group: '形' }),
    width: p.mm('幅', 150, 900, 450, { hint: 'タオル掛け・フック・手すりのとき', hardMax: 1500 }),
    count: p.number({ label: 'フックの数', min: 1, max: 6, step: 1, default: 3, group: '形' }),
    towel: p.bool('タオルをかける', true),
    towelColor: p.color('タオルの色', '#c9d6df', { swatches: ['#f4f1ec', '#c9d6df', '#9fb59a', '#e8c76a', '#d8a48f', '#4d4f53'] }),
    color: p.color('色', '#d9dcdf', { swatches: [...FITTING_COLORS, '#b8875a'] }),
  },
  presets: [
    { name: 'タオルリング', params: { kind: 'towelRing' } },
    { name: 'ペーパーホルダー', params: { kind: 'paper' } },
    { name: '2 連ホルダー', params: { kind: 'paperDouble', color: '#2b2b2e' } },
    { name: '玄関のフック', params: { kind: 'hooks', count: 4, width: 500, color: '#b8875a', towel: false } },
    { name: '手すり', params: { kind: 'grab', width: 600 } },
  ],
  build({ kind, width: W, count, towel, towelColor, color }) {
    const g = group()
    const m = color === '#b8875a' ? mat('wood', color) : fittingMat(color)
    const back = -40
    const cloth = mat('fabric', towelColor)
    const post = (x: number, y: number, out: number) => {
      g.add(cyl(14, 14, 6, m, [x, y, back + 3], { rot: [Math.PI / 2, 0, 0], segments: 18 }))
      g.add(cyl(6, 6, out, m, [x, y, back + out / 2], { rot: [Math.PI / 2, 0, 0], segments: 10 }))
    }
    if (kind === 'towelBar' || kind === 'grab') {
      // A bar on two posts; a grab bar is thicker and sits closer to the wall.
      const r = kind === 'grab' ? 16 : 9
      const out = kind === 'grab' ? 55 : 70
      for (const s of [-1, 1]) post((s * (W - 40)) / 2, 0, out)
      g.add(cyl(r, r, W - 20, m, [0, 0, back + out], { rot: [0, 0, Math.PI / 2], segments: 18 }))
      if (towel && kind === 'towelBar') {
        const tw = Math.min(W - 80, 500)
        for (const s of [-1, 1]) g.add(panelOn(tw, 420 - (s > 0 ? 0 : 60), 6, cloth, 0, -420 + (s > 0 ? 0 : 60), back + out + s * 12, { edge: 3, grain: 'y' }))
        g.add(cyl(14, 14, tw, cloth, [0, 0, back + out], { rot: [0, 0, Math.PI / 2], segments: 12 }))
      }
    } else if (kind === 'towelRing') {
      post(0, 0, 40)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(90, 7, 10, 40), m)
      ring.position.set(0, -95, back + 50)
      g.add(ring)
      if (towel) g.add(panelOn(280, 360, 26, cloth, 0, -460, back + 50, { edge: 10, grain: 'y' }))
    } else if (kind === 'paper' || kind === 'paperDouble') {
      // Holder arm(s) with a roll of paper each; the double one has a small shelf on top.
      const rolls = kind === 'paperDouble' ? [-80, 80] : [0]
      for (const x of rolls) {
        g.add(panelOn(130, 30, 10, m, x, 25, back + 5, { edge: 3 }))
        g.add(cyl(5, 5, 110, m, [x, 0, back + 70], { rot: [0, 0, Math.PI / 2], segments: 10 }))
        g.add(cyl(55, 55, 108, mat('paper', '#fbfaf6'), [x, 0, back + 70], { rot: [0, 0, Math.PI / 2], segments: 28 }))
        g.add(cyl(20, 20, 109, mat('cardboard', '#b99a72'), [x, 0, back + 70], { rot: [0, 0, Math.PI / 2], segments: 16 }))
      }
      if (kind === 'paperDouble') g.add(panelOn(320, 8, 140, m, 0, 65, back + 70, { edge: 2 }))
    } else {
      // A rail with hooks.
      g.add(panelOn(W, 50, 14, m, 0, -25, back + 7, { edge: 3 }))
      const n = Math.max(1, Math.round(count))
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -W / 2 + 50 + ((W - 100) / (n - 1)) * i
        g.add(tube([[x, 0, back + 14], [x, -5, back + 45], [x, -30, back + 60], [x, -10, back + 72]], 4, fittingMat(color === '#b8875a' ? '#2b2b2e' : color), { segments: 12, tension: 0.4 }))
      }
    }
    return g
  },
})

export const bathStool = defineAsset({
  type: 'bathStool',
  label: '風呂いす・洗面器',
  category: 'bath',
  description: '洗い場の風呂いすと洗面器。洗面器だけ・いすだけにもできる',
  placement: 'floor',
  surfaces: () => [],
  params: {
    height: p.mm('いすの高さ', 200, 450, 300),
    stool: p.bool('いす', true),
    bowl: p.select('洗面器', { beside: 'いすの横', on: 'いすの上', none: 'なし' }, 'beside', { group: '形' }),
    color: p.color('色', '#f4f4f2', { swatches: ['#f4f4f2', '#cfd8dc', '#d9e4ea', '#e9d9d6', '#b8875a', '#2b2b2e'] }),
  },
  presets: [
    { name: '高めのいす', params: { height: 400 } },
    { name: '洗面器だけ', params: { stool: false } },
    { name: '木の手桶風', params: { color: '#b8875a', bowl: 'on' } },
  ],
  build({ height: H, stool, bowl, color }) {
    const g = group()
    const m = color === '#b8875a' ? mat('wood', color) : mat('plastic', color, { roughness: 0.3 })
    if (stool) {
      // A seat with a grip slot, on a skirt that opens at the front and back.
      const seat = new THREE.Shape()
      seat.absellipse(0, 0, 190, 140, 0, Math.PI * 2, false, 0)
      const slot = new THREE.Path()
      slot.absellipse(0, 0, 70, 18, 0, Math.PI * 2, false, 0)
      seat.holes.push(slot)
      const top = new THREE.Mesh(new THREE.ExtrudeGeometry(seat, { depth: 22, bevelEnabled: true, bevelSize: 6, bevelThickness: 6, bevelSegments: 2, curveSegments: 32 }), m)
      top.rotation.x = -Math.PI / 2
      top.position.y = H - 28
      top.castShadow = true
      g.add(top)
      for (const s of [-1, 1]) g.add(panelOn(24, H - 28, 220, m, s * 150, 0, 0, { edge: 8 }))
    }
    if (bowl !== 'none') {
      const b = hollowCylinder(150, 110, 6, m, { segments: 36, lip: 8 })
      if (bowl === 'on' && stool) b.position.set(0, H + 4, 0)
      else b.position.set(stool ? 330 : 0, 0, stool ? 40 : 0)
      g.add(b)
    }
    return g
  },
})
