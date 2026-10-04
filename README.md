# おへやこねこね

一人暮らしサイズの部屋を、ブラウザの3Dでこねこねデザインするアプリ。
家具はパラメトリック（サイズ・色・形をパラメータで変えられる）で、配置はJSONで入出力できます。
JSONをAIエージェントに渡して、配置を考えてもらうこともできます。

## 動かす

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # JSONスキーマ・検証まわりのテスト
npm run build      # dist/ に静的ファイルを出力
```

- `/?gallery` … 全アセットの一覧（目視チェック用）
- `/?gallery&type=desk` … 1つのアセットを最小・デフォルト・最大・プリセット・形のバリエーションで並べる

## JSONのルール（AIエージェント向け）

- 単位は **mm**、角度は **度**
- 原点は北西の床の角。**+X = 東（部屋の幅）**、**+Z = 南（部屋の奥行き）**、+Y = 上
- 開口部（ドア・窓・クローゼット）の `offset` は、壁の座標が小さい側の端からの距離（北・南の壁ならx、西・東の壁ならz）
- アイテムの `position` は底面中心 `[x, y, z]`。`rotation` は 0 で正面が南(+Z)、90 で東、180 で北、270 で西
- `params` を省略すると、各アセットのデフォルト値になる。範囲外の値は、エラーとして場所（例: `items[2].params.width`）を返す

アプリの「JSON」ダイアログ（`J`キー）から、JSON Schema をコピーできます。

## 画面の確認（開発者向け）

`npm run dev` を起動したうえで:

```bash
node scripts/shot.mjs '/?gallery&type=desk' shots/desk.png 1400 900
```

インストール済みの Chromium を、ソフトウェアWebGL（SwiftShader）で使ってスクショを撮ります。

## デプロイ

`main` に push すると、GitHub Actions で GitHub Pages にデプロイされます。
（リポジトリの Settings → Pages で Source を「GitHub Actions」にしておく必要があります）

計画と設計は [docs/PLAN.md](docs/PLAN.md) にまとめています。
