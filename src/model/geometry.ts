import type { Opening, Room, WallSide } from './schema'

/** Length of a wall's interior face in mm. */
export function wallLength(room: Room, wall: WallSide): number {
  return wall === 'north' || wall === 'south' ? room.width : room.depth
}

/** 1 畳 ≈ 1.62 m² (中京間〜江戸間の平均的な不動産表記に合わせる). */
export const TATAMI_M2 = 1.62

export function roomArea(room: Room): number {
  return (room.width * room.depth) / 1_000_000
}

export function tatami(room: Room): number {
  return roomArea(room) / TATAMI_M2
}

/** Clamp an opening so it stays on its wall. */
export function clampOpening<T extends Opening>(room: Room, o: T): T {
  const len = wallLength(room, o.wall)
  const width = Math.min(o.width, len)
  const offset = Math.max(0, Math.min(o.offset, len - width))
  let height = Math.min(o.height, room.height - 50)
  if (o.type === 'window') {
    const sill = Math.min(o.sill, room.height - 300)
    height = Math.min(height, room.height - 50 - sill)
    return { ...o, width, offset, height, sill }
  }
  return { ...o, width, offset, height }
}

/** Openings overlapping on the same wall (by id pairs), used for warnings. */
export function overlappingOpenings(room: Room): [string, string][] {
  const out: [string, string][] = []
  const list = room.openings
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      if (a.wall !== b.wall) continue
      if (a.offset < b.offset + b.width && b.offset < a.offset + a.width) out.push([a.id, b.id])
    }
  }
  return out
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`
}
