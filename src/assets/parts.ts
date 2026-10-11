import * as THREE from 'three'
import { mat } from '../three/materials'
import { boxOn, cyl, deg, group, lathe, panel, panelOn, tube } from './kit'

/**
 * Furniture parts shared by asset builders: handles, doors, drawers, feet and casters.
 * All sizes in mm. Unless noted, a part is built with its origin at the bottom centre of its
 * back face, facing +Z, so the caller only has to move it to where it sits.
 *
 * The details here (2–3 mm gaps, eased edges, small hardware) are what make furniture read as
 * real; keep them even when they are tiny.
 */

/** Width of the shadow gap between doors / drawer fronts and their neighbours. */
export const GAP = 3
/** Dark colour behind gaps, so they read as seams. */
export const SEAM = '#1d1a18'

export type HandleKind = 'bar' | 'knob' | 'groove' | 'cup' | 'lever' | 'none'

export const HANDLE_LABELS: Record<HandleKind, string> = {
  bar: 'バー',
  knob: 'つまみ',
  groove: '溝（彫り込み）',
  cup: 'くぼみ',
  lever: 'レバー（ロッカー）',
  none: 'なし',
}

/**
 * A handle centred on the origin, sticking out towards +Z from z = 0.
 * `length` is the bar length (ignored for knobs); `vertical` turns bars upright.
 */
