import { FormEvent, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Field, Textarea } from '@/shared/ui/Field'
import { useAgentsStore } from '../store'
import { LegalVerdict } from '../types'

const EXAMPLES = [
  'Каких материалов не хватает на складе для ближайшего модуля?',
  'Клиенту нужна скидка 15% и окончательная цена сегодня',
  'Используем ворованную информацию конкурентов в рекламе',
]

function legalTone(verdict: LegalVerdict) {
  if (verdict === 'block') return 'danger' as const
  if (verdict === 'allow') return 'info' as const
  return 'warning' as const
}

function legalLabel(verdict: LegalVerdict) {
  if (verdict === 'escalate_human') return 'человек'
  if (verdict === 'allow_with_conditions') return 'с оговорками'
  return verdict
}

export function RunTaskForm() {
  const [text, setText] = useState('')
  const lastRun = useAgentsStore((s) => s.lastRun)
  const runLoading = useAgentsStore((s) => s.runLoading)
  const runError = useAgentsStore((s) => s.runError)
  const submit = useAgentsStore((s) => s.submit)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = text.trim()
    if (next.length < 3) return
    await submit(next)
  }

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Прогнать запрос</h2>
        <p className="mt-1 text-[12px] text-muted">
          Автоматическая проверка запроса по настроенным правилам. Результат не является заключением или согласованием специалиста.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 px-5 py-5 sm:px-6">
        <Field label="Запрос" required hint="Минимум три символа. Результат сохраняется в истории запросов.">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Например: цех не успевает модуль, каких материалов нет на складе?"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="rounded-pill border border-border px-3 py-1.5 text-left text-[12px] text-muted hover:border-brand/40 hover:text-ink"
            >
              {example}
            </button>
          ))}
        </div>
        {runError && <p className="text-[13px] text-danger">{runError}</p>}
        <Button type="submit" disabled={runLoading || text.trim().length < 3}>
          {runLoading ? 'Прогон…' : 'Запустить координатора'}
        </Button>
      </form>
      {lastRun && (
        <div className="border-t border-border px-5 py-5 sm:px-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone={legalTone(lastRun.legal_verdict)}>{legalLabel(lastRun.legal_verdict)}</Chip>
            <span className="text-[12px] text-muted">
              {lastRun.released ? 'выпущен как информация' : 'не выпущен как действие'}
            </span>
            {lastRun.specialist_titles.length > 0 && (
              <span className="text-[12px] text-muted">{lastRun.specialist_titles.join(' · ')}</span>
            )}
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink">{lastRun.reply}</pre>
          <p className="mt-3 text-xs text-muted">Это сохранённый ответ программных ролей. Участие и согласование сотрудника этой записью не подтверждаются.</p>
        </div>
      )}
    </section>
  )
}
