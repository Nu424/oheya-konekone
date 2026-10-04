import type { Layout } from '../model/schema'
import { getAsset } from '../assets/registry'

/** Tiny 2D floor plan used on template cards and in dialogs. */
export function FloorPlan({ layout, padding = 400 }: { layout: Layout; padding?: number }) {
  const { room } = layout
  const t = room.wallThickness
  const W = room.width
  const D = room.depth
  const vb = `${-t - padding} ${-t - padding} ${W + 2 * (t + padding)} ${D + 2 * (t + padding)}`
  const seg = (o: Layout['room']['openings'][number]) => {
    const a = o.offset
    const b = o.offset + o.width
    switch (o.wall) {
      case 'north':
        return { x: a, y: -t, w: b - a, h: t }
      case 'south':
        return { x: a, y: D, w: b - a, h: t }
      case 'west':
        return { x: -t, y: a, w: t, h: b - a }
      case 'east':
        return { x: W, y: a, w: t, h: b - a }
    }
  }
  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet">
      <rect x={-t} y={-t} width={W + 2 * t} height={D + 2 * t} fill="#6f6a64" rx={20} />
      <rect x={0} y={0} width={W} height={D} fill="#ead8bf" />
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
      {room.openings.map((o) => {
        const r = seg(o)
        const fill = o.type === 'window' ? '#bcd6ea' : o.type === 'door' ? '#fffbf6' : '#e9d9c4'
        return <rect key={o.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke="#6f6a64" strokeWidth={10} />
      })}
    </svg>
  )
}
