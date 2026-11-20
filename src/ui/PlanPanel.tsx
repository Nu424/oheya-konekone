import { useState } from 'react'
import { addSpace, ensureSpaces, removeSpace, resizeSpace, setSpaceLevel, updateSpace } from '../editor/planEdit'
import { SWATCHES } from '../three/materials'
import type { FloorMaterial, WallSide } from '../model/schema'
import { useDoc, useUi } from '../store/useStore'
import { FLOOR_PRESETS } from '../three/textures'
import { ColorSwatches, Field, NumberSlider } from './controls'
import { Icon } from './icons'

const SIDE_LABEL: Record<WallSide, string> = { north: '北', south: '南', west: '西', east: '東' }
const WALL_FINISHES = [
  ['paper', '壁紙'],
  ['panel', 'パネル'],
  ['tile', 'タイル'],
] as const
const WALL_DEFAULT = { paper: '#f3efe8', panel: '#eef0f0', tile: '#f4f4f2' } as const

/** The plan's spaces: add one beside another, resize, rename, change the floor, remove (docs/FLOORPLAN.md). */
export function PlanPanel() {
  const room = useDoc((s) => s.layout.room)
  const setLayout = useDoc((s) => s.setLayout)
  const notify = useUi((s) => s.notify)
  const [open, setOpen] = useState<string | null>(null)
  const edit = (f: (l: ReturnType<typeof useDoc.getState>['layout']) => ReturnType<typeof useDoc.getState>['layout']) => setLayout(f(useDoc.getState().layout))
  const spaces = room.spaces ?? []

  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">
          <Icon.plan /> 間取り
        </span>
      </div>
      {!spaces.length ? (
        <>
          <p className="plan-note">玄関やキッチン、お風呂まで作るときは、区画（部屋）を並べた間取りにしてね。いまの部屋がひとつめの区画になるよ</p>
          <button
            className="add-btn plan-start"
            onClick={() => {
              edit(ensureSpaces)
              setOpen('main')
              notify('間取りにしたよ。となりに区画を足してみてね')
            }}
          >
            <Icon.plan /> 間取りにする
          </button>
        </>
      ) : (
        <>
          <p className="plan-note">真上の視点（2）で区画の辺をドラッグすると、広さを変えられるよ。となり合う区画の境目は一緒に動くよ</p>
          {spaces.map((sp) => {
            const isOpen = open === sp.id
            const floor = sp.floor?.material
            return (
              <div key={sp.id} className={`card${isOpen ? ' open' : ''}`}>
                <div className="card-head" onClick={() => setOpen(isOpen ? null : sp.id)}>
                  <span className="ic">
                    <Icon.plan />
                  </span>
                  <span className="t">
                    {sp.name ?? sp.id}
                    <small>
                      {(sp.rect[2] / 1000).toFixed(2)} × {(sp.rect[3] / 1000).toFixed(2)} m ・ {((sp.rect[2] * sp.rect[3]) / 1_000_000 / 1.62).toFixed(1)} 畳
                    </small>
                  </span>
                  {spaces.length > 1 && (
                    <button
                      className="icon-btn danger"
                      title="この区画を消す"
                      onClick={(e) => {
                        e.stopPropagation()
                        edit((l) => removeSpace(l, sp.id))
                        notify(`「${sp.name ?? sp.id}」を消したよ`)
                      }}
                    >
                      <Icon.trash />
                    </button>
                  )}
                  <Icon.chevron className="chev" />
                </div>
                {isOpen && (
                  <div className="card-body">
                    <Field label="名前">
                      <input className="insp-text" value={sp.name ?? ''} maxLength={32} placeholder="洋室・キッチン・浴室など" onChange={(e) => edit((l) => updateSpace(l, sp.id, { name: e.target.value || undefined }))} />
                    </Field>
                    <NumberSlider label="幅（東西）" value={sp.rect[2]} min={600} max={8000} step={50} onChange={(v) => edit((l) => resizeSpace(l, sp.id, 'width', v))} />
                    <NumberSlider label="奥行き（南北）" value={sp.rect[3]} min={600} max={8000} step={50} onChange={(v) => edit((l) => resizeSpace(l, sp.id, 'depth', v))} />
                    <div className="plan-floor">
                      <span className="plan-floor-label">床</span>
                      <div className="chips">
                        <button className={`chip${!floor ? ' on' : ''}`} onClick={() => edit((l) => updateSpace(l, sp.id, { floor: undefined }))}>
                          部屋と同じ
                        </button>
                        {(Object.keys(FLOOR_PRESETS) as FloorMaterial[]).map((m) => (
                          <button key={m} className={`chip${floor === m ? ' on' : ''}`} onClick={() => edit((l) => updateSpace(l, sp.id, { floor: { material: m } }))}>
                            {FLOOR_PRESETS[m].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <NumberSlider label="床の高さ" value={sp.floorLevel ?? 0} min={-300} max={0} step={10} hint="玄関の土間は -150 くらい。中の家具も一緒に上下するよ" onChange={(v) => edit((l) => setSpaceLevel(l, sp.id, v))} />
                    <div className="plan-floor">
                      <span className="plan-floor-label">壁</span>
                      <div className="chips plan-wall-finish">
                        <button className={`chip${!sp.wall ? ' on' : ''}`} onClick={() => edit((l) => updateSpace(l, sp.id, { wall: undefined }))}>
                          部屋と同じ
                        </button>
                        {WALL_FINISHES.map(([f, label]) => (
                          <button key={f} className={`chip${sp.wall?.finish === f ? ' on' : ''}`} onClick={() => edit((l) => updateSpace(l, sp.id, { wall: { color: sp.wall?.color ?? WALL_DEFAULT[f], finish: f } }))}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {sp.wall && <ColorSwatches value={sp.wall.color} swatches={SWATCHES.paint} onChange={(color) => edit((l) => updateSpace(l, sp.id, { wall: { color, finish: sp.wall!.finish } }))} />}
                    </div>
                    <Field label="となりに区画を足す" hint="ドアも一緒につくよ。いらなければ「ドア・窓・収納」から消してね">
                      <div className="compass">
                        {([null, 'north', null, 'west', 'mid', 'east', null, 'south', null] as const).map((side, i) =>
                          side === null ? (
                            <span key={i} />
                          ) : side === 'mid' ? (
                            <span key={i} className="mid" />
                          ) : (
                            <button
                              key={i}
                              onClick={() => {
                                const r = addSpace(useDoc.getState().layout, sp.id, side)
                                if (!r) return notify(`${SIDE_LABEL[side]}側には区画を足す場所がないよ`, 'error')
                                setLayout(r.layout)
                                setOpen(r.id)
                                notify(`${SIDE_LABEL[side]}側に区画を足したよ`)
                              }}
                            >
                              {SIDE_LABEL[side]}
                            </button>
                          ),
                        )}
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
