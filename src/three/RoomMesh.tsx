import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ClosetOpening, DoorOpening, Opening, Room, WallSide, WindowOpening } from '../model/schema'
import type { z } from 'zod'
import { mat } from './materials'
import { floorTextures, skyView, wallpaper } from './textures'

const S = 0.001

type Door = z.infer<typeof DoorOpening>
type Win = z.infer<typeof WindowOpening>
type Closet = z.infer<typeof ClosetOpening>

/** Material used for parts hidden by the dollhouse cutaway: invisible, but still casts shadows. */
const GHOST = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

interface WallFrame {
  side: WallSide
  /** Interior length of the wall. */
  length: number
  /** Converts wall-local (u along wall, v up, w into the wall thickness / outward) to room mm. */
  toRoom(u: number, v: number, w: number): THREE.Vector3
  /** Yaw so that local +Z points into the room. */
  yaw: number
  inward: THREE.Vector3
}

function wallFrames(room: Room): WallFrame[] {
  const { width: W, depth: D } = room
  return [
    { side: 'north', length: W, toRoom: (u, v, w) => new THREE.Vector3(u, v, -w), yaw: 0, inward: new THREE.Vector3(0, 0, 1) },
    { side: 'south', length: W, toRoom: (u, v, w) => new THREE.Vector3(u, v, D + w), yaw: Math.PI, inward: new THREE.Vector3(0, 0, -1) },
    { side: 'west', length: D, toRoom: (u, v, w) => new THREE.Vector3(-w, v, u), yaw: Math.PI / 2, inward: new THREE.Vector3(1, 0, 0) },
    { side: 'east', length: D, toRoom: (u, v, w) => new THREE.Vector3(W + w, v, u), yaw: -Math.PI / 2, inward: new THREE.Vector3(-1, 0, 0) },
  ]
}

/**
 * Box in wall-local coordinates: u0..u1 along the wall, v0..v1 vertical, w0..w1 through the thickness
 * (w=0 is the interior face, positive goes outward). Returns a mesh positioned in room mm.
 */
