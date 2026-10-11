import * as THREE from 'three'
import { mat } from '../../three/materials'
import { screenMesh } from './computing'
import { cyl, deg, extrude, group, lathe, merged, panel, panelOn, rbox } from '../kit'
import { p } from '../params'
import { hollowBox, hollowCylinder } from '../parts'
import { defineAsset } from '../types'

function screen(w: number, h: number, on: boolean) {
  return screenMesh(w, h, on ? 'wallpaper' : 'off')
}

export const tv = defineAsset({
  type: 'tv',
  label: 'テレビ',
  category: 'av',
  description: '薄型テレビ。インチ数でサイズが変わる。テレビ台の上(y=テレビ台の高さ)に置く',
  placement: 'onTop',
  // Nothing is meant to stand on it.
  surfaces: () => [],
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
    g.add(rbox(w + 16, h + 16, 45, 6, bezel, [0, lift + h / 2 + 8, 0]))
    const sc = screen(w, h, on)
    sc.position.set(0, lift + h / 2 + 8, 23)
    g.add(sc)
    if (stand === 'center') {
      g.add(rbox(Math.min(380, w * 0.35), 14, 220, 6, bezel, [0, 7, 30]))
      g.add(panelOn(70, lift, 30, bezel, 0, 0, -5))
    } else if (stand === 'feet') {
      for (const s of [-1, 1]) {
        const foot = panelOn(30, lift + 30, 200, bezel, s * (w / 2 - 80), 0, 20)
        foot.rotation.x = deg(-10)
        g.add(foot)
      }
    }
    return g
  },
})

