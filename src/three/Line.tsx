import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib'

export interface LineProps {
  points: [number, number, number][]
  color: string
  lineWidth?: number
  dashed?: boolean
  dashSize?: number
  gapSize?: number
  transparent?: boolean
  opacity?: number
  depthTest?: boolean
  renderOrder?: number
  visible?: boolean
}

/**
 * Screen-space wide line (three-stdlib Line2), like drei's <Line> but with a material that lives as long
 * as the component. drei disposes the material together with the geometry whenever `points` change,
 * which made three.js drop and recompile the line shader on every drag step (tens of ms on ANGLE / D3D).
 * Here only the geometry is replaced when the points move.
 */
export function Line({ points, color, lineWidth = 1, dashed = false, dashSize = 1, gapSize = 1, transparent = false, opacity = 1, depthTest = true, renderOrder = 0, visible = true }: LineProps) {
  const size = useThree((s) => s.size)
  const line = useMemo(() => new Line2(), [])
  const material = useMemo(() => new LineMaterial(), [])
  const geometry = useMemo(() => {
    const g = new LineGeometry()
    g.setPositions(points.flat())
    return g
  }, [points])

  useLayoutEffect(() => {
    line.geometry = geometry
    line.computeLineDistances()
    return () => geometry.dispose()
  }, [line, geometry])

  useLayoutEffect(() => {
    material.color.set(color)
    material.linewidth = lineWidth
    material.dashed = dashed
    material.dashSize = dashSize
    material.gapSize = gapSize
    material.transparent = transparent
    material.opacity = opacity
    material.depthTest = depthTest
    material.resolution.set(size.width, size.height)
  }, [material, color, lineWidth, dashed, dashSize, gapSize, transparent, opacity, depthTest, size.width, size.height])

  useEffect(() => () => material.dispose(), [material])

  return <primitive object={line} material={material} renderOrder={renderOrder} visible={visible} />
}
