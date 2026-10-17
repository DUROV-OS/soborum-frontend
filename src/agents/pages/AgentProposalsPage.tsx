import { useEffect, useMemo, useState } from 'react'
import { Chip } from '@/shared/ui/Chip'
import { priorityTone } from '@/tasks/components/priorityTone'
import { stateTone } from '@/tasks/components/stateTone'
import { TaskDetailDrawer } from '@/tasks/components/TaskDetailDrawer'
import { useTasksStore } from '@/tasks/store'
import { TASK_PRIORITIES, TASK_STATES, Task } from '@/tasks/types'

const isProposal = (t: Task) => t.link_type === 'agent_proposal'

function ProposalRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const state = TASK_STATES.find((s) => s.key === task.status)?.label ?? task.status
  const priority = TASK_PRIORITIES.find((p) => p.key === task.priority)?.label ?? task.priority
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-ink/30"
    >
      <span className="text-[14px] font-medium text-ink">{task.title}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Chip tone={stateTone(task.status)}>{state}</Chip>
        <Chip tone={priorityTone(task.priority)}>{priority}</Chip>
      </span>
    </button>
  )
}

/** Предложения автономного агента (0112) — отдельно от общего борда задач. */
export function AgentProposalsPage() {
  const tasks = useTasksStore((s) => s.tasks)
  const loading = useTasksStore((s) => s.loading)
  const load = useTasksStore((s) => s.load)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    void load({ scope: 'all' })
  }, [load])

  const proposals = useMemo(() => tasks.filter(isProposal), [tasks])
  const pending = proposals.filter((t) => t.status === 'in_review')
  const decided = proposals.filter((t) => t.status !== 'in_review')
  const selected = proposals.find((t) => t.id === selectedId) ?? null

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[20px] font-medium text-ink">Предложения ИИ</h1>
        <p className="mt-1 text-[13px] text-muted">
          Что агент предлагает сделать сам и что ждёт вашего решения. В общем борде «Задач» этих карточек нет.
        </p>
      </div>

      <h2 className="mb-2 text-[14px] font-medium text-ink">Ждут решения · {pending.length}</h2>
      {loading ? (
        <p className="text-[13px] text-muted">Загружаем…</p>
      ) : pending.length === 0 ? (
        <p className="text-[13px] text-muted">Нет предложений, ожидающих решения.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {pending.map((t) => (
            <ProposalRow key={t.id} task={t} onOpen={() => setSelectedId(t.id)} />
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[14px] font-medium text-ink">Решённые · {decided.length}</summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {decided.map((t) => (
              <ProposalRow key={t.id} task={t} onOpen={() => setSelectedId(t.id)} />
            ))}
          </div>
        </details>
      )}

      <TaskDetailDrawer task={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