export const fridge = defineAsset({
  type: 'fridge',
  label: '冷蔵庫',
  category: 'appliance',
  description: '冷蔵庫。容量でサイズが変わる。一人暮らしなら150L前後の2ドアが定番。扉を開けると中の棚に物を置ける。上に電子レンジを載せられる',
  placement: 'floor',
  params: {
    capacity: p.select('容量', { mini: '小型 (90L)', small: '2ドア (150L)', medium: '3ドア (300L)', large: '大型 (450L)' }, 'small', { group: 'サイズ' }),
    open: p.number({ label: '扉の開き', min: 0, max: 1, step: 0.05, default: 0, group: '形' }),
    hinge: p.select('扉の吊り元', { right: '右', left: '左' }, 'right', { group: '形' }),
    color: p.color('色', '#f4f4f2', { swatches: ['#f4f4f2', '#2f2f31', '#c9ccd0', '#e9dccb', '#9fb5a5'] }),
    finish: p.select('仕上げ', { matte: 'マット', gloss: 'つや', steel: 'ステンレス' }, 'matte', { group: '色・素材' }),
    magnets: p.bool('マグネット・メモ', true),
  },
  presets: [
    { name: '扉を開ける', params: { open: 0.8 } },
    { name: '黒・大型', params: { capacity: 'large', color: '#2f2f31', finish: 'gloss' } },
    { name: 'ステンレス', params: { capacity: 'medium', finish: 'steel', color: '#c9ccd0', magnets: false } },
  ],
  body: ({ capacity }) => {
    const [W, H, D] = FRIDGE[capacity]
    return { min: { x: -W / 2, y: 0, z: -D / 2 }, max: { x: W / 2, y: H, z: D / 2 } }
  },
  surfaces: ({ capacity }) => {
    const [W, H, D] = FRIDGE[capacity]
    const L = fridgeLayout(capacity)
    // 0 = top; then the shelves inside the main (refrigerator) compartment, bottom up.
    return [
      { y: H, minX: -W / 2 + 10, maxX: W / 2 - 10, minZ: -D / 2 + 10, maxZ: D / 2 - 40, label: '天面' },
      ...L.shelves.map((y, i) => ({ y, minX: -W / 2 + 30, maxX: W / 2 - 30, minZ: -D / 2 + 40, maxZ: D / 2 - 90, clearance: (L.shelves[i + 1] ?? L.mainTop) - y - 10, label: `庫内の棚${i + 1}` })),
    ]
  },
  build({ capacity, open, hinge, color, finish, magnets }) {
    const [W, H, D] = FRIDGE[capacity]
    const body = finish === 'gloss' ? mat('gloss', color) : finish === 'steel' ? mat('stainless', color) : mat('powder', color, { roughness: 0.45 })
    const g = group()
    const L = fridgeLayout(capacity)
    const doorT = 45
    const caseD = D - doorT
    // Cabinet: sides, top, back; kick plate with a vent grille at the bottom.
    // The refrigerator compartment is a shell (sides, back, top and bottom) so it can be opened;
    // the other compartments are solid blocks behind their doors.
    const zc = -doorT / 2
    const [mb, mt] = [L.doors[L.main][0], L.doors[L.main][1]]
    if (mb > 20) g.add(panelOn(W, mb - 20, caseD, body, 0, 20, zc, { edge: 6 }))
    if (mt < H) g.add(panelOn(W, H - mt, caseD, body, 0, mt, zc, { edge: 6 }))
    for (const sx of [-1, 1]) g.add(panelOn(25, mt - mb, caseD, body, sx * (W / 2 - 12.5), mb, zc, { edge: 6 }))
    g.add(panelOn(W - 50, mt - mb, 20, body, 0, mb, -D / 2 + 10, { edge: 2 }))
    g.add(panelOn(W - 50, 25, caseD - 20, body, 0, mb, zc + 10, { edge: 2 }))
    g.add(panelOn(W - 50, 25, caseD - 20, body, 0, mt - 25, zc + 10, { edge: 2 }))
    g.add(panelOn(W - 40, 20, caseD - 40, mat('matte', '#2b2b2b'), 0, 0, -doorT / 2))
    const grille: THREE.Mesh[] = []
    for (let k = 0; k < 6; k++) grille.push(panel(W - 120, 2, 3, mat('matte', '#1a1a1a'), [0, 4 + k * 3, D / 2 - doorT - 1]))
    g.add(merged(grille, mat('matte', '#1a1a1a'), { castShadow: false }))
    // Interior of the main compartment (visible when open): white liner, glass shelves.
    const liner = mat('plastic', '#f4f6f7', { roughness: 0.35 })
    const mainH = L.mainTop - L.mainBottom
    if (open > 0.02) {
      g.add(panelOn(W - 52, mainH, 2, liner, 0, L.mainBottom, -D / 2 + 21))
      for (const y of L.shelves) g.add(panelOn(W - 64, 5, caseD - 60, mat('glass', '#dfeef2', { opacity: 0.4 }), 0, y - 5, -doorT / 2 - 18))
      g.add(panelOn(W - 70, 2, 8, mat('emissive', '#ffffff', { intensity: 1.2 }), 0, L.mainTop - 30, -D / 2 + 50))
    }
    // Doors: separate panels with 3 mm seams, a recessed vertical grip on the opening side.
    const side = hinge === 'right' ? 1 : -1
    L.doors.forEach(([y0, y1], i) => {
      const leaf = new THREE.Group()
      const h = y1 - y0 - 3
      leaf.add(panelOn(W - 2, h, doorT, body, 0, 0, doorT / 2, { edge: 6 }))
      leaf.add(panelOn(16, Math.min(320, h * 0.55), 12, mat('matte', '#cfd2d5'), -side * (W / 2 - 22), i === L.main ? 30 : h - Math.min(320, h * 0.55) - 30, doorT + 1, { edge: 5 }))
      if (i === L.main && open > 0.02) {
        // Door pockets on the inside of the main door.
        for (let k = 0; k < 3; k++) leaf.add(panelOn(W - 90, 70, 60, mat('acrylic', '#e6f0f3', { opacity: 0.5 }), 0, 120 + k * (h - 160) / 3, -30))
      }
      if (i === L.doors.length - 1 && magnets) {
        leaf.add(panelOn(140, 180, 3, mat('paper', '#fff8e6'), side * 60, h * 0.4, doorT + 1))
        leaf.add(cyl(14, 14, 10, mat('plastic', '#e8835c'), [side * 60, h * 0.4 + 170, doorT + 5], { rot: [Math.PI / 2, 0, 0] }))
        leaf.add(panelOn(90, 110, 3, mat('paper', '#dfe8ec'), side * 60 - 140 * side, h * 0.2, doorT + 1))
        leaf.add(cyl(12, 12, 10, mat('plastic', '#5d7a8c'), [side * 60 - 140 * side, h * 0.2 + 100, doorT + 5], { rot: [Math.PI / 2, 0, 0] }))
      }
      const pivot = new THREE.Group()
      pivot.position.set(side * (W / 2 - 1), y0 + 1.5, D / 2 - doorT)
      leaf.position.x = -side * (W / 2 - 1)
      pivot.rotation.y = side * deg(i === L.main ? open * 105 : 0)
      pivot.add(leaf)
      g.add(pivot)
    })
    return g
  },
})

