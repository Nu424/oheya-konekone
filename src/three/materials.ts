import * as THREE from 'three'
import { fabricWeave, leafVein, softNoise, woodGrain } from './textures'

/**
 * Shared material library for assets. Materials are cached by (kind, color, options),
 * so a room full of furniture only creates a handful of shader programs.
 */

export type MatKind =
  | 'wood'
  | 'fabric'
  | 'leather'
  | 'metal'
  | 'plastic'
  | 'matte'
  | 'gloss'
  | 'glass'
  | 'mirror'
  | 'screen'
  | 'ceramic'
  | 'leaf'
  | 'emissive'
  | 'rubber'

export interface MatOptions {
  roughness?: number
  /** Emissive strength for 'emissive' (in addition to color). */
  intensity?: number
  opacity?: number
  side?: THREE.Side
}

const cache = new Map<string, THREE.Material>()

export function mat(kind: MatKind, color = '#ffffff', o: MatOptions = {}): THREE.Material {
  const key = `${kind}|${color}|${o.roughness ?? ''}|${o.intensity ?? ''}|${o.opacity ?? ''}|${o.side ?? ''}`
  let m = cache.get(key)
  if (!m) {
    m = create(kind, color, o)
    m.name = key
    cache.set(key, m)
  }
  return m
}

function create(kind: MatKind, color: string, o: MatOptions): THREE.Material {
  const c = new THREE.Color(color)
  const side = o.side ?? THREE.FrontSide
  switch (kind) {
    case 'wood':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        map: woodGrain(),
        roughness: o.roughness ?? 0.55,
        roughnessMap: softNoise(),
        clearcoat: 0.15,
        clearcoatRoughness: 0.5,
        side,
      })
    case 'fabric': {
      const weave = fabricWeave()
      const sheen = c.clone().lerp(new THREE.Color('#ffffff'), 0.35)
      return new THREE.MeshPhysicalMaterial({
        color: c,
        map: weave,
        bumpMap: weave,
        bumpScale: 0.6,
        roughness: o.roughness ?? 0.92,
        sheen: 1,
        sheenRoughness: 0.6,
        sheenColor: sheen,
        side,
      })
    }
    case 'leather':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: o.roughness ?? 0.45,
        bumpMap: softNoise(),
        bumpScale: 0.3,
        clearcoat: 0.3,
        clearcoatRoughness: 0.45,
        side,
      })
    case 'metal':
      return new THREE.MeshStandardMaterial({
        color: c,
        metalness: 1,
        roughness: o.roughness ?? 0.35,
        roughnessMap: softNoise(),
        side,
      })
    case 'plastic':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: o.roughness ?? 0.4,
        clearcoat: 0.2,
        clearcoatRoughness: 0.4,
        side,
      })
    case 'matte':
      return new THREE.MeshStandardMaterial({ color: c, roughness: o.roughness ?? 0.82, side })
    case 'gloss':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: o.roughness ?? 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        side,
      })
    case 'glass':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: o.roughness ?? 0.04,
        metalness: 0,
        transparent: true,
        opacity: o.opacity ?? 0.18,
        envMapIntensity: 0.6,
        specularIntensity: 1,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    case 'mirror':
      return new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: o.roughness ?? 0.02, side })
    case 'screen':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        emissive: new THREE.Color('#0b0d12'),
        side,
      })
    case 'ceramic':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: o.roughness ?? 0.25,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15,
        side,
      })
    case 'leaf':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        map: leafVein(),
        roughness: o.roughness ?? 0.55,
        sheen: 0.4,
        sheenColor: c.clone().lerp(new THREE.Color('#ffffcc'), 0.5),
        side: THREE.DoubleSide,
      })
    case 'emissive':
      return new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: o.intensity ?? 2,
        roughness: 0.6,
        toneMapped: true,
        side,
      })
    case 'rubber':
      return new THREE.MeshStandardMaterial({ color: c, roughness: o.roughness ?? 0.95, side })
  }
}

/** Common palette for UI swatches. */
export const SWATCHES = {
  wood: ['#e4cfa8', '#d2ad7c', '#b8875a', '#8f5f3d', '#6b4a34', '#4a3326', '#f1ece4', '#2b2b2b'],
  fabric: ['#efe9df', '#d9d2c5', '#b9b0a3', '#8c8a86', '#4d4f53', '#c9d6df', '#8fa9bf', '#9fb59a', '#d8a48f', '#e8c76a', '#c5687a', '#3d4a5c'],
  paint: ['#ffffff', '#f3efe8', '#e7e2da', '#cfcac2', '#8a8780', '#2f2f31', '#dfe8ec', '#e9dccb', '#d9e4d3', '#f2d9cf'],
  metal: ['#d7d9dc', '#a7aaae', '#3a3b3e', '#c9a86a', '#b87a5a'],
}
