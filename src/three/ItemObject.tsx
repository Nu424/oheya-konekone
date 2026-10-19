import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { getAsset, resolveItemParams } from '../assets/registry'
import type { Item } from '../model/schema'
import { disposeObject } from './RoomMesh'
import { contactShadowTexture } from './textures'

const S = 0.001

export interface Footprint {
  /** Size in mm along the item's local X (width), Y (height) and Z (depth). */
  w: number
  h: number
  d: number
  /** Local bounding box of everything that is drawn, in mm. */
  box: THREE.Box3
  /** The solid part used for snapping and the outline (the asset's `body`, or the bounding box). */
  body: THREE.Box3
  /** Separate solid parts used for collision, when the asset declares them (see AssetDef.solids). */
  solids?: THREE.Box3[]
}

const shadowMat = new THREE.MeshBasicMaterial({
  color: '#1d140e',
  transparent: true,
  depthWrite: false,
  opacity: 0.55,
  polygonOffset: true,
  polygonOffsetFactor: -2,
})

/** Soft dark blob under furniture so it reads as grounded even where no shadow light reaches. */
function contactShadow(box: THREE.Box3) {
  const w = box.max.x - box.min.x
  const d = box.max.z - box.min.z
  const pad = Math.min(160, Math.max(60, Math.min(w, d) * 0.18))
  const geo = new THREE.PlaneGeometry(w + pad * 2, d + pad * 2)
  geo.rotateX(-Math.PI / 2)
  const m = shadowMat.clone()
  m.alphaMap = contactShadowTexture()
  // Low furniture casts a darker, tighter blob than tall, leggy furniture.
  const h = box.max.y - box.min.y
  m.opacity = THREE.MathUtils.clamp(0.75 - h / 4000, 0.35, 0.7)
  const mesh = new THREE.Mesh(geo, m)
  mesh.position.set((box.min.x + box.max.x) / 2, 1.5, (box.min.z + box.max.z) / 2)
  mesh.renderOrder = -1
  mesh.userData.contactShadow = true
  mesh.raycast = () => {}
  return mesh
}

/** Build an asset's object, scaled to metres, with shadows enabled. */
export function buildItemObject(type: string, params: Record<string, unknown>): THREE.Object3D | null {
  const asset = getAsset(type)
  if (!asset) return null
  const resolved = resolveItemParams(type, params)
  const obj = asset.build(resolved as never)
  obj.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      if (m.userData.noShadow) {
        m.castShadow = false
        return
      }
      m.castShadow = true
      m.receiveShadow = true
    }
  })
  const root = new THREE.Group()
  root.add(obj)
  const box = new THREE.Box3().setFromObject(obj)
  const toBox3 = (b: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) =>
    new THREE.Box3(new THREE.Vector3(b.min.x, b.min.y, b.min.z), new THREE.Vector3(b.max.x, b.max.y, b.max.z))
  const solids = asset.solids?.(resolved as never).map(toBox3)
  const b = asset.body?.(resolved as never)
  const body = b ? toBox3(b) : solids?.length ? solids.reduce((u, s) => u.union(s), new THREE.Box3()) : box
  root.userData.footprint = { w: box.max.x - box.min.x, h: box.max.y - box.min.y, d: box.max.z - box.min.z, box, body, solids } satisfies Footprint
  if ((asset.contactShadow ?? asset.placement === 'floor') && !body.isEmpty()) {
    // Parts standing on the floor each get their own blob; the floor under a loft bed's deck stays lit.
    const feet = solids?.filter((s) => s.min.y < 1)
    for (const f of feet?.length ? feet : [body]) root.add(contactShadow(f))
  }
  root.scale.setScalar(S)
  return root
}

const fpCache = new Map<string, Footprint>()

/** Footprint of an item in mm (cached by type + params). */
export function itemFootprint(type: string, params: Record<string, unknown>): Footprint | null {
  const key = type + JSON.stringify(params)
  const hit = fpCache.get(key)
  if (hit) return hit
  const o = buildItemObject(type, params)
  if (!o) return null
  const fp = o.userData.footprint as Footprint
  disposeObject(o)
  if (fpCache.size > 500) fpCache.clear()
  fpCache.set(key, fp)
  return fp
}

export function ItemObject({
  item,
  ceiling,
  onPointerDown,
  innerRef,
  live,
}: {
  item: Item
  /** App state for assets with live parameters (see AssetDef.live). */
  live?: { hour: number }
  ceiling?: number
  onPointerDown?: (e: { stopPropagation(): void }) => void
  /** Wrapper around the model at the item's origin (for pop-in scaling). */
  innerRef?: React.Ref<THREE.Group>
}) {
  const asset = getAsset(item.type)
  // Assets with live parameters (the wall clock) follow the time of day; others ignore it.
  const hour = asset?.live ? (live?.hour ?? 10) : 0
  const params = useMemo(() => (asset?.live ? { ...item.params, ...asset.live({ hour }) } : item.params), [asset, item.params, hour])
  const obj = useMemo(() => buildItemObject(item.type, params), [item.type, params])
  useEffect(
    () => () => {
      if (obj) disposeObject(obj)
    },
    [obj],
  )
  if (!obj) return null
  const [x, y, z] = item.position
  const hang = asset?.placement === 'ceiling' && ceiling !== undefined
  return (
    <group
      position={[x * S, (hang ? ceiling : y) * S, z * S]}
      rotation={[0, THREE.MathUtils.degToRad(item.rotation), 0]}
      userData={{ itemId: item.id }}
      onPointerDown={onPointerDown}
    >
      <group ref={innerRef}>
        <primitive object={obj} />
      </group>
    </group>
  )
}
