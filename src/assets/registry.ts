import { bed, futon, loftBed } from './items/beds'
import { desk } from './items/desk'
import { cushion, curtain, mirror, plant, roomDivider, rug, trashCan } from './items/decor'
import { coffeeMaker, kettle, microwave, riceCooker, toaster } from './items/appliances'
import { bookRow, bookStack, fileBox } from './items/books'
import { desktopPC, keyboardMouse, laptop, monitor } from './items/computing'
import { aircon, fridge, gameConsole, speaker, tv, washer } from './items/electronics'
import { cardboardBox, organizer, wallClock } from './items/small'
import { copier, foldingChair, officeDesk, partition, printer, whiteboard } from './items/office'
import { dishRack, miniKitchen } from './items/kitchen'
import { ceilingLight, deskLamp, floorLamp, pendantLight } from './items/lights'
import { beanbag, diningChair, floorChair, officeChair, sofa } from './items/seating'
import { cabinet, ceilingDryer, hangerRack, metalRack, shelf, tvStand, wallStorage } from './items/storage'
import { wallArt } from './items/wall'
import { diningTable, kotatsu, lowTable } from './items/tables'
import { defaultParams, describeParam, paramsSchema, resolveParams, type ParamSpecs } from './params'
import type { AssetDef } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL: AssetDef<any>[] = [
  bed,
  futon,
  loftBed,
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
  laptop,
  keyboardMouse,
  desktopPC,
  deskLamp,
  officeDesk,
  foldingChair,
  partition,
  whiteboard,
  printer,
  copier,
  shelf,
  cabinet,
  metalRack,
  hangerRack,
  ceilingDryer,
  wallStorage,
  tvStand,
  tv,
  gameConsole,
  speaker,
  fridge,
  washer,
  aircon,
  miniKitchen,
  microwave,
  riceCooker,
  kettle,
  toaster,
  coffeeMaker,
  dishRack,
  bookRow,
  bookStack,
  fileBox,
  cardboardBox,
  organizer,
  wallClock,
  wallArt,
  rug,
  curtain,
  roomDivider,
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
