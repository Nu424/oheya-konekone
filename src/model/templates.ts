import { makeLayout } from './io'
import type { Layout, LayoutInput } from './schema'

const WIDE_7: LayoutInput['room'] = {
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
}

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
        { id: 'curtain', type: 'curtain', position: [1350, 15, 70], rotation: 0, params: { width: 1900, height: 2030 } },
        { id: 'bed', type: 'bed', position: [530, 0, 1130], rotation: 0, params: { size: 'single', headboard: 'shelf' } },
        { id: 'aircon', type: 'aircon', position: [125, 1980, 1500], rotation: 90, params: {} },
        { id: 'rug', type: 'rug', position: [1720, 0, 1650], rotation: 90, params: { width: 1400, depth: 1000, pattern: 'border' } },
        { id: 'table', type: 'lowTable', position: [1700, 0, 1650], rotation: 90, params: { width: 750, depth: 450, shape: 'oval' } },
        { id: 'cushion', type: 'cushion', position: [1250, 0, 1650], rotation: 90, params: { kind: 'zabuton', color: '#e8c76a' } },
        { id: 'tvstand', type: 'tvStand', position: [2535, 0, 1250], rotation: 270, params: { width: 1000, height: 380, depth: 330 } },
        { id: 'tv', type: 'tv', position: [2550, 380, 1250], rotation: 270, params: { inches: 32 } },
        { id: 'plant', type: 'plant', position: [2430, 0, 330], rotation: 0, params: { kind: 'monstera', height: 1000 } },
        { id: 'desk', type: 'desk', position: [300, 0, 2950], rotation: 90, params: { width: 1000, depth: 550 } },
        { id: 'monitor', type: 'monitor', position: [240, 720, 2950], rotation: 90, params: { laptop: false } },
        { id: 'chair', type: 'officeChair', position: [820, 0, 2950], rotation: 270, params: {} },
        { id: 'trash', type: 'trashCan', position: [1100, 0, 3430], rotation: 0, params: {} },
        { id: 'light', type: 'ceilingLight', position: [1350, 0, 1800], rotation: 0, params: {} },
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
      items: [
        { id: 'curtain', type: 'curtain', position: [1800, 15, 70], rotation: 0, params: { width: 2200, height: 2030, color: '#d9d2c5' } },
        { id: 'bed', type: 'bed', position: [1060, 0, 2945], rotation: 90, params: { size: 'semiDouble', frame: 'storage', frameColor: '#f1ece4', beddingColor: '#8fa9bf' } },
        { id: 'rug', type: 'rug', position: [1550, 0, 1550], rotation: 0, params: { shape: 'round', width: 1500, pattern: 'plain', color: '#d9cbb4' } },
        { id: 'table', type: 'lowTable', position: [1550, 0, 1550], rotation: 0, params: { shape: 'round', width: 700, legs: 'wood', topColor: '#e4cfa8', legColor: '#e4cfa8' } },
        { id: 'tvstand', type: 'tvStand', position: [210, 0, 1600], rotation: 90, params: { width: 1100, height: 400, depth: 400, color: '#d2ad7c' } },
        { id: 'tv', type: 'tv', position: [190, 400, 1600], rotation: 90, params: { inches: 40 } },
        { id: 'sofa', type: 'sofa', position: [2650, 0, 1550], rotation: 270, params: { width: 1450, fabric: '#9fb59a', cushionColor: '#efe9df' } },
        { id: 'desk', type: 'desk', position: [420, 0, 290], rotation: 0, params: { width: 800, depth: 550, legStyle: 'round' } },
        { id: 'chair', type: 'diningChair', position: [420, 0, 780], rotation: 180, params: {} },
        { id: 'lamp', type: 'deskLamp', position: [180, 720, 200], rotation: 30, params: { color: '#f2efe9' } },
        { id: 'plant', type: 'plant', position: [2960, 0, 200], rotation: 0, params: { kind: 'sansevieria', height: 900, potStyle: 'cylinder', potColor: '#2f2f31' } },
        { id: 'shelf', type: 'bookshelf', position: [2390, 0, 3445], rotation: 180, params: { width: 600, height: 900, shelves: 3 } },
        { id: 'pendant', type: 'pendantLight', position: [1550, 0, 1550], rotation: 0, params: { style: 'paper', diameter: 420, drop: 700 } },
      ],
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
      room: WIDE_7,
      items: [],
    }),
  },
  {
    id: 'work-7',
    name: '在宅ワーク 7畳',
    description: 'AIに「在宅ワークがはかどる部屋」と頼んで作ったレイアウトの例。デュアルモニターのデスクと、くつろぎスペース',
    layout: t({
      meta: { name: '在宅ワーク 7畳', notes: 'AIエージェントがdocs/AI_GUIDE.mdのルールに沿って設計した例' },
      room: { ...WIDE_7, floor: { material: 'whiteOak' }, wall: { color: '#f1ece3' } },
      items: [
        { id: 'curtain', type: 'curtain', position: [2300, 15, 70], rotation: 0, params: { width: 2800, height: 2030, color: '#b9b0a3', open: 80 } },
        { id: 'desk', type: 'desk', position: [3550, 0, 1300], rotation: 270, params: { width: 1400, depth: 700, topColor: '#d2ad7c', legStyle: 'steel', drawer: true } },
        { id: 'monitors', type: 'monitor', position: [3620, 720, 1300], rotation: 270, params: { count: 2, inches: 24, laptop: false } },
        { id: 'lamp', type: 'deskLamp', position: [3720, 720, 760], rotation: 270, params: { color: '#2b2b2b' } },
        { id: 'chair', type: 'officeChair', position: [3000, 0, 1300], rotation: 90, params: { back: 'mesh' } },
        { id: 'bed', type: 'bed', position: [1010, 0, 650], rotation: 90, params: { size: 'semiDouble', frame: 'low', headboard: 'none', frameColor: '#6b4a34', beddingColor: '#d9d2c5' } },
        { id: 'rug', type: 'rug', position: [1650, 0, 2050], rotation: 0, params: { shape: 'round', width: 1300, pattern: 'border', color: '#e7dfd2', accent: '#9fb59a' } },
        { id: 'table', type: 'lowTable', position: [1650, 0, 2050], rotation: 0, params: { shape: 'round', width: 600, legs: 'wood', topColor: '#e4cfa8', legColor: '#e4cfa8' } },
        { id: 'seat', type: 'floorChair', position: [1650, 0, 1640], rotation: 180, params: { fabric: '#9fb59a' } },
        { id: 'shelf', type: 'bookshelf', position: [1450, 0, 2745], rotation: 180, params: { width: 900, height: 1200, depth: 300, shelves: 3 } },
        { id: 'floorlamp', type: 'floorLamp', position: [2700, 0, 2250], rotation: 0, params: { style: 'stick', height: 1500 } },
        { id: 'trash', type: 'trashCan', position: [3050, 0, 2250], rotation: 0, params: { shape: 'slim', color: '#2f2f31' } },
        { id: 'pendant', type: 'pendantLight', position: [1650, 0, 2050], rotation: 0, params: { style: 'globe', diameter: 300, drop: 800 } },
      ],
    }),
  },
]

export const defaultLayout = () => TEMPLATES[0].layout()
