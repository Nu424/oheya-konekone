import { useState } from 'react'
import { useUi } from './store/useStore'
import { Viewport } from './three/Viewport'
import { DropZone, FlowPanel, Hud, PhotoBar, Toast, TopBar, useShortcuts } from './ui/Chrome'
import { AiDialog, JsonDialog, TemplateDialog } from './ui/dialogs'
import { RoomPanel } from './ui/RoomPanel'
import { Catalog, DRAG_MIME } from './ui/Catalog'
import { Inspector } from './ui/Inspector'
import { addItemOfType, screenToFloor } from './editor/commands'

export default function App() {
  useShortcuts()
  const panel = useUi((s) => s.panel)
  const setPanel = useUi((s) => s.setPanel)
  const jsonOpen = useUi((s) => s.jsonOpen)
  const [newOpen, setNewOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const hasSelection = useUi((s) => s.selection !== null)
  const view = useUi((s) => s.view)
  const photo = useUi((s) => s.photo)

  return (
    <div className={`app${photo ? ' photo' : ''}`}>
      <div
        className="viewport-wrap"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={(e) => {
          const type = e.dataTransfer.getData(DRAG_MIME)
          if (!type) return
          e.preventDefault()
          e.stopPropagation()
          const at = screenToFloor?.(e.clientX, e.clientY) ?? undefined
          addItemOfType(type, undefined, at)
        }}
      >
        <Viewport />
      </div>
      <TopBar onNew={() => setNewOpen(true)} onAi={() => setAiOpen(true)} />
      <aside className={`side glass${panel ? '' : ' hidden'}`}>
        <div className="side-tabs">
          <button className={`side-tab${panel === 'room' ? ' active' : ''}`} onClick={() => setPanel('room')}>
            おへや
          </button>
          <button className={`side-tab${panel === 'catalog' ? ' active' : ''}`} onClick={() => setPanel('catalog')}>
            家具
          </button>
        </div>
        <div className="side-body">
          {panel === 'room' && <RoomPanel />}
          {panel === 'catalog' && <Catalog />}
        </div>
      </aside>
      <Inspector />
      <FlowPanel />
      <Hud />
      <div className={`hint glass${hasSelection ? ' hidden' : ''}`}>
        {view === 'walk' ? (
          <>
            <kbd>ドラッグ</kbd> 見回す ・ <kbd>WASD</kbd> 歩く ・ <kbd>床をクリック</kbd> そこへ移動
            <br />
            <kbd>Esc</kbd> 3Dビューにもどる
          </>
        ) : (
          <>
            <kbd>ドラッグ</kbd> 回転 ・ <kbd>右ドラッグ</kbd> 移動 ・ <kbd>ホイール</kbd> ズーム
            <br />
            <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> 視点 ・ <kbd>F</kbd> 動線 ・ <kbd>J</kbd> JSON
          </>
        )}
      </div>
      <PhotoBar />
      <Toast />
      <DropZone />
      {jsonOpen && <JsonDialog />}
      {newOpen && <TemplateDialog onClose={() => setNewOpen(false)} />}
      {aiOpen && <AiDialog onClose={() => setAiOpen(false)} />}
    </div>
  )
}
