import { useState, type CSSProperties } from 'react'
import { SWATCHES } from '../three/materials'
import { FLOOR_PRESETS } from '../three/textures'
import { overlappingOpenings, roomArea, tatami, wallLength } from '../model/geometry'
import type { FloorMaterial, Opening, WallSide } from '../model/schema'
import { useDoc, useUi } from '../store/useStore'
import { ColorSwatches, Field, NumberSlider, Segmented } from './controls'
import { Icon } from './icons'

const WALL_LABEL: Record<WallSide, string> = { north: '北', south: '南', west: '西', east: '東' }
const OPENING_LABEL: Record<Opening['type'], string> = { door: 'ドア', window: '窓', closet: 'クローゼット' }
const OPENING_ICON = { door: Icon.door, window: Icon.window, closet: Icon.closet }

/** CSS-only preview of a floor material (cheaper than rendering the real texture). */
function floorPreview(m: FloorMaterial, color: string): CSSProperties {
  switch (m) {
    case 'tile':
      return {
        background: `linear-gradient(90deg, rgba(0,0,0,.12) 2px, transparent 2px) 0 0/14px 14px, linear-gradient(rgba(0,0,0,.12) 2px, transparent 2px) 0 0/14px 14px, ${color}`,
      }
    case 'carpet':
      return { background: `radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px) 0 0/4px 4px, ${color}` }
    case 'concrete':
      return { background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,.2), transparent 50%), radial-gradient(circle at 70% 80%, rgba(0,0,0,.1), transparent 50%), ${color}` }
    case 'tatami':
      return {
        background: `linear-gradient(90deg, #2c3540 3px, transparent 3px, transparent 19px, #2c3540 19px, #2c3540 25px, transparent 25px) 0 0/44px 44px, repeating-linear-gradient(rgba(0,0,0,.07) 0 1px, transparent 1px 3px), ${color}`,
      }
    default:
      return {
        background: `linear-gradient(90deg, rgba(60,35,20,.25) 1px, transparent 1px) 0 0/11px 100%, linear-gradient(rgba(60,35,20,.2) 1px, transparent 1px) 0 0/100% 30px, linear-gradient(115deg, rgba(255,255,255,.12), rgba(0,0,0,.08)), ${color}`,
      }
  }
}

function fmtM(mm: number) {
  return `${(mm / 1000).toFixed(2)} m`
}

