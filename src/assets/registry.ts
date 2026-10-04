import { bed, futon } from './items/beds'
import { desk } from './items/desk'
import { cushion, curtain, mirror, plant, rug, trashCan } from './items/decor'
import { aircon, fridge, monitor, tv, washer } from './items/electronics'
import { miniKitchen, rangeRack } from './items/kitchen'
import { ceilingLight, deskLamp, floorLamp, pendantLight } from './items/lights'
import { beanbag, diningChair, floorChair, officeChair, sofa } from './items/seating'
import { bookshelf, chest, colorBox, hangerRack, tvStand } from './items/storage'
import { diningTable, kotatsu, lowTable } from './items/tables'
import { defaultParams, describeParam, paramsSchema, resolveParams, type ParamSpecs } from './params'
import type { AssetDef } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL: AssetDef<any>[] = [
  bed,
  futon,
  sofa,
  floorChair,
  beanbag,
  cushion,
  lowTable,
  kotatsu,
  diningTable,
  diningChair,
  desk,
  officeChair,
  monitor,
  deskLamp,
  bookshelf,
  colorBox,
  chest,
  hangerRack,
  tvStand,
  tv,
  fridge,
  washer,
  aircon,
  miniKitchen,
  rangeRack,
  rug,
  curtain,
  plant,
  mirror,
  trashCan,
  pendantLight,
  ceilingLight,
  floorLamp,
]

export const assets: Record<string, AssetDef<ParamSpecs>> = Object.fromEntries(ALL.map((a) => [a.type, a]))
export const assetList: AssetDef<ParamSpecs>[] = ALL

export function getAsset(type: string): AssetDef<ParamSpecs> | undefined {
  return assets[type]
}

export function resolveItemParams(type: string, raw: Record<string, unknown> | undefined) {
  const a = assets[type]
  return a ? resolveParams(a.params, raw) : {}
}

export function itemParamsSchema(type: string) {
  const a = assets[type]
  return a ? paramsSchema(a.params) : undefined
}

export { defaultParams, describeParam }
