import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { GrowthProposalOut } from '../types'

/** Карточка одного предложения Марины по разделу «Развитие» (задача 0036-b) —
 * по образцу скриншота Арсения: бейдж, заголовок, описание проблемы и три
 * подписанных блока. Кнопка «Подготовить задачу» дизейблится сразу после
 * успеха и остаётся такой при следующих открытиях (proposal.status с бэка). */
export function GrowthProposalCard({
  proposal,
  onPrepareTask,
}: {
  proposal: GrowthProposalOut
  onPrepareTask: (id: number) => Promise<void>
}) {
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPrepared = proposal.status === 'task_created'
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')

  async function handleClick() {
    if (isPrepared || preparing) return
    setPreparing(true)
    setError(null)
    try {
      await onPrepareTask(proposal.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подготовить задачу')
    } finally {
      setPreparing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <Chip tone="ai">Предложение</Chip>
      <h3 className="text-[15px] font-medium leading-snug text-ink">{proposal.title}</h3>
      <p className="text-[13px] leading-relaxed text-muted">{proposal.problem}</p>

      <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3">
        <div>
          <div className="text-[12px] font-medium text-ink">Проверяемый результат</div>
          <p className="text-[13px] leading-relaxed text-muted">{proposal.checkable_result}</p>
        </div>
        <div>
          <div className="text-[12px] font-medium text-ink">Исполнитель и оценка</div>
          <p className="text-[13px] leading-relaxed text-muted">{proposal.executor_and_estimate}</p>
        </div>
        <div>
          <div className="text-[12px] font-medium text-ink">Ожидаемый эффект</div>
          <p className="text-[13px] leading-relaxed text-muted">{proposal.expected_effect}</p>
        </div>
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}

      {(isPrepared || canEdit) && (
        <Button
          variant={isPrepared ? 'secondary' : 'ai'}
          size="sm"
          disabled={isPrepared || preparing}
          onClick={handleClick}
          className="mt-1 self-start"
        >
          {isPrepared && (
            <>
              <Check size={14} />
              Задача подготовлена
            </>
          )}
          {!isPrepared && (preparing ? 'Готовим задачу…' : 'Подготовить задачу')}
        </Button>
      )}
    </div>
  )
}
