import { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDialogFocus } from '@/shared/hooks/useDialogFocus'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
  mobileFull = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
  mobileFull?: boolean
}) {
  const dialogRef = useDialogFocus(open, onClose)
  if (!open) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-ink/40 ${mobileFull ? "p-0 sm:p-4" : "p-4"}`}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal
        aria-label={title}
        className={`w-full ${width} bg-surface shadow-xl ${mobileFull ? "flex h-[100dvh] flex-col rounded-none sm:h-auto sm:max-h-[92dvh] sm:rounded-xl" : "rounded-md"}`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-medium text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className={`${mobileFull ? "min-h-0 flex-1 overflow-y-auto overscroll-contain sm:max-h-[70vh]" : "max-h-[70vh] overflow-y-auto"} px-5 py-4`}>{children}</div>
        {footer && (
          <div className={`flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 py-4 ${mobileFull ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : ""}`}>{footer}</div>
        )}
      </div>
    </div>
  )
}
