import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { getAsset, resolveItemParams } from '../assets/registry'
import type { Item } from '../model/schema'
import { disposeObject } from './RoomMesh'

const S = 0.001

/** Build an asset's object, scaled to metres, with shadows enabled. */
export function buildItemObject(type: string, params: Record<string, unknown>): THREE.Object3D | null {
  const asset = getAsset(type)
  if (!asset) return null
  const obj = asset.build(resolveItemParams(type, params) as never)
  obj.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      if (m.userData.noShadow) return
      m.castShadow = true
      m.receiveShadow = true
    }
  })
  const root = new THREE.Group()
  root.add(obj)
  root.scale.setScalar(S)
  return root
}

export function ItemObject({ item, onPointerDown }: { item: Item; onPointerDown?: (e: { stopPropagation(): void }) => void }) {
  const obj = useMemo(() => buildItemObject(item.type, item.params), [item.type, item.params])
  useEffect(() => () => {
    if (obj) disposeObject(obj)
  }, [obj])
  if (!obj) return null
  const [x, y, z] = item.position
  return (
    <group
      position={[x * S, y * S, z * S]}
      rotation={[0, THREE.MathUtils.degToRad(item.rotation), 0]}
      userData={{ itemId: item.id }}
      onPointerDown={onPointerDown}
    >
      <primitive object={obj} />
    </group>
  )
}
