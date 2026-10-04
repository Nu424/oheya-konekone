import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export type Quality = 'low' | 'medium' | 'high'

/** Post-processing chain: ambient occlusion → AgX tone mapping → subtle vignette → SMAA. */
export function Effects({ quality = 'high' }: { quality?: Quality }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        aoRadius={1.0}
        distanceFalloff={0.8}
        intensity={quality === 'low' ? 3.5 : 5}
        quality={quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'performance'}
        halfRes={quality !== 'high'}
        color="#2a1d14"
        renderMode={Number(new URLSearchParams(location.search).get("ao") ?? 0) as 0}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.35} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  )
}
