import { useState } from 'react'
import { AlertTriangle, CalendarClock, Plus } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { deadlineLabel, isOpen } from '../taskDeadline'
import { Client, ClientTask } from '../types'
import { Section } from './PanelPrimitives'
import { CloseTaskForm, CreateTaskForm, ShiftDeadlineForm } from './TaskForms'

/**
 * Задачи менеджера по клиенту (0079-d/e): что нужно сделать, к какому сроку,
 * и чем кончилась прошлая попытка. Открытые — списком сверху, закрытые — в
 * журнале, чтобы и менеджеру, и руководству было видно, почему клиент стоит
 * на стадии.
 */
export function TasksPanel({ client }: { client: Client }) {
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [creating, setCreating] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const open = client.tasks.filter(isOpen)
  const closed = client.tasks.filter((t) => !isOpen(t))

  return (
    <Section title="Задачи по клиенту">
      {open.length === 0 && !creating && (
        <p className="text-[13px] text-muted">
          Открытых задач нет. Поставьте задачу, чтобы не потерять клиента: связаться, выслать каталог,
          уточнить по ипотеке.
        </p>
      )}

      {open.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {open.map((task) => (
            <OpenTaskRow key={task.id} client={client} task={task} canEdit={canEdit} />
          ))}
        </div>
      )}

      {canEdit && !creating && (
        <Button size="sm" variant="ghost" className="mt-3" onClick={() => setCreating(true)}>
          <Plus size={14} />
          Поставить задачу
        </Button>
      )}

      {creating && (
        <div className="mt-3 rounded-md border border-border p-3">
          <CreateTaskForm client={client} onDone={() => setCreating(false)} />
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="text-[12px] text-muted hover:text-brand"
          >
            {showLog ? 'Скрыть журнал' : `Журнал закрытых задач (${closed.length})`}
          </button>
          {showLog && (
            <div className="mt-2 flex flex-col gap-2">
              {closed.map((task) => (
                <div key={task.id} className="rounded-md bg-surface-muted px-3 py-2">
                  <p className="text-[13px] text-ink">{task.title}</p>
                  <TaskLog task={task} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

function OpenTaskRow({ client, task, canEdit }: { client: Client; task: ClientTask; canEdit: boolean }) {
  const [action, setAction] = useState<'none' | 'shift' | 'close'>('none')
  const label = deadlineLabel(task.deadline)

  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        label?.overdue ? 'border-danger/40 bg-danger/5' : 'border-border bg-surface-muted'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-ink">{task.title}</p>
        {label && (
          <span
            className={`inline-flex items-center gap-1 text-[12px] ${
              label.overdue ? 'text-danger' : label.urgent ? 'text-brand-dark' : 'text-muted'
            }`}
          >
            {label.overdue ? <AlertTriangle size={12} /> : <CalendarClock size={12} />}
            {label.text}
          </span>
        )}
      </div>
      {task.description && <p className="mt-1 text-[12px] text-muted">{task.description}</p>}
      {task.blocking && (
        <p className="mt-1 text-[11px] text-muted">Блокирует перевод клиента на следующую стадию</p>
      )}
      <TaskLog task={task} />

      {canEdit && action === 'none' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setAction('shift')}>
            Перенести срок
          </Button>
          <Button size="sm" onClick={() => setAction('close')}>
            Задача выполнена
          </Button>
        </div>
      )}
      {action === 'shift' && (
        <ShiftDeadlineForm client={client} task={task} onDone={() => setAction('none')} />
      )}
      {action === 'close' && (
        <CloseTaskForm client={client} task={task} onDone={() => setAction('none')} />
      )}
    </div>
  )
}

function TaskLog({ task }: { task: ClientTask }) {
  if (task.reports.length === 0) return null
  return (
    <div className="mt-2 flex flex-col gap-1">
      {task.reports.map((report) => (
        <p key={report.id} className="text-[11px] text-muted">
          {report.kind === 'deadline_shift' ? '↻ ' : '✓ '}
          {report.comment} · {new Date(report.created_at).toLocaleDateString('ru-RU')}
        </p>
      ))}
    </div>
  )
}