export function RoomPanel() {
  const room = useDoc((s) => s.layout.room)
  const updateRoom = useDoc((s) => s.updateRoom)
  const addOpening = useDoc((s) => s.addOpening)
  const [open, setOpen] = useState<string | null>(null)
  const notify = useUi((s) => s.notify)
  const overlaps = new Set(overlappingOpenings(room).flat())

  return (
    <>
      <div className="section">
        <div className="area-badge">
          <b>{tatami(room).toFixed(1)}</b>
          <span>畳</span>
          <span className="sub">{roomArea(room).toFixed(2)} m²</span>
        </div>
        <NumberSlider label="幅（東西）" value={room.width} min={1800} max={8000} step={50} format={fmtM} onChange={(width) => updateRoom({ width })} />
        <NumberSlider label="奥行き（南北）" value={room.depth} min={1800} max={8000} step={50} format={fmtM} onChange={(depth) => updateRoom({ depth })} />
        <NumberSlider label="天井高" value={room.height} min={2100} max={3200} step={10} format={fmtM} hint="一般的なマンションは2400mm前後" onChange={(height) => updateRoom({ height })} />
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">
            <Icon.floor /> 床
          </span>
        </div>
        <div className="chips">
          {(Object.keys(FLOOR_PRESETS) as FloorMaterial[]).map((m) => (
            <button
              key={m}
              className={`chip${room.floor.material === m ? ' on' : ''}`}
              onClick={() => updateRoom({ floor: { material: m } })}
            >
              <span className="chip-img" style={floorPreview(m, FLOOR_PRESETS[m].color)} />
              {FLOOR_PRESETS[m].label}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">
            <Icon.palette /> 壁・天井
          </span>
        </div>
        <Field label="壁紙">{null}</Field>
        <ColorSwatches value={room.wall.color} swatches={SWATCHES.paint} onChange={(color) => updateRoom({ wall: { color } })} />
        <Field label="巾木">{null}</Field>
        <ColorSwatches
          value={room.baseboard.color}
          swatches={['#ffffff', '#e9e3d9', '#cdbfae', '#8f5f3d', '#4a3326', '#2f2f31']}
          onChange={(color) => updateRoom({ baseboard: { ...room.baseboard, color } })}
        />
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">
            <Icon.door /> ドア・窓・収納
          </span>
        </div>
        <div className="add-row">
          {(['door', 'window', 'closet'] as const).map((t) => {
            const I = OPENING_ICON[t]
            return (
              <button
                key={t}
                className="add-btn"
                onClick={() => {
                  const id = addOpening(t)
                  setOpen(id)
                  notify(`${OPENING_LABEL[t]}を追加したよ`)
                }}
              >
                <I />
                {OPENING_LABEL[t]}
              </button>
            )
          })}
        </div>
        {room.openings.map((o) => (
          <OpeningCard
            key={o.id}
            o={o}
            open={open === o.id}
            warn={overlaps.has(o.id)}
            onToggle={() => setOpen(open === o.id ? null : o.id)}
          />
        ))}
      </div>
    </>
  )
}

function OpeningCard({ o, open, warn, onToggle }: { o: Opening; open: boolean; warn: boolean; onToggle: () => void }) {
  const room = useDoc((s) => s.layout.room)
  const update = useDoc((s) => s.updateOpening)
  const remove = useDoc((s) => s.removeOpening)
  const I = OPENING_ICON[o.type]
  const len = wallLength(room, o.wall)
  const set = (patch: Partial<Opening>) => update(o.id, patch)
  const summary =
    o.type === 'window'
      ? `${WALL_LABEL[o.wall]}の壁 ・ ${o.width}×${o.height} ・ ${o.sill === 0 ? '掃き出し' : `床から${o.sill}`}`
      : `${WALL_LABEL[o.wall]}の壁 ・ 幅${o.width}`

  return (
    <div className={`card${open ? ' open' : ''}${warn ? ' warn' : ''}`}>
      <div className="card-head" onClick={onToggle}>
        <span className="ic">
          <I />
        </span>
        <span className="t">
          {OPENING_LABEL[o.type]}
          {warn && <span style={{ color: 'var(--warn)', fontSize: 11, marginLeft: 6 }}>重なってるよ</span>}
          <small>{summary}</small>
        </span>
        <button
          className="icon-btn danger"
          title="削除"
          onClick={(e) => {
            e.stopPropagation()
            remove(o.id)
          }}
        >
          <Icon.trash />
        </button>
        <Icon.chevron className="chev" />
      </div>
      {open && (
        <div className="card-body">
          <Field label="どの壁？">
            <div className="compass">
              <span />
              <button className={o.wall === 'north' ? 'on' : ''} onClick={() => set({ wall: 'north' })}>北</button>
              <span />
              <button className={o.wall === 'west' ? 'on' : ''} onClick={() => set({ wall: 'west' })}>西</button>
              <span className="mid" />
              <button className={o.wall === 'east' ? 'on' : ''} onClick={() => set({ wall: 'east' })}>東</button>
              <span />
              <button className={o.wall === 'south' ? 'on' : ''} onClick={() => set({ wall: 'south' })}>南</button>
              <span />
            </div>
          </Field>
          <NumberSlider
            label="位置"
            value={o.offset}
            min={0}
            max={Math.max(0, len - o.width)}
            hint={o.wall === 'north' || o.wall === 'south' ? '西の端からの距離' : '北の端からの距離'}
            onChange={(offset) => set({ offset })}
          />
          <NumberSlider label="幅" value={o.width} min={o.type === 'door' ? 500 : 300} max={Math.min(len, o.type === 'door' ? 1200 : 4000)} onChange={(width) => set({ width })} />
          <NumberSlider label="高さ" value={o.height} min={o.type === 'window' ? 300 : 1700} max={room.height - 50 - (o.type === 'window' ? o.sill : 0)} onChange={(height) => set({ height })} />
          {o.type === 'window' && (
            <>
              <NumberSlider label="床からの高さ" value={o.sill} min={0} max={room.height - 350} hint="0にすると掃き出し窓（ベランダに出られる窓）" onChange={(sill) => set({ sill })} />
              <Field label="サッシの色">
                <Segmented
                  value={o.frameColor}
                  options={[
                    { value: '#c9ccd0', label: 'シルバー' },
                    { value: '#3a3b3e', label: 'ブラック' },
                    { value: '#f2efe9', label: 'ホワイト' },
                    { value: '#7a5a43', label: 'ブロンズ' },
                  ]}
                  onChange={(frameColor) => set({ frameColor })}
                />
              </Field>
            </>
          )}
          {o.type === 'door' && (
            <>
              <Field label="蝶番">
                <Segmented value={o.hinge} options={[{ value: 'left', label: '左' }, { value: 'right', label: '右' }]} onChange={(hinge) => set({ hinge })} />
              </Field>
              <Field label="開き方">
                <Segmented value={o.swing} options={[{ value: 'in', label: '内開き' }, { value: 'out', label: '外開き' }]} onChange={(swing) => set({ swing })} />
              </Field>
            </>
          )}
          {o.type === 'closet' && (
            <>
              <Field label="扉">
                <Segmented
                  value={o.doorStyle}
                  options={[
                    { value: 'sliding', label: '引き戸' },
                    { value: 'folding', label: '折れ戸' },
                    { value: 'open', label: 'なし' },
                  ]}
                  onChange={(doorStyle) => set({ doorStyle })}
                />
              </Field>
              <NumberSlider label="奥行き" value={o.depth} min={300} max={1000} hint="壁の向こう側に広がる収納の深さ" onChange={(depth) => set({ depth })} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
