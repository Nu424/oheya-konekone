import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { downloadText, parseLayoutText, serializeLayout } from '../model/io'
import { redo, undo, useDoc, useUi } from '../store/useStore'
import { Segmented } from './controls'
import { Icon } from './icons'

function Logo() {
  return (
    <svg className="brand-logo" viewBox="0 0 64 64" aria-hidden>
      <rect x="6" y="16" width="52" height="42" rx="10" fill="#e8835c" />
      <path d="M4 28 32 6l28 22" fill="none" stroke="#e8835c" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="25" y="34" width="14" height="24" rx="3" fill="#fff4ea" />
      <circle cx="20" cy="30" r="2.6" fill="#fff4ea" />
      <circle cx="44" cy="30" r="2.6" fill="#fff4ea" />
    </svg>
  )
}

export function openLayoutFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = async () => {
    const f = input.files?.[0]
    if (f) loadLayoutText(await f.text(), f.name)
  }
  input.click()
}

export function loadLayoutText(text: string, source = 'JSON') {
  const r = parseLayoutText(text)
  const ui = useUi.getState()
  if (r.ok) {
    useDoc.getState().setLayout(r.layout)
    ui.notify(`${source} を読み込んだよ`)
  } else {
    ui.notify(`読み込めなかった: ${r.errors[0].path} ${r.errors[0].message}`, 'error')
  }
}

export function TopBar({ onNew }: { onNew: () => void }) {
  const name = useDoc((s) => s.layout.meta.name)
  const setMeta = useDoc((s) => s.setMeta)
  const canUndo = useStore(useDoc.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useDoc.temporal, (s) => s.futureStates.length > 0)
  const setJsonOpen = useUi((s) => s.setJsonOpen)
  const notify = useUi((s) => s.notify)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const exportJson = () => {
    const l = useDoc.getState().layout
    downloadText(`${l.meta.name || 'oheya'}.json`, serializeLayout(l))
  }

  return (
    <header className="topbar">
      <div className="brand glass">
        <Logo />
        <div className="brand-name">
          おへやこねこね
          <small>OHEYA KONEKONE</small>
        </div>
      </div>
      <div className="toolbar glass">
        <input className="title-input" value={name} onChange={(e) => setMeta({ name: e.target.value })} aria-label="おへやの名前" />
        <span className="sep" />
        <button className="icon-btn" disabled={!canUndo} onClick={undo} title="元に戻す (Ctrl+Z)">
          <Icon.undo />
        </button>
        <button className="icon-btn" disabled={!canRedo} onClick={redo} title="やり直す (Ctrl+Shift+Z)">
          <Icon.redo />
        </button>
      </div>
      <span className="spacer" />
      <div className="toolbar glass">
        <button className="icon-btn" onClick={() => setJsonOpen(true)} title="JSONで編集 (J)">
          <Icon.code /> <span className="label">JSON</span>
        </button>
        <div className="rel" ref={menuRef}>
          <button className="icon-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} title="メニュー">
            <Icon.menu />
          </button>
          {menu && (
            <div className="menu glass" onClick={() => setMenu(false)}>
              <button onClick={onNew}>
                <Icon.home /> テンプレートから新規
              </button>
              <hr />
              <button onClick={openLayoutFile}>
                <Icon.upload /> JSONファイルを開く <kbd>Ctrl+O</kbd>
              </button>
              <button onClick={exportJson}>
                <Icon.download /> JSONファイルに保存 <kbd>Ctrl+S</kbd>
              </button>
              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(serializeLayout(useDoc.getState().layout))
                    .then(() => notify('JSONをコピーしたよ'))
                }
              >
                <Icon.copy /> JSONをコピー
              </button>
              <button
                onClick={async () => {
                  try {
                    loadLayoutText(await navigator.clipboard.readText(), 'クリップボード')
                  } catch {
                    notify('クリップボードを読めなかった…', 'error')
                  }
                }}
              >
                <Icon.paste /> クリップボードから読み込み
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export function Hud() {
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  return (
    <div className="hud glass">
      <Segmented
        value={view === 'walk' ? 'orbit' : view}
        onChange={setView}
        options={[
          { value: 'orbit', label: <><Icon.cube /> 3D</>, title: '3Dビュー (1)' },
          { value: 'top', label: <><Icon.top /> 真上</>, title: '真上から (2)' },
        ]}
      />
    </div>
  )
}

export function Toast() {
  const toast = useUi((s) => s.toast)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), toast.tone === 'error' ? 4500 : 2200)
    return () => clearTimeout(id)
  }, [toast])
  if (!toast || !visible) return null
  return (
    <div key={toast.id} className={`toast${toast.tone === 'error' ? ' error' : ''}`} role="status">
      {toast.text}
    </div>
  )
}

export function DropZone() {
  const [over, setOver] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFile = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFile(e)) return
      depth++
      setOver(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setOver(false)
    }
    const overH = (e: DragEvent) => hasFile(e) && e.preventDefault()
    const drop = async (e: DragEvent) => {
      if (!hasFile(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      const f = e.dataTransfer?.files[0]
      if (f) loadLayoutText(await f.text(), f.name)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overH)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overH)
      window.removeEventListener('drop', drop)
    }
  }, [])
  return over ? <div className="drop-overlay">JSONをここにドロップして読み込み</div> : null
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      const mod = e.metaKey || e.ctrlKey
      const ui = useUi.getState()
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        const l = useDoc.getState().layout
        downloadText(`${l.meta.name || 'oheya'}.json`, serializeLayout(l))
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        openLayoutFile()
      } else if (!typing && !mod && !ui.jsonOpen) {
        if (e.key === '1') ui.setView('orbit')
        if (e.key === '2') ui.setView('top')
        if (e.key.toLowerCase() === 'j') ui.setJsonOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
