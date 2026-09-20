import { Loader2 } from 'lucide-react'

/**
 * Полноэкранный оверлей ожидания на переходе «Оплата» → «Постоплата» (0068).
 * В отличие от остальных переходов стадий (мгновенных), этот синхронно
 * вызывает на бэкенде OCR + Claude-разбор КР и генерацию плана работ
 * (`transition_stage`, app/clients/service.py) — это может занять минуту
 * на многостраничном документе. Без пояснения кнопка «Переход…» выглядит
 * как зависшая. Блокировку взаимодействия по-прежнему даёт существующий
 * `disabled`/`saving` на самих панелях — оверлей только объясняет паузу.
 */
export function AiPlanOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-md bg-surface px-6 py-8 text-center shadow-xl">
        <Loader2 size={28} className="animate-spin text-brand" />
        <p className="text-[14px] font-medium text-ink">ИИ формирует план работ по КР</p>
        <p className="text-[13px] text-muted">
          Это может занять минуту — идёт распознавание документа и генерация плана производства.
          Не закрывайте страницу.
        </p>
      </div>
    </div>
  )
}
