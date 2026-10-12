import { useEffect, useState } from 'react'
import { useUi } from '../store/useStore'
import { Modal } from '../ui/dialogs'
import { Icon } from '../ui/icons'
import { PERF_PANEL, usePerf } from './store'

/** `?perf`: record a few seconds of frames and get a log to compare before / after. */
export function PerfPanel() {
  const status = usePerf((s) => s.status)
  const mode = usePerf((s) => s.mode)
  const startedAt = usePerf((s) => s.startedAt)
  const duration = usePerf((s) => s.duration)
  const report = usePerf((s) => s.report)
  const [, tick] = useState(0)
  useEffect(() => {
    if (status !== 'recording') return
    const id = setInterval(() => tick((n) => n + 1), 100)
    return () => clearInterval(id)
  }, [status])
  if (!PERF_PANEL) return null
  const recording = status === 'recording'
  const left = Math.max(0, (startedAt + duration - performance.now()) / 1000)

  return (
    <>
      <div className="perf-panel glass">
        <div className="perf-head">
          <b>動作診断</b>
        </div>
        {recording ? (
          <div className="perf-rec">
            <span className="perf-dot" />
            {mode === 'auto' ? 'ぐるっと一周してるよ…' : '記録中！視点をぐるぐる動かしてね'} <b>{left.toFixed(1)}s</b>
            <div className="perf-track">
              <div style={{ width: `${(1 - left / (duration / 1000)) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="perf-actions">
            <button className="icon-btn" onClick={() => usePerf.getState().start('manual')} title="5秒間、自分で視点を動かしているあいだを記録するよ">
              <span className="perf-dot" /> 記録（5秒）
            </button>
            <button className="icon-btn" onClick={() => usePerf.getState().start('auto')} title="カメラが自動で6秒かけて一周するあいだを記録するよ。前後の比較に向いてる">
              <Icon.redo /> 自動で一周
            </button>
          </div>
        )}
      </div>
      {report && <PerfReportDialog text={report.text} json={report.json} />}
    </>
  )
}

function PerfReportDialog({ text, json }: { text: string; json: string }) {
  const notify = useUi((s) => s.notify)
  const close = () => usePerf.getState().clear()
  const all = `${text}\n\n--- 詳細ログ (JSON) ---\n${json}`
  return (
    <Modal
      title="動作診断の結果"
      sub="「ログをコピー」で全部まとめてコピーできるよ。そのまま貼ってくれれば分析できる"
      onClose={close}
      width={760}
      foot={
        <>
          <button className="icon-btn" onClick={() => navigator.clipboard.writeText(all).then(() => notify('ログをコピーしたよ'))}>
            <Icon.copy /> <span className="label">ログをコピー</span>
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
              a.download = `oheya-perf-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
          >
            <Icon.download /> <span className="label">JSONで保存</span>
          </button>
          <span className="spacer" />
          <button className="icon-btn primary" onClick={close}>
            とじる
          </button>
        </>
      }
    >
      <pre className="perf-summary">{text}</pre>
      <details className="perf-json">
        <summary>詳細ログ (JSON)</summary>
        <pre>{json}</pre>
      </details>
    </Modal>
  )
}
