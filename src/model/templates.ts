import { makeLayout } from './io'
import type { Layout, LayoutInput } from './schema'

export interface RoomTemplate {
  id: string
  name: string
  description: string
  layout: () => Layout
}

const t = (input: LayoutInput) => () => makeLayout(input)

export const TEMPLATES: RoomTemplate[] = [
  {
    id: '1k-6',
    name: '6畳 1K（縦長）',
    description: '2.7m × 3.6m。奥に掃き出し窓、横にクローゼットの王道1K',
    layout: t({
      meta: { name: '6畳 1K' },
      room: {
        width: 2700,
        depth: 3600,
        height: 2400,
        floor: { material: 'oak' },
        openings: [
          { id: 'door', type: 'door', wall: 'south', offset: 1800, width: 750, height: 2000, hinge: 'right', swing: 'in' },
          { id: 'window', type: 'window', wall: 'north', offset: 500, width: 1700, height: 2000, sill: 0 },
          { id: 'closet', type: 'closet', wall: 'east', offset: 2000, width: 1350, height: 2100, doorStyle: 'folding', depth: 600 },
        ],
      },
      items: [
        { id: 'desk-1', type: 'desk', position: [500, 0, 2900], rotation: 90, params: { width: 1000, depth: 550 } },
      ],
    }),
  },
  {
    id: 'one-8',
    name: '8畳 ワンルーム',
    description: '3.6m × 3.6m。窓が2面にある広めの角部屋',
    layout: t({
      meta: { name: '8畳 ワンルーム' },
      room: {
        width: 3600,
        depth: 3600,
        height: 2450,
        floor: { material: 'whiteOak' },
        openings: [
          { id: 'door', type: 'door', wall: 'south', offset: 2700, width: 780, height: 2000, hinge: 'left', swing: 'in' },
          { id: 'window', type: 'window', wall: 'north', offset: 800, width: 2000, height: 2000, sill: 0 },
          { id: 'window-2', type: 'window', wall: 'west', offset: 1200, width: 1200, height: 1100, sill: 900 },
          { id: 'closet', type: 'closet', wall: 'east', offset: 300, width: 1800, height: 2100, doorStyle: 'sliding', depth: 650 },
        ],
      },
      items: [],
    }),
  },
  {
    id: 'compact-45',
    name: '4.5畳 コンパクト',
    description: '2.7m × 2.7m。限られた広さでどこまで快適にできるか',
    layout: t({
      meta: { name: '4.5畳 コンパクト' },
      room: {
        width: 2700,
        depth: 2700,
        height: 2350,
        floor: { material: 'birch' },
        openings: [
          { id: 'door', type: 'door', wall: 'south', offset: 150, width: 720, height: 2000, hinge: 'left', swing: 'in' },
          { id: 'window', type: 'window', wall: 'north', offset: 650, width: 1400, height: 1200, sill: 800 },
        ],
      },
      items: [],
    }),
  },
  {
    id: 'wide-7',
    name: '7畳 横長',
    description: '3.9m × 2.9m。横に長くてレイアウトの自由度が高い',
    layout: t({
      meta: { name: '7畳 横長' },
      room: {
        width: 3900,
        depth: 2900,
        height: 2400,
        floor: { material: 'walnut' },
        wall: { color: '#f1ece3' },
        openings: [
          { id: 'door', type: 'door', wall: 'west', offset: 2000, width: 750, height: 2000, hinge: 'left', swing: 'in' },
          { id: 'window', type: 'window', wall: 'north', offset: 1000, width: 2600, height: 2000, sill: 0 },
          { id: 'closet', type: 'closet', wall: 'south', offset: 2200, width: 1500, height: 2100, doorStyle: 'sliding', depth: 600 },
        ],
        columns: [{ id: 'col', x: 3700, z: 200, width: 400, depth: 400 }],
      },
      items: [],
    }),
  },
]

export const defaultLayout = () => TEMPLATES[0].layout()
