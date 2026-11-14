import { ReactNode } from 'react'
import { BitrixIcon } from './BitrixIcon'
import { useDialogFocus } from '@/shared/hooks/useDialogFocus'

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-xl',
  bodyClassName = 'flex-1 overflow-y-auto px-6 py-5',
  modal = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  width?: string
  bodyClassName?: string
  modal?: boolean
}) {
  const dialogRef = useDialogFocus(open, onClose, modal)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={modal}
        aria-label={title}
        className={`workspace-drawer flex h-full w-full ${width} flex-col bg-surface shadow-xl`}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-[16px] font-medium text-ink">{title}</h2>
            {subtitle && <div className="mt-1 text-[13px] text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-ink"
          >
            <BitrixIcon name="cross-l" size={20} />
          </button>
        </div>
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  )
}
