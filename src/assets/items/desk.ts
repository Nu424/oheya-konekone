import { mat, SWATCHES } from '../../three/materials'
import { boxOn, cyl, group } from '../kit'
import { p } from '../params'
import { defineAsset } from '../types'

export const desk = defineAsset({
  type: 'desk',
  label: 'デスク',
  category: 'work',
  description: '作業机。I字。天板サイズ・脚の形・色を変えられる',
  placement: 'floor',
  params: {
    width: p.mm('幅', 600, 1800, 1000),
    depth: p.mm('奥行き', 400, 900, 600),
    height: p.mm('高さ', 600, 1200, 720, { hint: '一般的な机は700〜730mm。スタンディングなら1000mm前後' }),
    legStyle: p.select('脚', { panel: 'パネル', steel: 'スチール角脚', round: '丸脚' }, 'steel'),
    topColor: p.color('天板', '#c8a27a', { swatches: SWATCHES.wood }),
    legColor: p.color('脚', '#2f2f31', { swatches: SWATCHES.metal }),
    drawer: p.bool('引き出し', false),
  },
  presets: [
    { name: 'コンパクト', params: { width: 800, depth: 450 } },
    { name: '在宅ワーク', params: { width: 1400, depth: 700, topColor: '#d2ad7c' } },
    { name: 'スタンディング', params: { width: 1200, depth: 650, height: 1050, legStyle: 'steel' } },
  ],
  build({ width: w, depth: d, height: h, legStyle, topColor, legColor, drawer }) {
    const top = mat('wood', topColor)
    const t = 25
    const g = group(boxOn(w, t, d, top, 0, h - t, 0, { grain: 'x' }))
    const legH = h - t
    if (legStyle === 'panel') {
      const pm = mat('wood', topColor)
      for (const s of [-1, 1]) g.add(boxOn(20, legH, d - 20, pm, s * (w / 2 - 25), 0, 0, { grain: 'y' }))
      g.add(boxOn(w - 70, legH * 0.35, 15, pm, 0, legH * 0.6, -d / 2 + 30))
    } else if (legStyle === 'steel') {
      const lm = mat('metal', legColor, { roughness: 0.45 })
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) g.add(boxOn(30, legH, 30, lm, sx * (w / 2 - 35), 0, sz * (d / 2 - 35)))
        g.add(boxOn(20, 30, d - 70, lm, sx * (w / 2 - 35), legH - 30, 0))
      }
      g.add(boxOn(w - 70, 30, 20, lm, 0, legH - 30, -d / 2 + 35))
    } else {
      const lm = mat('wood', legColor === '#2f2f31' ? topColor : legColor)
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) g.add(cyl(18, 14, legH, lm, [sx * (w / 2 - 50), legH / 2, sz * (d / 2 - 50)]))
    }
    if (drawer) {
      const dm = mat('wood', topColor)
      const dw = Math.min(450, w * 0.45)
      g.add(boxOn(dw, 90, d - 60, dm, 0, h - t - 90, 0))
      g.add(boxOn(120, 12, 14, mat('metal', '#a7aaae'), 0, h - t - 50, d / 2 - 28))
    }
    return g
  },
})
