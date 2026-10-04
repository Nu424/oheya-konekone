import { useMemo, useState } from 'react'
import { assetList } from '../assets/registry'
import { CATEGORY_LABELS, type Category } from '../assets/types'
import { addItemOfType } from '../editor/commands'
import { useThumbnail } from '../three/thumbnails'
import { Icon } from './icons'

export const DRAG_MIME = 'application/x-oheya-item'

function Card({ type, label, description }: { type: string; label: string; description: string }) {
  const url = useThumbnail(type)
  return (
    <button
      className="cat-card"
      title={description}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, type)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => addItemOfType(type)}
    >
      <span className="cat-thumb">{url ? <img src={url} alt="" draggable={false} /> : <span className="cat-skel" />}</span>
      <span className="cat-label">{label}</span>
      <span className="cat-add">
        <Icon.plus />
      </span>
    </button>
  )
}

export function Catalog() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const cats = useMemo(() => [...new Set(assetList.map((a) => a.category))], [])
  const list = assetList.filter(
    (a) => (cat === 'all' || a.category === cat) && (!q || a.label.includes(q) || a.type.toLowerCase().includes(q.toLowerCase()) || a.description.includes(q)),
  )
  return (
    <div className="catalog">
      <label className="search">
        <Icon.search />
        <input placeholder="家具をさがす（例: ベッド）" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="cat-chips">
        <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
          すべて
        </button>
        {cats.map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="cat-grid">
        {list.map((a) => (
          <Card key={a.type} type={a.type} label={a.label} description={a.description} />
        ))}
        {list.length === 0 && <div className="field-hint">見つからなかった…別のことばで探してみて</div>}
      </div>
      <div className="field-hint" style={{ marginTop: 10 }}>
        クリックで空いている場所に置くよ。部屋にドラッグして好きな場所にも置ける。
      </div>
    </div>
  )
}
