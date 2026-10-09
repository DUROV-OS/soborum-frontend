import { KeyboardEvent, useEffect, useLayoutEffect, useRef } from 'react'

/** До какой высоты поле растёт само по тексту, px (~10 строк). */
const AUTO_MAX_HEIGHT = 240

/**
 * Поле ввода сообщения MAX (0102). Само растёт по тексту до AUTO_MAX_HEIGHT,
 * дальше — прокрутка внутри. За правый нижний угол тянется по высоте вручную
 * (до 60% окна); выбранная руками высота — нижняя граница авто-роста, пока
 * поле на экране.
 */
export function MaxComposerInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  minRows = 1,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  minRows?: number
  disabled?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  /** Высота, выставленная авто-ростом последней. */
  const autoHeight = useRef<number | null>(null)
  /** Высота, до которой поле растянули руками. */
  const manualHeight = useRef(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight без рамок, а высота с box-sizing: border-box — с ними
    const borders = el.offsetHeight - el.clientHeight
    const content = el.scrollHeight + borders
    const height = Math.max(Math.min(content, AUTO_MAX_HEIGHT), manualHeight.current)
    el.style.height = `${height}px`
    autoHeight.current = el.offsetHeight // фактическая: её может урезать max-height
  }, [value])

  // Любое изменение высоты, которое сделал не авто-рост, — растягивание руками.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (autoHeight.current === null) return
      if (Math.abs(el.offsetHeight - autoHeight.current) > 2) {
        manualHeight.current = el.offsetHeight
        autoHeight.current = el.offsetHeight
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      style={{ maxHeight: '60vh' }}
      className="min-h-[2.25rem] w-full flex-1 resize-y rounded-sm border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand/50 disabled:bg-surface-muted"
    />
  )
}
