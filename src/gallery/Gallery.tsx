import { CameraControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { assetList, getAsset } from '../assets/registry'
import { defaultParams, type ParamSpecs } from '../assets/params'
import { Effects } from '../three/Effects'
import { buildItemObject } from '../three/ItemObject'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { useThree } from '@react-three/fiber'

/**
 * Asset gallery for visual QA: `?gallery` shows every asset with its default parameters,
 * `?gallery&type=desk` shows one asset at min / default / max and each preset.
 */

interface Cell {
  label: string
  type: string
  params: Record<string, unknown>
}

function extremes(specs: ParamSpecs, which: 'min' | 'max') {
  const out: Record<string, unknown> = defaultParams(specs)
  for (const [k, s] of Object.entries(specs)) if (s.kind === 'number') out[k] = s[which]
  return out
}

function cellsFor(type: string | null, types: string[] | null): Cell[] {
  if (types) return types.flatMap((t) => (getAsset(t) ? [{ label: getAsset(t)!.label, type: t, params: {} }] : []))
  if (!type) return assetList.map((a) => ({ label: a.label, type: a.type, params: {} }))
  const a = getAsset(type)
  if (!a) return []
  const cells: Cell[] = [
    { label: '最小', type, params: extremes(a.params, 'min') },
    { label: 'デフォルト', type, params: {} },
    { label: '最大', type, params: extremes(a.params, 'max') },
  ]
  for (const p of a.presets ?? []) cells.push({ label: p.name, type, params: p.params as Record<string, unknown> })
  // One cell per select option for the first select param, to eyeball shape variants.
  for (const [k, s] of Object.entries(a.params)) {
    if (s.kind !== 'select') continue
    for (const [v, l] of Object.entries(s.options)) if (v !== s.default) cells.push({ label: `${s.label}: ${l}`, type, params: { [k]: v } })
  }
  for (const [k, s] of Object.entries(a.params)) {
    if (s.kind === 'bool') cells.push({ label: `${s.label}: ${s.default ? 'なし' : 'あり'}`, type, params: { [k]: !s.default } })
  }
  return cells
}

const labelCache = new Map<string, THREE.Texture>()
function labelTexture(text: string) {
  let t = labelCache.get(text)
  if (t) return t
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = '700 40px "Zen Maru Gothic", sans-serif'
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 48
  c.width = w
  c.height = 64
  ctx.font = font
  ctx.fillStyle = '#fffbf6'
  ctx.beginPath()
  ctx.roundRect(0, 0, w, 64, 20)
  ctx.fill()
  ctx.fillStyle = '#3b2f28'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 24, 34)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  labelCache.set(text, t)
  return t
}

function Label({ text, position, size }: { text: string; position: [number, number, number]; size: number }) {
  const tex = labelTexture(text)
  const img = tex.image as HTMLCanvasElement
  const h = size
  const w = (img.width / img.height) * h
  return (
    <mesh position={position} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.5
  }, [gl, scene])
  return null
}

/** Point the default CameraControls once they exist. */
function AimCamera({ pos, ty }: { pos: [number, number, number]; ty: number }) {
  const controls = useThree((s) => s.controls) as unknown as { setLookAt?: (...a: unknown[]) => void } | null
  useEffect(() => {
    controls?.setLookAt?.(...pos, 0, ty, 0, false)
  }, [controls, pos, ty])
  return null
}

function Probe() {
  useFrame(() => {
    const p = (window.__oheya ??= { frames: 0, ready: false })
    p.frames++
    if (p.frames > 20) p.ready = true
  })
  return null
}

export default function Gallery() {
  const q = new URLSearchParams(location.search)
  const type = q.get('type')
  const only = q.get('only')
  const cells = useMemo(() => {
    const all = cellsFor(type, q.get('types')?.split(',') ?? null)
    return only !== null ? all.filter((_, i) => String(i) === only || all[i].label === only) : all
  }, [type, only])
  const objs = useMemo(
    () =>
      cells.map((c) => {
        const o = buildItemObject(c.type, c.params)
        const box = o ? new THREE.Box3().setFromObject(o) : new THREE.Box3()
        return { c, o, box: o ? (o.userData.footprint.box as THREE.Box3).clone().applyMatrix4(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)) : box }
      }),
    [cells],
  )
  const spacing = Math.max(1.6, ...objs.map(({ box }) => Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 0.6))
  const maxH = Math.max(0.3, ...objs.map(({ box }) => box.max.y - box.min.y))
  const cols = Math.max(1, Math.min(objs.length, Math.ceil(Math.sqrt(objs.length * 1.6))))
  const rows = Math.ceil(objs.length / cols)
  const W = cols * spacing
  const D = rows * spacing

  // 3/4 view from the front-right, framed to the grid (which is centred on the origin).
  const cam = (() => {
    const size = Math.max(W, D * 1.2)
    const dist = only !== null ? size * 1.35 + 0.4 : size * 1.3 + 0.5
    const el = THREE.MathUtils.degToRad(only !== null ? 32 : 48)
    const az = THREE.MathUtils.degToRad(only !== null ? 28 : 8)
    const ty = only !== null ? maxH * 0.4 : 0.1
    const pos: [number, number, number] = [dist * Math.cos(el) * Math.sin(az), ty + dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az)]
    return { pos, ty }
  })()

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={1} gl={{ antialias: false, preserveDrawingBuffer: true }} camera={{ fov: 30, position: cam.pos }}>
        <color attach="background" args={['#efe6da']} />
        <Env />
        <hemisphereLight args={['#ffffff', '#b39a80', 0.4]} />
        <directionalLight
          position={[4, 8, 6]}
          intensity={2.5}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-Math.max(W, D)}
          shadow-camera-right={Math.max(W, D)}
          shadow-camera-top={Math.max(W, D)}
          shadow-camera-bottom={-Math.max(W, D)}
          shadow-bias={-0.0002}
          shadow-radius={3}
          onUpdate={(l) => {
            l.target.position.set(0, 0, 0)
            l.target.updateMatrixWorld()
          }}
        />
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[W + 4, D + 4]} />
          <meshStandardMaterial color="#e2d6c6" roughness={0.9} />
        </mesh>
        {objs.map(({ c, o, box }, i) => {
          const x = (i % cols) * spacing + spacing / 2
          const z = Math.floor(i / cols) * spacing + spacing / 2
          return (
            <group key={i} position={[x - W / 2, Math.max(0, -box.min.y), z - D / 2]}>
              {o && <primitive object={o} />}
              <Label text={c.label} position={[0, 0.005, Math.min(spacing / 2 - 0.12, box.max.z + 0.22)]} size={Math.max(0.12, spacing * 0.07)} />
            </group>
          )
        })}
        <CameraControls makeDefault />
        <AimCamera pos={cam.pos} ty={cam.ty} />
        <Effects quality="medium" />
        <Probe />
      </Canvas>
    </div>
  )
}
