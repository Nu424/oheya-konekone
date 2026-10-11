/**
 * Helpers for input fields that edit several items at once (docs/EDITING-EXTRAS.md).
 * No dependency on the store, the registry or three.js.
 */

/** The value all items share, or null when they differ (the field is then shown empty). */
export function sharedValue(values: readonly number[], tolerance = 0.05): number | null {
  if (!values.length) return null
  return values.every((v) => Math.abs(v - values[0]) <= tolerance) ? values[0] : null
}

export type NumberEntry = { value: number; relative: boolean }

/**
 * Read what was typed into a number field.
 * - "120" / "-40" / "12.5": that value.
 * - "+50": 50 more than now. "+=50" / "-=50": 50 more / less than now.
 * A plain "-40" stays absolute so negative coordinates can still be typed.
 * Full-width digits and signs (typed with a Japanese IME) are accepted. Returns null for anything else.
 */
export function parseNumberEntry(text: string): NumberEntry | null {
  const t = text
    .replace(/[０-９．＋－＝]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ー−]/g, '-')
    .replace(/\s+/g, '')
  const m = /^(\+=|-=|\+)?(-?(?:\d+\.?\d*|\.\d+))$/.exec(t)
  if (!m) return null
  const n = Number(m[2])
  if (!Number.isFinite(n)) return null
  if (!m[1]) return { value: n, relative: false }
  return { value: m[1] === '-=' ? -n : n, relative: true }
}