function wallBox(f: WallFrame, u0: number, u1: number, v0: number, v1: number, w0: number, w1: number, material: THREE.Material | THREE.Material[]) {
  const lu = u1 - u0
  const lv = v1 - v0
  const lw = w1 - w0
  const along = f.side === 'north' || f.side === 'south'
  const geo = new THREE.BoxGeometry(along ? lu : lw, lv, along ? lw : lu)
  // World-scale UVs (1 repeat = 1 m) so wallpaper/wood keep scale.
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const dims = along ? [lu, lv, lw] : [lw, lv, lu]
  const faceSpan: [number, number][] = [
    [dims[2], dims[1]],
    [dims[2], dims[1]],
    [dims[0], dims[2]],
    [dims[0], dims[2]],
    [dims[0], dims[1]],
    [dims[0], dims[1]],
  ]
  for (let fi = 0; fi < 6; fi++)
    for (let i = fi * 4; i < fi * 4 + 4; i++) uv.setXY(i, uv.getX(i) * faceSpan[fi][0] * S, uv.getY(i) * faceSpan[fi][1] * S)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.copy(f.toRoom((u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function openingSpan(o: Opening): [number, number] {
  return o.type === 'window' ? [o.sill, o.sill + o.height] : [0, o.height]
}

interface WallBuild {
  frame: WallFrame
  full: THREE.Group
  stub: THREE.Group
  lights: { pos: THREE.Vector3; yaw: number; w: number; h: number }[]
}

const STUB = 90

function buildWall(room: Room, f: WallFrame, wallMats: THREE.Material[], capMat: THREE.Material): WallBuild {
  const t = room.wallThickness
  const H = room.height
  const full = new THREE.Group()
  const stub = new THREE.Group()
  const lights: WallBuild['lights'] = []
  const along = f.side === 'north' || f.side === 'south'
  // North/south walls run past the corners to close them.
  const start = along ? -t : 0
  const end = along ? f.length + t : f.length
  const openings = room.openings.filter((o) => o.wall === f.side).sort((a, b) => a.offset - b.offset)

  let cursor = start
  const solid = (u0: number, u1: number, v0: number, v1: number) => {
    if (u1 - u0 < 0.5 || v1 - v0 < 0.5) return
    full.add(wallBox(f, u0, u1, v0, v1, 0, t, wallMats))
    if (v0 < STUB) stub.add(wallBox(f, u0, u1, v0, Math.min(v1, STUB), 0, t, wallMats))
  }

  for (const o of openings) {
    const [b, top] = openingSpan(o)
    solid(cursor, o.offset, 0, H)
    solid(o.offset, o.offset + o.width, top, H) // lintel
    solid(o.offset, o.offset + o.width, 0, b) // below window
    if (o.type === 'window') {
      buildWindow(full, f, o, t)
      const c = f.toRoom(o.offset + o.width / 2, b + o.height / 2, 0)
      lights.push({ pos: c, yaw: f.yaw, w: o.width, h: o.height })
    }
    if (o.type === 'door') buildDoor(full, f, o, t)
    if (o.type === 'closet') buildCloset(full, f, o, t, room)
    cursor = Math.max(cursor, o.offset + o.width)
  }
  solid(cursor, end, 0, H)

  // Cap faces get the poché colour (index 2 is +Y on BoxGeometry).
  for (const g of [full, stub])
    g.traverse((m) => {
      if (m instanceof THREE.Mesh && Array.isArray(m.material)) m.material = m.material.map((mm, i) => (i === 2 ? capMat : mm))
    })

  // Baseboard (skip doors, closets and floor-level windows).
  const bb = room.baseboard
  if (bb.height > 0) {
    const bbMat = mat('matte', bb.color, { roughness: 0.6 })
    let c = 0
    const gaps = openings.filter((o) => o.type !== 'window' || o.sill < bb.height)
    for (const o of [...gaps, null]) {
      const u1 = o ? o.offset : f.length
      if (u1 - c > 5) full.add(wallBox(f, c, u1, 0, bb.height, -9, 0, bbMat))
      if (o) c = o.offset + o.width
    }
  }
  return { frame: f, full, stub, lights }
}

function place(parent: THREE.Object3D, f: WallFrame, mesh: THREE.Mesh, u: number, v: number, w: number) {
  mesh.position.copy(f.toRoom(u, v, w))
  mesh.rotation.y = f.yaw
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function buildWindow(g: THREE.Group, f: WallFrame, o: Win, t: number) {
  const frameMat = mat('metal', o.frameColor, { roughness: 0.4 })
  const glass = mat('glass', '#dfeaf2', { opacity: 0.1 })
  const fw = 40 // frame bar width
  const fd = 70 // frame depth
  const wc = t * 0.55 // frame sits a bit outward of the wall centre
  const u0 = o.offset
  const u1 = o.offset + o.width
  const v0 = o.sill
  const v1 = o.sill + o.height
  const bar = (w: number, h: number, d: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat)
  place(g, f, bar(o.width, fw, fd), (u0 + u1) / 2, v0 + fw / 2, wc)
  place(g, f, bar(o.width, fw, fd), (u0 + u1) / 2, v1 - fw / 2, wc)
  place(g, f, bar(fw, o.height, fd), u0 + fw / 2, (v0 + v1) / 2, wc)
  place(g, f, bar(fw, o.height, fd), u1 - fw / 2, (v0 + v1) / 2, wc)
  // Two sliding sashes, overlapping in the middle, on two tracks.
  const ih = o.height - fw * 2
  const sw = (o.width - fw * 2) / 2 + 20
  for (const [i, du] of [
    [0, -1],
    [1, 1],
  ] as const) {
    const cu = (u0 + u1) / 2 + du * (sw / 2 - 10)
    const cw = wc + (i ? 18 : -18)
    const sash = new THREE.Group()
    const s = 28
    const sm = (w: number, h: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, 24), frameMat)
    const parts: [THREE.Mesh, number, number][] = [
      [sm(sw, s), 0, ih / 2 - s / 2],
      [sm(sw, s), 0, -ih / 2 + s / 2],
      [sm(s, ih), sw / 2 - s / 2, 0],
      [sm(s, ih), -sw / 2 + s / 2, 0],
    ]
    for (const [m, x, y] of parts) {
      m.position.set(x, y, 0)
      m.castShadow = true
      sash.add(m)
    }
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(sw - s * 2, ih - s * 2), glass)
    pane.castShadow = false
    pane.userData.glass = true
    sash.add(pane)
    sash.position.copy(f.toRoom(cu, (v0 + v1) / 2, cw))
    sash.rotation.y = f.yaw
    g.add(sash)
  }
  // The view outside: an unlit sky panel behind the glass, visible from inside only.
  const view = new THREE.Mesh(
    new THREE.PlaneGeometry(o.width, o.height),
    new THREE.MeshBasicMaterial({ map: skyView(), color: new THREE.Color(1.15, 1.15, 1.15) }),
  )
  place(g, f, view, (u0 + u1) / 2, (v0 + v1) / 2, t + 40)
  view.castShadow = false
  view.receiveShadow = false
  // Interior sill board for raised windows.
  if (o.sill > 0) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(o.width + 60, 22, t * 0.5 + 25), mat('wood', '#e9e1d3', { roughness: 0.5 }))
    place(g, f, sill, (u0 + u1) / 2, v0 - 11, (t * 0.5 - 25) / 2)
  }
}

function buildDoor(g: THREE.Group, f: WallFrame, o: Door, t: number) {
  const trim = mat('matte', o.color, { roughness: 0.55 })
  const leaf = mat('matte', o.color, { roughness: 0.45 })
  const metal = mat('metal', '#b9bcc0', { roughness: 0.3 })
  const cw = 60 // casing width
  const u0 = o.offset
  const u1 = o.offset + o.width
  // Casing on the interior face.
  const cas = (w: number, h: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), trim)
  place(g, f, cas(o.width + cw * 2, cw), (u0 + u1) / 2, o.height + cw / 2, -7)
  place(g, f, cas(cw, o.height), u0 - cw / 2, o.height / 2, -7)
  place(g, f, cas(cw, o.height), u1 + cw / 2, o.height / 2, -7)
  // Jambs
  const jamb = (w: number, h: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, t), trim)
  place(g, f, jamb(o.width, 20), (u0 + u1) / 2, o.height - 10, t / 2)
  place(g, f, jamb(20, o.height), u0 + 10, o.height / 2, t / 2)
  place(g, f, jamb(20, o.height), u1 - 10, o.height / 2, t / 2)
  // Closed leaf, flush with the interior side (or exterior if it swings out).
  const lw = o.width - 44
  const lh = o.height - 22
  const lt = 36
  const wl = o.swing === 'in' ? lt / 2 + 6 : t - lt / 2 - 6
  const leafMesh = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, lt), leaf)
  place(g, f, leafMesh, (u0 + u1) / 2, lh / 2 + 2, wl)
  // Subtle panel grooves
  for (const y of [lh * 0.3, lh * 0.72]) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(lw - 120, 6, 2), mat('matte', '#d8d2c8'))
    place(g, f, groove, (u0 + u1) / 2, y, wl - lt / 2 - 1)
  }
  // Lever handle on the latch side. Hinge side is as seen from inside the room.
  // Inside view: wall-local u increases to the right for north/east... normalise via a sign.
  const rightIsHighU = f.side === 'north' || f.side === 'east'
  const hingeHighU = (o.hinge === 'right') === rightIsHighU
  const latchU = hingeHighU ? u0 + 80 : u1 - 80
  const lever = new THREE.Group()
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 10, 24), metal)
  rose.rotation.x = Math.PI / 2
  const handle = new THREE.Mesh(new THREE.BoxGeometry(120, 16, 16), metal)
  // Local +Z points into the room; local +X follows +u on north/east walls and -u on south/west.
  const sgn = f.side === 'north' || f.side === 'east' ? 1 : -1
  handle.position.set((hingeHighU ? 50 : -50) * sgn, 0, 26)
  rose.position.z = 6
  lever.add(rose, handle)
  lever.traverse((m) => (m.castShadow = true))
  lever.position.copy(f.toRoom(latchU, 1000, wl - lt / 2))
  lever.rotation.y = f.yaw
  g.add(lever)
}

