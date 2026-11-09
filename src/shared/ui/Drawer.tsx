import { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDialogFocus } from '@/shared/hooks/useDialogFocus'

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-xl',
  bodyClassName = 'flex-1 overflow-y-auto px-6 py-5',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  width?: string
  bodyClassName?: string
}) {
  const dialogRef = useDialogFocus(open, onClose)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal
        aria-label={title}
        className={`flex h-full w-full ${width} flex-col bg-surface shadow-xl`}
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
            <X size={18} />
          </button>
        </div>
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  )
}
