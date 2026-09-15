const STEPS: { title: string; detail: string }[] = [
  {
    title: 'Проблема и критерии',
    detail: 'Что именно не устраивает и по каким признакам будет видно, что стало лучше.',
  },
  {
    title: 'Приоритет и оценка',
    detail: 'Сравнение с другими задачами, оценка объёма и стоимости изменения.',
  },
  {
    title: 'Отдельная тестовая версия',
    detail: 'Изменение обкатывается отдельно от продакшн-версии, не затрагивая всех сразу.',
  },
  {
    title: 'Утверждение выпуска',
    detail: 'Ручное решение о переносе проверенного изменения в прод.',
  },
  {
    title: 'Замер результата',
    detail: 'Проверка по тем же критериям, что эффект действительно наступил.',
  },
]

/** Статичная справка «Порядок изменения системы» — по образцу скриншота
 * Арсения. Текст захардкожен на фронте (не приходит с бэка) и не привязан к
 * конкретному предложению — показывается рядом с любым из них (задача 0036-b). */
export function GrowthProcessCard() {
  return (
    <div className="flex shrink-0 flex-col gap-4 rounded-xl border border-dashed border-border bg-surface-muted p-4 lg:w-72">
      <h3 className="text-[14px] font-medium text-ink">Порядок изменения системы</h3>
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-ai/15 text-[12px] font-medium text-ai-accent">
              {i + 1}
            </span>
            <div>
              <div className="text-[13px] font-medium text-ink">{step.title}</div>
              <p className="text-[12px] leading-relaxed text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
