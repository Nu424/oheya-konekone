import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as Composer } from 'postprocessing'
import { useCallback, useEffect } from 'react'
import { AO_QUALITY } from './render/quality'
import { applyRenderScale, composerRef, useRenderScale } from './render/renderScale'

type AoQuality = 'performance' | 'low' | 'medium' | 'high' | 'ultra'

/** Post-processing chain: ambient occlusion → AgX tone mapping → subtle vignette → SMAA. */
export function Effects({ ao = AO_QUALITY }: { ao?: AoQuality }) {
  const invalidate = useThree((s) => s.invalidate)
  const register = useCallback((c: Composer | null) => {
    composerRef.current = c
  }, [])
  // The motion render scale shrinks the composer's buffers while the view moves (docs/PERFORMANCE.md B-1).
  useEffect(
    () =>
      useRenderScale.subscribe((s, p) => {
        if (s.scale === p.scale || !composerRef.current) return
        applyRenderScale(composerRef.current, s.scale)
        invalidate()
      }),
    [invalidate],
  )
  return (
    <EffectComposer ref={register} multisampling={0} enableNormalPass={false}>
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
