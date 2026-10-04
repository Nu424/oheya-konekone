# おへやこねこね AIエージェント向けガイド

このファイルは `npm run ai-guide` で自動生成しています。レイアウトJSONを作るときのルールと、使えるアイテムの一覧です。
JSONはアプリの「JSON」ダイアログに貼り付けるか、ファイルとしてドラッグ＆ドロップすると読み込めます。
検証で問題があれば、`items[2].params.width` のように場所を指してエラーが表示されます。

## 座標と単位
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
- params を省略すると各アセットのデフォルト値になる。範囲外の値はエラーになる。

## レイアウトのコツ
- 家具どうし、家具と柱は重ねない（ラグ・カーテン・クッション・天井照明は重なってOK。椅子は机やテーブルの下に入れてOK）。
- 人が通る通路は 600mm 以上あける。ドアの開く範囲（ドア幅の扇形）と、掃き出し窓（sill=0）の前はふさがない。
- クローゼットの前（奥行き 600mm くらい）は空ける。
- 背の高い家具（本棚・冷蔵庫など）は壁際に。ベッドは窓や壁に沿わせると広く見える。
- テレビとソファ（または座る場所）は向かい合わせる。デスクは窓の横か壁向きが集中しやすい。
- id はアイテムごとにユニークな短い英数字にする。