const FRIDGE: Record<string, [number, number, number]> = { mini: [480, 850, 530], small: [480, 1220, 580], medium: [600, 1680, 660], large: [685, 1820, 700] }

/** Door splits and shelf heights; `main` is the refrigerator door (the one that opens). */
function fridgeLayout(capacity: string) {
  const [, H] = FRIDGE[capacity]
  const splits = capacity === 'mini' ? [0.82] : capacity === 'small' ? [0.36] : capacity === 'medium' ? [0.28, 0.48] : [0.22, 0.4, 0.55]
  const ys = [20, ...splits.map((f) => 20 + (H - 20) * f), H]
  const doors = ys.slice(0, -1).map((y, i) => [y, ys[i + 1]] as [number, number])
  // The refrigerator is the top compartment, except the mini fridge (freezer box on top).
  const main = capacity === 'mini' ? 0 : doors.length - 1
  const [mainBottom, mainTop] = [doors[main][0] + 30, doors[main][1] - 30]
  const n = Math.max(1, Math.floor((mainTop - mainBottom) / 260))
  const shelves = Array.from({ length: n }, (_, i) => Math.round(mainBottom + ((mainTop - mainBottom) * i) / n + (i === 0 ? 10 : 0)))
  return { doors, main, mainBottom, mainTop, shelves }
}

