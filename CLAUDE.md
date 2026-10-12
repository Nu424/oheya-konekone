# CLAUDE.md

一人暮らしサイズの部屋を3Dでデザインする Web アプリ「おへやこねこね」。
Vite + React + TypeScript + react-three-fiber。GitHub Pages に静的デプロイ（`main` への push で自動）。

くわしい知見（モデリング・レンダリング・検証の罠）は [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md)、描画の軽さの仕組みと測り方は [docs/PERFORMANCE.md](docs/PERFORMANCE.md)、
計画と進捗は [docs/PLAN.md](docs/PLAN.md)、レイアウト JSON のルールとカタログは [docs/AI_GUIDE.md](docs/AI_GUIDE.md)。
積み重ね・コピペ・複数選択・削除や数値入力の追加の設計は [docs/STACKING.md](docs/STACKING.md)・[docs/CLIPBOARD.md](docs/CLIPBOARD.md)・[docs/MULTISELECT.md](docs/MULTISELECT.md)・[docs/EDITING-EXTRAS.md](docs/EDITING-EXTRAS.md)。

## このプロジェクトの前提（迷ったらここに立ち返る）

最初に決めた「何を目指すか」。新しい機能やアセットを足すときの判断基準にする。

1. **three.js で、いま見てもきれいな部屋を描く。** 外部のテクスチャや3Dモデル素材には頼らず、形もテクスチャもコードで作る（静的サイトで軽く、パラメータで形を変えられることと両立させるため）。
2. **家具はすべてパラメトリック。** サイズ・形・色をパラメータで変えられ、よくある組み合わせはプリセットにする。寸法は実物の一人暮らし家具に合わせる。パラメータ定義ひとつから、UI・検証・AI向けの説明・サムネイルを作る（手で二重に書かない）。
3. **アセットは目で確かめながら作る。** ギャラリーとスクショで最小・最大・各プリセットを見て、変な形や破綻がないか確認してから入れる。
4. **部屋の大きさは自由に変えられる。** 長方形の部屋＋ドア・窓・クローゼット・柱。スキーマは将来多角形に広げられる形を保つ。
5. **人も AI も同じ JSON で部屋を作れる。** AI エージェントが JSON だけで配置を考えられるようにする。新しい機能も JSON とルール文（`src/ai/prompt.ts`）で表現でき、間違えたら「どこが・なぜ」違うかを返せるようにする。
6. **触っていて楽しく、気が利く UI/UX。** 置いたらぽよんと弾む、壁や家具に吸い付く、空いている場所に自動で置く、重なりや通れない場所を先に教える、undo があるから失敗しても怖くない。文言はやわらかく、エラーは直し方まで言う。「設定画面で頑張らせる」より「勝手にいい感じになる」を選ぶ。
7. **PC が主役、スマホでも見られる。** サーバーなし（GitHub Pages＋localStorage＋JSON ファイル）。

## コマンド

```bash
npm run dev          # http://localhost:5173
npm test             # vitest（スキーマ・当たり判定・吸い付き・全テンプレートの重なり/動線）
npm run typecheck    # tsc -b
npm run build        # dist/
npm run ai-guide     # docs/AI_GUIDE.md を再生成（アセットやルールを変えたら必ず）
node scripts/shot.mjs '<path?query>' shots/x.png [w] [h] [waitMs] [actions...]   # スクショ（dev サーバー起動中に）
node scripts/sheet.mjs shots/x.png 4 'type=desk&only=1' 'type=shelf&only=3&az=-30' ...   # ギャラリーの寄りを並べた一覧
npx tsx scripts/check-layout.ts [id | file.json]   # 重なり・浮き・何に載っているかを一覧（ブラウザ不要）
node scripts/perf-check.mjs   # 描画の軽量化の回帰チェック（dev サーバー起動中に。docs/PERFORMANCE.md）
# /?perf で動作診断（記録してログを出す）
```

- `npm install` は `.npmrc` の `legacy-peer-deps=true` 前提（drei が古い three-mesh-bvh を固定しているため）。
- 変更をコミットする前に `npm test` と `npm run typecheck` を通す。見た目を変えたらスクショで確認する。

## 構成

