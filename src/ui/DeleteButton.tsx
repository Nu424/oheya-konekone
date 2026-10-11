import { useEffect, useRef, useState } from 'react'
import { itemCommands } from '../editor/commands'
import { Icon } from './icons'

/**
 * Delete button shared by the inspector and the floating toolbars (docs/EDITING-EXTRAS.md).
 * A click deletes the items and lets what stood on them drop; Shift+click, the right-click menu
 * or the small arrow (shown when something stands on them) deletes the riders as well.
 */
export function DeleteButton({ ids, label, title = '削除 (Delete)' }: { ids: string | readonly string[]; label?: string; title?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const riders = itemCommands.riderCount(ids)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const remove = (withRiders: boolean) => {
    setOpen(false)
    itemCommands.remove(ids, { withRiders })
  }

  return (
    <span className={`del-wrap${label ? ' labelled' : ''}`} ref={ref}>
      <button
        className={label ? 'icon-btn danger' : 'danger'}
        title={`${title}／右クリックで消し方を選べるよ`}
        onClick={(e) => remove(e.shiftKey)}
        onContextMenu={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        <Icon.trash /> {label}
      </button>
      {riders > 0 && (
        <button className={`del-more${label ? ' icon-btn danger' : ' danger'}`} title="消し方を選ぶ" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon.chevron />
        </button>
      )}
      {open && (
        <div className="del-menu glass" role="menu">
          <button role="menuitem" onClick={() => remove(false)}>
            <span>
              これだけ削除
              <small>{riders > 0 ? `上の${riders}点は下に降ろすよ` : '上には何も載ってないよ'}</small>
            </span>
            <kbd>Delete</kbd>
          </button>
          <button role="menuitem" disabled={riders === 0} onClick={() => remove(true)}>
            <span>
              上のものも一緒に削除
              <small>{riders > 0 ? `上に載ってる${riders}点もまとめて消すよ` : '上には何も載ってないよ'}</small>
            </span>
            <kbd>Shift+Delete</kbd>
          </button>
        </div>
      )}
    </span>
  )
}
