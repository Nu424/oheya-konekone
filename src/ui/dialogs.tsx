import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { downloadText, layoutJsonSchema, parseLayoutText, serializeLayout, type ParseResult } from '../model/io'
import type { Layout } from '../model/schema'
import { TEMPLATES } from '../model/templates'
import { buildPrompt } from '../ai/prompt'
import { assetList } from '../assets/registry'
import { itemFootprint } from '../three/ItemObject'
import { useDoc, useUi } from '../store/useStore'
import { FloorPlan } from './FloorPlan'
import { Icon } from './icons'

export function Modal({ title, sub, onClose, children, foot, width }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width: `min(${width}px, 100%)` } : undefined} role="dialog" aria-modal>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Icon.x />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export function summarizeDiff(a: Layout, b: Layout): string[] {
  const out: string[] = []
  const ra = a.room
  const rb = b.room
  if (ra.width !== rb.width || ra.depth !== rb.depth || ra.height !== rb.height)
    out.push(`部屋: ${ra.width}×${ra.depth}×${ra.height} → ${rb.width}×${rb.depth}×${rb.height}`)
  if (ra.floor.material !== rb.floor.material) out.push(`床: ${ra.floor.material} → ${rb.floor.material}`)
  if (ra.wall.color !== rb.wall.color) out.push(`壁の色: ${ra.wall.color} → ${rb.wall.color}`)
  if (ra.openings.length !== rb.openings.length) out.push(`開口部: ${ra.openings.length} → ${rb.openings.length}個`)
  const ia = new Map(a.items.map((i) => [i.id, i]))
  const ib = new Map(b.items.map((i) => [i.id, i]))
  const added = [...ib.keys()].filter((k) => !ia.has(k)).length
  const removed = [...ia.keys()].filter((k) => !ib.has(k)).length
  const changed = [...ib.keys()].filter((k) => ia.has(k) && JSON.stringify(ia.get(k)) !== JSON.stringify(ib.get(k))).length
  if (added) out.push(`アイテム追加: ${added}個`)
  if (removed) out.push(`アイテム削除: ${removed}個`)
  if (changed) out.push(`アイテム変更: ${changed}個`)
  return out
}

