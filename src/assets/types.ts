import type * as THREE from 'three'
import type { ParamSpecs, ParamValues } from './params'

export type Category = 'bed' | 'sofa' | 'table' | 'work' | 'storage' | 'av' | 'appliance' | 'kitchen' | 'decor' | 'light'

export const CATEGORY_LABELS: Record<Category, string> = {
  bed: '寝具',
  sofa: 'くつろぎ',
  table: 'テーブル',
  work: '作業',
  storage: '収納',
  av: 'AV',
  appliance: '家電',
  kitchen: 'キッチン',
  decor: '雑貨',
  light: '照明',
}

/**
 * Where an item naturally lives when it is first added. Every floor / onTop item can be
 * dragged onto any support surface afterwards (see docs/STACKING.md).
 * - floor: stands on the floor (position y is usually 0)
 * - onTop: sits on furniture (monitor, TV); when added it looks for a free spot on a support surface
 * - wall: hung on a wall at `elevation` (aircon, curtain rail)
 * - ceiling: hangs from the ceiling. Built with its origin at the ceiling and extending downward;
 *   the renderer ignores position y and attaches it to the ceiling.
 */
export type Placement = 'floor' | 'wall' | 'ceiling' | 'onTop'

/** Axis-aligned box in the item's local frame (mm). */
export interface LocalBox {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

/**
 * A horizontal rectangle other items can stand on, in the item's local frame (mm).
 * `y` is the height of the surface above the item's origin.
 */
export interface Surface {
  y: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Free height above the surface when something limits it (a shelf under another shelf). */
  clearance?: number
  /** Short name shown in the AI catalog, e.g. "天板" / "中段の棚". */
  label?: string
}

export interface AssetDef<S extends ParamSpecs = ParamSpecs> {
  type: string
  label: string
  category: Category
  /** Short description for the catalog and the AI prompt. */
  description: string
  placement: Placement
  /** Default height (mm) of the item's bottom when added, for wall items. */
  elevation?: number
  /** Hide while the ceiling is cut away (flush ceiling fixtures would otherwise float). */
  hideWithCeiling?: boolean
  /** Whether to draw a soft contact shadow under the item (default true for floor items). */
  contactShadow?: boolean
  params: S
  presets?: { name: string; params: Partial<ParamValues<S>> }[]
  /**
   * Build the object in millimetres: footprint centred on the origin, bottom at y=0,
   * front facing +Z. The renderer scales it to metres.
   */
  build(p: ParamValues<S>): THREE.Object3D
  /**
   * Surfaces other items can be placed on. Omit to use the top of the bounding box;
   * return [] for things nothing should stand on (beds, chairs, rugs).
   */
  surfaces?(p: ParamValues<S>): Surface[]
  /**
   * The solid part used for collision, snapping and the selection outline. Omit to use the
   * bounding box of the built geometry. Give it when parts stick out of what actually occupies
   * the floor: a fridge without its open door.
   */
  body?(p: ParamValues<S>): LocalBox
  /**
   * Open frames: items whose footprint lies inside this item's footprint do not collide with it.
   */
  hollow?: boolean | ((p: ParamValues<S>) => boolean)
  /** Light sources this item emits (lamps), in mm relative to the item origin. */
  lights?(p: ParamValues<S>): { position: [number, number, number]; color: string; intensity: number; distance?: number }[]
}

export function defineAsset<const S extends ParamSpecs>(def: AssetDef<S>): AssetDef<S> {
  return def
}
