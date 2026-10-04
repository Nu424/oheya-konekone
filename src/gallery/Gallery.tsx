import { CameraControls, Html } from '@react-three/drei'
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

function cellsFor(type: string | null): Cell[] {
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

function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.5
  }, [gl, scene])
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
  const cells = useMemo(() => cellsFor(type), [type])
  const objs = useMemo(
    () =>
      cells.map((c) => {
        const o = buildItemObject(c.type, c.params)
        const box = o ? new THREE.Box3().setFromObject(o) : new THREE.Box3()
        return { c, o, box }
      }),
    [cells],
  )
  const spacing = Math.max(1.6, ...objs.map(({ box }) => Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 0.6))
  const cols = Math.ceil(Math.sqrt(objs.length * 1.6))
  const rows = Math.ceil(objs.length / cols)
  const W = cols * spacing
  const D = rows * spacing

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={1} gl={{ antialias: false, preserveDrawingBuffer: true }} camera={{ fov: 30, position: [W * 0.5, Math.max(W, D) * 0.9 + 2, D + Math.max(W, D) * 0.7 + 2] }}>
        <color attach="background" args={['#efe6da']} />
        <Env />
        <hemisphereLight args={['#ffffff', '#b39a80', 0.4]} />
        <directionalLight
          position={[W / 2 + 4, 8, D / 2 + 6]}
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
            l.target.position.set(W / 2, 0, D / 2)
            l.target.updateMatrixWorld()
          }}
        />
        <mesh rotation-x={-Math.PI / 2} position={[W / 2, 0, D / 2]} receiveShadow>
          <planeGeometry args={[W + 4, D + 4]} />
          <meshStandardMaterial color="#e2d6c6" roughness={0.9} />
        </mesh>
        {objs.map(({ c, o }, i) => {
          const x = (i % cols) * spacing + spacing / 2
          const z = Math.floor(i / cols) * spacing + spacing / 2
          return (
            <group key={i} position={[x, 0, z]}>
              {o && <primitive object={o} />}
              <Html position={[0, 0, spacing / 2 - 0.15]} center style={{ pointerEvents: 'none' }}>
                <div style={{ background: '#fffbf6', borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,.15)', fontFamily: 'sans-serif' }}>
                  {c.label}
                </div>
              </Html>
            </group>
          )
        })}
        <CameraControls
          makeDefault
          ref={(c) => {
            c?.setTarget(W / 2, 0.3, D / 2, false)
          }}
        />
        <Effects quality="medium" />
        <Probe />
      </Canvas>
    </div>
  )
}
