import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { AO_QUALITY, registerComposer, type AoQuality } from './perf'

/** Post-processing chain: ambient occlusion → AgX tone mapping → subtle vignette → SMAA. */
export function Effects({ ao = AO_QUALITY }: { ao?: AoQuality }) {
  return (
    <EffectComposer ref={registerComposer} multisampling={0} enableNormalPass={false}>
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
