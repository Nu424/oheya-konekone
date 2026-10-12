// Rendering quality knobs. Background and measurements: docs/PERFORMANCE.md.

/** N8AO quality. `high` = 64 samples per pixel; `medium` (16) costs about a third and looks nearly the same. */
export const AO_QUALITY = 'high' as const

/**
 * Pixel budget while the view moves or furniture is dragged. Frame cost is mostly per pixel, so a canvas
 * bigger than this renders smaller meanwhile (about a 1920×940 canvas worth of pixels).
 */
export const MOTION_PIXELS = 1.8e6

/** Pixel ratio the Canvas renders at when still (same range as its `dpr={[1, 2]}`). */
export function restPixelRatio(devicePixelRatio: number) {
  return Math.min(2, Math.max(1, devicePixelRatio || 1))
}

/**
 * Fraction of the resting drawing buffer to render at while moving, or null when the canvas is already
 * within budget: at most a 1× pixel ratio (high-DPI laptops), less on big canvases; never below 0.5×.
 */
export function motionRenderScale(cssWidth: number, cssHeight: number, devicePixelRatio: number): number | null {
  const fit = Math.sqrt(MOTION_PIXELS / Math.max(1, cssWidth * cssHeight))
  const ratio = Math.max(0.5, Math.min(1, Math.floor(fit * 20) / 20))
  const scale = ratio / restPixelRatio(devicePixelRatio)
  return scale < 0.99 ? scale : null
}
