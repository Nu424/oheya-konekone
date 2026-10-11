import { getAsset } from '../assets/registry'
import type { ParamSpec } from '../assets/params'
import { CATEGORY_LABELS, type AssetDef } from '../assets/types'
import type { AlignMode } from '../editor/commands'
import type { Item } from '../model/schema'
import { collisions } from '../editor/placement'
import { itemCommands } from '../three/EditLayer'
import { useThumbnail } from '../three/thumbnails'
import { useDoc, useUi } from '../store/useStore'
import { ColorSwatches, Field, NumberSlider, Segmented } from './controls'
import { Icon } from './icons'

function ParamControl({ k, spec, value, onChange }: { k: string; spec: ParamSpec; value: unknown; onChange: (v: unknown) => void }) {
  switch (spec.kind) {
    case 'number':
      return (
        <NumberSlider
          label={spec.label}
          value={Number(value)}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          unit={spec.unit ?? ''}
          hint={spec.hint}
          onChange={onChange}
        />
      )
    case 'color':
      return (
        <div className="field">
          <div className="field-row">
            <span className="field-label">{spec.label}</span>
          </div>
          <ColorSwatches value={String(value)} swatches={spec.swatches ?? []} onChange={onChange} />
        </div>
      )
    case 'select': {
      const opts = Object.entries(spec.options)
      if (opts.length <= 4 && opts.every(([, l]) => l.length <= 6))
        return (
          <Field label={spec.label} hint={spec.hint}>
            <Segmented value={String(value)} options={opts.map(([v, l]) => ({ value: v, label: l }))} onChange={onChange} />
          </Field>
        )
      return (
        <Field label={spec.label} hint={spec.hint}>
          <select className="select" value={String(value)} onChange={(e) => onChange(e.target.value)}>
            {opts.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      )
    }
    case 'bool':
      return (
        <Field label={spec.label} hint={spec.hint}>
          <button className={`toggle${value ? ' on' : ''}`} role="switch" aria-checked={!!value} aria-label={k} onClick={() => onChange(!value)}>
            <span />
          </button>
        </Field>
      )
    case 'text':
      return (
        <Field label={spec.label} hint={spec.hint}>
          <input className="insp-text" value={String(value ?? '')} maxLength={spec.maxLength} onChange={(e) => onChange(e.target.value)} />
        </Field>
      )
  }
}

/** Parameters grouped under their headings, in the order the panel shows them. */
function paramGroups(asset: AssetDef) {
  const groups = new Map<string, [string, ParamSpec][]>()
  for (const [k, s] of Object.entries(asset.params)) {
    const g = s.group ?? 'その他'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push([k, s])
  }
  const preferred = ['サイズ', '形', '色・素材', '表示']
  return [...preferred, ...[...groups.keys()].filter((g) => !preferred.includes(g))].filter((g) => groups.has(g)).map((g) => [g, groups.get(g)!] as const)
}

const ALIGN: { mode: AlignMode; label: string; title: string }[] = [
  { mode: 'left', label: '左', title: '左端をそろえる' },
  { mode: 'centerX', label: '左右中央', title: '左右の中央をそろえる' },
  { mode: 'right', label: '右', title: '右端をそろえる' },
  { mode: 'back', label: '奥', title: '奥の端をそろえる' },
  { mode: 'centerZ', label: '前後中央', title: '前後の中央をそろえる' },
  { mode: 'front', label: '手前', title: '手前の端をそろえる' },
]

/** Panel for several selected items: the list, arranging, and shared parameters when they are all one type. */
function MultiInspector({ items }: { items: Item[] }) {
  const ids = items.map((i) => i.id)
  const primary = items[items.length - 1]
  const asset = getAsset(primary.type)
  const sameType = items.every((i) => i.type === primary.type)
  const colliding = collisions(useDoc.getState().layout)
  const hit = items.filter((i) => colliding.has(i.id)).length
  const allLocked = items.every((i) => i.locked)
  const ui = useUi.getState()
  return (
    <aside className="inspector glass">
      <div className="insp-head">
        <span className="insp-thumb multi">{items.length}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="insp-name">{items.length} 点を選択中</div>
          <div className="insp-sub">{sameType && asset ? `すべて ${asset.label}` : 'いろんな種類が混ざってるよ'}</div>
        </div>
        <button className="icon-btn" onClick={() => ui.select(null)} aria-label="選択を解除">
          <Icon.x />
        </button>
      </div>
      {hit > 0 && (
        <div className="insp-warn">
          <Icon.alert width={16} /> {hit} 点がほかの家具や柱と重なってるよ
        </div>
      )}
      <div className="insp-body">
        <div className="section">
          <div className="section-title">選択中のアイテム</div>
          <ul className="sel-list">
            {items.map((it) => (
              <li key={it.id} className={it === primary ? 'primary' : ''}>
                <button className="sel-name" title="この家具を基準にする" onClick={() => ui.select(it.id, 'add')}>
                  {it.name ?? getAsset(it.type)?.label ?? it.type}
                  {it.locked && <small>ロック中</small>}
                </button>
                <button className="sel-remove" title="選択から外す" onClick={() => ui.select(it.id, 'toggle')}>
                  <Icon.x />
                </button>
              </li>
            ))}
          </ul>
          <div className="field-hint">Shift+クリックで足したり外したり、Shift+ドラッグで囲んで選べるよ。机と、その上のモニターを両方選んでも、モニターは机と一緒に1回だけ動く。</div>
        </div>
        <div className="section">
          <div className="section-title">そろえる・並べる</div>
          <div className="align-grid">
            {ALIGN.map((a) => (
              <button key={a.mode} className="preset" title={a.title} onClick={() => itemCommands.align(ids, a.mode)}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="align-grid two">
            <button className="preset" disabled={items.length < 3} title="両端はそのままで、すき間をそろえるよ（3点以上）" onClick={() => itemCommands.distribute(ids, 'x')}>
              左右に等間隔
            </button>
            <button className="preset" disabled={items.length < 3} title="両端はそのままで、すき間をそろえるよ（3点以上）" onClick={() => itemCommands.distribute(ids, 'z')}>
              前後に等間隔
            </button>
          </div>
        </div>
        {sameType && asset ? (
          <>
            {asset.presets && asset.presets.length > 0 && (
              <div className="section">
                <div className="section-title">プリセット（すべてに適用）</div>
                <div className="preset-row">
                  {asset.presets.map((p) => (
                    <button key={p.name} className="preset" onClick={() => itemCommands.setParams(ids, p.params as Record<string, unknown>)}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {paramGroups(asset).map(([g, list]) => (
              <div className="section" key={g}>
                <div className="section-title">{g}</div>
                {list.map(([k, spec]) => {
                  const value = primary.params[k] ?? spec.default
                  const mixed = items.some((i) => (i.params[k] ?? spec.default) !== value)
                  return (
                    <div key={k} className={mixed ? 'param-mixed' : ''}>
                      {mixed && <span className="mixed-tag">ばらばら（変えると全部そろうよ）</span>}
                      <ParamControl k={k} spec={spec} value={value} onChange={(v) => itemCommands.setParams(ids, { [k]: v })} />
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        ) : (
          <div className="field-hint">同じ種類だけを選ぶと、パラメータをまとめて変えられるよ。</div>
        )}
        <div className="insp-actions">
          <button className="icon-btn" onClick={() => itemCommands.duplicate(ids)}>
            <Icon.copy /> 複製
          </button>
          <button className={`icon-btn${allLocked ? ' primary' : ''}`} onClick={() => itemCommands.toggleLock(ids)}>
            <Icon.lock /> {allLocked ? 'ロック中' : 'ロック'}
          </button>
          <span className="spacer" />
          <button className="icon-btn danger" onClick={() => itemCommands.remove(ids)}>
            <Icon.trash /> 削除
          </button>
        </div>
      </div>
    </aside>
  )
}

export function Inspector() {
  const selection = useUi((s) => s.selection)
  const layout = useDoc((s) => s.layout)
  const picked = selection.map((id) => layout.items.find((i) => i.id === id)).filter((i): i is Item => !!i)
  const item = picked.length === 1 ? picked[0] : undefined
  const asset = item ? getAsset(item.type) : undefined
  const thumb = useThumbnail(item?.type ?? '', item?.params)
  if (picked.length > 1) return <MultiInspector items={picked} />
  if (!item || !asset) return null
  const update = useDoc.getState().updateItem
  const setParam = (k: string, v: unknown) => itemCommands.setParams(item.id, { [k]: v })
  const colliding = collisions(layout).has(item.id)

  return (
    <aside className="inspector glass" key={item.id}>
      <div className="insp-head">
        <span className="insp-thumb">{thumb && <img src={thumb} alt="" />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input className="insp-name" value={item.name ?? ''} placeholder={asset.label} onChange={(e) => update(item.id, { name: e.target.value || undefined })} />
          <div className="insp-sub">
            {CATEGORY_LABELS[asset.category]} ・ <code>{item.type}</code>
          </div>
        </div>
        <button className="icon-btn" onClick={() => useUi.getState().select(null)} aria-label="閉じる">
          <Icon.x />
        </button>
      </div>
      {colliding && (
        <div className="insp-warn">
          <Icon.alert width={16} /> ほかの家具や柱と重なってるよ
        </div>
      )}
      <div className="insp-body">
        {asset.presets && asset.presets.length > 0 && (
          <div className="section">
            <div className="section-title">プリセット</div>
            <div className="preset-row">
              {asset.presets.map((p) => (
                <button key={p.name} className="preset" onClick={() => itemCommands.setParams(item.id, p.params as Record<string, unknown>)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {paramGroups(asset).map(([g, list]) => (
          <div className="section" key={g}>
            <div className="section-title">{g}</div>
            {list.map(([k, s]) => (
              <ParamControl key={k} k={k} spec={s} value={item.params[k] ?? s.default} onChange={(v) => setParam(k, v)} />
            ))}
          </div>
        ))}
        <div className="section">
          <div className="section-title">位置・向き</div>
          <div className="xyz">
            {(['x', 'y', 'z'] as const).map((axis, i) => (
              <label key={axis}>
                <span>{axis.toUpperCase()}</span>
                <input
                  type="number"
                  step={10}
                  value={item.position[i]}
                  onChange={(e) => {
                    const p = [...item.position] as [number, number, number]
                    p[i] = Number(e.target.value) || 0
                    itemCommands.move(item.id, { position: p })
                  }}
                />
              </label>
            ))}
          </div>
          <Field label="向き">
            <Segmented
              value={String(((Math.round(item.rotation) % 360) + 360) % 360)}
              options={[
                { value: '0', label: '南', title: '正面が南(手前)' },
                { value: '90', label: '東' },
                { value: '180', label: '北' },
                { value: '270', label: '西' },
              ]}
              onChange={(v) => itemCommands.move(item.id, { rotation: Number(v) })}
            />
          </Field>
          <div className="field-hint">Y は床からの高さ（家具の上にドラッグすると勝手に合うよ）。R で90°、Shift+R で15°回転。矢印キーで10mm、Shift+矢印で100mm動く。上に載っているものも一緒に動くよ。</div>
        </div>
        <div className="insp-actions">
          <button className="icon-btn" onClick={() => itemCommands.duplicate(item.id)}>
            <Icon.copy /> 複製
          </button>
          <button className={`icon-btn${item.locked ? ' primary' : ''}`} onClick={() => itemCommands.toggleLock(item.id)}>
            <Icon.lock /> {item.locked ? 'ロック中' : 'ロック'}
          </button>
          <span className="spacer" />
          <button className="icon-btn danger" onClick={() => itemCommands.remove(item.id)}>
            <Icon.trash /> 削除
          </button>
        </div>
      </div>
    </aside>
  )
}
