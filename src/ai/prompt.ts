import { assetList, defaultParams, describeParam } from '../assets/registry'
import { CATEGORY_LABELS, type AssetDef } from '../assets/types'
import { itemSurfaces, wallElevation } from '../editor/placement'
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
  - ほかの家具の上に置くもの（モニター・テレビ・デスクライトなど）は、y を下の家具の面の高さにする（くわしくは「積み重ね」）。
  - placement が wall のもの（エアコン・カーテン・壁の棚・ポスター）は、背面を壁につけて y を取り付け高さ（本体の下端）にする。
  - placement が ceiling のもの（ペンダントライト・天井の物干し・間仕切りカーテン）は、y を無視して天井から吊るす。
- 当たり判定は高さも見る。床から浮いている物（壁の棚・吊り戸棚・天井の物干し）の下には家具を置ける。
  - ロフトベッドは柱・はしご・床板だけが場所をとる。床板の下にデスク・ソファ・収納を入れてよい（床板の下の高さに収まる物）。
- rotation はアイテムの正面の向き。0=南(+Z)、90=東(+X)、180=北、270=西。
  - 例: 北の壁に背をつけて置く家具は rotation 0、西の壁に背をつけるなら 90、東の壁なら 270、南の壁なら 180。
  - 回転しても position（中心）は変わらない。90°や270°のときは、幅と奥行きが入れ替わった形で場所をとる。
- params を省略すると各アセットのデフォルト値になる。範囲外の値はエラーになる。
  - カタログの数値の範囲は、ふつうに使う範囲（アプリのスライダーの範囲）。「〜まで指定可」と書いてある長さは、その値まで直接指定できる（大きめの家具を置きたいときだけ使う）。

## 積み重ね（家具の上に置く）
- アイテムは、ほかのアイテムの「載せられる面」（天板・棚板など）の上に置ける（デスクの上のモニター、本棚の段に置く小物など）。何段でも重ねられる。
- 上に置くアイテムは、**y を面の高さにする**。面の高さ ＝ 下のアイテムの y ＋ カタログに書いてある面の高さ。
  - 例: デスク（y=0、天板の面が 720）の上のモニターは y=720。テレビ台（面が 400）の上のテレビは y=400。
  - カタログの面の高さはデフォルト寸法のときの値。高さなどのパラメータを変えたら、その分だけ面も動く。
- x, z（底面の中心）は、載せる面の範囲の中にする。
- 壁の棚（wallStorage）にも物を載せられる。面の高さ ＝ 棚の y ＋ カタログの面の高さ。
- 親子関係を書く必要はない。座標が面の上にあれば、アプリが「載っている」と判断して、下の家具を動かすと一緒に動く。
- y が面の高さと 2mm 以上ずれていると「宙に浮いています」という警告が出る。
- 「上には何も載せられない」と書いてあるもの（ベッド・ソファ・椅子・ラグなど）の上には置かない。`

export const DESIGN_TIPS = `## レイアウトのコツ
- 家具どうし、家具と柱は重ねない（上に載せるのはOK。ラグ・カーテン・間仕切りカーテン・クッション・天井照明は重なってOK。椅子は机やテーブルの下に入れてOK。ロフトベッドの床板の下もOK）。
- 天井の物干しの洗濯物は、背の高い家具（本棚・冷蔵庫など）の上にかからないようにする。
- 人が通る通路は 600mm 以上あける。ドアの開く範囲（ドア幅の扇形）と、掃き出し窓（sill=0）の前はふさがない。
- クローゼットの前（奥行き 600mm くらい）は空ける。
- 背の高い家具（本棚・冷蔵庫など）は壁際に。ベッドは窓や壁に沿わせると広く見える。
- テレビとソファ（または座る場所）は向かい合わせる。デスクは窓の横か壁向きが集中しやすい。
- id はアイテムごとにユニークな短い英数字にする。`

/** Support surfaces of an asset at its default size, measured from its declaration. */
function surfaceLine(a: AssetDef): string | null {
  if (a.placement === 'ceiling' || (a.placement === 'wall' && !a.surfaces)) return null
  const s = itemSurfaces({ type: a.type, params: defaultParams(a.params) as Record<string, unknown> })
  if (!s.length) return '- 上には何も載せられない'
  return `- 載せられる面（既定の寸法のとき）: ${s
    .map((f) => `${f.label ?? '上面'} 高さ ${Math.round(f.y * 10) / 10}（${Math.round(f.maxX - f.minX)}×${Math.round(f.maxZ - f.minZ)}${f.clearance !== undefined ? `、上の空き ${Math.round(f.clearance)}` : ''}）`)
    .join(' / ')}`
}

/** Default mounting height of a wall item, worked out for a 2400 mm ceiling when it depends on the room. */
function elevationText(a: AssetDef): string {
  if (a.elevation === undefined) return ''
  if (typeof a.elevation === 'number') return ` / 既定の高さ y=${a.elevation}`
  const v = Math.round(wallElevation(a.type, defaultParams(a.params) as Record<string, unknown>, { height: 2400 }))
  return ` / 既定の高さ y=${v}（大きさや天井高で変わる）`
}

export function catalogText(): string {
  const lines: string[] = []
  for (const a of assetList) {
    lines.push(`### ${a.type} — ${a.label}（${CATEGORY_LABELS[a.category]} / placement: ${a.placement}${elevationText(a)}）`)
    lines.push(a.description)
    const sl = surfaceLine(a)
    if (sl) lines.push(sl)
    for (const [k, s] of Object.entries(a.params)) if (!s.hidden) lines.push(`- ${describeParam(k, s)}`)
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
