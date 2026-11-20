import { useEffect, useState, type ReactNode } from 'react'
import { useUi } from '../store/useStore'
import { useWalk } from '../store/walk'
import { Icon } from './icons'

function Slider({ icon, label, title, value, min, max, step, text, onChange }: { icon?: ReactNode; label: string; title: string; value: number; min: number; max: number; step: number; text: string; onChange: (v: number) => void }) {
  return (
    <label className="clock walk-slider" title={title}>
      {icon}
      <span className="walk-slider-name">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="clock-label">{text}</span>
    </label>
  )
}

function useFullscreen() {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => useUi.getState().notify('全画面にできなかったよ（ブラウザの設定を見てね）', 'error'))
  }
  return [on, toggle] as const
}

/** The bottom bar while walking: collision, body height, speed, look sensitivity, fullscreen. */
export function WalkBar() {
  const w = useWalk()
  const [full, toggleFull] = useFullscreen()
  return (
    <div className="hud glass walk-bar">
      <button className={`icon-btn${w.collide ? ' on' : ''}`} onClick={() => w.set({ collide: !w.collide })} title="壁や家具にぶつかる（オフにするとすり抜けられる）" aria-pressed={w.collide}>
        <Icon.overlap /> <span className="label">当たり判定</span>
      </button>
      <span className="sep" />
      <Slider label="身長" title="身長（目の高さはこれより 10cm 低い）" value={w.height} min={90} max={200} step={1} text={`${w.height}cm`} onChange={(height) => w.set({ height })} />
      <Slider label="速さ" title="歩く速さ（Shift を押すと 2 倍）" value={w.speed} min={0.5} max={3} step={0.1} text={`${w.speed.toFixed(1)}m/s`} onChange={(speed) => w.set({ speed })} />
      <Slider label="感度" title="マウスで見回すときの感度" value={w.sensitivity} min={0.3} max={2.5} step={0.1} text={`×${w.sensitivity.toFixed(1)}`} onChange={(sensitivity) => w.set({ sensitivity })} />
      <span className="sep" />
      <button className={`icon-btn${full ? ' on' : ''}`} onClick={toggleFull} title="全画面" aria-pressed={full}>
        <Icon.expand /> <span className="label">全画面</span>
      </button>
      <button className="icon-btn" onClick={() => w.reset()} title="入口に戻る">
        <Icon.door /> <span className="label">入口へ</span>
      </button>
      <button className="icon-btn" onClick={() => useUi.getState().setView('orbit')} title="歩くのをやめて 3D ビューに戻る (Esc)">
        <Icon.cube /> <span className="label">やめる</span>
      </button>
    </div>
  )
}

/** Centre of the screen while walking: a crosshair once the mouse is captured, how to start otherwise. */
export function WalkOverlay() {
  const locked = useWalk((s) => s.locked)
  const mouse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
  if (locked) return <div className="walk-crosshair" aria-hidden />
  return (
    <div className="walk-start glass" role="note">
      {mouse ? (
        <>
          <b>画面をクリックすると、マウスを動かすだけで見回せるよ</b>
          <span>
            <kbd>WASD</kbd> 歩く ・ <kbd>Shift</kbd> 急ぐ ・ <kbd>Esc</kbd> マウスを離す（もう一度で 3D にもどる）
          </span>
        </>
      ) : (
        <>
          <b>ドラッグで見回して、床をタップするとそこへ歩くよ</b>
        </>
      )}
    </div>
  )
}
