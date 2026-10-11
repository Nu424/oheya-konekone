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
  - ほかの家具の上に置くもの（モニター・テレビ・デスクライトなど）は、y を下の家具の面の高さにする（くわしくは「積み重ね」）。
  - placement が wall のもの（エアコン・カーテン）は、背面を壁につけて y を取り付け高さにする。
  - placement が ceiling のもの（ペンダントライトなど）は、y を無視して天井から吊るす。
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
- 親子関係を書く必要はない。座標が面の上にあれば、アプリが「載っている」と判断して、下の家具を動かすと一緒に動く。
- y が面の高さと 2mm 以上ずれていると「宙に浮いています」という警告が出る。
- 「上には何も載せられない」と書いてあるもの（ベッド・ソファ・椅子・ラグなど）の上には置かない。

## レイアウトのコツ
- 家具どうし、家具と柱は重ねない（上に載せるのはOK。ラグ・カーテン・クッション・天井照明は重なってOK。椅子は机やテーブルの下に入れてOK）。
- 人が通る通路は 600mm 以上あける。ドアの開く範囲（ドア幅の扇形）と、掃き出し窓（sill=0）の前はふさがない。
- クローゼットの前（奥行き 600mm くらい）は空ける。
- 背の高い家具（本棚・冷蔵庫など）は壁際に。ベッドは窓や壁に沿わせると広く見える。
- テレビとソファ（または座る場所）は向かい合わせる。デスクは窓の横か壁向きが集中しやすい。
- id はアイテムごとにユニークな短い英数字にする。

