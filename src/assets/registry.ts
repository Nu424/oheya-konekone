import { desk } from './items/desk'
import { defaultParams, describeParam, paramsSchema, resolveParams, type ParamSpecs } from './params'
import type { AssetDef } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL: AssetDef<any>[] = [desk]

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
