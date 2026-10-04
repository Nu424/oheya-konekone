import { useState } from 'react'
import { useUi } from './store/useStore'
import { Viewport } from './three/Viewport'
import { DropZone, Hud, Toast, TopBar, useShortcuts } from './ui/Chrome'
import { JsonDialog, TemplateDialog } from './ui/dialogs'
import { RoomPanel } from './ui/RoomPanel'

export default function App() {
  useShortcuts()
  const panel = useUi((s) => s.panel)
  const setPanel = useUi((s) => s.setPanel)
  const jsonOpen = useUi((s) => s.jsonOpen)
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="app">
      <Viewport />
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
          {panel === 'catalog' && <div className="field-hint" style={{ padding: 20 }}>家具カタログはもうすぐ（P1）</div>}
        </div>
      </aside>
      <Hud />
      <div className="hint glass">
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
