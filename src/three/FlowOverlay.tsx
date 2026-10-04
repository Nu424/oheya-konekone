import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Cell, CELL, getFlow } from '../editor/flow'
import { useDoc } from '../store/useStore'

const S = 0.001
// Multiplied onto the floor, so the tint survives bright sunlight (white = no change).
const COLORS: Record<number, [number, number, number, number]> = {
  [Cell.Blocked]: [255, 255, 255, 255],
  [Cell.Unreachable]: [255, 150, 140, 255],
  [Cell.Tight]: [255, 210, 110, 255],
  [Cell.Comfy]: [150, 220, 165, 255],
}

/** Floor heat map of the circulation analysis plus door swing sectors. */
export function FlowOverlay() {
  const layout = useDoc((s) => s.layout)
  const flow = getFlow(layout)
  const tex = useMemo(() => {
    const data = new Uint8Array(flow.cols * flow.rows * 4)
    // Texture row 0 is the bottom of the plane (south); grid row 0 is the north wall, so flip rows.
    for (let r = 0; r < flow.rows; r++)
      for (let c = 0; c < flow.cols; c++) data.set(COLORS[flow.cells[r * flow.cols + c]], ((flow.rows - 1 - r) * flow.cols + c) * 4)
    const t = new THREE.DataTexture(data, flow.cols, flow.rows, THREE.RGBAFormat)
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.flipY = false
    t.needsUpdate = true
    return t
  }, [flow])
  useEffect(() => () => tex.dispose(), [tex])
  const W = flow.cols * CELL * S
  const D = flow.rows * CELL * S
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[W / 2, 0.012, D / 2]} renderOrder={5} raycast={() => null}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial map={tex} transparent premultipliedAlpha blending={THREE.MultiplyBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {flow.swings.map((s, i) => (
        <mesh key={i} position={[s.cx * S, 0.008, s.cz * S]} rotation-x={-Math.PI / 2} renderOrder={6} raycast={() => null}>
          <circleGeometry args={[s.r * S, 32, -s.a1, s.a1 - s.a0]} />
          <meshBasicMaterial color="#f2b49a" transparent premultipliedAlpha blending={THREE.MultiplyBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
