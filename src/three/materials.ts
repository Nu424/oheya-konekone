import * as THREE from 'three'
import { brushedLines, fabricWeave, kraftPaper, leafVein, softNoise, woodGrain } from './textures'

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
  /** Brushed (hairline) stainless steel. */
  | 'stainless'
  /** Mirror-like chrome plating. */
  | 'chrome'
  /** Powder-coated steel: satin paint over metal (office furniture, racks, lockers). */
  | 'powder'
  /** Anodised / brushed aluminium (frames, laptops). */
  | 'aluminum'
  /** Kraft paper / corrugated cardboard. */
  | 'cardboard'
  /** Plain printing paper. */
  | 'paper'
  /** Acrylic or polycarbonate sheet; `opacity` sets clarity, `roughness` frosting. */
  | 'acrylic'

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
    case 'stainless':
      return new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: o.roughness ?? 0.32, roughnessMap: brushedLines(), side })
    case 'chrome':
      return new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: o.roughness ?? 0.08, side })
    case 'powder':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        metalness: 0.15,
        roughness: o.roughness ?? 0.5,
        bumpMap: softNoise(),
        bumpScale: 0.08,
        clearcoat: 0.25,
        clearcoatRoughness: 0.6,
        side,
      })
    case 'aluminum':
      return new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: o.roughness ?? 0.38, roughnessMap: brushedLines(), side })
    case 'cardboard':
      return new THREE.MeshStandardMaterial({ color: c, map: kraftPaper(), roughness: o.roughness ?? 0.9, side })
    case 'paper':
      return new THREE.MeshStandardMaterial({ color: c, roughness: o.roughness ?? 0.85, side })
    case 'acrylic':
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: o.roughness ?? 0.05,
        transparent: true,
        opacity: o.opacity ?? 0.35,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
  }
}

/**
 * A material that carries its own picture (a print on a box, a clock face, a screen image).
 * `kind` decides the surface (matte paper, glossy print...). Cached by `key`.
 */
export function printedMat(key: string, map: THREE.Texture, kind: 'paper' | 'gloss' | 'screen' | 'cardboard' = 'paper', o: { roughness?: number } = {}): THREE.Material {
  const k = `printed|${kind}|${key}|${o.roughness ?? ''}`
  let m = cache.get(k)
  if (!m) {
    if (kind === 'screen')
      m = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.9, roughness: 0.15 })
    else
      m = new THREE.MeshPhysicalMaterial({
        map,
        roughness: o.roughness ?? (kind === 'gloss' ? 0.25 : 0.85),
        clearcoat: kind === 'gloss' ? 0.6 : 0,
        clearcoatRoughness: 0.2,
      })
    m.name = k
    cache.set(k, m)
  }
  return m
}

/** Common palette for UI swatches. */
export const SWATCHES = {
  wood: ['#e4cfa8', '#d2ad7c', '#b8875a', '#8f5f3d', '#6b4a34', '#4a3326', '#f1ece4', '#2b2b2b'],
  fabric: ['#efe9df', '#d9d2c5', '#b9b0a3', '#8c8a86', '#4d4f53', '#c9d6df', '#8fa9bf', '#9fb59a', '#d8a48f', '#e8c76a', '#c5687a', '#3d4a5c'],
  paint: ['#ffffff', '#f3efe8', '#e7e2da', '#cfcac2', '#8a8780', '#2f2f31', '#dfe8ec', '#e9dccb', '#d9e4d3', '#f2d9cf'],
  metal: ['#d7d9dc', '#a7aaae', '#3a3b3e', '#c9a86a', '#b87a5a'],
  /** Office furniture / rack paint (powder coat). */
  steel: ['#f4f4f2', '#e6e6e3', '#c4c6c8', '#8e9196', '#4d5055', '#2a2b2e', '#d9d2c5', '#9fb5a5'],
}
