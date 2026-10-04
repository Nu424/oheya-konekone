# CLAUDE.md

一人暮らしサイズの部屋を3Dでデザインする Web アプリ「おへやこねこね」。
Vite + React + TypeScript + react-three-fiber。GitHub Pages に静的デプロイ（`main` への push で自動）。

くわしい知見（モデリング・レンダリング・検証の罠）は [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md)、
計画と進捗は [docs/PLAN.md](docs/PLAN.md)、レイアウト JSON のルールとカタログは [docs/AI_GUIDE.md](docs/AI_GUIDE.md)。

## コマンド

```bash
npm run dev          # http://localhost:5173
npm test             # vitest（スキーマ・当たり判定・吸い付き・全テンプレートの重なり/動線）
npm run typecheck    # tsc -b
npm run build        # dist/
npm run ai-guide     # docs/AI_GUIDE.md を再生成（アセットやルールを変えたら必ず）
node scripts/shot.mjs '<path?query>' shots/x.png [w] [h] [waitMs] [actions...]   # スクショ（dev サーバー起動中に）
```

- `npm install` は `.npmrc` の `legacy-peer-deps=true` 前提（drei が古い three-mesh-bvh を固定しているため）。
- 変更をコミットする前に `npm test` と `npm run typecheck` を通す。見た目を変えたらスクショで確認する。

## 構成

| パス | 役割 |
|---|---|
| `src/model/` | レイアウト JSON の zod スキーマ（`schema.ts`）、検証と入出力（`io.ts`）、テンプレート |
| `src/assets/` | パラメトリック家具。`params.ts`（パラメータ DSL）、`kit.ts`（モデリング道具）、`items/*.ts`（各アセット）、`registry.ts`（一覧） |
| `src/three/` | 描画。部屋（`RoomMesh`）、照明（`Lighting`）、ポストエフェクト、テクスチャ・マテリアル、編集レイヤー、動線オーバーレイ、撮影モード、サムネイル |
| `src/editor/` | 描画に依存しない編集ロジック。2D の当たり判定と吸い付き（`space.ts`）、配置（`placement.ts`）、動線解析（`flow.ts`） |
| `src/store/` | Zustand。`useDoc`（レイアウト本体、zundo で undo）と `useUi`（選択・視点・時間帯など） |
| `src/ui/` | パネル・ダイアログ・HUD・スタイル（`styles.css` 1枚） |
| `src/ai/prompt.ts` | AI 向けのルール文・カタログ文・プロンプト生成（アプリと AI_GUIDE で共用） |
| `src/gallery/` | `/?gallery` のアセット目視チェック画面 |

## 守ること

- **単位と座標**：JSON もアセットも mm。原点は北西の床の角、+X 東・+Z 南・+Y 上。`rotation` 0 で正面が南(+Z)、90 で東。three.js のシーンは m（アセットのルートを 0.001 倍）。
- **アセットの規約**：`build(params)` は mm で組み、底面中心が原点、正面が +Z。マテリアルは `mat(kind, color)` で共有キャッシュから取る（直接 `new` しない）。新しいアセットは `registry.ts` の `ALL` に足し、`/?gallery&type=<type>` で最小・最大・各プリセットを目で確認する。
- **マテリアル配列を持つメッシュを作らない**（撮影モードのパストレーサーで以降の全マテリアルがずれる）。色違いの面は別メッシュにする。
- **ブラウザ外でも組み立てられるように**：テクスチャ生成は `textures.ts` の `HEADLESS` ガードを通す。`document` を直接触る処理をアセットに書かない（テストと `scripts/` が node で寸法を測っている）。
- **レイアウトの変更は store のアクション経由**。ドラッグのような連続操作は `beginGesture()` / `endGesture()` で 1 回の undo にまとめる。
- **JSON の仕様を変えたら** `src/ai/prompt.ts` の RULES、`docs/AI_GUIDE.md`（再生成）、README を合わせて更新する。
- **テンプレートを足したら** `src/__tests__/templates.test.ts` が自動で重なりと動線を検査する。通るように配置を直す。
- UI の文言は日本語で、やわらかい口調（「〜したよ」）。コードのコメントは英語。

## よくあるハマりどころ（詳細は KNOWLEDGE.md）

- 描画は `frameloop="demand"`。`useFrame` で動かし続けるもの（アニメ・キー移動）は自分で `invalidate()` する。
- ヘッドレス Chromium（SwiftShader）は遅い。スクショの `waitMs` は 3〜6 秒、複数並列で撮ると ready が間に合わない。撮影モードは 1 分で数サンプルしか進まない。
- 床に半透明で色を重ねると日なたで色が飛ぶ（HDR）。オーバーレイは `MultiplyBlending` で乗算する。
- CSS のクラス名が衝突しやすい（`.compass` の前例あり）。新しいクラスは用途がわかる接頭辞を付ける。