function buildCloset(g: THREE.Group, f: WallFrame, o: Closet, t: number, room: Room) {
  const u0 = o.offset
  const u1 = o.offset + o.width
  const H = o.height
  const doorMat = mat('matte', o.color, { roughness: 0.5 })
  const trim = mat('matte', room.baseboard.color, { roughness: 0.55 })
  const innerMat = mat('matte', '#efeae2', { roughness: 0.9 })
  const wallMat = mat('matte', room.wall.color, { roughness: 0.9 })
  const capMat = mat('matte', '#6f6a64')

  // Enclosure behind the wall: back wall, two side walls, floor and top.
  const back = o.depth + t
  const enc: [number, number, number, number, number, number][] = [
    [u0 - t, u1 + t, 0, room.height, back, back + t], // back
    [u0 - t, u0, 0, room.height, t, back], // side
    [u1, u1 + t, 0, room.height, t, back], // side
  ]
  for (const [a, b, c, d, e, h] of enc) {
    const m = wallBox(f, a, b, c, d, e, h, [wallMat, wallMat, capMat, wallMat, wallMat, wallMat])
    m.userData.closetShell = true
    g.add(m)
  }
  g.add(wallBox(f, u0, u1, -1, 0, t, back, innerMat)) // floor
  g.add(wallBox(f, u0, u1, H, H + 18, t, back, innerMat)) // shelf / head
  // Interior: shelf + hanger pipe
  g.add(wallBox(f, u0, u1, 1800, 1818, t, back, innerMat))
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, o.width, 16), mat('metal', '#cfd2d6', { roughness: 0.25 }))
  pipe.rotation.z = Math.PI / 2
  place(g, f, pipe, (u0 + u1) / 2, 1700, t + o.depth / 2)
  pipe.rotation.set(0, f.yaw, Math.PI / 2)

  // Trim
  const cw = 50
  const cas = (w: number, h: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), trim)
  place(g, f, cas(o.width + cw * 2, cw), (u0 + u1) / 2, H + cw / 2, -7)
  place(g, f, cas(cw, H), u0 - cw / 2, H / 2, -7)
  place(g, f, cas(cw, H), u1 + cw / 2, H / 2, -7)

  if (o.doorStyle === 'open') return
  const n = o.doorStyle === 'sliding' ? 2 : o.width > 1500 ? 4 : 2
  const pw = o.doorStyle === 'sliding' ? o.width / 2 + 25 : o.width / n
  for (let i = 0; i < n; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(pw - 4, H - 10, 28), doorMat)
    let cu: number
    let w: number
    if (o.doorStyle === 'sliding') {
      cu = i === 0 ? u0 + pw / 2 : u1 - pw / 2
      w = t * 0.3 + i * 32
    } else {
      cu = u0 + pw * (i + 0.5)
      w = t * 0.3 + (i % 2) * 14
    }
    place(g, f, panel, cu, H / 2, w)
    // Recessed pull
    const pull = new THREE.Mesh(new THREE.BoxGeometry(18, 160, 4), mat('metal', '#a7aaae', { roughness: 0.35 }))
    const pu = o.doorStyle === 'sliding' ? (i === 0 ? cu + pw / 2 - 60 : cu - pw / 2 + 60) : cu + (i % 2 ? -1 : 1) * (pw / 2 - 40)
    place(g, f, pull, pu, 1000, w - 15)
    // Folding doors: vertical seam line between pairs
    if (o.doorStyle === 'folding' && i % 2 === 1) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(4, H - 20, 30), mat('matte', '#cfc8bd'))
      place(g, f, seam, cu - pw / 2, H / 2, w)
    }
  }
}

