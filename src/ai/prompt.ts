import { assetList, describeParam } from '../assets/registry'
import { CATEGORY_LABELS } from '../assets/types'
import type { Layout } from '../model/schema'

/**
 * Text for AI agents: the coordinate rules, the asset catalog and a request template.
 * Shared by the in-app "AIに頼む" dialog and the generated docs/AI_GUIDE.md.
 */

export const RULES = `## 座標と単位
- 単位は mm、角度は度。
- 原点は部屋の北西の床の角。+X が東（部屋の幅 room.width）、+Z が南（奥行き room.depth）、+Y が上。
- 壁は north(z=0) / south(z=depth) / west(x=0) / east(x=width)。
- 開口部（door / window / closet）の offset は、その壁の座標が小さい側の端から開口部の端までの距離（北・南の壁ならx、西・東の壁ならz）。
- アイテムの position は底面中心 [x, y, z]。y は床からの高さで、ふつうは 0。
  - placement が onTop のもの（モニター・テレビなど）は、y を下の家具の高さにする（例: デスク720、テレビ台400）。
  - placement が wall のもの（エアコン・カーテン）は、背面を壁につけて y を取り付け高さにする。
  - placement が ceiling のもの（ペンダントライトなど）は、y を無視して天井から吊るす。
- rotation はアイテムの正面の向き。0=南(+Z)、90=東(+X)、180=北、270=西。
  - 例: 北の壁に背をつけて置く家具は rotation 0、西の壁に背をつけるなら 90、東の壁なら 270、南の壁なら 180。
  - 回転しても position（中心）は変わらない。90°や270°のときは、幅と奥行きが入れ替わった形で場所をとる。
- params を省略すると各アセットのデフォルト値になる。範囲外の値はエラーになる。`

export const DESIGN_TIPS = `## レイアウトのコツ
- 家具どうし、家具と柱は重ねない（ラグ・カーテン・クッション・天井照明は重なってOK。椅子は机やテーブルの下に入れてOK）。
- 人が通る通路は 600mm 以上あける。ドアの開く範囲（ドア幅の扇形）と、掃き出し窓（sill=0）の前はふさがない。
- クローゼットの前（奥行き 600mm くらい）は空ける。
- 背の高い家具（本棚・冷蔵庫など）は壁際に。ベッドは窓や壁に沿わせると広く見える。
- テレビとソファ（または座る場所）は向かい合わせる。デスクは窓の横か壁向きが集中しやすい。
- id はアイテムごとにユニークな短い英数字にする。`

export function catalogText(): string {
  const lines: string[] = []
  for (const a of assetList) {
    lines.push(`### ${a.type} — ${a.label}（${CATEGORY_LABELS[a.category]} / placement: ${a.placement}${a.elevation !== undefined ? ` / 既定の高さ y=${a.elevation}` : ''}）`)
    lines.push(a.description)
    for (const [k, s] of Object.entries(a.params)) lines.push(`- ${describeParam(k, s)}`)
    if (a.presets?.length) lines.push(`- プリセット例: ${a.presets.map((p) => `${p.name} ${JSON.stringify(p.params)}`).join(' / ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

export interface PromptOptions {
  request: string
  keepRoom: boolean
  /** Optional measured sizes per type (W×D×H mm) to help agents plan. */
  sizes?: Record<string, string>
}

export function buildPrompt(layout: Layout, o: PromptOptions): string {
  const sizeTable = o.sizes
    ? `## 各アイテムのデフォルトの大きさ（幅×奥行き×高さ mm、rotation 0 のとき）\n${Object.entries(o.sizes)
        .map(([t, s]) => `- ${t}: ${s}`)
        .join('\n')}\n`
    : ''
  return `あなたは一人暮らしの部屋づくりが得意なインテリアコーディネーターです。
「おへやこねこね」という3D部屋デザインアプリのレイアウトJSONを編集して、依頼に合う部屋にしてください。

## 依頼
${o.request.trim() || '暮らしやすくて、おしゃれな部屋にしてください。'}

## 出力のしかた
- 完成したレイアウトJSONを1つだけ、\`\`\`json で囲んで出力してください。前後に短い説明を書いてもかまいません。
- version / meta / room / items のすべてを含む、完全なJSONにしてください。
- ${o.keepRoom ? 'room（部屋の広さ・ドア・窓・クローゼット・柱）は変更しないでください。' : 'room も必要なら変更してかまいません。'}
- "locked": true のアイテムは、位置も向きも変えないでください。

${RULES}

${DESIGN_TIPS}

${sizeTable}
## 使えるアイテム（カタログ）
${catalogText()}
## いまの部屋
\`\`\`json
${JSON.stringify(layout, null, 2)}
\`\`\`
`
}