## 使えるアイテム（カタログ）
### bed — ベッド（寝具 / placement: floor）
ベッド。サイズ（シングル〜クイーン）、フレームの種類、脚の高さ、ヘッドボードの有無、寝具の色を変えられる。足元が正面(+Z)、頭側が背面
- size: "single"(シングル) | "semiDouble"(セミダブル) | "double"(ダブル) | "queen"(クイーン) (既定 "single") — サイズ
- length: number 1950〜2150mm (既定 1950) — 長さ
- frame: "wood"(木製・脚つき) | "steel"(スチール) | "storage"(収納付き) | "low"(ローベッド) | "none"(マットレスのみ) (既定 "wood") — フレーム
- legHeight: number 0〜400mm (既定 180) — 脚の高さ
- headboard: "none"(なし) | "panel"(パネル) | "shelf"(棚付き) (既定 "panel") — ヘッドボード
- mattress: number 100〜300mm (既定 200) — マットレス厚
- frameColor: "#rrggbb" (既定 #b8875a) — フレーム
- beddingColor: "#rrggbb" (既定 #c9d6df) — 掛け布団
- sheetColor: "#rrggbb" (既定 #f4f1ec) — シーツ・枕
- duvet: boolean (既定 true) — 掛け布団
- プリセット例: シングル・木製 {"size":"single","frame":"wood"} / セミダブル・収納付き {"size":"semiDouble","frame":"storage","frameColor":"#f1ece4","beddingColor":"#c9d6df"} / ローベッド {"size":"semiDouble","frame":"low","headboard":"none","frameColor":"#6b4a34","beddingColor":"#9fb59a"} / アイアン {"frame":"steel","legHeight":300,"frameColor":"#2b2b2b","beddingColor":"#d8a48f"}

### futon — 敷布団（寝具 / placement: floor）
床に敷く布団。たたんだ状態にもできる
- width: number 900〜1500mm (既定 1000) — 幅
- length: number 1900〜2200mm (既定 2100) — 長さ
- thickness: number 40〜150mm (既定 80) — 厚み
- folded: boolean (既定 false) — 三つ折りにたたむ
- color: "#rrggbb" (既定 #f1ede6) — 布団の色
- coverColor: "#rrggbb" (既定 #c9d6df) — 掛け布団

### sofa — ソファ（くつろぎ / placement: floor）
ソファ。幅で1〜3人掛けを表現。ひじ掛けや脚の形、布の色を変えられる。座る側が正面
- width: number 700〜2400mm (既定 1600) — 幅
- depth: number 650〜1000mm (既定 800) — 奥行き
- seatHeight: number 250〜480mm (既定 400) — 座面の高さ
- arms: "square"(角型) | "round"(丸型) | "thin"(細め) | "none"(なし) (既定 "square") — ひじ掛け
- legs: "wood"(木の脚) | "metal"(金属の脚) | "none"(脚なし) (既定 "wood") — 脚
- fabric: "#rrggbb" (既定 #b9b0a3) — 布の色
- legColor: "#rrggbb" (既定 #6b4a34) — 脚の色
- cushions: boolean (既定 true) — クッション
- cushionColor: "#rrggbb" (既定 #e8c76a) — クッションの色
- プリセット例: 1人掛け {"width":850} / 2人掛け {"width":1450} / 3人掛け {"width":2000,"depth":880} / ローソファ {"width":1300,"seatHeight":300,"legs":"none","arms":"round","fabric":"#8fa9bf"}

### floorChair — 座椅子（くつろぎ / placement: floor）
床に置く座椅子。背もたれの角度を変えられる
- width: number 450〜700mm (既定 550) — 幅
- recline: number 95〜160° (既定 110) — 背もたれの角度
- arms: boolean (既定 false) — ひじ掛け
- fabric: "#rrggbb" (既定 #4d4f53) — 布の色

### beanbag — ビーズクッション（くつろぎ / placement: floor）
体が沈み込む大きなビーズクッション
- size: number 500〜1100mm (既定 750) — 直径
- height: number 300〜700mm (既定 450) — 高さ
- color: "#rrggbb" (既定 #d8a48f) — 布の色

### cushion — クッション（雑貨 / placement: floor）
床やソファに置くクッション・座布団
- kind: "square"(四角クッション) | "zabuton"(座布団) | "round"(丸クッション) (既定 "zabuton") — 種類
- size: number 350〜650mm (既定 550) — 大きさ
- color: "#rrggbb" (既定 #e8c76a) — 色

### lowTable — ローテーブル（テーブル / placement: floor）
床に座って使う低いテーブル。四角・丸・楕円
- shape: "rect"(四角) | "round"(丸) | "oval"(楕円) (既定 "rect") — 天板の形
- width: number 500〜1400mm (既定 900) — 幅
- depth: number 400〜900mm (既定 500) — 奥行き
- height: number 280〜500mm (既定 360) — 高さ
- legs: "wood"(木の脚) | "hairpin"(ヘアピン) | "folding"(折りたたみ) | "box"(箱型) (既定 "wood") — 脚
- shelf: boolean (既定 false) — 下段の棚
- topColor: "#rrggbb" (既定 #d2ad7c) — 天板
- legColor: "#rrggbb" (既定 #d2ad7c) — 脚
- プリセット例: 丸テーブル {"shape":"round","width":750,"legs":"folding","topColor":"#f1ece4","legColor":"#f1ece4"} / 北欧風 {"shape":"oval","width":1000,"depth":550,"topColor":"#e4cfa8","legColor":"#e4cfa8"} / インダストリアル {"legs":"hairpin","topColor":"#6b4a34","legColor":"#2b2b2b"}

### kotatsu — こたつ（テーブル / placement: floor）
こたつ布団付きのこたつ。布団なし（夏モード）にもできる
- width: number 600〜1200mm (既定 800) — 幅
- depth: number 600〜900mm (既定 600) — 奥行き
- futon: boolean (既定 true) — こたつ布団
- futonColor: "#rrggbb" (既定 #9a7b6a) — 布団の色
- topColor: "#rrggbb" (既定 #8f5f3d) — 天板

### diningTable — ダイニングテーブル（テーブル / placement: floor）
椅子で使うテーブル。カフェテーブルからダイニングまで
- shape: "rect"(四角) | "round"(丸) (既定 "rect") — 天板の形
- width: number 600〜1600mm (既定 1100) — 幅
- depth: number 600〜900mm (既定 700) — 奥行き
- height: number 650〜1000mm (既定 720) — 高さ
- legs: "four"(4本脚) | "center"(1本脚) | "trestle"(コの字) (既定 "four") — 脚
- topColor: "#rrggbb" (既定 #b8875a) — 天板
- legColor: "#rrggbb" (既定 #b8875a) — 脚
- プリセット例: カフェテーブル {"shape":"round","width":650,"legs":"center","topColor":"#f1ece4","legColor":"#2b2b2b"} / 2人用 {"width":800,"depth":650}

### diningChair — チェア（テーブル / placement: floor）
ダイニングチェアやスツール。座る人が正面(+Z)を向く
- style: "wood"(木製) | "cafe"(カフェ（金属）) | "stool"(スツール) (既定 "wood") — スタイル
- seatHeight: number 380〜750mm (既定 440) — 座面の高さ
- frameColor: "#rrggbb" (既定 #b8875a) — フレーム
- seatColor: "#rrggbb" (既定 #d9d2c5) — 座面

### desk — デスク（作業 / placement: floor）
作業机。I字。天板サイズ・脚の形・色を変えられる
- width: number 600〜1800mm (既定 1000) — 幅
- depth: number 400〜900mm (既定 600) — 奥行き
- height: number 600〜1200mm (既定 720) — 高さ
- legStyle: "panel"(パネル) | "steel"(スチール角脚) | "round"(丸脚) (既定 "steel") — 脚
- topColor: "#rrggbb" (既定 #c8a27a) — 天板
- legColor: "#rrggbb" (既定 #2f2f31) — 脚
- drawer: boolean (既定 false) — 引き出し
- プリセット例: コンパクト {"width":800,"depth":450} / 在宅ワーク {"width":1400,"depth":700,"topColor":"#d2ad7c"} / スタンディング {"width":1200,"depth":650,"height":1050,"legStyle":"steel"}

### officeChair — オフィスチェア（作業 / placement: floor）
キャスター付きのデスクチェア。座る人が正面(+Z)を向く
- seatHeight: number 380〜520mm (既定 450) — 座面の高さ
- back: "mesh"(メッシュ) | "fabric"(ファブリック) | "high"(ハイバック) (既定 "mesh") — 背もたれ
- arms: boolean (既定 true) — ひじ掛け
- color: "#rrggbb" (既定 #3a3b3e) — 座面・背もたれ
- frameColor: "#rrggbb" (既定 #2b2b2b) — フレーム
- プリセット例: ゲーミング風 {"back":"high","color":"#c5687a"} / ホワイト {"color":"#e7e2da","frameColor":"#f2efe9"}

### monitor — モニター（作業 / placement: onTop / 既定の高さ y=720）
PCモニター。デスクの上(y=デスクの高さ)に置く。2枚並べることもできる
- inches: number 21〜34インチ (既定 24) — サイズ
- count: number 1〜2 (既定 1) — 枚数
- ultrawide: boolean (既定 false) — ウルトラワイド
- laptop: boolean (既定 true) — ノートPCも置く
- keyboard: boolean (既定 true) — キーボード
- color: "#rrggbb" (既定 #1d1d20) — 色
- on: boolean (既定 true) — 画面をつける

### deskLamp — デスクライト（照明 / placement: onTop / 既定の高さ y=720）
机の上に置くアーム式ライト。y=机の高さ
- color: "#rrggbb" (既定 #2b2b2b) — 色

### bookshelf — 本棚（収納 / placement: floor）
オープンシェルフ・本棚。段数・サイズを変えられ、本を並べた状態も表示できる
- width: number 300〜1800mm (既定 800) — 幅
- height: number 400〜2100mm (既定 1800) — 高さ
- depth: number 200〜450mm (既定 300) — 奥行き
- shelves: number 1〜8 (既定 5) — 段数
- columns: number 1〜4 (既定 1) — 列数
- back: boolean (既定 true) — 背板
- books: boolean (既定 true) — 本を並べる
- color: "#rrggbb" (既定 #d2ad7c) — 本体
- プリセット例: 壁一面 {"width":1600,"height":2000,"columns":2,"shelves":6} / ロー {"width":1200,"height":800,"shelves":2,"columns":3,"color":"#f1ece4"} / ブラック {"color":"#2b2b2b","back":false}

### colorBox — カラーボックス（収納 / placement: floor）
定番のカラーボックス。縦置き・横置き、インナーボックスの有無
- cubes: number 2〜4 (既定 3) — 段数
- orientation: "vertical"(縦置き) | "horizontal"(横置き) (既定 "vertical") — 向き
- bins: "none"(なし) | "some"(いくつか) | "all"(ぜんぶ) (既定 "some") — インナーボックス
- color: "#rrggbb" (既定 #f1ece4) — 本体
- binColor: "#rrggbb" (既定 #b9b0a3) — インナーボックス

### chest — チェスト（収納 / placement: floor）
引き出しの収納家具。段数と列数を変えられる
- width: number 350〜1400mm (既定 800) — 幅
- height: number 400〜1300mm (既定 900) — 高さ
- depth: number 300〜550mm (既定 420) — 奥行き
- rows: number 2〜7 (既定 4) — 段数
- columns: number 1〜3 (既定 1) — 列数
- handle: "bar"(バー) | "knob"(つまみ) | "groove"(溝) (既定 "bar") — 取っ手
- material: "wood"(木製) | "plastic"(プラスチック（衣装ケース風）) (既定 "wood") — 素材
- color: "#rrggbb" (既定 #d2ad7c) — 本体
- プリセット例: 衣装ケース {"width":440,"height":1000,"rows":5,"material":"plastic","color":"#ffffff"} / 横長ロー {"width":1200,"height":600,"rows":2,"columns":3}

### hangerRack — ハンガーラック（収納 / placement: floor）
服をかけるラック。服をかけた状態も表示できる
- width: number 600〜1600mm (既定 1000) — 幅
- height: number 1300〜1900mm (既定 1650) — 高さ
- depth: number 350〜600mm (既定 450) — 奥行き
- clothes: number 0〜20 (既定 9) — 服の数
- shelf: boolean (既定 true) — 下段の棚
- color: "#rrggbb" (既定 #2b2b2b) — フレーム

### tvStand — テレビ台（AV / placement: floor）
テレビを置く低い台。テレビ（tv）を上に載せて使う
- width: number 600〜2000mm (既定 1200) — 幅
- height: number 250〜600mm (既定 400) — 高さ
- depth: number 280〜500mm (既定 400) — 奥行き
- style: "open"(オープン) | "drawers"(引き出し) | "doors"(扉付き) (既定 "open") — スタイル
- legs: boolean (既定 true) — 脚付き
- color: "#rrggbb" (既定 #8f5f3d) — 本体

### tv — テレビ（AV / placement: onTop / 既定の高さ y=400）
薄型テレビ。インチ数でサイズが変わる。テレビ台の上(y=テレビ台の高さ)に置く
- inches: number 19〜75インチ (既定 43) — サイズ
- stand: "center"(中央) | "feet"(両端の脚) | "wall"(壁掛け) (既定 "center") — スタンド
- on: boolean (既定 false) — 画面をつける

### fridge — 冷蔵庫（家電 / placement: floor）
冷蔵庫。容量でサイズが変わる。一人暮らしなら150L前後の2ドアが定番
- capacity: "mini"(小型 (90L)) | "small"(2ドア (150L)) | "medium"(3ドア (300L)) | "large"(大型 (450L)) (既定 "small") — 容量
- color: "#rrggbb" (既定 #f4f4f2) — 色
- finish: "matte"(マット) | "gloss"(つや) (既定 "matte") — 仕上げ
- magnets: boolean (既定 true) — マグネット・メモ

### washer — 洗濯機（家電 / placement: floor）
洗濯機。縦型かドラム式。防水パンも付けられる
- kind: "vertical"(縦型) | "drum"(ドラム式) (既定 "vertical") — タイプ
- pan: boolean (既定 true) — 防水パン
- color: "#rrggbb" (既定 #f4f4f2) — 色

### aircon — エアコン（家電 / placement: wall / 既定の高さ y=1950）
壁掛けエアコン。壁に背面をつけ、position yは本体の下端（通常1900〜2000）
- width: number 700〜950mm (既定 800) — 幅
- color: "#rrggbb" (既定 #f6f5f2) — 色

### miniKitchen — ミニキッチン（キッチン / placement: floor）
1K/ワンルームによくある備え付けキッチン。シンク・コンロ・吊り戸棚。背面を壁につけて置く（locked推奨）
- width: number 900〜2400mm (既定 1500) — 幅
- depth: number 450〜650mm (既定 550) — 奥行き
- stove: "ih1"(IH 1口) | "ih2"(IH 2口) | "gas2"(ガス 2口) | "none"(なし) (既定 "ih1") — コンロ
- sinkSide: "left"(左) | "right"(右) (既定 "left") — シンクの位置
- upper: boolean (既定 true) — 吊り戸棚
- color: "#rrggbb" (既定 #f2efe9) — 扉の色
- fridgeSpace: boolean (既定 false) — 下に小型冷蔵庫
- プリセット例: コンパクト {"width":1000,"stove":"ih1","depth":500} / 2口コンロ {"width":1800,"stove":"gas2","color":"#d2ad7c"}

### rangeRack — レンジ台（キッチン / placement: floor）
電子レンジや炊飯器を載せるキッチンラック
- width: number 450〜900mm (既定 600) — 幅
- height: number 800〜1800mm (既定 1200) — 高さ
- depth: number 350〜500mm (既定 420) — 奥行き
- microwave: boolean (既定 true) — 電子レンジ
- riceCooker: boolean (既定 true) — 炊飯器
- kettle: boolean (既定 true) — 電気ケトル
- color: "#rrggbb" (既定 #f1ece4) — 本体

### rug — ラグ（雑貨 / placement: floor）
床に敷くラグ。家具の下に敷いてよい（重なってもOK）
- shape: "rect"(四角) | "round"(丸) (既定 "rect") — 形
- width: number 600〜3000mm (既定 1400) — 幅
- depth: number 600〜3000mm (既定 2000) — 奥行き
- pattern: "plain"(無地) | "border"(ボーダー枠) | "stripe"(ストライプ) | "check"(チェック) | "kilim"(キリム風) (既定 "border") — 柄
- pile: "flat"(薄手) | "shaggy"(シャギー) (既定 "flat") — 毛足
- color: "#rrggbb" (既定 #e7dfd2) — ベース色
- accent: "#rrggbb" (既定 #b9a58c) — 柄の色

### curtain — カーテン（雑貨 / placement: wall / 既定の高さ y=15）
窓にかけるカーテンとレール。背面を窓のある壁につけ、position yはカーテンの下端（掃き出し窓なら10〜20、腰窓なら窓の下端-150くらい）
- width: number 800〜3600mm (既定 1900) — 幅（レール）
- height: number 800〜2600mm (既定 2100) — 丈
- open: number 0〜100% (既定 70) — 開き具合
- lace: boolean (既定 true) — レースカーテン
- color: "#rrggbb" (既定 #9fb5a5) — ドレープの色
- プリセット例: 閉じた状態 {"open":0} / 腰窓用 {"width":1800,"height":1350}

### plant — 観葉植物（雑貨 / placement: floor）
鉢植えの観葉植物。種類と高さを変えられる
- kind: "monstera"(モンステラ) | "umbellata"(ウンベラータ) | "sansevieria"(サンスベリア) | "olive"(オリーブ) (既定 "monstera") — 種類
- height: number 300〜1900mm (既定 900) — 高さ
- potColor: "#rrggbb" (既定 #e9e4dc) — 鉢の色
- potStyle: "round"(丸) | "cylinder"(円筒) | "basket"(バスケット) (既定 "round") — 鉢
- プリセット例: 小さめ {"height":450,"kind":"sansevieria","potColor":"#c87f5c"} / 大きめ {"height":1700,"kind":"umbellata","potStyle":"basket"}

### mirror — 姿見（雑貨 / placement: floor）
全身が映る鏡。壁に立てかけるかスタンド式
- width: number 300〜900mm (既定 450) — 幅
- height: number 1000〜1900mm (既定 1500) — 高さ
- style: "lean"(立てかけ) | "stand"(スタンド) (既定 "lean") — 置き方
- frame: "thin"(細い) | "wide"(太い) | "none"(なし) (既定 "thin") — フレーム
- frameColor: "#rrggbb" (既定 #b8875a) — フレームの色

### trashCan — ゴミ箱（雑貨 / placement: floor）
ゴミ箱
- shape: "round"(丸) | "square"(角) | "slim"(スリム（分別）) (既定 "round") — 形
- height: number 250〜700mm (既定 380) — 高さ
- lid: boolean (既定 true) — フタ
- color: "#rrggbb" (既定 #f2efe9) — 色

### pendantLight — ペンダントライト（照明 / placement: ceiling）
天井から吊るす照明。position yは無視され天井から吊るされる。x,zで位置を決める
- style: "dome"(ドーム) | "globe"(ガラス球) | "cone"(コーン) | "paper"(提灯（和紙）) (既定 "dome") — シェード
- diameter: number 200〜600mm (既定 350) — 直径
- drop: number 300〜1400mm (既定 800) — 吊り下げの長さ
- color: "#rrggbb" (既定 #f2efe9) — シェードの色

### ceilingLight — シーリングライト（照明 / placement: ceiling）
天井に直付けする丸い照明。日本の賃貸の定番
- diameter: number 400〜900mm (既定 600) — 直径
- frame: "none"(なし) | "wood"(木枠) (既定 "none") — 縁
- frameColor: "#rrggbb" (既定 #b8875a) — 縁の色

### floorLamp — フロアランプ（照明 / placement: floor）
床置きの照明。スタンド・アーチ・三脚
- style: "stick"(スタンド) | "arc"(アーチ) | "tripod"(三脚) (既定 "stick") — 形
- height: number 1000〜2000mm (既定 1500) — 高さ
- shadeColor: "#rrggbb" (既定 #f2ebe0) — シェード
- frameColor: "#rrggbb" (既定 #2b2b2b) — フレーム

## 例（6畳 1K）
```json
{
  "version": 1,
  "meta": {
    "name": "6畳 1K"
  },
  "room": {
    "width": 2700,
    "depth": 3600,
    "height": 2400,
    "wallThickness": 120,
    "floor": {
      "material": "oak"
    },
    "wall": {
      "color": "#f3efe8"
    },
    "ceiling": {
      "color": "#fbfaf7"
    },
    "baseboard": {
      "color": "#e9e3d9",
      "height": 60
    },
    "openings": [
      {
        "id": "door",
        "wall": "south",
        "offset": 1800,
        "width": 750,
        "height": 2000,
        "type": "door",
        "hinge": "right",
        "swing": "in",
        "color": "#f2ede4"
      },
      {
        "id": "window",
        "wall": "north",
        "offset": 500,
        "width": 1700,
        "height": 2000,
        "type": "window",
        "sill": 0,
        "frameColor": "#c9ccd0"
      },
      {
        "id": "closet",
        "wall": "east",
        "offset": 2000,
        "width": 1350,
        "height": 2100,
        "type": "closet",
        "doorStyle": "folding",
        "depth": 600,
        "color": "#efe9df"
      }
    ],
    "columns": []
  },
  "items": [
    {
      "id": "curtain",
      "type": "curtain",
      "position": [
        1350,
        15,
        70
      ],
      "rotation": 0,
      "params": {
        "width": 1900,
        "height": 2030,
        "open": 70,
        "lace": true,
        "color": "#9fb5a5"
      }
    },
    {
      "id": "bed",
      "type": "bed",
      "position": [
        530,
        0,
        1130
      ],
      "rotation": 0,
      "params": {
        "size": "single",
        "length": 1950,
        "frame": "wood",
        "legHeight": 180,
        "headboard": "shelf",
        "mattress": 200,
        "frameColor": "#b8875a",
        "beddingColor": "#c9d6df",
        "sheetColor": "#f4f1ec",
        "duvet": true
      }
    },
    {
      "id": "aircon",
      "type": "aircon",
      "position": [
        125,
        1980,
        1500
      ],
      "rotation": 90,
      "params": {
        "width": 800,
        "color": "#f6f5f2"
      }
    },
    {
      "id": "rug",
      "type": "rug",
      "position": [
        1720,
        0,
        1650
      ],
      "rotation": 90,
      "params": {
        "shape": "rect",
        "width": 1400,
        "depth": 1000,
        "pattern": "border",
        "pile": "flat",
        "color": "#e7dfd2",
        "accent": "#b9a58c"
      }
    },
    {
      "id": "table",
      "type": "lowTable",
      "position": [
        1700,
        0,
        1650
      ],
      "rotation": 90,
      "params": {
        "shape": "oval",
        "width": 750,
        "depth": 450,
        "height": 360,
        "legs": "wood",
        "shelf": false,
        "topColor": "#d2ad7c",
        "legColor": "#d2ad7c"
      }
    },
    {
      "id": "cushion",
      "type": "cushion",
      "position": [
        1250,
        0,
        1650
      ],
      "rotation": 90,
      "params": {
        "kind": "zabuton",
        "size": 550,
        "color": "#e8c76a"
      }
    },
    {
      "id": "tvstand",
      "type": "tvStand",
      "position": [
        2535,
        0,
        1250
      ],
      "rotation": 270,
      "params": {
        "width": 1000,
        "height": 380,
        "depth": 330,
        "style": "open",
        "legs": true,
        "color": "#8f5f3d"
      }
    },
    {
      "id": "tv",
      "type": "tv",
      "position": [
        2550,
        380,
        1250
      ],
      "rotation": 270,
      "params": {
        "inches": 32,
        "stand": "center",
        "on": false
      }
    },
    {
      "id": "plant",
      "type": "plant",
      "position": [
        2430,
        0,
        330
      ],
      "rotation": 0,
      "params": {
        "kind": "monstera",
        "height": 1000,
        "potColor": "#e9e4dc",
        "potStyle": "round"
      }
    },
    {
      "id": "desk",
      "type": "desk",
      "position": [
        300,
        0,
        2950
      ],
      "rotation": 90,
      "params": {
        "width": 1000,
        "depth": 550,
        "height": 720,
        "legStyle": "steel",
        "topColor": "#c8a27a",
        "legColor": "#2f2f31",
        "drawer": false
      }
    },
    {
      "id": "monitor",
      "type": "monitor",
      "position": [
        240,
        720,
        2950
      ],
      "rotation": 90,
      "params": {
        "inches": 24,
        "count": 1,
        "ultrawide": false,
        "laptop": false,
        "keyboard": true,
        "color": "#1d1d20",
        "on": true
      }
    },
    {
      "id": "chair",
      "type": "officeChair",
      "position": [
        820,
        0,
        2950
      ],
      "rotation": 270,
      "params": {
        "seatHeight": 450,
        "back": "mesh",
        "arms": true,
        "color": "#3a3b3e",
        "frameColor": "#2b2b2b"
      }
    },
    {
      "id": "trash",
      "type": "trashCan",
      "position": [
        1100,
        0,
        3430
      ],
      "rotation": 0,
      "params": {
        "shape": "round",
        "height": 380,
        "lid": true,
        "color": "#f2efe9"
      }
    },
    {
      "id": "light",
      "type": "ceilingLight",
      "position": [
        1350,
        0,
        1800
      ],
      "rotation": 0,
      "params": {
        "diameter": 600,
        "frame": "none",
        "frameColor": "#b8875a"
      }
    }
  ]
}
```