export interface RoomBuild {
  group: THREE.Group
  walls: WallBuild[]
  ceiling: THREE.Mesh
  windowLights: WallBuild['lights']
}

export function buildRoom(room: Room): RoomBuild {
  const { width: W, depth: D, height: H, wallThickness: t } = room
  const root = new THREE.Group()

  // Floor
  const ft = floorTextures(room.floor.material, room.floor.color)
  const floorMat = new THREE.MeshStandardMaterial({
    map: ft.map,
    roughnessMap: ft.roughnessMap,
    roughness: ft.roughness,
    ...(ft.bumpMap ? { bumpMap: ft.bumpMap, bumpScale: 1.5 } : {}),
  })
  const floorGeo = new THREE.PlaneGeometry(W, D)
  const fuv = floorGeo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fuv.getX(i) * W) / ft.size, (fuv.getY(i) * D) / ft.size)
  floorGeo.rotateX(-Math.PI / 2)
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.position.set(W / 2, 0, D / 2)
  floor.receiveShadow = true
  floor.name = 'floor'
  root.add(floor)

  // Slab under everything for a diorama look.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + t * 2 + 40, 160, D + t * 2 + 40), mat('matte', '#d9cfc2', { roughness: 0.95 }))
  slab.position.set(W / 2, -80.5, D / 2)
  slab.receiveShadow = true
  root.add(slab)

  // Walls
  const wp = wallpaper()
  const wallMat = new THREE.MeshStandardMaterial({ color: room.wall.color, roughness: 0.92, bumpMap: wp, bumpScale: 0.35 })
  wp.repeat.set(3, 3)
  const capMat = mat('matte', '#6f6a64', { roughness: 0.9 })
  const wallMats = Array.from({ length: 6 }, () => wallMat)
  const walls = wallFrames(room).map((f) => buildWall(room, f, wallMats, capMat))
  for (const w of walls) root.add(w.full, w.stub)

  // Columns
  for (const c of room.columns) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(c.width, H, c.depth), [wallMat, wallMat, capMat, wallMat, wallMat, wallMat])
    col.position.set(c.x, H / 2, c.z)
    col.castShadow = col.receiveShadow = true
    root.add(col)
  }

  // Ceiling (one-sided, facing down). Hidden visually in the dollhouse view but still blocks the sun.
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(W + t * 2, 30, D + t * 2),
    new THREE.MeshStandardMaterial({ color: room.ceiling.color, roughness: 0.95 }),
  )
  ceiling.position.set(W / 2, H + 15, D / 2)
  ceiling.castShadow = true
  ceiling.receiveShadow = true
  root.add(ceiling)

  root.scale.setScalar(S)
  return { group: root, walls, ceiling, windowLights: walls.flatMap((w) => w.lights) }
}