| パス | 役割 |
|---|---|
| `src/model/` | レイアウト JSON の zod スキーマ（`schema.ts`）、検証と入出力（`io.ts`）、テンプレート |
| `src/assets/` | パラメトリック家具。`params.ts`（パラメータ DSL）、`kit.ts`（形の道具：`panel`・`merged` など）、`parts.ts`（取っ手・扉・引き出し・キャスターなどの部品）、`storageKit.ts`（棚・収納の組み立て）、`items/*.ts`（各アセット）、`registry.ts`（一覧） |
| `src/three/` | 描画。部屋（`RoomMesh`）、照明（`Lighting`）、ポストエフェクト、テクスチャ・マテリアル、編集レイヤー、動線オーバーレイ、撮影モード、サムネイル。`render/` は軽さの調整（影の描き直し・動いている間の縮小・画質の定数） |
| `src/perf/` | `?perf` の動作診断（記録・レポート・パネル） |
| `src/editor/` | 描画に依存しない編集ロジック。2D の当たり判定と吸い付き（`space.ts`）、積み重ね（`stacking.ts`）、配置（`placement.ts`）、編集操作（`commands.ts` の `itemCommands`）、コピペ（`clipboard.ts`）、動線解析（`flow.ts`） |
| `src/store/` | Zustand。`useDoc`（レイアウト本体、zundo で undo）と `useUi`（選択 `string[]`・視点・時間帯など） |
| `src/ui/` | パネル・ダイアログ・HUD・スタイル（`styles.css` 1枚） |
| `src/ai/prompt.ts` | AI 向けのルール文・カタログ文・プロンプト生成（アプリと AI_GUIDE で共用） |
| `src/gallery/` | `/?gallery` のアセット目視チェック画面 |

## 守ること

- **単位と座標**：JSON もアセットも mm。原点は北西の床の角、+X 東・+Z 南・+Y 上。`rotation` 0 で正面が南(+Z)、90 で東。three.js のシーンは m（アセットのルートを 0.001 倍）。
- **アセットの規約**：`build(params)` は mm で組み、底面中心が原点、正面が +Z。マテリアルは `mat(kind, color)` で共有キャッシュから取る（直接 `new` しない）。新しいアセットは `registry.ts` の `ALL` に足し、`/?gallery&type=<type>` で最小・最大・各プリセットを目で確認する。長さのパラメータは直接入力ならスライダーの上限の 1.5 倍まで通る（`numberLimits`）ので、`/?gallery&limits=max&types=<type>` でもその端の形を見る。崩れるなら `hardMax` を付ける。
- **形は実物の作りで**：木や金属の部品は `panel`（角 1〜5mm）、扉と引き出しは `parts.ts` の部品（すき間と継ぎ目つき）を使う。大きく丸めた `rbox` はクッション・布団・家電の外装だけ。棚・収納は `storageKit` を通す。中に入れる物はパラメータにせず、別のアセットとして積み重ねる。
- **開く物は中を空洞にする**：扉・フタ・引き出しが開くアセットは、閉じたときも中身のある塊ではなく、`parts.ts` の `hollowBox` / `hollowCylinder` で空洞を作る（電子レンジの庫内、洗濯槽、炊飯器の内釜、冷蔵庫の庫内）。開いた状態は `/?gallery&type=<type>&only=0&p={"open":true}` で確かめる。
- **上に物を置ける面はアセットが宣言する**（`surfaces`）。省略すると本体の上面が面になる。上に何も置かない家具（ベッド・椅子・ラグなど）は `surfaces: () => []`。段のある家具は段ごとに返し、**返す順番の意味をパラメータで変えない**（0 番は天板）。見た目より小さい本体があるときは `body` を書く。
- **マテリアル配列を持つメッシュを作らない**（撮影モードのパストレーサーで以降の全マテリアルがずれる）。色違いの面は別メッシュにする。
- **ブラウザ外でも組み立てられるように**：テクスチャ生成は `textures.ts` の `HEADLESS` ガードを通す。`document` を直接触る処理をアセットに書かない（テストと `scripts/` が node で寸法を測っている）。
- **アイテムの編集は `itemCommands`（`src/editor/commands.ts`）経由**。上に載っている物がついてくる・落ちる・高さを追う処理がここに入っている。`updateItem` で位置を直接書き換えると、載っている物が置いていかれる。ドラッグのような連続操作は `beginGesture()` / `endGesture()` で 1 回の undo にまとめる。
- **JSON の仕様を変えたら** `src/ai/prompt.ts` の RULES、`docs/AI_GUIDE.md`（再生成）、README を合わせて更新する。
- **テンプレートを足したら** `src/__tests__/templates.test.ts` が自動で重なりと動線を検査する。通るように配置を直す。
- **操作やショートカットを変えたら** `src/ui/shortcuts.ts`（`?` で開く操作一覧）と README の操作表も直す。
- UI の文言は日本語で、やわらかい口調（「〜したよ」）。コードのコメントは英語。

## よくあるハマりどころ（詳細は KNOWLEDGE.md）

- 描画は `frameloop="demand"`。`useFrame` で動かし続けるもの（アニメ・キー移動）は自分で `invalidate()` する。
- ヘッドレス Chromium（SwiftShader）は遅い。スクショの `waitMs` は 3〜6 秒、複数並列で撮ると ready が間に合わない。撮影モードは 1 分で数サンプルしか進まない。
- 床に半透明で色を重ねると日なたで色が飛ぶ（HDR）。オーバーレイは `MultiplyBlending` で乗算する。
- 3D の線は `src/three/Line.tsx` を使う（drei の `<Line>` は点が動くたびにシェーダーを作り直して、ドラッグが引っかかる）。
- CSS のクラス名が衝突しやすい（`.compass` の前例あり）。新しいクラスは用途がわかる接頭辞を付ける。