export const washer = defineAsset({
  type: 'washer',
  label: '洗濯機',
  category: 'appliance',
  description: '洗濯機。縦型かドラム式。防水パンも付けられる。ドラム式の天面には物を置ける',
  placement: 'floor',
  // A drum washer's flat top is a handy shelf; a top loader's lid has to open.
  surfaces: ({ kind, pan }) => (kind === 'drum' ? [{ y: (pan ? 90 : 0) + 1020, minX: -280, maxX: 280, minZ: -290, maxZ: 250, label: '天面' }] : []),
  params: {
    kind: p.select('タイプ', { vertical: '縦型', drum: 'ドラム式' }, 'drum'),
    open: p.bool('フタ・扉を開ける', false),
    pan: p.bool('防水パン', true),
    color: p.color('色', '#f4f4f2', { swatches: ['#f4f4f2', '#2f2f31', '#c9ccd0', '#e9dccb'] }),
  },
  build({ kind, open, pan, color }) {
    const body = mat('powder', color, { roughness: 0.38 })
    const trim = mat('plastic', color === '#2f2f31' ? '#1c1c1e' : '#e3e4e2', { roughness: 0.3 })
    const dark = mat('plastic', '#1b1c1f', { roughness: 0.3 })
    const chrome = mat('chrome', '#d7dadd', { roughness: 0.12 })
    const g = group()
    const base = pan ? 90 : 0
    if (pan) {
      g.add(panelOn(640, 80, 640, mat('plastic', '#eeeeee', { roughness: 0.4 }), 0, 0, 0, { edge: 18 }))
      g.add(panelOn(570, 4, 570, mat('plastic', '#d8d8d8'), 0, 80, 0))
      g.add(cyl(40, 40, 3, mat('matte', '#5a5a5a'), [200, 82, 200], { segments: 20 })) // drain
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(18, 22, 12, mat('rubber', '#2a2a2a'), [sx * 250, base + 6, sz * 250], { segments: 12 }))
    const y0 = base + 12
    if (kind === 'vertical') {
      const W = 565
      const H = 950
      const D = 560
      // Cabinet open at the top; a deck with a round opening over the tub (seen when the lid is up).
      const cab = hollowBox(W, H - 32, D, 14, body, { open: 'top', edge: 14 })
      cab.position.y = y0
      g.add(cab)
      const deck = new THREE.Shape()
      deck.moveTo(-W / 2, -D / 2)
      deck.lineTo(W / 2, -D / 2)
      deck.lineTo(W / 2, D / 2)
      deck.lineTo(-W / 2, D / 2)
      deck.lineTo(-W / 2, -D / 2)
      const hole = new THREE.Path()
      hole.absarc(0, -50, 215, 0, Math.PI * 2, false)
      deck.holes.push(hole)
      g.add(extrude(deck, 20, body, [0, y0 + H - 22, 0], { rot: [Math.PI / 2, 0, 0], bevel: 3 }))
      // Tub: stainless, with a pulsator at the bottom.
      const tub = hollowCylinder(210, H - 260, 3, mat('stainless', '#c9ccd0'), { lip: 8 })
      tub.position.set(0, y0 + 210, 50)
      g.add(tub)
      g.add(lathe([[0, 0], [150, 0], [120, 30], [40, 45], [0, 50]], mat('plastic', '#e9eaea', { roughness: 0.4 }), [0, y0 + 213, 50], { segments: 36 }))
      g.add(panelOn(W - 30, 3, 2, mat('matte', '#c8c9c7'), 0, y0 + 60, D / 2 + 0.5)) // kick seam
      // Top: control strip at the back, lid with a smoked window, hinged at the back.
      g.add(panelOn(W - 10, 60, 140, trim, 0, y0 + H - 12, -D / 2 + 75, { edge: 12 }))
      const ui = panel(260, 50, 6, dark, [0, 0, 0], { edge: 3 })
      ui.position.set(0, y0 + H + 22, -D / 2 + 146)
      ui.rotation.x = deg(-35)
      g.add(ui)
      g.add(panel(90, 22, 1, mat('emissive', '#7fd6a8', { intensity: 0.7 }), [-60, y0 + H + 24, -D / 2 + 150]))
      for (let k = 0; k < 4; k++) g.add(cyl(8, 8, 3, mat('plastic', '#d9dcdf'), [30 + k * 28, y0 + H + 22, -D / 2 + 150], { rot: [Math.PI / 2 - deg(35), 0, 0], segments: 12 }))
      const lid = new THREE.Group()
      lid.add(panelOn(W - 30, 18, D - 170, body, 0, 0, (D - 170) / 2, { edge: 8 }))
      lid.add(panelOn(W - 170, 3, D - 300, mat('glass', '#5d6a74', { opacity: 0.75 }), 0, 17, (D - 170) / 2 + 10, { edge: 20 }))
      lid.add(panelOn(140, 10, 30, trim, 0, 10, D - 190, { edge: 4 }))
      lid.position.set(0, y0 + H - 12, -D / 2 + 150)
      lid.rotation.x = open ? -deg(80) : 0
      g.add(lid)
      return g
    }
    // Drum washer: a front panel slightly proud of the cabinet, a slanted control strip on top.
    const W = 600
    const H = 1008
    const D = 620
    // Cabinet open at the front, closed by a front panel with a round opening into the drum.
    const cab = hollowBox(W, H, D - 20, 14, body, { edge: 10 })
    cab.position.set(0, y0, -10)
    g.add(cab)
    const frontH = H - 150
    const dyLocal = (H - 150) * 0.52
    const front = new THREE.Shape()
    front.moveTo(-(W - 6) / 2, 0)
    front.lineTo((W - 6) / 2, 0)
    front.lineTo((W - 6) / 2, frontH)
    front.lineTo(-(W - 6) / 2, frontH)
    front.lineTo(-(W - 6) / 2, 0)
    const port = new THREE.Path()
    port.absarc(0, dyLocal, 172, 0, Math.PI * 2, false)
    front.holes.push(port)
    g.add(extrude(front, 14, body, [0, y0 + 20, D / 2 - 11], { bevel: 3 }))
    g.add(panelOn(W - 20, 4, 2, mat('matte', '#1d1a18'), 0, y0 + H - 132, D / 2 - 18.5)) // seam under the controls
    // Control strip: angled, with a display, a chrome dial and buttons.
    const strip = new THREE.Group()
    strip.add(panelOn(W - 6, 120, 30, trim, 0, 0, 0, { edge: 6 }))
    strip.add(panelOn(200, 56, 2, dark, -40, 34, 30, { edge: 3 }))
    strip.add(panel(170, 30, 1, mat('emissive', '#9fe6ff', { intensity: 0.8 }), [-40, 62, 32.2]))
    strip.add(cyl(40, 42, 22, chrome, [160, 60, 33], { rot: [Math.PI / 2, 0, 0], segments: 40 }))
    strip.add(cyl(30, 30, 24, mat('plastic', '#2b2b2e', { roughness: 0.3 }), [160, 60, 35], { rot: [Math.PI / 2, 0, 0], segments: 32 }))
    for (let k = 0; k < 4; k++) strip.add(panel(34, 14, 6, mat('plastic', '#b9bcc0'), [-110 + k * 40, 18, 31], { edge: 3 }))
    // Detergent drawer at the top left.
    strip.add(panelOn(120, 80, 4, trim, -225, 20, 31, { edge: 3 }))
    strip.add(panelOn(60, 8, 3, mat('matte', '#1d1a18'), -225, 84, 32))
    strip.position.set(0, y0 + H - 125, D / 2 - 28)
    g.add(strip)
    // Door: chrome ring, dark gasket, domed glass, the drum behind it. Hinged on the left.
    const dy = y0 + 20 + (H - 150) * 0.52
    const door = new THREE.Group()
    door.add(new THREE.Mesh(new THREE.TorusGeometry(200, 22, 18, 64), chrome))
    door.add(cyl(196, 196, 26, mat('plastic', '#2b2c2f', { roughness: 0.4 }), [0, 0, -6], { rot: [Math.PI / 2, 0, 0], segments: 64 }))
    const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 48, 16, 0, Math.PI * 2, 0, 0.62), mat('glass', '#7f98a8', { opacity: 0.35 }))
    dome.rotation.x = Math.PI / 2
    dome.position.z = -270
    door.add(dome)
    door.add(panelOn(30, 70, 20, trim, 210, -35, 10, { edge: 6 })) // handle
    door.children.forEach((c) => (c.castShadow = true))
    const doorPivot = new THREE.Group()
    doorPivot.position.set(-200, dy, D / 2 + 10)
    door.position.x = 200
    doorPivot.rotation.y = open ? -deg(100) : 0
    doorPivot.add(door)
    g.add(doorPivot)
    // Gasket and the drum: a stainless tub opening towards the door, with holes and lifters.
    g.add(new THREE.Mesh(new THREE.TorusGeometry(175, 14, 10, 48), mat('rubber', '#3a3b3e')).translateY(dy).translateZ(D / 2 - 4))
    const drumDepth = 380
    const drum = hollowCylinder(165, drumDepth, 3, mat('stainless', '#b9bcc0'), { segments: 56 })
    drum.rotation.x = Math.PI / 2
    drum.position.set(0, dy, D / 2 - 14 - drumDepth)
    g.add(drum)
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3
      const lifter = panel(30, 26, drumDepth - 40, mat('plastic', '#d9dcdf'), [0, 0, 0], { edge: 8 })
      lifter.position.set(Math.cos(a) * 150, dy + Math.sin(a) * 150, D / 2 - 14 - drumDepth / 2)
      lifter.rotation.z = a + Math.PI / 2
      g.add(lifter)
    }
    const holes: THREE.Mesh[] = []
    for (let r = 30; r < 160; r += 26) {
      const n = Math.round((2 * Math.PI * r) / 26)
      for (let k = 0; k < n; k++) holes.push(cyl(3.5, 3.5, 1, mat('matte', '#1a1a1a'), [Math.cos((k / n) * Math.PI * 2) * r, dy + Math.sin((k / n) * Math.PI * 2) * r, D / 2 - 14 - drumDepth + 3.6], { rot: [Math.PI / 2, 0, 0], segments: 6 }))
    }
    g.add(merged(holes, mat('matte', '#1a1a1a'), { castShadow: false }))
    // Service flap at the bottom left.
    g.add(panelOn(140, 90, 4, body, -W / 2 + 100, y0 + 40, D / 2 - 9, { edge: 3 }))
    g.add(panelOn(146, 2, 2, mat('matte', '#1d1a18'), -W / 2 + 100, y0 + 132, D / 2 - 9))
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
    const body = mat('plastic', color, { roughness: 0.38 })
    const dark = mat('plastic', color === '#2f2f31' ? '#141416' : '#3a3b3e', { roughness: 0.5 })
    const H = 290
    const D = 240
    const g = group()
    // Chassis with eased edges, a separate flat front panel (seam around it), and the top intake.
    g.add(panelOn(W, H, D - 30, body, 0, 0, -15, { edge: 12 }))
    g.add(panelOn(W - 6, H - 80, 22, body, 0, 70, D / 2 - 22, { edge: 8 }))
    g.add(panelOn(W - 30, 2, 2, mat('matte', '#1d1a18'), 0, 68, D / 2 - 10, { edge: 0 }))
    const slats: THREE.Mesh[] = []
    for (let k = 0; k < 14; k++) slats.push(panel(W - 60, 3, 6, dark, [0, H - 1, -D / 2 + 30 + k * 11], { edge: 0 }))
    g.add(merged(slats, dark, { castShadow: false }))
    // Outlet under the front: dark cavity, vertical louvres, and the horizontal flap tilted down.
    g.add(panelOn(W - 80, 50, 90, dark, 0, 8, D / 2 - 100, { edge: 4 }))
    const louvres: THREE.Mesh[] = []
    for (let x = -W / 2 + 70; x < W / 2 - 60; x += 32) louvres.push(panel(2.5, 42, 70, mat('plastic', '#cfd0ce'), [x, 32, D / 2 - 70], { edge: 0 }))
    g.add(merged(louvres, mat('plastic', '#cfd0ce'), { castShadow: false }))
    const flap = panel(W - 90, 10, 82, body, [0, 0, 0], { edge: 4 })
    flap.position.set(0, 22, D / 2 - 36)
    flap.rotation.x = deg(28)
    g.add(flap)
    // Display window with a small temperature readout and the status LED.
    g.add(panelOn(70, 18, 2, mat('plastic', '#1f2124', { roughness: 0.2 }), W / 2 - 90, 92, D / 2, { edge: 2 }))
    g.add(cyl(4, 4, 2, mat('emissive', '#7fe0a8', { intensity: 3 }), [W / 2 - 66, 101, D / 2 + 2], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
    g.add(panelOn(60, 2, 1, mat('matte', '#b9bcc0'), -W / 2 + 70, H - 40, D / 2 + 0.2, { edge: 0 }))
    return g
  },
})
