import { getAsset } from '../assets/registry'
import type { ParamSpec } from '../assets/params'
import { CATEGORY_LABELS } from '../assets/types'
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
  }
}

export function Inspector() {
  const selection = useUi((s) => s.selection)
  const layout = useDoc((s) => s.layout)
  const item = selection?.kind === 'item' ? layout.items.find((i) => i.id === selection.id) : undefined
  const asset = item ? getAsset(item.type) : undefined
  const thumb = useThumbnail(item?.type ?? '', item?.params)
  if (!item || !asset) return null
  const update = useDoc.getState().updateItem
  const setParam = (k: string, v: unknown) => useDoc.getState().updateItemParams(item.id, { [k]: v })
  const groups = new Map<string, [string, ParamSpec][]>()
  for (const [k, s] of Object.entries(asset.params)) {
    const g = s.group ?? 'その他'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push([k, s])
  }
  const order = ['サイズ', '形', '色・素材', 'その他']
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
                <button key={p.name} className="preset" onClick={() => useDoc.getState().updateItemParams(item.id, p.params as Record<string, unknown>)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {order
          .filter((g) => groups.has(g))
          .map((g) => (
            <div className="section" key={g}>
              <div className="section-title">{g}</div>
              {groups.get(g)!.map(([k, s]) => (
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
                    update(item.id, { position: p })
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
              onChange={(v) => update(item.id, { rotation: Number(v) })}
            />
          </Field>
          <div className="field-hint">R で90°、Shift+R で15°回転。矢印キーで10mm、Shift+矢印で100mm動く。</div>
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
