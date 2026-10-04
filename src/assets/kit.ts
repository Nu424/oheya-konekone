import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/**
 * Modelling kit used by asset builders. All sizes are in millimetres;
 * UVs are written in metres (1 texture repeat = 1 m) so textures keep a constant scale.
 */

type Axis = 'x' | 'y' | 'z'
type Vec = [number, number, number]

export interface MeshOpts {
  /** Direction wood grain / fabric weave runs. Defaults to the longest dimension. */
  grain?: Axis
  rot?: Vec
  castShadow?: boolean
  name?: string
}

// BoxGeometry face order: +x, -x, +y, -y, +z, -z. Each face's (u, v) world axes:
const FACE_AXES: [Axis, Axis][] = [
  ['z', 'y'],
  ['z', 'y'],
  ['x', 'z'],
  ['x', 'z'],
  ['x', 'y'],
  ['x', 'y'],
]

function worldUVs(geo: THREE.BufferGeometry, size: Record<Axis, number>, grain: Axis, verticesPerFace: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let f = 0; f < 6; f++) {
    const [ua, va] = FACE_AXES[f]
    const swap = grain === va
    for (let i = f * verticesPerFace; i < (f + 1) * verticesPerFace; i++) {
      const u = uv.getX(i) * size[ua] * 0.001
      const v = uv.getY(i) * size[va] * 0.001
      if (swap) uv.setXY(i, v, u)
      else uv.setXY(i, u, v)
    }
  }
  uv.needsUpdate = true
}

function longest(w: number, h: number, d: number): Axis {
  return w >= h && w >= d ? 'x' : h >= d ? 'y' : 'z'
}

function finish(mesh: THREE.Mesh, pos: Vec, o: MeshOpts) {
  mesh.position.set(...pos)
  if (o.rot) mesh.rotation.set(...o.rot)
  mesh.castShadow = o.castShadow ?? true
  mesh.receiveShadow = true
  if (o.name) mesh.name = o.name
  return mesh
}

/** Axis-aligned box. `pos` is the box centre. */
export function box(w: number, h: number, d: number, material: THREE.Material, pos: Vec = [0, 0, 0], o: MeshOpts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d)
  worldUVs(geo, { x: w, y: h, z: d }, o.grain ?? longest(w, h, d), 4)
  return finish(new THREE.Mesh(geo, material), pos, o)
}

/** Box whose bottom sits at `y` (handier for stacking furniture parts). */
export function boxOn(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, o: MeshOpts = {}) {
  return box(w, h, d, material, [x, y + h / 2, z], o)
}

/** Rounded box (cushions, appliances). `pos` is the centre. */
export function rbox(w: number, h: number, d: number, radius: number, material: THREE.Material, pos: Vec = [0, 0, 0], o: MeshOpts & { segments?: number } = {}) {
  const r = Math.max(0.5, Math.min(radius, w / 2 - 0.5, h / 2 - 0.5, d / 2 - 0.5))
  const geo = new RoundedBoxGeometry(w, h, d, o.segments ?? 4, r)
  // RoundedBoxGeometry has UVs per face in 0..1; scale them to metres along the dominant axes.
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const s = Math.max(w, h, d) * 0.001
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s)
  return finish(new THREE.Mesh(geo, material), pos, o)
}

/** Vertical cylinder; `pos` is the centre. Use rot to lay it down. */
export function cyl(rTop: number, rBottom: number, h: number, material: THREE.Material, pos: Vec = [0, 0, 0], o: MeshOpts & { segments?: number; open?: boolean } = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, o.segments ?? 32, 1, o.open ?? false)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const circ = Math.PI * 2 * Math.max(rTop, rBottom) * 0.001
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h * 0.001)
  return finish(new THREE.Mesh(geo, material), pos, o)
}

export function sphere(r: number, material: THREE.Material, pos: Vec = [0, 0, 0], o: MeshOpts & { segments?: number } = {}) {
  const geo = new THREE.SphereGeometry(r, o.segments ?? 32, Math.max(8, (o.segments ?? 32) / 2))
  return finish(new THREE.Mesh(geo, material), pos, o)
}

/** Lathe around Y from a list of [radius, y] points (lamp shades, pots, vases). */
export function lathe(points: [number, number][], material: THREE.Material, pos: Vec = [0, 0, 0], o: MeshOpts & { segments?: number } = {}) {
  const geo = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    o.segments ?? 40,
  )
  return finish(new THREE.Mesh(geo, material), pos, o)
}

/** Extrude a 2D outline (in the XY plane) by `depth` along Z, centred on Z. */
export function extrude(shape: THREE.Shape, depth: number, material: THREE.Material, pos: Vec = [0, 0, 0], o: MeshOpts & { bevel?: number } = {}) {
  const bevel = o.bevel ?? 0
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  })
  geo.translate(0, 0, -(depth - bevel * 2) / 2)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.001, uv.getY(i) * 0.001)
  return finish(new THREE.Mesh(geo, material), pos, o)
}

/** Tube along a path of points (chair frames, lamp arms). */
export function tube(points: Vec[], radius: number, material: THREE.Material, o: MeshOpts & { segments?: number; closed?: boolean; tension?: number } = {}) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    o.closed ?? false,
    'catmullrom',
    o.tension ?? 0.1,
  )
  const geo = new THREE.TubeGeometry(curve, o.segments ?? Math.max(16, points.length * 12), radius, 12, o.closed ?? false)
  return finish(new THREE.Mesh(geo, material), [0, 0, 0], o)
}

/** Rounded-rectangle 2D shape centred on the origin. */
export function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  r = Math.min(r, w / 2, h / 2)
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

export function group(...children: (THREE.Object3D | null | undefined | false)[]) {
  const g = new THREE.Group()
  for (const c of children) if (c) g.add(c)
  return g
}

export const deg = (d: number) => (d * Math.PI) / 180
