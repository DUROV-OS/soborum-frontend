import { CSSProperties, RefObject, useEffect, useRef, useState } from 'react'

const MIN = 32, MAX = 60, DEFAULT = 42
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value))
function read(key: string) {
  try {
    const saved = localStorage.getItem(key)
    const value = saved === null ? DEFAULT : Number(saved)
    return Number.isFinite(value) ? clamp(value) : DEFAULT
  } catch { return DEFAULT }
}

export function useCrmCardSplit(accountId: number | undefined) {
  const key = `durov.crm.card-width:${accountId ?? 'anonymous'}`
  const [percent, setPercent] = useState(() => read(key))
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => setPercent(read(key)), [key])
  const update = (value: number) => {
    const next = clamp(Math.round(value))
    setPercent(next)
    try { localStorage.setItem(key, String(next)) } catch { /* Resizing still works without storage. */ }
  }
  return { percent, update, containerRef, style: { '--crm-data-width': `${percent}%` } as CSSProperties }
}

export function CrmCardDivider({ containerRef, percent, onChange, controls }: {
  containerRef: RefObject<HTMLDivElement>
  percent: number
  onChange: (value: number) => void
  controls: string
}) {
  return <div role="separator" aria-label="Ширина данных карточки" aria-orientation="vertical"
    aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={percent} aria-valuetext={`${percent}%`}
    aria-controls={controls} tabIndex={0} className="crm-card-divider"
    title="Перетащите границу или используйте стрелки. Двойной щелчок — исходная ширина."
    onDoubleClick={() => onChange(DEFAULT)}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerMove={event => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect?.width) onChange((event.clientX - rect.left) / rect.width * 100)
    }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onPointerCancel={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const step = event.shiftKey ? 5 : 1
      onChange(event.key === 'Home' ? MIN : event.key === 'End' ? MAX : percent + (event.key === 'ArrowRight' ? step : -step))
    }}><span /></div>
}
