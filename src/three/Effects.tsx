import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as Composer } from 'postprocessing'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { AO_QUALITY, registerComposer, type AoQuality } from './perf'
import { useCameraMotion } from './RenderTuning'

/**
 * Renders the composer's buffers at a fraction of the drawing buffer (null = full size). The canvas
 * itself keeps its size, so nothing is cleared; the last pass stretches the smaller image over it.
 */
function applyRenderScale(composer: Composer, scale: number | null) {
  if (scale === null) {
    // Same size as now: the renderer is left alone and the buffers go back to the full drawing buffer.
    const css = composer.getRenderer().getSize(new THREE.Vector2())
    composer.setSize(css.x, css.y)
    return
  }
  const full = composer.getRenderer().getDrawingBufferSize(new THREE.Vector2())
  const w = Math.max(1, Math.round(full.x * scale))
  const h = Math.max(1, Math.round(full.y * scale))
  composer.inputBuffer.setSize(w, h)
  composer.outputBuffer.setSize(w, h)
  ;(composer as unknown as { depthRenderTarget: THREE.WebGLRenderTarget | null }).depthRenderTarget?.setSize(w, h)
  for (const pass of composer.passes) pass.setSize(w, h)
}

/** Post-processing chain: ambient occlusion → AgX tone mapping → subtle vignette → SMAA. */
export function Effects({ ao = AO_QUALITY }: { ao?: AoQuality }) {
  const invalidate = useThree((s) => s.invalidate)
  const composer = useRef<Composer | null>(null)
  const setComposer = useCallback((c: Composer | null) => {
    composer.current = c
    registerComposer(c)
  }, [])
  useEffect(
    () =>
      useCameraMotion.subscribe((s, p) => {
        if (s.scale === p.scale || !composer.current) return
        applyRenderScale(composer.current, s.scale)
        invalidate()
      }),
    [invalidate],
  )
  return (
    <EffectComposer ref={setComposer} multisampling={0} enableNormalPass={false}>
      <N8AO
        aoRadius={1.0}
        distanceFalloff={0.8}
        intensity={5}
        quality={ao}
        color="#2a1d14"
        renderMode={Number(new URLSearchParams(location.search).get('ao') ?? 0) as 0}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.35} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  )
}
