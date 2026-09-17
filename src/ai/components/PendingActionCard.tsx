import { useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { PendingActionOut } from '../types'

function formatInput(input: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(input).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }))
}

export function PendingActionCard({
  action,
  onResolve,
  canAct = true,
}: {
  action: PendingActionOut
  onResolve: (id: number, decision: 'approve' | 'reject') => Promise<unknown>
  /** false для раздела уровня ниже edit (0052-d) — прячет одобрить/отклонить,
   * не влияет на Jarvis/consult, который сюда всегда передаёт по умолчанию true. */
  canAct?: boolean
}) {
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null)
  const fields = formatInput(action.tool_input)

  async function decide(decision: 'approve' | 'reject') {
    setDeciding(decision)
    try {
      await onResolve(action.id, decision)
    } finally {
      setDeciding(null)
    }
  }

  return (
    <div className="w-full rounded-md border border-border bg-surface-muted p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{action.summary ?? 'Предложенное изменение'}</span>
        {action.status === 'pending' ? (
          <Chip tone="warning">Ожидает</Chip>
        ) : action.execution_status === 'succeeded' ? (
          <Chip tone="success">Выполнено</Chip>
        ) : action.execution_status === 'failed' ? (
          <Chip tone="danger">Не выполнено</Chip>
        ) : action.status === 'approved' ? (
          <Chip tone="warning">Результат не подтверждён</Chip>
        ) : (
          <Chip tone="danger">Отклонено</Chip>
        )}
      </div>
      {action.status === 'pending' && <p className="mb-3 flex items-start gap-2 text-[12px] text-muted">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        Изменение будет выполнено после подтверждения. Права проверяются повторно при выполнении.
      </p>}
      {fields.length > 0 && (
        <dl className="mb-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {fields.map(({ key, value }) => (
            <div key={key} className="min-w-0 text-[12px]">
              <dt className="shrink-0 text-muted">{key}:</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {action.status === 'pending' && canAct && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide('approve')} disabled={deciding !== null}>
            <Check size={14} />
            {deciding === 'approve' ? 'Одобряем…' : 'Одобрить'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => decide('reject')} disabled={deciding !== null}>
            <X size={14} />
            {deciding === 'reject' ? 'Отклоняем…' : 'Отклонить'}
          </Button>
        </div>
      )}
    </div>
  )
}
