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
 * Where an item naturally lives.
 * - floor: stands on the floor (position y is usually 0)
 * - wall: hung on a wall at `elevation` (aircon, curtain rail)
 * - onTop: sits on other furniture at `elevation` (monitor, TV)
 * - ceiling: hangs from the ceiling. Built with its origin at the ceiling and extending downward;
 *   the renderer ignores position y and attaches it to the ceiling.
 */
export type Placement = 'floor' | 'wall' | 'ceiling' | 'onTop'

export interface AssetDef<S extends ParamSpecs = ParamSpecs> {
  type: string
  label: string
  category: Category
  /** Short description for the catalog and the AI prompt. */
  description: string
  placement: Placement
  /** Default height (mm) of the item's bottom when added, for wall / onTop items. */
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
  /** Light sources this item emits (lamps), in mm relative to the item origin. */
  lights?(p: ParamValues<S>): { position: [number, number, number]; color: string; intensity: number; distance?: number }[]
}

export function defineAsset<const S extends ParamSpecs>(def: AssetDef<S>): AssetDef<S> {
  return def
}