export function JsonDialog() {
  const layout = useDoc((s) => s.layout)
  const setLayout = useDoc((s) => s.setLayout)
  const close = () => useUi.getState().setJsonOpen(false)
  const notify = useUi((s) => s.notify)
  const current = useMemo(() => serializeLayout(layout), [layout])
  const [text, setText] = useState(current)
  const [result, setResult] = useState<ParseResult | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setResult(text === current ? null : parseLayoutText(text)), 250)
    return () => clearTimeout(id)
  }, [text, current])

  const dirty = text !== current
  const diff = result?.ok ? summarizeDiff(layout, result.layout) : []

  const apply = () => {
    if (!result?.ok) return
    setLayout(result.layout)
    notify('JSONを反映したよ（Ctrl+Zで戻せる）')
    close()
  }

  return (
    <Modal
      title="JSONで編集"
      sub="この部屋の設計図。コピーしてAIに渡したり、書き換えて貼り付けたりできるよ"
      onClose={close}
      width={1000}
      foot={
        <>
          <button className="icon-btn" onClick={() => navigator.clipboard.writeText(text).then(() => notify('コピーしたよ'))}>
            <Icon.copy /> <span className="label">コピー</span>
          </button>
          <button
            className="icon-btn"
            onClick={async () => {
              try {
                setText(await navigator.clipboard.readText())
              } catch {
                notify('クリップボードを読めなかった…エディタに直接貼り付けてね', 'error')
              }
            }}
          >
            <Icon.paste /> <span className="label">貼り付け</span>
          </button>
          <button className="icon-btn" onClick={() => downloadText(`${layout.meta.name || 'oheya'}.json`, text)}>
            <Icon.download /> <span className="label">保存</span>
          </button>
          <button
            className="icon-btn"
            title="AIエージェント向けのJSON Schema"
            onClick={() => navigator.clipboard.writeText(JSON.stringify(layoutJsonSchema(), null, 2)).then(() => notify('JSON Schemaをコピーしたよ'))}
          >
            <Icon.code /> <span className="label">Schemaをコピー</span>
          </button>
          <span className="spacer" />
          {dirty && (
            <button className="icon-btn" onClick={() => setText(current)}>
              元に戻す
            </button>
          )}
          <button className="icon-btn primary" disabled={!dirty || !result?.ok} onClick={apply}>
            <Icon.check /> 反映する
          </button>
        </>
      }
    >
      <div className="json-wrap">
        <textarea
          className="json-editor"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') apply()
            if (e.key === 'Tab') {
              e.preventDefault()
              const el = e.currentTarget
              const s = el.selectionStart
              setText(text.slice(0, s) + '  ' + text.slice(el.selectionEnd))
              requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
            }
          }}
        />
        <div className="json-side">
          {!dirty && (
            <div className="status same">
              <Icon.check width={18} /> いまの部屋と同じ内容
            </div>
          )}
          {dirty && !result && <div className="status same">チェック中…</div>}
          {result?.ok && (
            <div className="status ok">
              <Icon.check width={18} /> 読み込めるよ！
            </div>
          )}
          {result && !result.ok && (
            <div className="status bad">
              <Icon.alert width={18} /> {result.errors.length}件の問題
            </div>
          )}
          {diff.length > 0 && (
            <div className="diff">
              <b>変わるところ</b>
              <br />
              {diff.map((d) => (
                <div key={d}>・{d}</div>
              ))}
            </div>
          )}
          {result && (
            <ul className="issues">
              {!result.ok &&
                result.errors.map((e, i) => (
                  <li key={`e${i}`}>
                    <code>{e.path}</code>
                    {e.message}
                  </li>
                ))}
              {result.warnings.map((e, i) => (
                <li key={`w${i}`} className="warn">
                  <code>⚠ {e.path}</code>
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          <div className="field-hint" style={{ marginTop: 'auto' }}>
            Ctrl+Enter で反映。単位はmm、原点は北西の床の角。
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function TemplateDialog({ onClose }: { onClose: () => void }) {
  const setLayout = useDoc((s) => s.setLayout)
  const notify = useUi((s) => s.notify)
  const previews = useMemo(() => TEMPLATES.map((t) => ({ t, layout: t.layout() })), [])
  return (
    <Modal title="新しいおへや" sub="テンプレートから始めよう。いまの部屋はCtrl+Zで戻せるよ" onClose={onClose} width={900}>
      <div className="templates">
        {previews.map(({ t, layout }) => (
          <button
            key={t.id}
            className="tpl"
            onClick={() => {
              setLayout(t.layout())
              notify(`「${t.name}」を用意したよ`)
              onClose()
            }}
          >
            <FloorPlan layout={layout} />
            <b>{t.name}</b>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

const IDEAS = [
  '在宅ワークがはかどる部屋にしたい。デスクまわりを充実させて',
  '友だちを3人くらい呼んでくつろげる部屋',
  'ミニマルで、できるだけ広く見せたい',
  '本と観葉植物に囲まれた、カフェみたいな部屋',
  'ベッドとソファの両方を置きたい。通路はしっかり確保して',
  '冬はこたつでぬくぬくしたい。和モダンな雰囲気で',
]

function measuredSizes() {
  const out: Record<string, string> = {}
  for (const a of assetList) {
    const fp = itemFootprint(a.type, {})
    if (fp) out[a.type] = `${Math.round(fp.w)}×${Math.round(fp.d)}×${Math.round(fp.h)}`
  }
  return out
}

export function AiDialog({ onClose }: { onClose: () => void }) {
  const layout = useDoc((s) => s.layout)
  const setLayout = useDoc((s) => s.setLayout)
  const notify = useUi((s) => s.notify)
  const [request, setRequest] = useState('')
  const [keepRoom, setKeepRoom] = useState(true)
  const [reply, setReply] = useState('')
  const [copied, setCopied] = useState(false)
  const result = useMemo(() => (reply.trim() ? parseLayoutText(reply) : null), [reply])
  const diff = result?.ok ? summarizeDiff(layout, result.layout) : []

  const copyPrompt = async () => {
    const text = buildPrompt(layout, { request, keepRoom, sizes: measuredSizes() })
    await navigator.clipboard.writeText(text)
    setCopied(true)
    notify(`プロンプトをコピーしたよ（${text.length.toLocaleString()}文字）`)
  }

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon.sparkle width={22} /> AIに頼む
        </span>
      }
      sub="ChatGPTやClaudeなどにレイアウトを考えてもらおう。プロンプトをコピーして渡して、返ってきたJSONを貼り付けるだけ"
      onClose={onClose}
      width={980}
      foot={
        <>
          <span className="field-hint">反映したあとも Ctrl+Z でもとに戻せるよ</span>
          <span className="spacer" />
          <button
            className="icon-btn primary"
            disabled={!result?.ok}
            onClick={() => {
              if (!result?.ok) return
              setLayout(result.layout)
              notify('AIのレイアウトを反映したよ！')
              onClose()
            }}
          >
            <Icon.check /> 反映する
          </button>
        </>
      }
    >
      <div className="ai-grid">
        <section className="ai-step">
          <div className="ai-num">1</div>
          <h3>どんな部屋にしたい？</h3>
          <textarea className="ai-text" placeholder="例: 在宅ワークがはかどる部屋にしたい" value={request} onChange={(e) => setRequest(e.target.value)} rows={4} />
          <div className="ai-ideas">
            {IDEAS.map((i) => (
              <button key={i} onClick={() => setRequest(i)}>
                {i}
              </button>
            ))}
          </div>
          <label className="ai-check">
            <input type="checkbox" checked={keepRoom} onChange={(e) => setKeepRoom(e.target.checked)} /> 部屋の広さやドア・窓は変えない
          </label>
          <button className="icon-btn primary ai-copy" onClick={copyPrompt}>
            {copied ? <Icon.check /> : <Icon.copy />} プロンプトをコピー
          </button>
          <div className="field-hint">ルール・使える家具の一覧・いまの部屋のJSONがまとめて入るよ。</div>
        </section>
        <section className="ai-step">
          <div className="ai-num">2</div>
          <h3>AIの返事を貼り付け</h3>
          <textarea
            className="json-editor ai-reply"
            spellCheck={false}
            placeholder="AIの返事をまるごと貼り付けてOK（```json の部分を自動で取り出すよ）"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {result?.ok && (
            <div className="status ok">
              <Icon.check width={18} /> 読み込めるよ！
            </div>
          )}
          {result && !result.ok && (
            <div className="status bad">
              <Icon.alert width={18} /> {result.errors.length}件の問題（AIに伝えて直してもらおう）
            </div>
          )}
          {diff.length > 0 && (
            <div className="diff">
              {diff.map((d) => (
                <div key={d}>・{d}</div>
              ))}
            </div>
          )}
          {result && (
            <ul className="issues">
              {!result.ok &&
                result.errors.slice(0, 8).map((e, i) => (
                  <li key={`e${i}`}>
                    <code>{e.path}</code>
                    {e.message}
                  </li>
                ))}
              {result.warnings.slice(0, 5).map((e, i) => (
                <li key={`w${i}`} className="warn">
                  <code>⚠ {e.path}</code>
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          {result && !result.ok && (
            <button
              className="icon-btn"
              onClick={() =>
                navigator.clipboard
                  .writeText(`いただいたJSONを読み込んだら、次のエラーが出ました。直した完全なJSONをもう一度ください。\n${result.errors.map((e) => `- ${e.path}: ${e.message}`).join('\n')}`)
                  .then(() => notify('エラー内容をコピーしたよ。AIに貼り付けてね'))
              }
            >
              <Icon.copy /> エラーをAIに伝える文をコピー
            </button>
          )}
        </section>
      </div>
    </Modal>
  )
}
