import { z } from 'zod'

/**
 * Layout JSON schema.
 *
 * Conventions (shared with the AI prompt, keep in sync with docs/PLAN.md):
 * - Units are millimetres, angles are degrees.
 * - Origin is the floor corner where the north and west walls meet.
 *   +X runs east (room width), +Z runs south (room depth), +Y is up.
 * - Opening `offset` is measured along the wall from its low-coordinate end
 *   (x for north/south walls, z for west/east walls) to the opening's near edge.
 * - Item `position` is the bottom centre of the item's footprint.
 *   `rotation` 0 means the item's front faces south (+Z); 90 faces east, 180 north, 270 west.
 */

export const LAYOUT_VERSION = 1

export const WallSide = z.enum(['north', 'south', 'west', 'east']).meta({
  description: '壁の向き。north=奥(z=0), south=手前(z=depth), west=左(x=0), east=右(x=width)',
})
export type WallSide = z.infer<typeof WallSide>

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, '#rrggbb 形式の色を指定してください')

const id = z.string().min(1).max(64)

const openingBase = {
  id,
  wall: WallSide,
  offset: z.number().min(0).meta({ description: '壁の座標が小さい側の端から開口部の端までの距離(mm)' }),
  width: z.number().min(300).max(4000),
  height: z.number().min(300).max(3000),
}

export const DoorOpening = z.object({
  ...openingBase,
  type: z.literal('door'),
  width: z.number().min(500).max(1200).default(780),
  height: z.number().min(1700).max(2400).default(2000),
  hinge: z.enum(['left', 'right']).default('left').meta({ description: '部屋の内側から見た蝶番の位置' }),
  swing: z.enum(['in', 'out']).default('in').meta({ description: '部屋の内側に開くか外側に開くか' }),
  color: hex.default('#f2ede4'),
})

export const WindowOpening = z.object({
  ...openingBase,
  type: z.literal('window'),
  width: z.number().min(300).max(4000).default(1650),
  height: z.number().min(300).max(2400).default(1100),
  sill: z.number().min(0).max(2000).default(900).meta({ description: '床から窓の下端までの高さ。0なら掃き出し窓' }),
  frameColor: hex.default('#c9ccd0'),
})

export const ClosetOpening = z.object({
  ...openingBase,
  type: z.literal('closet'),
  width: z.number().min(600).max(3600).default(1600),
  height: z.number().min(1700).max(2400).default(2100),
  doorStyle: z.enum(['sliding', 'folding', 'open']).default('sliding'),
  depth: z.number().min(300).max(1000).default(600).meta({ description: '壁の向こう側に張り出す収納の奥行き' }),
  color: hex.default('#efe9df'),
})

export const Opening = z.discriminatedUnion('type', [DoorOpening, WindowOpening, ClosetOpening])
export type Opening = z.infer<typeof Opening>
export type OpeningType = Opening['type']

export const Column = z.object({
  id,
  x: z.number().meta({ description: '柱の中心のx座標' }),
  z: z.number().meta({ description: '柱の中心のz座標' }),
  width: z.number().min(100).max(1200).default(400),
  depth: z.number().min(100).max(1200).default(400),
})
export type Column = z.infer<typeof Column>

export const FloorMaterial = z.enum(['oak', 'walnut', 'birch', 'whiteOak', 'tile', 'carpet', 'tatami', 'concrete'])
export type FloorMaterial = z.infer<typeof FloorMaterial>

export const Room = z.object({
  width: z.number().min(1800).max(8000).default(3600).meta({ description: '部屋の幅(x方向, 内法mm)' }),
  depth: z.number().min(1800).max(8000).default(2700).meta({ description: '部屋の奥行き(z方向, 内法mm)' }),
  height: z.number().min(2100).max(3200).default(2400).meta({ description: '天井高(mm)' }),
  wallThickness: z.number().min(60).max(300).default(120),
  floor: z
    .object({ material: FloorMaterial.default('oak'), color: hex.optional() })
    .default({ material: 'oak' }),
  wall: z.object({ color: hex.default('#f3efe8') }).default({ color: '#f3efe8' }),
  ceiling: z.object({ color: hex.default('#fbfaf7') }).default({ color: '#fbfaf7' }),
  baseboard: z
    .object({ color: hex.default('#e9e3d9'), height: z.number().min(0).max(150).default(60) })
    .default({ color: '#e9e3d9', height: 60 }),
  openings: z.array(Opening).default([]),
  columns: z.array(Column).default([]),
})
export type Room = z.infer<typeof Room>

export const Item = z.object({
  id,
  type: z.string().min(1).meta({ description: 'アセットの種類 (catalog の type)' }),
  name: z.string().max(64).optional(),
  position: z
    .tuple([z.number(), z.number(), z.number()])
    .meta({ description: '[x, y, z] 底面中心の座標(mm)。yは床からの高さ(通常0)' }),
  rotation: z.number().default(0).meta({ description: '0=正面が南(+z), 90=東, 180=北, 270=西' }),
  params: z.record(z.string(), z.unknown()).default({}),
  locked: z.boolean().optional(),
})
export type Item = z.infer<typeof Item>

export const Layout = z.object({
  version: z.literal(LAYOUT_VERSION).default(LAYOUT_VERSION),
  meta: z
    .object({ name: z.string().max(80).default('わたしのおへや'), notes: z.string().max(4000).optional() })
    .default({ name: 'わたしのおへや' }),
  room: Room,
  items: z.array(Item).default([]),
})
export type Layout = z.infer<typeof Layout>
export type LayoutInput = z.input<typeof Layout>