## 使えるアイテム（カタログ）
### bed — ベッド（寝具 / placement: floor）
ベッド。サイズ（シングル〜クイーン）、フレームの種類、脚の高さ、ヘッドボードの有無、寝具の色を変えられる。足元が正面(+Z)、頭側が背面
- 上には何も載せられない
- size: "single"(シングル) | "semiDouble"(セミダブル) | "double"(ダブル) | "queen"(クイーン) (既定 "single") — サイズ
- length: number 1950〜2150mm (既定 1950、1950〜3225 まで指定可) — 長さ
- frame: "wood"(木製・脚つき) | "steel"(スチール) | "storage"(収納付き) | "low"(ローベッド) | "none"(マットレスのみ) (既定 "wood") — フレーム
- legHeight: number 0〜400mm (既定 180、0〜600 まで指定可) — 脚の高さ
- headboard: "none"(なし) | "panel"(パネル) | "shelf"(棚付き) (既定 "panel") — ヘッドボード
- mattress: number 100〜300mm (既定 200、100〜450 まで指定可) — マットレス厚
- frameColor: "#rrggbb" (既定 #b8875a) — フレーム
- beddingColor: "#rrggbb" (既定 #c9d6df) — 掛け布団
- sheetColor: "#rrggbb" (既定 #f4f1ec) — シーツ・枕
- duvet: boolean (既定 true) — 掛け布団
- プリセット例: シングル・木製 {"size":"single","frame":"wood"} / セミダブル・収納付き {"size":"semiDouble","frame":"storage","frameColor":"#f1ece4","beddingColor":"#c9d6df"} / ローベッド {"size":"semiDouble","frame":"low","headboard":"none","frameColor":"#6b4a34","beddingColor":"#9fb59a"} / アイアン {"frame":"steel","legHeight":300,"frameColor":"#2b2b2b","beddingColor":"#d8a48f"}

### futon — 敷布団（寝具 / placement: floor）
床に敷く布団。たたんだ状態にもできる
- 上には何も載せられない
- width: number 900〜1500mm (既定 1000、900〜2250 まで指定可) — 幅
- length: number 1900〜2200mm (既定 2100、1900〜3300 まで指定可) — 長さ
- thickness: number 40〜150mm (既定 80、40〜225 まで指定可) — 厚み
- folded: boolean (既定 false) — 三つ折りにたたむ
- color: "#rrggbb" (既定 #f1ede6) — 布団の色
- coverColor: "#rrggbb" (既定 #c9d6df) — 掛け布団

### sofa — ソファ（くつろぎ / placement: floor）
ソファ。幅で1〜3人掛けを表現。ひじ掛けや脚の形、布の色を変えられる。座る側が正面
- 上には何も載せられない
- width: number 700〜2400mm (既定 1600、700〜3600 まで指定可) — 幅
- depth: number 650〜1000mm (既定 800、650〜1500 まで指定可) — 奥行き
- seatHeight: number 250〜480mm (既定 400、250〜720 まで指定可) — 座面の高さ
- arms: "square"(角型) | "round"(丸型) | "thin"(細め) | "none"(なし) (既定 "square") — ひじ掛け
- legs: "wood"(木の脚) | "metal"(金属の脚) | "none"(脚なし) (既定 "wood") — 脚
- fabric: "#rrggbb" (既定 #b9b0a3) — 布の色
- legColor: "#rrggbb" (既定 #6b4a34) — 脚の色
- cushions: boolean (既定 true) — クッション
- cushionColor: "#rrggbb" (既定 #e8c76a) — クッションの色
- プリセット例: 1人掛け {"width":850} / 2人掛け {"width":1450} / 3人掛け {"width":2000,"depth":880} / ローソファ {"width":1300,"seatHeight":300,"legs":"none","arms":"round","fabric":"#8fa9bf"}

### floorChair — 座椅子（くつろぎ / placement: floor）
床に置く座椅子。背もたれの角度を変えられる
- 上には何も載せられない
- width: number 450〜700mm (既定 550、450〜1050 まで指定可) — 幅
- recline: number 95〜160° (既定 110) — 背もたれの角度
- arms: boolean (既定 false) — ひじ掛け
- fabric: "#rrggbb" (既定 #4d4f53) — 布の色

### beanbag — ビーズクッション（くつろぎ / placement: floor）
体が沈み込む大きなビーズクッション
- 上には何も載せられない
- size: number 500〜1100mm (既定 700、500〜1650 まで指定可) — 直径
- height: number 300〜800mm (既定 620、300〜1200 まで指定可) — 高さ
- color: "#rrggbb" (既定 #d8a48f) — 布の色

### cushion — クッション（雑貨 / placement: floor）
床やソファに置くクッション・座布団
- 上には何も載せられない
- kind: "square"(四角クッション) | "zabuton"(座布団) | "round"(丸クッション) (既定 "zabuton") — 種類
- size: number 350〜650mm (既定 550、350〜975 まで指定可) — 大きさ
- color: "#rrggbb" (既定 #e8c76a) — 色

### lowTable — ローテーブル（テーブル / placement: floor）
床に座って使う低いテーブル。四角・丸・楕円
- 載せられる面（既定の寸法のとき）: 上面 高さ 360（906×506）
- shape: "rect"(四角) | "round"(丸) | "oval"(楕円) (既定 "rect") — 天板の形
- width: number 500〜1400mm (既定 900、500〜2100 まで指定可) — 幅
- depth: number 400〜900mm (既定 500、400〜1350 まで指定可) — 奥行き
- height: number 280〜500mm (既定 360、280〜750 まで指定可) — 高さ
- legs: "wood"(木の脚) | "hairpin"(ヘアピン) | "folding"(折りたたみ) | "box"(箱型) (既定 "wood") — 脚
- shelf: boolean (既定 false) — 下段の棚
- topColor: "#rrggbb" (既定 #d2ad7c) — 天板
- legColor: "#rrggbb" (既定 #d2ad7c) — 脚
- プリセット例: 丸テーブル {"shape":"round","width":750,"legs":"folding","topColor":"#f1ece4","legColor":"#f1ece4"} / 北欧風 {"shape":"oval","width":1000,"depth":550,"topColor":"#e4cfa8","legColor":"#e4cfa8"} / インダストリアル {"legs":"hairpin","topColor":"#6b4a34","legColor":"#2b2b2b"}

### kotatsu — こたつ（テーブル / placement: floor）
こたつ布団付きのこたつ。布団なし（夏モード）にもできる
- 載せられる面（既定の寸法のとき）: 天板 高さ 395（840×640）
- width: number 600〜1200mm (既定 800、600〜1800 まで指定可) — 幅
- depth: number 600〜900mm (既定 600、600〜1350 まで指定可) — 奥行き
- futon: boolean (既定 true) — こたつ布団
- futonColor: "#rrggbb" (既定 #9a7b6a) — 布団の色
- topColor: "#rrggbb" (既定 #8f5f3d) — 天板

### diningTable — ダイニングテーブル（テーブル / placement: floor）
椅子で使うテーブル。カフェテーブルからダイニングまで
- 載せられる面（既定の寸法のとき）: 上面 高さ 720（1106×706）
- shape: "rect"(四角) | "round"(丸) (既定 "rect") — 天板の形
- width: number 600〜1600mm (既定 1100、600〜2400 まで指定可) — 幅
- depth: number 600〜900mm (既定 700、600〜1350 まで指定可) — 奥行き
- height: number 650〜1000mm (既定 720、650〜1500 まで指定可) — 高さ
- legs: "four"(4本脚) | "center"(1本脚) | "trestle"(コの字) (既定 "four") — 脚
- topColor: "#rrggbb" (既定 #b8875a) — 天板
- legColor: "#rrggbb" (既定 #b8875a) — 脚
- プリセット例: カフェテーブル {"shape":"round","width":650,"legs":"center","topColor":"#f1ece4","legColor":"#2b2b2b"} / 2人用 {"width":800,"depth":650}

### diningChair — チェア（テーブル / placement: floor）
ダイニングチェアやスツール。座る人が正面(+Z)を向く
- 上には何も載せられない
- style: "wood"(木製) | "cafe"(カフェ（金属）) | "stool"(スツール) (既定 "wood") — スタイル
- seatHeight: number 380〜750mm (既定 440、380〜1125 まで指定可) — 座面の高さ
- frameColor: "#rrggbb" (既定 #b8875a) — フレーム
- seatColor: "#rrggbb" (既定 #d9d2c5) — 座面

### desk — デスク（デスク・PC / placement: floor）
作業机。I字。天板サイズ・脚の形・色を変えられる
- 載せられる面（既定の寸法のとき）: 上面 高さ 720（1000×600）
- width: number 600〜1800mm (既定 1000、600〜2700 まで指定可) — 幅
- depth: number 400〜900mm (既定 600、400〜1350 まで指定可) — 奥行き
- height: number 600〜1200mm (既定 720、600〜1800 まで指定可) — 高さ
- legStyle: "panel"(パネル) | "steel"(スチール角脚) | "round"(丸脚) (既定 "steel") — 脚
- topColor: "#rrggbb" (既定 #c8a27a) — 天板
- legColor: "#rrggbb" (既定 #2f2f31) — 脚
- drawer: boolean (既定 false) — 引き出し
- プリセット例: コンパクト {"width":800,"depth":450} / 在宅ワーク {"width":1400,"depth":700,"topColor":"#d2ad7c"} / スタンディング {"width":1200,"depth":650,"height":1050,"legStyle":"steel"}

### officeChair — オフィスチェア（デスク・PC / placement: floor）
キャスター付きのデスクチェア。座る人が正面(+Z)を向く
- 上には何も載せられない
- seatHeight: number 380〜520mm (既定 450、380〜780 まで指定可) — 座面の高さ
- back: "mesh"(メッシュ) | "fabric"(ファブリック) | "high"(ハイバック) (既定 "mesh") — 背もたれ
- arms: boolean (既定 true) — ひじ掛け
- color: "#rrggbb" (既定 #3a3b3e) — 座面・背もたれ
- frameColor: "#rrggbb" (既定 #2b2b2b) — フレーム
- プリセット例: ゲーミング風 {"back":"high","color":"#c5687a"} / ホワイト {"color":"#e7e2da","frameColor":"#f2efe9"}

### monitor — モニター（デスク・PC / placement: onTop）
PC モニター 1 台。横置き・縦置き、スタンドかモニターアーム。机の上に置く（2 台なら 2 個置く）
- 上には何も載せられない
- inches: number 21〜34インチ (既定 24) — サイズ
- aspect: "wide"(16:9) | "ultrawide"(ウルトラワイド (21:9)) (既定 "wide") — 比率
- orientation: "landscape"(横置き) | "portrait"(縦置き) (既定 "landscape") — 向き
- stand: "stand"(標準スタンド) | "arm"(モニターアーム) (既定 "stand") — スタンド
- screen: "off"(消灯) | "wallpaper"(壁紙) | "code"(コード) | "doc"(文書) | "sheet"(表計算) (既定 "wallpaper") — 画面
- color: "#rrggbb" (既定 #1d1d20) — 本体
- プリセット例: 縦置き（コード用） {"orientation":"portrait","screen":"code"} / ウルトラワイド {"inches":34,"aspect":"ultrawide"} / アームで浮かせる {"stand":"arm"} / 白 {"color":"#f2f2f0","screen":"doc"}

### laptop — ノートPC（デスク・PC / placement: onTop）
ノートパソコン。開く角度を変えられる。机の上に置く
- 上には何も載せられない
- inches: number 11〜17インチ (既定 14) — サイズ
- open: number 0〜135° (既定 110) — 開く角度
- screen: "off"(消灯) | "wallpaper"(壁紙) | "code"(コード) | "doc"(文書) | "sheet"(表計算) (既定 "doc") — 画面
- color: "#rrggbb" (既定 #c9ccd0) — 本体
- プリセット例: 閉じている {"open":0} / 黒・16インチ {"inches":16,"color":"#2b2b2e","screen":"code"}

### keyboardMouse — キーボード・マウス（デスク・PC / placement: onTop）
キーボードとマウス（マウスパッド付きにもできる）。机の上に置く
- 上には何も載せられない
- layout: "full"(フルサイズ) | "tenkeyless"(テンキーなし) | "compact"(コンパクト) (既定 "tenkeyless") — キーボード
- mouse: boolean (既定 true) — マウス
- pad: "none"(なし) | "small"(小) | "desk"(デスクマット) (既定 "small") — マウスパッド
- color: "#rrggbb" (既定 #2b2b2e) — キーボード
- padColor: "#rrggbb" (既定 #3d4a5c) — マット

### desktopPC — デスクトップPC（デスク・PC / placement: floor）
PC の本体。タワー型・小型・ミニ PC。床にも机の上にも置ける
- 載せられる面（既定の寸法のとき）: 上面 高さ 484（224×460）
- form: "tower"(ミドルタワー) | "mini"(ミニタワー) | "mini_pc"(ミニ PC) (既定 "tower") — 形
- glass: boolean (既定 true) — ガラスの横板
- glow: "#rrggbb" (既定 #8ab4ff) — 光の色
- color: "#rrggbb" (既定 #1d1d20) — 本体
- プリセット例: 白いゲーミング {"color":"#f2f2f0","glow":"#ff7ab6"} / 光らない {"glass":false} / ミニ PC {"form":"mini_pc"}

### deskLamp — デスクライト（照明 / placement: onTop / 既定の高さ y=720）
机の上に置くアーム式ライト。y=机の高さ
- 上には何も載せられない
- color: "#rrggbb" (既定 #2b2b2b) — 色

### officeDesk — オフィスデスク（オフィス / placement: floor）
スチール脚の事務机（コクヨの S シリーズ風）。奥の幕板、片袖・両袖の引き出し、センター引き出しを選べる
- 載せられる面（既定の寸法のとき）: 天板 高さ 720（1200×700）
- width: number 1000〜1800mm (既定 1200、1000〜2700 まで指定可) — 幅
- depth: number 600〜800mm (既定 700、600〜1200 まで指定可) — 奥行き
- height: number 700〜740mm (既定 720、700〜1110 まで指定可) — 高さ
- legs: "panel"(パネル脚) | "frame"(4 本脚（角）) | "tleg"(T 字脚) (既定 "panel") — 脚
- modesty: "none"(なし) | "half"(半分) | "full"(床まで) (既定 "half") — 幕板（奥のパネル）
- pedestal: "none"(なし) | "left"(左) | "right"(右) | "both"(両袖) (既定 "right") — 袖（引き出し）
- pedDrawers: "three"(3 段) | "file"(2 段（A4 ファイル）) (既定 "three") — 袖の段
- center: boolean (既定 true) — センター引き出し
- edge: "soft"(ソフトエッジ) | "square"(角) | "wood"(木口) (既定 "soft") — 天板の縁
- open: number 0〜1 (既定 0) — 引き出しを開ける
- topColor: "#rrggbb" (既定 #e6e3dc) — 天板
- frameColor: "#rrggbb" (既定 #f4f4f2) — 脚・袖
- プリセット例: 片袖デスク {} / 平机（引き出しなし） {"pedestal":"none","center":false,"modesty":"half"} / 両袖デスク {"width":1600,"pedestal":"both"} / 木目の天板・黒脚 {"topColor":"#b8875a","frameColor":"#2a2b2e","legs":"frame","edge":"wood","modesty":"none","pedestal":"none"}

### foldingChair — 折りたたみ・ミーティングチェア（オフィス / placement: floor）
パイプ椅子（折りたためる）、ミーティングチェア（座面を跳ね上げて重ねられる、キャスター付きにもできる）、スタッキングチェア
- 上には何も載せられない
- style: "pipe"(パイプ椅子) | "meeting"(ミーティングチェア) | "stacking"(スタッキングチェア) (既定 "pipe") — 種類
- folded: boolean (既定 false) — たたむ（跳ね上げる）
- casters: boolean (既定 false) — キャスター
- arms: boolean (既定 false) — ひじ掛け
- back: "plastic"(樹脂) | "mesh"(メッシュ) | "cushion"(クッション) (既定 "cushion") — 背もたれ
- seatColor: "#rrggbb" (既定 #3d4a5c) — 座面
- frame: "chrome"(クロム) | "black"(ブラック) | "white"(ホワイト) | "silver"(シルバー) (既定 "chrome") — フレーム
- プリセット例: パイプ椅子 {} / たたんだパイプ椅子 {"folded":true} / ミーティングチェア {"style":"meeting","casters":true,"back":"mesh","seatColor":"#2b2b2e","frame":"silver"} / 跳ね上げて重ねる {"style":"meeting","folded":true,"casters":true,"back":"plastic","seatColor":"#f4f4f2","frame":"silver"} / カフェ風スタッキング {"style":"stacking","back":"plastic","seatColor":"#9fb5a5","frame":"black"}

### partition — パーテーション（オフィス / placement: floor）
自立式のついたて・間仕切り。布・アクリル・木・ホワイトボードの面、フレームと脚を選べる。何枚かつなげられる
- 上には何も載せられない
- width: number 400〜1800mm (既定 1200、400〜2700 まで指定可) — 1 枚の幅
- height: number 900〜1800mm (既定 1500、900〜2700 まで指定可) — 高さ
- panels: number 1〜4 (既定 1) — 枚数
- face: "fabric"(布) | "clear"(アクリル（透明）) | "frosted"(アクリル（すりガラス）) | "wood"(木) | "board"(ホワイトボード) | "perforated"(有孔ボード) (既定 "fabric") — 面
- topClear: boolean (既定 false) — 上だけ透明
- frame: "aluminum"(アルミ) | "wood"(木) | "black"(黒) | "none"(なし) (既定 "aluminum") — フレーム
- feet: "tleg"(T 字脚) | "base"(平たい台) | "casters"(キャスター) (既定 "tleg") — 脚
- color: "#rrggbb" (既定 #8c9aa8) — 面の色
- プリセット例: 布のパーテーション {} / 飛沫防止アクリル {"width":800,"height":900,"face":"clear","frame":"none","feet":"base"} / 上だけ透明 {"topClear":true,"height":1800,"color":"#4d5055"} / 木の衝立 {"face":"wood","frame":"wood","color":"#b8875a","feet":"base","height":1200} / 3 枚つなげる {"panels":3,"width":900}

### whiteboard — ホワイトボード（オフィス / placement: floor）
脚付き・キャスター付きの移動式ホワイトボード。板の大きさと、書いてある内容を選べる
- 上には何も載せられない
- width: number 900〜1800mm (既定 1200、900〜2700 まで指定可) — 板の幅
- height: number 600〜1200mm (既定 900、600〜1800 まで指定可) — 板の高さ
- content: "none"(まっさら) | "meeting"(会議メモ) | "plan"(間取りの落書き) | "todo"(やることリスト) (既定 "meeting") — 書いてあること
- tilt: number -30〜30° (既定 0) — 板の角度
- casters: boolean (既定 true) — キャスター
- frameColor: "#rrggbb" (既定 #c9ccd0) — フレーム
- プリセット例: 会議用 {} / 大きいボード {"width":1800,"height":1200,"content":"todo"} / 小さめ・黒フレーム {"width":900,"height":600,"content":"plan","frameColor":"#2a2b2e"}

### printer — プリンター（オフィス / placement: onTop）
家庭用のインクジェット複合機、または A4 レーザープリンター。机や棚に置く（大きなオフィス用は「オフィス複合機」）
- 上には何も載せられない
- kind: "inkjet"(インクジェット複合機) | "laser"(A4 レーザー) (既定 "inkjet") — 種類
- lid: boolean (既定 false) — スキャナーのフタを開ける
- paper: boolean (既定 true) — 印刷した紙
- color: "#rrggbb" (既定 #f4f4f2) — 本体

### copier — オフィス複合機（オフィス / placement: floor）
床置きの大型複合機（コピー・プリント・スキャン）。給紙トレイの段数を変えられる
- 上には何も載せられない
- trays: number 1〜4 (既定 3) — 給紙トレイ
- finisher: boolean (既定 false) — フィニッシャー（横の排紙ユニット）
- color: "#rrggbb" (既定 #f2f2f0) — 本体

### shelf — オープン棚（収納 / placement: floor）
扉のない棚（本棚・カラーボックス・レンジ台・見せる収納）。段数・列数・背板・脚を変えられる。各段に本や家電を載せられる
- 載せられる面（既定の寸法のとき）: 天板 高さ 1800（800×300） / 1段目 高さ 78（764×291、上の空き 326） / 2段目 高さ 422.4（764×291、上の空き 326） / 3段目 高さ 766.8（764×291、上の空き 326） / 4段目 高さ 1111.2（764×291、上の空き 326） / 5段目 高さ 1455.6（764×291、上の空き 326）
- width: number 300〜1800mm (既定 800、300〜2700 まで指定可) — 幅
- height: number 300〜2100mm (既定 1800、300〜3150 まで指定可) — 高さ
- depth: number 200〜600mm (既定 300、200〜900 まで指定可) — 奥行き
- rows: number 1〜8 (既定 5) — 段数
- cols: number 1〜5 (既定 1) — 列数
- back: boolean (既定 true) — 背板
- base: "none"(なし（床に直置き）) | "plinth"(台輪) | "legs"(脚) | "casters"(キャスター) | "adjusters"(アジャスター) (既定 "plinth") — 足もと
- finish: "wood"(木) | "melamine"(化粧板（白木・単色）) | "steel"(スチール) (既定 "wood") — 素材
- color: "#rrggbb" (既定 #d2ad7c) — 色
- プリセット例: 本棚 {} / 壁一面の本棚 {"width":1600,"height":2000,"rows":6,"cols":2} / カラーボックス（縦） {"width":420,"height":880,"depth":295,"rows":3,"cols":1,"base":"none","finish":"melamine","color":"#f4f4f2"} / カラーボックス（横） {"width":1150,"height":420,"depth":295,"rows":1,"cols":3,"base":"none","finish":"melamine","color":"#f4f4f2"} / レンジ台 {"width":600,"height":1200,"depth":450,"rows":3,"cols":1,"back":false,"base":"casters","finish":"melamine","color":"#f4f4f2"} / 見せる収納（ロー） {"width":1200,"height":800,"depth":350,"rows":2,"cols":3,"base":"legs","color":"#8f5f3d"} / スチールシェルフ {"width":900,"height":1800,"depth":400,"rows":5,"finish":"steel","color":"#e6e6e3","base":"adjusters","back":false}

### cabinet — 扉・引き出し付き収納（収納 / placement: floor）
チェスト・ロッカー・引き戸書庫・食器棚・キャビネットなど、扉や引き出しのある収納。下段と上段で扉の種類を選べる。扉を開けると中の棚に物を置ける
- 載せられる面（既定の寸法のとき）: 天板 高さ 900（800×450）
- width: number 300〜1800mm (既定 800、300〜2700 まで指定可) — 幅
- height: number 300〜2100mm (既定 900、300〜3150 まで指定可) — 高さ
- depth: number 300〜650mm (既定 450、300〜975 まで指定可) — 奥行き
- cols: number 1〜4 (既定 1) — 列数
- lower: "open"(オープン（扉なし）) | "hinged"(開き戸) | "glass"(ガラス開き戸) | "sliding"(引き戸) | "glassSliding"(ガラス引き戸) | "drawers"(引き出し) | "flap"(フラップ扉（下に開く）) (既定 "drawers") — 下段の扉
- lowerRows: number 1〜8 (既定 4) — 下段の段数
- upperShare: number 0〜0.9 (既定 0) — 上段の高さ
- upper: "open"(オープン（扉なし）) | "hinged"(開き戸) | "glass"(ガラス開き戸) | "sliding"(引き戸) | "glassSliding"(ガラス引き戸) | "drawers"(引き出し) | "flap"(フラップ扉（下に開く）) (既定 "glassSliding") — 上段の扉
- upperRows: number 1〜6 (既定 2) — 上段の段数
- span: "cell"(マスごと) | "row"(横一列ごと) | "column"(縦一列ごと) | "whole"(全面で 1 枚（2 枚）) (既定 "cell") — 扉の分け方
- open: number 0〜1 (既定 0) — 開き具合
- handle: "bar"(バー) | "knob"(つまみ) | "groove"(溝（彫り込み）) | "cup"(くぼみ) | "lever"(レバー（ロッカー）) | "none"(なし) (既定 "bar") — 取っ手
- base: "none"(なし（床に直置き）) | "plinth"(台輪) | "legs"(脚) | "casters"(キャスター) | "adjusters"(アジャスター) (既定 "plinth") — 足もと
- finish: "wood"(木) | "melamine"(化粧板（白木・単色）) | "steel"(スチール) | "plastic"(樹脂) (既定 "wood") — 素材
- color: "#rrggbb" (既定 #d2ad7c) — 本体
- frontColor: "#rrggbb" (既定 #d2ad7c) — 扉・前板
- プリセット例: チェスト（4 段） {} / 横長チェスト {"width":1200,"height":700,"cols":3,"lowerRows":2,"handle":"knob"} / 衣装ケース {"width":440,"height":1000,"depth":550,"lowerRows":5,"finish":"plastic","color":"#f4f4f2","frontColor":"#f4f4f2","handle":"cup","base":"casters"} / ロッカー（1 人用） {"width":380,"height":1790,"depth":515,"lower":"hinged","lowerRows":4,"span":"column","handle":"lever","finish":"steel","color":"#e6e6e3","frontColor":"#e6e6e3","base":"adjusters"} / ロッカー（3 人用） {"width":900,"height":1790,"depth":515,"cols":3,"lower":"hinged","lowerRows":4,"span":"column","handle":"lever","finish":"steel","color":"#e6e6e3","frontColor":"#e6e6e3","base":"adjusters"} / 引き戸書庫 {"width":880,"height":1050,"depth":400,"lower":"sliding","lowerRows":2,"finish":"steel","color":"#e6e6e3","frontColor":"#e6e6e3","base":"adjusters"} / スチール書庫（上ガラス） {"width":880,"height":1790,"depth":400,"lower":"hinged","lowerRows":2,"upperShare":0.55,"upper":"glassSliding","upperRows":3,"span":"column","handle":"lever","finish":"steel","color":"#e6e6e3","frontColor":"#e6e6e3","base":"adjusters"} / 食器棚 {"width":900,"height":1800,"depth":450,"lower":"drawers","lowerRows":2,"upperShare":0.6,"upper":"glass","upperRows":3,"span":"row","color":"#f1ece4","frontColor":"#f1ece4","finish":"melamine","handle":"bar"} / キャビネット（開き戸） {"width":800,"height":850,"depth":400,"lower":"hinged","lowerRows":2,"span":"whole","handle":"knob","base":"legs","color":"#8f5f3d","frontColor":"#8f5f3d"} / サイドボード {"width":1500,"height":700,"depth":420,"cols":3,"lower":"flap","lowerRows":1,"span":"cell","handle":"groove","base":"legs","color":"#6b4a34","frontColor":"#6b4a34"}

### metalRack — メタルラック（収納 / placement: floor）
ポールと棚板を組み合わせるスチールラック（ワイヤー棚・木目の棚板・ガラス）。キッチン・洗面所・押し入れなどに。各段に物を載せられる
- 載せられる面（既定の寸法のとき）: 一番上の棚 高さ 1750（885×435） / 1段目 高さ 55（885×435、上の空き 394） / 2段目 高さ 478.8（885×435、上の空き 394） / 3段目 高さ 902.5（885×435、上の空き 394） / 4段目 高さ 1326.3（885×435、上の空き 394）
- width: number 450〜1800mm (既定 910、450〜2700 まで指定可) — 幅
- depth: number 300〜650mm (既定 460、300〜975 まで指定可) — 奥行き
- height: number 600〜2000mm (既定 1790、600〜3000 まで指定可) — 高さ
- shelves: number 2〜8 (既定 5) — 棚の数
- shelfType: "wire"(ワイヤー) | "board"(木目の板をのせる) | "glass"(ガラスをのせる) (既定 "wire") — 棚板
- pole: "standard"(太い (25mm)) | "slim"(細い (19mm)) (既定 "standard") — ポール
- feet: "adjuster"(アジャスター) | "casters"(キャスター) (既定 "adjuster") — 足もと
- finish: "chrome"(クロムめっき) | "black"(ブラック) | "white"(ホワイト) | "gold"(ゴールド) (既定 "chrome") — 色
- boardColor: "#rrggbb" (既定 #b8875a) — 棚板の色
- プリセット例: キッチンラック {"width":760,"depth":460,"height":1790,"shelves":5,"feet":"casters"} / ブラック＋木目 {"finish":"black","shelfType":"board","boardColor":"#8f5f3d"} / ロー（3 段） {"width":910,"height":900,"shelves":3,"pole":"slim","finish":"white","shelfType":"board","boardColor":"#e4cfa8"} / すき間ラック {"width":450,"depth":350,"height":1500,"shelves":5,"pole":"slim"}

### hangerRack — ハンガーラック（収納 / placement: floor）
服をかけるラック。服をかけた状態も表示できる
- 上には何も載せられない
- width: number 600〜1600mm (既定 1000、600〜2400 まで指定可) — 幅
- height: number 1300〜1900mm (既定 1650、1300〜2850 まで指定可) — 高さ
- depth: number 350〜600mm (既定 450、350〜900 まで指定可) — 奥行き
- clothes: number 0〜20 (既定 9) — 服の数
- shelf: boolean (既定 true) — 下段の棚
- color: "#rrggbb" (既定 #2b2b2b) — フレーム

### tvStand — テレビ台（AV / placement: floor）
テレビを置く低い台。テレビ（tv）を上に載せて使う。中の段にゲーム機などを置ける
- 載せられる面（既定の寸法のとき）: 天板 高さ 400（1200×400） / 1段目 高さ 158（376×391、上の空き 224） / 2段目 高さ 158（376×391、上の空き 224） / 3段目 高さ 158（376×391、上の空き 224）
- width: number 600〜2000mm (既定 1200、600〜3000 まで指定可) — 幅
- height: number 250〜600mm (既定 400、250〜900 まで指定可) — 高さ
- depth: number 280〜500mm (既定 400、280〜750 まで指定可) — 奥行き
- style: "open"(オープン) | "drawers"(引き出し) | "doors"(扉付き) | "flap"(フラップ扉) (既定 "open") — スタイル
- legs: boolean (既定 true) — 脚付き
- finish: "wood"(木) | "melamine"(化粧板（白木・単色）) (既定 "wood") — 素材
- color: "#rrggbb" (既定 #8f5f3d) — 本体

### tv — テレビ（AV / placement: onTop / 既定の高さ y=400）
薄型テレビ。インチ数でサイズが変わる。テレビ台の上(y=テレビ台の高さ)に置く
- 上には何も載せられない
- inches: number 19〜75インチ (既定 43) — サイズ
- stand: "center"(中央) | "feet"(両端の脚) | "wall"(壁掛け) (既定 "center") — スタンド
- on: boolean (既定 false) — 画面をつける

### fridge — 冷蔵庫（家電 / placement: floor）
冷蔵庫。容量でサイズが変わる。一人暮らしなら150L前後の2ドアが定番。扉を開けると中の棚に物を置ける。上に電子レンジを載せられる
- 載せられる面（既定の寸法のとき）: 天面 高さ 1220（460×530） / 庫内の棚1 高さ 492（420×450、上の空き 334） / 庫内の棚2 高さ 836（420×450、上の空き 344）
- capacity: "mini"(小型 (90L)) | "small"(2ドア (150L)) | "medium"(3ドア (300L)) | "large"(大型 (450L)) (既定 "small") — 容量
- open: number 0〜1 (既定 0) — 扉の開き
- hinge: "right"(右) | "left"(左) (既定 "right") — 扉の吊り元
- color: "#rrggbb" (既定 #f4f4f2) — 色
- finish: "matte"(マット) | "gloss"(つや) | "steel"(ステンレス) (既定 "matte") — 仕上げ
- magnets: boolean (既定 true) — マグネット・メモ
- プリセット例: 扉を開ける {"open":0.8} / 黒・大型 {"capacity":"large","color":"#2f2f31","finish":"gloss"} / ステンレス {"capacity":"medium","finish":"steel","color":"#c9ccd0","magnets":false}

### washer — 洗濯機（家電 / placement: floor）
洗濯機。縦型かドラム式。防水パンも付けられる。ドラム式の天面には物を置ける
- 載せられる面（既定の寸法のとき）: 天面 高さ 1110（560×540）
- kind: "vertical"(縦型) | "drum"(ドラム式) (既定 "drum") — タイプ
- open: boolean (既定 false) — フタ・扉を開ける
- pan: boolean (既定 true) — 防水パン
- color: "#rrggbb" (既定 #f4f4f2) — 色

### aircon — エアコン（家電 / placement: wall / 既定の高さ y=1950）
壁掛けエアコン。壁に背面をつけ、position yは本体の下端（通常1900〜2000）
- width: number 700〜950mm (既定 800、700〜1425 まで指定可) — 幅
- color: "#rrggbb" (既定 #f6f5f2) — 色

### miniKitchen — ミニキッチン（キッチン / placement: floor）
1K/ワンルームによくある備え付けキッチン。シンク・コンロ・吊り戸棚。背面を壁につけて置く（locked推奨）
- 載せられる面（既定の寸法のとき）: カウンター 高さ 850（1500×550、上の空き 690）
- width: number 900〜2400mm (既定 1500、900〜3600 まで指定可) — 幅
- depth: number 450〜650mm (既定 550、450〜975 まで指定可) — 奥行き
- stove: "ih1"(IH 1口) | "ih2"(IH 2口) | "gas2"(ガス 2口) | "none"(なし) (既定 "ih1") — コンロ
- sinkSide: "left"(左) | "right"(右) (既定 "left") — シンクの位置
- upper: boolean (既定 true) — 吊り戸棚
- color: "#rrggbb" (既定 #f2efe9) — 扉の色
- fridgeSpace: boolean (既定 false) — 下に小型冷蔵庫
- プリセット例: コンパクト {"width":1000,"stove":"ih1","depth":500} / 2口コンロ {"width":1800,"stove":"gas2","color":"#d2ad7c"}

### microwave — 電子レンジ（キッチン / placement: onTop）
電子レンジ・オーブンレンジ。レンジ台や棚の段、冷蔵庫の上に置く。上にも物を置ける
- 載せられる面（既定の寸法のとき）: 天面 高さ 280（430×320）
- size: "compact"(単機能 (17L)) | "oven"(オーブンレンジ (26L)) (既定 "compact") — 大きさ
- door: "side"(横開き) | "drop"(縦開き（下に倒す）) (既定 "side") — 扉
- open: number 0〜1 (既定 0) — 扉の開き
- color: "#rrggbb" (既定 #f4f4f2) — 本体

### riceCooker — 炊飯器（キッチン / placement: onTop）
炊飯器。レンジ台や棚、キッチンのカウンターに置く
- 上には何も載せられない
- size: "small"(3合) | "medium"(5.5合) (既定 "small") — 大きさ
- open: boolean (既定 false) — フタを開ける
- color: "#rrggbb" (既定 #f4f4f2) — 本体

### kettle — 電気ケトル（キッチン / placement: onTop）
電気ケトル（台座つき）。カウンターや棚に置く
- 上には何も載せられない
- style: "round"(丸い) | "slim"(ドリップ（細口）) (既定 "round") — 形
- color: "#rrggbb" (既定 #2b2b2e) — 本体

### toaster — トースター（キッチン / placement: onTop）
オーブントースター。レンジ台や棚、カウンターに置く。上にも物を置ける
- 載せられる面（既定の寸法のとき）: 天面 高さ 220（300×220）
- color: "#rrggbb" (既定 #f4f4f2) — 本体

### bookRow — 本の列（縦置き）（小物 / placement: onTop）
本棚や机に立てて並べた本・バインダー・ファイル。幅を決めると、その幅ぶんだけ並ぶ。棚の段の上に置く
- 上には何も載せられない
- width: number 60〜1200mm (既定 400、60〜1800 まで指定可) — 幅
- kind: "books"(単行本) | "bunko"(文庫) | "manga"(マンガ) | "large"(大判・図鑑) | "magazines"(雑誌) | "binders"(バインダー) | "files"(フラットファイル) (既定 "books") — 種類
- palette: "colorful"(カラフル) | "calm"(落ち着いた色) | "mono"(モノトーン) | "pastel"(パステル) | "office"(事務用) (既定 "colorful") — 色
- lean: boolean (既定 true) — 端の 1 冊を斜めに
- bookends: boolean (既定 false) — ブックエンド
- seed: number 1〜50 (既定 1) — 並び
- プリセット例: 文庫の列 {"kind":"bunko","width":300,"palette":"calm"} / マンガ全巻 {"kind":"manga","width":500,"palette":"colorful"} / バインダー {"kind":"binders","width":350,"palette":"office","lean":false} / 雑誌 {"kind":"magazines","width":200,"palette":"pastel","bookends":true}

### bookStack — 本・書類の平積み（小物 / placement: onTop）
平積みにした本・雑誌・書類・クリアファイル。机や棚、床の上に置く。上にも物を置ける
- 載せられる面（既定の寸法のとき）: 一番上 高さ 90.2（111×199）
- kind: "books"(本) | "large"(大判の本) | "magazines"(雑誌) | "paper"(コピー用紙・書類) | "clearFolders"(クリアファイル) (既定 "books") — 種類
- count: number 1〜15 (既定 4) — 冊数・束の数
- mess: number 0〜1 (既定 0.3) — 散らかり具合
- palette: "colorful"(カラフル) | "calm"(落ち着いた色) | "mono"(モノトーン) | "pastel"(パステル) | "office"(事務用) (既定 "colorful") — 色
- seed: number 1〜50 (既定 1) — 並び
- プリセット例: 書類の山 {"kind":"paper","count":6,"mess":0.6} / クリアファイル {"kind":"clearFolders","count":8,"mess":0.2,"palette":"pastel"} / きっちり {"mess":0}

### fileBox — ファイルボックス（小物 / placement: onTop）
書類やファイルを立てて入れる箱。横から見ると斜めに切れている。棚に並べたり机に置いたりする
- 上には何も載せられない
- width: number 75〜200mm (既定 100、75〜300 まで指定可) — 幅
- height: number 240〜330mm (既定 320、240〜495 まで指定可) — 高さ
- depth: number 240〜340mm (既定 280、240〜510 まで指定可) — 奥行き
- material: "plastic"(プラスチック) | "paper"(紙（段ボール）) | "steel"(スチール) (既定 "plastic") — 素材
- color: "#rrggbb" (既定 #f4f2ee) — 色
- contents: "none"(からっぽ) | "files"(ファイル) | "papers"(書類) (既定 "files") — 中身
- プリセット例: 紙のファイルボックス {"material":"paper","color":"#e3cfa8"} / スチール {"material":"steel","color":"#2b2b2e"}

### cardboardBox — 段ボール・箱（小物 / placement: floor）
段ボール箱、かぶせ蓋の紙箱（お菓子・贈答品）、トレー。フタの開き具合と印刷を選べる。閉じていれば上に積み重ねられ、開いていれば中に物を入れられる
- 載せられる面（既定の寸法のとき）: フタの上 高さ 310（400×300）
- width: number 120〜800mm (既定 400、120〜1200 まで指定可) — 幅
- depth: number 100〜600mm (既定 300、100〜900 まで指定可) — 奥行き
- height: number 40〜600mm (既定 300、40〜900 まで指定可) — 高さ
- style: "flaps"(段ボール（フラップ）) | "lid"(かぶせ蓋) | "tray"(トレー（フタなし）) (既定 "flaps") — 形
- lid: "closed"(閉じる（テープ）) | "half"(半開き) | "open"(全開) (既定 "closed") — フタ
- material: "corrugated"(段ボール) | "board"(厚紙（印刷つき）) (既定 "corrugated") — 材質
- color: "#rrggbb" (既定 #c8a172) — 色
- print: "none"(なし) | "fragile"(取扱注意) | "moving"(引越し) | "shipping"(通販（伝票つき）) | "snack"(お菓子の箱) | "stripes"(帯（ストライプ）) (既定 "none") — 印刷
- printColor: "#rrggbb" (既定 #c4372f) — 印刷の色
- プリセット例: 引越しの段ボール {"print":"moving","printColor":"#1d3f8f"} / 開いた段ボール {"lid":"open","width":450,"height":280} / 通販の箱 {"width":320,"depth":240,"height":120,"print":"shipping","printColor":"#20242a"} / 割れ物注意 {"print":"fragile"} / お菓子の箱 {"style":"lid","material":"board","width":260,"depth":180,"height":60,"color":"#f2b8c6","print":"snack","printColor":"#c4372f"} / 書類トレー {"style":"tray","material":"board","width":330,"depth":240,"height":60,"color":"#f4f2ee"}

### organizer — 小物入れ（小物 / placement: onTop）
仕切りのある小物入れ・ペン立て・引き出しの中のトレー。仕切りの数と中身を選べる。机や棚に置く
- 上には何も載せられない
- width: number 60〜400mm (既定 240、60〜600 まで指定可) — 幅
- depth: number 60〜300mm (既定 160、60〜450 まで指定可) — 奥行き
- height: number 20〜150mm (既定 50、20〜225 まで指定可) — 高さ
- cols: number 1〜6 (既定 3) — 横の仕切り
- rows: number 1〜4 (既定 2) — 縦の仕切り
- material: "plastic"(プラスチック) | "wood"(木) | "acrylic"(アクリル) | "steel"(スチール) (既定 "plastic") — 素材
- color: "#rrggbb" (既定 #f4f4f2) — 色
- contents: "none"(からっぽ) | "stationery"(文房具いろいろ) | "pens"(ペン立て) (既定 "stationery") — 中身
- プリセット例: ペン立て {"width":90,"depth":90,"height":100,"cols":1,"rows":1,"contents":"pens"} / 木のトレー {"material":"wood","color":"#b8875a","cols":4,"rows":1,"height":40} / アクリルケース {"material":"acrylic","color":"#eef3f4","cols":2,"rows":2,"height":80}

### wallClock — 壁掛け時計（雑貨 / placement: wall / 既定の高さ y=1750）
壁に掛ける時計。針は画面の時間帯スライダーの時刻を指す
- diameter: number 200〜450mm (既定 300、200〜675 まで指定可) — 直径
- shape: "round"(丸) | "square"(四角) (既定 "round") — 形
- frame: "plastic"(樹脂) | "wood"(木) | "metal"(金属) | "none"(枠なし) (既定 "wood") — 枠
- frameColor: "#rrggbb" (既定 #b8875a) — 枠の色
- face: "numbers"(数字) | "bars"(線) | "minimal"(シンプル) (既定 "numbers") — 文字盤
- faceColor: "#rrggbb" (既定 #fbfaf6) — 文字盤の色
- プリセット例: 駅の時計風 {"frame":"metal","frameColor":"#2b2b2e","face":"bars","diameter":350} / 黒い文字盤 {"faceColor":"#2b2b2e","frame":"none","face":"minimal"} / 四角い木の時計 {"shape":"square","frame":"wood","face":"bars"}

### rug — ラグ（雑貨 / placement: floor）
床に敷くラグ。家具の下に敷いてよい（重なってもOK）
- 上には何も載せられない
- shape: "rect"(四角) | "round"(丸) (既定 "rect") — 形
- width: number 600〜3000mm (既定 1400、600〜4500 まで指定可) — 幅
- depth: number 600〜3000mm (既定 2000、600〜4500 まで指定可) — 奥行き
- pattern: "plain"(無地) | "border"(ボーダー枠) | "stripe"(ストライプ) | "check"(チェック) | "kilim"(キリム風) (既定 "border") — 柄
- pile: "flat"(薄手) | "shaggy"(シャギー) (既定 "flat") — 毛足
- color: "#rrggbb" (既定 #e7dfd2) — ベース色
- accent: "#rrggbb" (既定 #b9a58c) — 柄の色

### curtain — カーテン（雑貨 / placement: wall / 既定の高さ y=15）
窓にかけるカーテンとレール。背面を窓のある壁につけ、position yはカーテンの下端（掃き出し窓なら10〜20、腰窓なら窓の下端-150くらい）
- width: number 800〜3600mm (既定 1900、800〜5400 まで指定可) — 幅（レール）
- height: number 800〜2600mm (既定 2100、800〜3900 まで指定可) — 丈
- open: number 0〜100% (既定 70) — 開き具合
- lace: boolean (既定 true) — レースカーテン
- color: "#rrggbb" (既定 #9fb5a5) — ドレープの色
- プリセット例: 閉じた状態 {"open":0} / 腰窓用 {"width":1800,"height":1350}

### plant — 観葉植物（雑貨 / placement: floor）
鉢植えの観葉植物。種類と高さを変えられる
- 上には何も載せられない
- kind: "monstera"(モンステラ) | "umbellata"(ウンベラータ) | "sansevieria"(サンスベリア) | "olive"(オリーブ) (既定 "monstera") — 種類
- height: number 300〜1900mm (既定 900、300〜2850 まで指定可) — 高さ
- potColor: "#rrggbb" (既定 #e9e4dc) — 鉢の色
- potStyle: "round"(丸) | "cylinder"(円筒) | "basket"(バスケット) (既定 "round") — 鉢
- プリセット例: 小さめ {"height":450,"kind":"sansevieria","potColor":"#c87f5c"} / 大きめ {"height":1700,"kind":"umbellata","potStyle":"basket"}

### mirror — 姿見（雑貨 / placement: floor）
全身が映る鏡。壁に立てかける、左右の支柱で支えて角度を変えるスタンド式、後ろ脚で立てるイーゼル式
- 上には何も載せられない
- width: number 300〜900mm (既定 450、300〜1350 まで指定可) — 幅
- height: number 1000〜1900mm (既定 1500、1000〜2850 まで指定可) — 高さ
- style: "lean"(壁に立てかけ) | "stand"(スタンド（支柱ではさむ）) | "easel"(イーゼル（後ろ脚）) (既定 "lean") — 置き方
- tilt: number 0〜15° (既定 6) — 傾き
- frame: "thin"(細い) | "wide"(太い) | "none"(なし) (既定 "thin") — フレーム
- frameColor: "#rrggbb" (既定 #b8875a) — フレームの色
- プリセット例: スタンドミラー {"style":"stand","tilt":5} / イーゼル {"style":"easel","frame":"wide","frameColor":"#f1ece4"} / 黒い細枠 {"frameColor":"#2b2b2b","width":400,"height":1600}

### trashCan — ゴミ箱（雑貨 / placement: floor）
ゴミ箱。丸・角・分別スリム。フタなし・スイング・ペダル・跳ね上げ。フタなしなら中が空洞でゴミ袋のふちが見える
- 上には何も載せられない
- shape: "round"(丸) | "square"(角) | "slim"(分別スリム（2 つ）) (既定 "round") — 形
- height: number 250〜700mm (既定 380、250〜1050 まで指定可) — 高さ
- lid: "none"(なし) | "swing"(スイング) | "pedal"(ペダル式) | "flip"(跳ね上げ（開いた状態）) (既定 "none") — フタ
- bag: boolean (既定 true) — ゴミ袋
- color: "#rrggbb" (既定 #f2efe9) — 色
- プリセット例: ペダル式 {"lid":"pedal","height":450,"color":"#c9ccd0"} / 分別スリム {"shape":"slim","height":600,"lid":"swing","color":"#2f2f31"} / 木目の角型 {"shape":"square","color":"#b8875a"}

### pendantLight — ペンダントライト（照明 / placement: ceiling）
天井から吊るす照明。position yは無視され天井から吊るされる。x,zで位置を決める
- style: "dome"(ドーム) | "globe"(ガラス球) | "cone"(コーン) | "paper"(提灯（和紙）) (既定 "dome") — シェード
- diameter: number 200〜600mm (既定 350、200〜900 まで指定可) — 直径
- drop: number 300〜1400mm (既定 800、300〜2100 まで指定可) — 吊り下げの長さ
- color: "#rrggbb" (既定 #f2efe9) — シェードの色

### ceilingLight — シーリングライト（照明 / placement: ceiling）
天井に直付けする丸い照明。日本の賃貸の定番
- diameter: number 400〜900mm (既定 600、400〜1350 まで指定可) — 直径
- frame: "none"(なし) | "wood"(木枠) (既定 "none") — 縁
- frameColor: "#rrggbb" (既定 #b8875a) — 縁の色

### floorLamp — フロアランプ（照明 / placement: floor）
床置きの照明。スタンド・アーチ・三脚
- 上には何も載せられない
- style: "stick"(スタンド) | "arc"(アーチ) | "tripod"(三脚) (既定 "stick") — 形
- height: number 1000〜2000mm (既定 1500、1000〜3000 まで指定可) — 高さ
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
        "finish": "wood",
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
        200,
        720,
        2950
      ],
      "rotation": 90,
      "params": {
        "inches": 24,
        "aspect": "wide",
        "orientation": "landscape",
        "stand": "stand",
        "screen": "wallpaper",
        "color": "#1d1d20"
      }
    },
    {
      "id": "keyboard",
      "type": "keyboardMouse",
      "position": [
        420,
        720,
        2900
      ],
      "rotation": 90,
      "params": {
        "layout": "tenkeyless",
        "mouse": true,
        "pad": "none",
        "color": "#2b2b2e",
        "padColor": "#3d4a5c"
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
        "lid": "none",
        "bag": true,
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
