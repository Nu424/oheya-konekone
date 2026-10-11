/**
 * The operations shown in the help dialog ("操作方法とショートカット"). Keep this list in step with
 * `useShortcuts` (Chrome.tsx), the drag handling (EditLayer.tsx / Viewport.tsx) and the pose fields.
 * `keys` are alternatives; inside one alternative "+" joins keys held together.
 */
export interface HelpRow {
  keys: string[]
  text: string
}

export interface HelpGroup {
  title: string
  rows: HelpRow[]
  note?: string
}

export const HELP: HelpGroup[] = [
  {
    title: '見る',
    rows: [
      { keys: ['ドラッグ'], text: '視点をぐるっと回す' },
      { keys: ['右ドラッグ'], text: '視点を平行移動する' },
      { keys: ['ホイール'], text: '近づく・離れる' },
      { keys: ['1', '2', '3'], text: '3D ／ 真上（平面図）／ 部屋の中を歩く' },
      { keys: ['WASD'], text: '「歩く」のときに移動する（床をクリックするとそこへ）' },
      { keys: ['F'], text: '動線チェック（通れる場所を色分け）' },
      { keys: ['O'], text: '重なっている家具の赤枠を出す・消す（選んでいる家具の枠はいつも出る）' },
      { keys: ['P'], text: '撮影モード（パストレーシングで写真みたいに）' },
    ],
  },
  {
    title: '置く・選ぶ',
    rows: [
      { keys: ['カタログをクリック'], text: '空いている場所に置く（モニターやライトは空いている机の上）' },
      { keys: ['カタログからドラッグ'], text: '好きな場所や、机・棚の上に置く' },
      { keys: ['クリック'], text: '家具を選ぶ' },
      { keys: ['Shift+クリック', 'Ctrl+クリック'], text: '選択に足す・外す' },
      { keys: ['Shift+ドラッグ'], text: '囲んでまとめて選ぶ（右へ＝全部入ったもの、左へ＝かかったもの）' },
      { keys: ['Ctrl+A'], text: '全部選ぶ' },
      { keys: ['Esc'], text: '選択をやめる' },
    ],
  },
  {
    title: '動かす・回す',
    rows: [
      { keys: ['家具をドラッグ'], text: '動かす。机や棚の上に持っていくと載って、壁や家具の端に吸い付く' },
      { keys: ['Alt+ドラッグ'], text: '吸い付きなしで動かす' },
      { keys: ['矢印'], text: '10mm ずつ動かす' },
      { keys: ['Shift+矢印'], text: '100mm ずつ動かす' },
      { keys: ['R'], text: '90° 回す' },
      { keys: ['Shift+R'], text: '15° 回す' },
      { keys: ['L'], text: 'ロックする・はずす' },
    ],
    note: '上に載っているものは、下の家具と一緒に動くよ。複数選んでいるときは、まとめて動いて、まとめて回る。',
  },
  {
    title: '数字で決める（右のパネル）',
    rows: [
      { keys: ['数字を入力'], text: 'その値にする。長さはスライダーの端より大きく（1.5倍まで）できる' },
      { keys: ['+50'], text: '位置の欄で、今の位置から 50mm ずらす（-=50 で戻す）' },
      { keys: ['↑', '↓'], text: '入力欄の値を少しずつ変える（Shift で10倍）' },
    ],
    note: '複数選ぶと、値がそろっている欄だけ数字が出るよ。「ばらばら」の欄に入れると、全部その値にそろう。',
  },
  {
    title: '複製・削除・やり直し',
    rows: [
      { keys: ['Ctrl+C', 'Ctrl+X', 'Ctrl+V'], text: 'コピー ／ 切り取り ／ 貼り付け（マウスの下に置く。別のタブにも貼れる）' },
      { keys: ['Ctrl+D'], text: '隣に複製する' },
      { keys: ['Delete'], text: '削除する（上に載っているものは下に降りる）' },
      { keys: ['Shift+Delete'], text: '上に載っているものも一緒に削除する' },
      { keys: ['削除ボタンを右クリック'], text: '消し方を選ぶ' },
      { keys: ['Ctrl+Z'], text: '元に戻す' },
      { keys: ['Ctrl+Shift+Z', 'Ctrl+Y'], text: 'やり直す' },
    ],
  },
  {
    title: 'ファイル',
    rows: [
      { keys: ['J'], text: 'JSON で編集する' },
      { keys: ['Ctrl+S'], text: 'JSON ファイルに保存する' },
      { keys: ['Ctrl+O'], text: 'JSON ファイルを開く（画面にドロップしても開ける）' },
      { keys: ['?'], text: 'この画面を開く・閉じる' },
    ],
  },
]
