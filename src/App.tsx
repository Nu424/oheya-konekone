import { useState } from 'react'
import { useUi } from './store/useStore'
import { Viewport } from './three/Viewport'
import { DropZone, Hud, Toast, TopBar, useShortcuts } from './ui/Chrome'
import { JsonDialog, TemplateDialog } from './ui/dialogs'
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
  const hasSelection = useUi((s) => s.selection !== null)

  return (
    <div className="app">
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
      <TopBar onNew={() => setNewOpen(true)} />
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
      <Hud />
      <div className={`hint glass${hasSelection ? ' hidden' : ''}`}>
        <kbd>ドラッグ</kbd> 回転 ・ <kbd>右ドラッグ</kbd> 移動 ・ <kbd>ホイール</kbd> ズーム
        <br />
        <kbd>1</kbd>/<kbd>2</kbd> 視点 ・ <kbd>J</kbd> JSON ・ <kbd>Ctrl+Z</kbd> 元に戻す
      </div>
      <Toast />
      <DropZone />
      {jsonOpen && <JsonDialog />}
      {newOpen && <TemplateDialog onClose={() => setNewOpen(false)} />}
    </div>
  )
}
