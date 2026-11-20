import type { Layout } from '../model/schema'
import { getAsset } from '../assets/registry'
import { outwardOf, planOf, resolvedOpenings, usableRects, type Face } from '../model/plan'

/** Tiny 2D floor plan used on template cards and in dialogs. */
export function FloorPlan({ layout, padding = 400 }: { layout: Layout; padding?: number }) {
  const { room } = layout
  const t = room.wallThickness
  const W = room.width
  const D = room.depth
  const vb = `${-t - padding} ${-t - padding} ${W + 2 * (t + padding)} ${D + 2 * (t + padding)}`
  const plan = planOf(room)
  // A wall (or a stretch of one) as a rectangle in plan coordinates.
  const band = (f: Face, from: number, to: number, thickness: number) => {
    const [ox, oz] = outwardOf(f.side)
    const far = f.line + (f.axis === 'x' ? oz : ox) * thickness
    const [c0, c1] = [Math.min(f.line, far), Math.max(f.line, far)]
    return f.axis === 'x' ? { x: from, y: c0, w: to - from, h: c1 - c0 } : { x: c0, y: from, w: c1 - c0, h: to - from }
  }
  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet">
      {plan.walls.map((w) => {
        const r = band(w.face, w.start, w.end, w.thickness)
        return <rect key={w.id} x={r.x} y={r.y} width={r.w} height={r.h} fill="#6f6a64" />
      })}
      {usableRects(room).map((r) => (
        <rect key={r.space} x={r.minX} y={r.minZ} width={r.maxX - r.minX} height={r.maxZ - r.minZ} fill="#ead8bf" />
      ))}
      {layout.items.map((it) => {
        const a = getAsset(it.type)
        if (!a) return null
        const w = Number(it.params.width ?? 600)
        const d = Number(it.params.depth ?? 600)
        return (
          <rect
            key={it.id}
            x={-w / 2}
            y={-d / 2}
            width={w}
            height={d}
            rx={30}
            fill="#c9a888"
            stroke="#8a6a4f"
            strokeWidth={14}
            transform={`translate(${it.position[0]} ${it.position[2]}) rotate(${-it.rotation})`}
          />
        )
      })}
      {room.columns.map((c) => (
        <rect key={c.id} x={c.x - c.width / 2} y={c.z - c.depth / 2} width={c.width} height={c.depth} fill="#6f6a64" />
      ))}
      {resolvedOpenings(room).map(({ opening: o, wall, from, to }) => {
        const r = band(wall.face, from, to, wall.thickness)
        const fill = o.type === 'window' ? '#bcd6ea' : o.type === 'door' ? '#fffbf6' : '#e9d9c4'
        return <rect key={o.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke="#6f6a64" strokeWidth={10} />
      })}
    </svg>
  )
}