function setGhost(obj: THREE.Object3D, ghost: boolean) {
  obj.traverse((m) => {
    if (!(m instanceof THREE.Mesh)) return
    if (ghost) {
      if (m.userData.orig === undefined) m.userData.orig = m.material
      m.material = GHOST
    } else if (m.userData.orig !== undefined) {
      m.material = m.userData.orig
      delete m.userData.orig
    }
  })
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((m) => {
    if (m instanceof THREE.Mesh) m.geometry.dispose()
  })
}

/** Room geometry with the dollhouse cutaway: walls facing the camera drop to a low stub. */
export function RoomMesh({ room, cutaway = true, plan = false }: { room: Room; cutaway?: boolean; plan?: boolean }) {
  const build = useMemo(() => buildRoom(room), [room])
  const state = useRef<{ cut: boolean[]; ceiling: boolean }>({ cut: [], ceiling: false })

  useEffect(() => {
    state.current = { cut: build.walls.map(() => false), ceiling: false }
    for (const w of build.walls) w.stub.visible = false
    return () => {
      disposeObject(build.group)
    }
  }, [build])

  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const cam = camera.position
    const inside =
      cam.x > 0 && cam.x < room.width * S && cam.z > 0 && cam.z < room.depth * S && cam.y < room.height * S
    build.walls.forEach((w, i) => {
      // Point on the interior face, in metres.
      const f = w.frame
      tmp.copy(f.toRoom(f.length / 2, 0, 0)).multiplyScalar(S)
      const facing = plan || (cutaway && !inside && tmp.sub(cam).negate().dot(f.inward) < -0.05)
      if (facing !== state.current.cut[i]) {
        state.current.cut[i] = facing
        setGhost(w.full, facing)
        w.stub.visible = facing
      }
    })
    const hideCeiling = cutaway && !inside
    if (hideCeiling !== state.current.ceiling) {
      state.current.ceiling = hideCeiling
      setGhost(build.ceiling, hideCeiling)
    }
  })

  return <primitive object={build.group} />
}
