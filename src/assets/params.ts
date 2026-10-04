import { z } from 'zod'

/**
 * A tiny DSL for describing asset parameters once and deriving
 * - the zod validator (JSON import, AI round-trips),
 * - the UI controls (sliders, swatches, selects),
 * - the catalog description handed to AI agents.
 */

interface Base {
  label: string
  group?: string
  /** Extra hint shown in the UI tooltip and the AI catalog. */
  hint?: string
}

export interface NumberParam extends Base {
  kind: 'number'
  min: number
  max: number
  step: number
  default: number
  unit?: string
}

export interface ColorParam extends Base {
  kind: 'color'
  default: string
  swatches?: string[]
}

export interface SelectParam<K extends string = string> extends Base {
  kind: 'select'
  options: Record<K, string>
  default: K
}

export interface BoolParam extends Base {
  kind: 'bool'
  default: boolean
}

export type ParamSpec = NumberParam | ColorParam | SelectParam | BoolParam
export type ParamSpecs = Record<string, ParamSpec>

export type ParamValue<P> = P extends NumberParam
  ? number
  : P extends BoolParam
    ? boolean
    : P extends SelectParam<infer K>
      ? K
      : string

export type ParamValues<S extends ParamSpecs> = { -readonly [K in keyof S]: ParamValue<S[K]> }

export const p = {
  number: (o: Omit<NumberParam, 'kind' | 'step'> & { step?: number }): NumberParam => ({
    kind: 'number',
    step: 1,
    ...o,
  }),
  mm: (label: string, min: number, max: number, def: number, extra: Partial<NumberParam> = {}): NumberParam => ({
    kind: 'number',
    label,
    min,
    max,
    default: def,
    step: 10,
    unit: 'mm',
    group: 'サイズ',
    ...extra,
  }),
  color: (label: string, def: string, extra: Partial<ColorParam> = {}): ColorParam => ({
    kind: 'color',
    label,
    default: def,
    group: '色・素材',
    ...extra,
  }),
  select: <const K extends string>(
    label: string,
    options: Record<K, string>,
    def: NoInfer<K>,
    extra: Partial<Base> = {},
  ): SelectParam<K> => ({ kind: 'select', label, options, default: def, group: '形', ...extra }),
  bool: (label: string, def: boolean, extra: Partial<Base> = {}): BoolParam => ({
    kind: 'bool',
    label,
    default: def,
    group: '形',
    ...extra,
  }),
}

function zodFor(spec: ParamSpec): z.ZodType {
  switch (spec.kind) {
    case 'number':
      return z.number().min(spec.min).max(spec.max).default(spec.default)
    case 'color':
      return z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, '#rrggbb 形式の色を指定してください')
        .default(spec.default)
    case 'select':
      return z.enum(Object.keys(spec.options) as [string, ...string[]]).default(spec.default)
    case 'bool':
      return z.boolean().default(spec.default)
  }
}

export function paramsSchema(specs: ParamSpecs) {
  const shape: Record<string, z.ZodType> = {}
  for (const [k, s] of Object.entries(specs)) shape[k] = zodFor(s)
  return z.strictObject(shape)
}

export function defaultParams<S extends ParamSpecs>(specs: S): ParamValues<S> {
  const out: Record<string, unknown> = {}
  for (const [k, s] of Object.entries(specs)) out[k] = s.default
  return out as ParamValues<S>
}

/**
 * Lenient resolution used at render time: invalid or unknown fields fall back to defaults
 * (numbers are clamped) so a half-broken layout still renders. Strict validation happens on import.
 */
export function resolveParams<S extends ParamSpecs>(specs: S, raw: Record<string, unknown> | undefined): ParamValues<S> {
  const out = defaultParams(specs) as Record<string, unknown>
  if (!raw) return out as ParamValues<S>
  for (const [k, s] of Object.entries(specs)) {
    const v = raw[k]
    if (v === undefined) continue
    switch (s.kind) {
      case 'number':
        if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(s.max, Math.max(s.min, v))
        break
      case 'color':
        if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v
        break
      case 'select':
        if (typeof v === 'string' && v in s.options) out[k] = v
        break
      case 'bool':
        if (typeof v === 'boolean') out[k] = v
        break
    }
  }
  return out as ParamValues<S>
}

/** Human/AI readable one-line description of a parameter. */
export function describeParam(key: string, s: ParamSpec): string {
  switch (s.kind) {
    case 'number':
      return `${key}: number ${s.min}〜${s.max}${s.unit ?? ''} (既定 ${s.default}) — ${s.label}`
    case 'color':
      return `${key}: "#rrggbb" (既定 ${s.default}) — ${s.label}`
    case 'select':
      return `${key}: ${Object.entries(s.options)
        .map(([v, l]) => `"${v}"(${l})`)
        .join(' | ')} (既定 "${s.default}") — ${s.label}`
    case 'bool':
      return `${key}: boolean (既定 ${s.default}) — ${s.label}`
  }
}
