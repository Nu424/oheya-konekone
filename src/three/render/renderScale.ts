import type { EffectComposer } from 'postprocessing'
import * as THREE from 'three'
import { create } from 'zustand'

/**
 * Fraction of the drawing buffer the composer renders at (null = full size). Set by MotionQuality while
 * the view moves; Effects applies it to the composer.
 */
export const useRenderScale = create<{ scale: number | null }>()(() => ({ scale: null }))

/** The scene's EffectComposer, registered by Effects (also read by the ?perf recorder). */
export const composerRef: { current: EffectComposer | null } = { current: null }

/**
 * Shrinks only the composer's internal buffers; the canvas keeps its size and the last pass stretches
 * the image over it. (Resizing the canvas instead cleared it and flashed an empty frame.)
 */
export function applyRenderScale(composer: EffectComposer, scale: number | null) {
  const renderer = composer.getRenderer()
  if (scale === null) {
    // Same size as now: the renderer is left alone and the buffers go back to the full drawing buffer.
    const css = renderer.getSize(new THREE.Vector2())
    composer.setSize(css.x, css.y)
    return
  }
  const full = renderer.getDrawingBufferSize(new THREE.Vector2())
  const w = Math.max(1, Math.round(full.x * scale))
  const h = Math.max(1, Math.round(full.y * scale))
  composer.inputBuffer.setSize(w, h)
  composer.outputBuffer.setSize(w, h)
  ;(composer as unknown as { depthRenderTarget: THREE.WebGLRenderTarget | null }).depthRenderTarget?.setSize(w, h)
  for (const pass of composer.passes) pass.setSize(w, h)
}
