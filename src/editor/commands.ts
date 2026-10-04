import { defaultParams, getAsset } from '../assets/registry'
import { useDoc, useUi } from '../store/useStore'
import { isPassive, itemFootprint2D, localBox, placeNewItem, supportHeight } from './placement'
import { flushToWall, footprint, nearestWall, snapPosition } from './space'

/** Converts a screen point to a floor point (mm); registered by the viewport. */
export let screenToFloor: ((clientX: number, clientY: number) => { x: number; z: number } | null) | null = null
export function registerScreenToFloor(f: typeof screenToFloor) {
  screenToFloor = f
}

/** Add an item of `type`, either at a sensible free spot or at a dropped floor point. */
export function addItemOfType(type: string, params?: Record<string, unknown>, at?: { x: number; z: number }) {
  const asset = getAsset(type)
  if (!asset) return
  const doc = useDoc.getState()
  const L = doc.layout
  const full = { ...defaultParams(asset.params), ...params } as Record<string, unknown>
  const placed = placeNewItem(L, type, full)
  let { position, rotation } = placed
  if (at) {
    const box = localBox({ type, params: full })
    let x = at.x
    let z = at.z
    let y = position[1]
    if (asset.placement === 'wall') {
      const nw = nearestWall(L.room, x, z)
      rotation = nw.rotation
      ;({ x, z } = flushToWall((xx, zz) => footprint(box, xx, y, zz, rotation), x, z, L.room, nw.wall))
    } else if (asset.placement !== 'onTop') rotation = 0
    const others = L.items.filter((o) => !isPassive(o.type)).map((o) => itemFootprint2D(o, L))
    const sn = snapPosition((xx, zz) => footprint(box, xx, y, zz, rotation), x, z, L.room, others)
    x = sn.x
    z = sn.z
    if (asset.placement === 'onTop') y = supportHeight(L, x, z)
    position = [Math.round(x), Math.round(y), Math.round(z)]
  }
  const id = doc.addItem({ type, params: full, position, rotation })
  const ui = useUi.getState()
  ui.select({ kind: 'item', id })
  ui.notify(placed.crowded && !at ? `空きが見つからなかったから真ん中に置いたよ。ドラッグで動かしてね` : `${asset.label}を置いたよ`)
  return id
}
