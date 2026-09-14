import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

/** Полноэкранная модалка для превью (фото, PDF, текст…) — общая для «Все чаты» и чата клиента. */
export function Lightbox({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button type="button" aria-label="Закрыть" className="absolute right-4 top-4 text-white/80 hover:text-white">
        <X size={24} />
      </button>
      <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
