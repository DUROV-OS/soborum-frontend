import { Mic } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { useMeetingStore } from '../store'

/**
 * Кнопка «Совещание» в Topbar рядом с выбором аккаунта. Видна только при
 * доступе на запись (edit) к разделу «Марина» — начинает совещание, это
 * действие, не просмотр (0052-d). Оранжевый ИИ-акцент — токены --ai / --ai-accent
 * (палитра задачи 0008).
 */
export function MeetingButton() {
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')
  const phase = useMeetingStore((s) => s.phase)
  const start = useMeetingStore((s) => s.start)
  const openPanel = useMeetingStore((s) => s.openPanel)

  if (!canEdit) return null

  const busy = phase === 'starting' || phase === 'recording' || phase === 'finishing'

  return (
    <button
      type="button"
      onClick={() => (busy ? openPanel() : void start())}
      aria-label="Режим «Совещание»"
      aria-pressed={busy}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        busy
          ? 'border-ai/30 bg-ai-bg text-ai-accent'
          : 'border-ai/25 text-ai-accent hover:bg-ai-bg'
      }`}
    >
      <Mic size={14} />
      <span className="hidden sm:inline">Совещание</span>
      {busy && <span className="h-2 w-2 animate-pulse rounded-pill bg-red-500" />}
    </button>
  )
}