export function handle(kind: HandleKind, length: number, o: { color?: string; vertical?: boolean } = {}): THREE.Object3D | null {
  const metal = mat('stainless', o.color ?? '#b9bcc0')
  const g = new THREE.Group()
  switch (kind) {
    case 'bar': {
      const L = Math.max(60, length)
      // Two short posts and a round bar, like a typical steel pull.
      for (const s of [-1, 1]) g.add(cyl(4, 4, 22, metal, [s * (L / 2 - 8), 0, 11], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
      g.add(cyl(5, 5, L, metal, [0, 0, 24], { rot: [0, 0, Math.PI / 2], segments: 14 }))
      break
    }
    case 'knob':
      g.add(cyl(7, 9, 14, metal, [0, 0, 7], { rot: [Math.PI / 2, 0, 0], segments: 16 }))
      g.add(cyl(14, 14, 8, metal, [0, 0, 18], { rot: [Math.PI / 2, 0, 0], segments: 20 }))
      break
    case 'groove':
      // A dark slot routed into the front: thin, and slightly inset.
      g.add(boxOn(Math.max(60, length), 10, 2, mat('matte', SEAM), 0, -5, -0.5))
      break
    case 'cup':
      g.add(panel(Math.max(60, length * 0.6), 26, 4, mat('matte', '#2a2724'), [0, 0, 0.5], { edge: 1.5 }))
      g.add(boxOn(Math.max(52, length * 0.6 - 8), 4, 6, metal, 0, 9, 0))
      break
    case 'lever':
      g.add(panel(30, 90, 6, mat('powder', '#3a3b3e'), [0, 0, 3], { edge: 2 }))
      g.add(panel(14, 46, 10, metal, [0, -6, 10], { edge: 3 }))
      g.add(cyl(5, 5, 4, mat('chrome', '#d8dadc'), [0, 30, 7], { rot: [Math.PI / 2, 0, 0], segments: 12 }))
      break
    case 'none':
      return null
  }
  if (o.vertical) g.rotation.z = Math.PI / 2
  return g
}

export interface FrontOpts {
  material: THREE.Material
  handle?: HandleKind
  handleColor?: string
  /** Thickness of the door / drawer front. */
  t?: number
  /** Edge radius of the front. */
  edge?: number
}

/**
 * A drawer: front (with handle) plus, when pulled out, the box behind it.
 * Origin: bottom centre of the front's back face (where it closes against the carcass).
 * `w` / `h` are the opening size; the front is reduced by the gap on every side.
 */
export function drawer(w: number, h: number, depth: number, o: FrontOpts & { out?: number; inner?: THREE.Material }) {
  const t = o.t ?? 18
  const fw = w - GAP
  const fh = h - GAP
  const g = new THREE.Group()
  const out = Math.max(0, Math.min(depth * 0.85, o.out ?? 0))
  const front = new THREE.Group()
  front.add(panelOn(fw, fh, t, o.material, 0, GAP / 2, t / 2, { edge: o.edge ?? 1.5 }))
  const hd = handle(o.handle ?? 'bar', Math.min(180, fw * 0.4), { color: o.handleColor })
  if (hd) {
    hd.position.set(0, o.handle === 'groove' ? h - 22 : GAP / 2 + fh * 0.5, t)
    front.add(hd)
  }
  if (out > 0) {
    // The box: sides, back and bottom, a little lower than the front.
    const inner = o.inner ?? mat('wood', '#e4cfa8')
    const bh = Math.max(40, fh - 30)
    const bd = depth - 30
    for (const s of [-1, 1]) front.add(boxOn(12, bh, bd, inner, s * (fw / 2 - 26), 14, -bd / 2))
    front.add(boxOn(fw - 40, bh, 12, inner, 0, 14, -bd + 6))
    front.add(boxOn(fw - 40, 8, bd, inner, 0, 14, -bd / 2))
  }
  front.position.z = out
  g.add(front)
  return g
}

export type HingeSide = 'left' | 'right' | 'top' | 'bottom'

/**
 * A hinged door that swings out towards +Z. Origin: bottom centre of the closed door's back face.
 * `open` 0..1 maps to 0..100° (flap doors up to 85°). `glass` gives a framed glass door.
 */
export function hingedDoor(w: number, h: number, o: FrontOpts & { hinge: HingeSide; open?: number; glass?: boolean; frameWidth?: number }) {
  const t = o.t ?? 18
  const fw = w - GAP
  const fh = h - GAP
  const leaf = new THREE.Group()
  if (o.glass) {
    const f = o.frameWidth ?? 40
    leaf.add(panelOn(fw, f, t, o.material, 0, 0, t / 2, { edge: o.edge ?? 1.5 }))
    leaf.add(panelOn(fw, f, t, o.material, 0, fh - f, t / 2, { edge: o.edge ?? 1.5 }))
    for (const s of [-1, 1]) leaf.add(panelOn(f, fh - f * 2, t, o.material, s * (fw / 2 - f / 2), f, t / 2, { edge: o.edge ?? 1.5 }))
    leaf.add(boxOn(fw - f * 2 + 4, fh - f * 2 + 4, 4, mat('glass', '#dfe9ee', { opacity: 0.22 }), 0, f - 2, t / 2))
  } else leaf.add(panelOn(fw, fh, t, o.material, 0, 0, t / 2, { edge: o.edge ?? 1.5 }))
  // Handle on the edge opposite the hinge.
  const vertical = o.hinge === 'left' || o.hinge === 'right'
  const hd = handle(o.handle ?? 'bar', Math.min(160, (vertical ? fh : fw) * 0.3), { color: o.handleColor, vertical })
  if (hd) {
    if (o.hinge === 'left') hd.position.set(fw / 2 - 40, fh * 0.5, t)
    else if (o.hinge === 'right') hd.position.set(-fw / 2 + 40, fh * 0.5, t)
    else if (o.hinge === 'top') hd.position.set(0, 40, t)
    else hd.position.set(0, fh - 40, t)
    leaf.add(hd)
  }
  // Pivot along the hinge edge.
  const pivot = new THREE.Group()
  const a = deg((o.open ?? 0) * (vertical ? 100 : 85))
  if (o.hinge === 'left') {
    pivot.position.set(-fw / 2, GAP / 2, 0)
    leaf.position.x = fw / 2
    pivot.rotation.y = -a
  } else if (o.hinge === 'right') {
    pivot.position.set(fw / 2, GAP / 2, 0)
    leaf.position.x = -fw / 2
    pivot.rotation.y = a
  } else if (o.hinge === 'top') {
    pivot.position.set(0, GAP / 2 + fh, 0)
    leaf.position.y = -fh
    pivot.rotation.x = -a
  } else {
    pivot.position.set(0, GAP / 2, 0)
    pivot.rotation.x = a
  }
  pivot.add(leaf)
  return group(pivot)
}

/**
 * A pair of sliding doors on two tracks. Origin: bottom centre of the rear track.
 * `open` 0..1 slides the front door over the rear one. `glass` makes both panes glass in a frame.
 */
export function slidingDoors(w: number, h: number, o: FrontOpts & { open?: number; glass?: boolean }) {
  const t = o.t ?? 14
  const g = new THREE.Group()
  const leafW = w / 2 + 15 // overlap in the middle
  const make = () => {
    const leaf = new THREE.Group()
    if (o.glass) {
      const f = 22
      leaf.add(panelOn(leafW, f, t, o.material, 0, 0, t / 2, { edge: 1 }))
      leaf.add(panelOn(leafW, f, t, o.material, 0, h - GAP - f, t / 2, { edge: 1 }))
      for (const s of [-1, 1]) leaf.add(panelOn(f, h - GAP - f * 2, t, o.material, s * (leafW / 2 - f / 2), f, t / 2, { edge: 1 }))
      leaf.add(boxOn(leafW - f * 2 + 4, h - GAP - f * 2 + 4, 4, mat('glass', '#dfe9ee', { opacity: 0.2 }), 0, f - 2, t / 2))
    } else leaf.add(panelOn(leafW, h - GAP, t, o.material, 0, 0, t / 2, { edge: o.edge ?? 1.5 }))
    // Recessed finger pull near the outer edge.
    const pull = boxOn(18, Math.min(120, h * 0.25), 2, mat('matte', SEAM), 0, (h - GAP) * 0.5 - Math.min(60, h * 0.125), t + 0.3)
    leaf.add(pull)
    return { leaf, pull }
  }
  const rear = make()
  rear.pull.position.x = leafW / 2 - 30
  rear.leaf.position.set(w / 4 - 7.5, GAP / 2, 0)
  const front = make()
  front.pull.position.x = -leafW / 2 + 30
  const slide = Math.max(0, Math.min(1, o.open ?? 0)) * (w / 2 - 15)
  front.leaf.position.set(-w / 4 + 7.5 + slide, GAP / 2, t + 2)
  g.add(rear.leaf, front.leaf)
  return g
}

/** A levelling foot: a small dark disc under furniture. Origin: floor contact point. */
export function adjuster(h = 10, r = 14) {
  return cyl(r, r, h, mat('rubber', '#2a2a2a'), [0, h / 2, 0], { segments: 16 })
}

/**
 * A twin-wheel swivel caster. Origin: floor contact point; the mounting plate is at `size` mm.
 * `turn` rotates the wheel housing (casters rarely all point the same way).
 */
export function caster(size = 50, o: { color?: string; turn?: number; lock?: boolean } = {}) {
  const body = mat('plastic', o.color ?? '#2b2b2d', { roughness: 0.45 })
  const r = size * 0.36
  const g = new THREE.Group()
  const fork = new THREE.Group()
  // Two wheels either side of a central housing, offset behind the swivel axis.
  for (const s of [-1, 1]) fork.add(cyl(r, r, size * 0.16, mat('rubber', '#1f1f20'), [s * size * 0.12, r, -size * 0.12], { rot: [0, 0, Math.PI / 2], segments: 18 }))
  fork.add(panel(size * 0.1, size * 0.62, size * 0.5, body, [0, size * 0.5, -size * 0.06], { edge: size * 0.04 }))
  if (o.lock) fork.add(panel(size * 0.34, size * 0.06, size * 0.22, mat('plastic', '#c94a3c'), [0, size * 0.8, size * 0.18], { edge: 1 }))
  fork.rotation.y = o.turn ?? 0
  g.add(fork)
  g.add(cyl(size * 0.12, size * 0.12, size * 0.2, mat('chrome', '#cfd2d5'), [0, size * 0.88, 0], { segments: 12 }))
  return g
}

/** Four of something at the corners of a w × d rectangle, inset by `inset`. */
export function atCorners(w: number, d: number, inset: number, make: (i: number) => THREE.Object3D) {
  const g = new THREE.Group()
  let i = 0
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const o = make(i++)
      o.position.x += sx * (w / 2 - inset)
      o.position.z += sz * (d / 2 - inset)
      g.add(o)
    }
  return g
}

/** A round steel tube between two points (frames, rails). */
export function rod(a: [number, number, number], b: [number, number, number], r: number, material: THREE.Material) {
  return tube([a, b], r, material, { segments: 2 })
}

/**
 * A box made of walls with one open side: the cavity behind a door or under a lid (an oven, a
 * drawer, a washer cabinet). Anything that opens should show a real hollow inside, never the
 * solid block it was modelled as. Origin: bottom centre. `open` is the side left open.
 * `inner` lines the inside faces (a light enamel in an oven, raw board in a drawer).
 */
export function hollowBox(w: number, h: number, d: number, wall: number, material: THREE.Material, o: { open?: 'front' | 'top'; inner?: THREE.Material; edge?: number } = {}) {
  const g = new THREE.Group()
  const open = o.open ?? 'front'
  const e = o.edge ?? 1.5
  const t = wall
  g.add(panelOn(w, t, d, material, 0, 0, 0, { edge: e })) // bottom
  if (open !== 'top') g.add(panelOn(w, t, d, material, 0, h - t, 0, { edge: e })) // top
  for (const s of [-1, 1]) g.add(panelOn(t, h, d, material, s * (w / 2 - t / 2), 0, 0, { edge: e })) // sides
  g.add(panelOn(w, h, t, material, 0, 0, -d / 2 + t / 2, { edge: e })) // back
  if (open !== 'front') g.add(panelOn(w, h, t, material, 0, 0, d / 2 - t / 2, { edge: e })) // front
  if (o.inner) {
    // A thin liner just inside every closed face.
    const iw = w - t * 2
    const ih = h - t * (open === 'top' ? 1 : 2)
    const idp = d - t * (open === 'front' ? 1 : 2)
    const cz = open === 'front' ? t / 2 : 0
    const L = new THREE.Group()
    L.add(boxOn(iw, 0.6, idp, o.inner, 0, t, cz))
    if (open !== 'top') L.add(boxOn(iw, 0.6, idp, o.inner, 0, h - t - 0.6, cz))
    for (const s of [-1, 1]) L.add(boxOn(0.6, ih, idp, o.inner, s * (iw / 2 - 0.3), t, cz))
    L.add(boxOn(iw, ih, 0.6, o.inner, 0, t, -d / 2 + t + 0.3))
    if (open !== 'front') L.add(boxOn(iw, ih, 0.6, o.inner, 0, t, d / 2 - t - 0.3))
    L.traverse((m) => (m.castShadow = false))
    g.add(L)
  }
  return g
}

/**
 * A round tub with one open end (a washing drum, a rice pot, a bucket). Origin: centre of the
 * closed bottom; the open end faces +Y. Rotate it (rotation.x = π/2) to open towards +Z.
 */
export function hollowCylinder(r: number, depth: number, wall: number, material: THREE.Material, o: { segments?: number; lip?: number } = {}) {
  const lip = o.lip ?? 0
  const pts: [number, number][] = [
    [0, 0],
    [r, 0],
    [r, depth],
    [r + lip, depth],
    [r + lip, depth + Math.min(4, wall)],
    [r - wall, depth + Math.min(4, wall)],
    [r - wall, wall],
    [0, wall],
  ]
  return lathe(pts, material, [0, 0, 0], { segments: o.segments ?? 48 })
}
