import { useEffect, useState, type ReactNode } from 'react'

export function NumberSlider({
  label,
  value,
  min,
  max,
  step = 10,
  unit = 'mm',
  hint,
  onChange,
  format,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  hint?: ReactNode
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value])
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  const commit = () => {
    const n = Number(text)
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
    else setText(String(value))
  }
  return (
    <div className="field">
      <div className="field-row">
        <span className="field-label">{label}</span>
        <span className="num" title={format?.(value)}>
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
                onChange(Math.min(max, Math.max(min, value + d)))
              }
            }}
          />
          <span className="unit">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  full,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  full?: boolean
}) {
  return (
    <div className={`seg${full ? ' full' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ColorSwatches({ value, swatches, onChange }: { value: string; swatches: string[]; onChange: (v: string) => void }) {
  const lower = value.toLowerCase()
  return (
    <div className="swatches">
      {swatches.map((c) => (
        <button
          key={c}
          className={`swatch${c.toLowerCase() === lower ? ' on' : ''}`}
          style={{ background: c }}
          title={c}
          aria-label={c}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="swatch-custom" title="好きな色を選ぶ">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <div className="field-row">
        <span className="field-label">{label}</span>
        {children}
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}
