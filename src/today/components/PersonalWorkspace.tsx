import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { listClients } from '@/clients/api'
import { deadlineLabel, nearestOpenTask } from '@/clients/taskDeadline'
import { Client } from '@/clients/types'
import { listTasks } from '@/tasks/api'
import { TASK_STATES, Task } from '@/tasks/types'

export function PersonalWorkspace({ userId, manager, showTasks, refresh }: { userId: number; manager: boolean; showTasks: boolean; refresh: number }) {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const navigate = useNavigate()
  const canTasks = hasAccess('tasks')
  const canClients = hasAccess('clients')
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [clients, setClients] = useState<Client[] | null>(null)
  const [taskError, setTaskError] = useState(false)
  const [clientError, setClientError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setTasks(null); setTaskError(false)
    if (canTasks && showTasks) listTasks({ scope: 'mine', status: 'open' }).then((items) => {
      if (active) setTasks(items.filter((task) => task.link_type !== 'agent_proposal' && (task.responsible?.id === userId || task.assignees.some((person) => person.id === userId) || task.reviewers.some((person) => person.id === userId))))
    }).catch(() => { if (active) setTaskError(true) })
    return () => { active = false }
  }, [userId, canTasks, showTasks, refresh, retry])

  useEffect(() => {
    let active = true
    setClients(null); setClientError(false)
    if (manager && canClients) listClients().then((items) => {
      if (active) setClients(items.filter((client) => client.manager_id === userId && client.stage !== 'completed'))
    }).catch(() => { if (active) setClientError(true) })
    return () => { active = false }
  }, [manager, canClients, userId, refresh, retry])

  const sortedTasks = [...(tasks ?? [])].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
  const nextContacts = (clients ?? []).map((client) => ({ client, task: nearestOpenTask(client.tasks.filter((task) => task.assignee_ids.includes(userId))) }))
    .filter((item) => item.task !== null).sort((a, b) => (a.task?.deadline ?? '9999').localeCompare(b.task?.deadline ?? '9999'))
  const retryButton = <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 text-[13px] font-medium text-brand">Повторить</button>

  return <div className="grid gap-5 lg:grid-cols-2">
    {showTasks && <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="personal-tasks-title">
      <div className="flex items-start justify-between gap-3"><div>
        <h2 id="personal-tasks-title" className="text-[18px] font-semibold text-ink">Мои задачи</h2>
        <p className="mt-1 text-[12px] text-muted">Вы исполнитель, ответственный или проверяющий; свободные задачи не включены.</p>
      </div>{tasks && <span className="rounded-lg bg-surface-muted px-3 py-1 text-[18px] font-semibold">{tasks.length}</span>}</div>
      {!canTasks ? <p className="mt-4 text-[13px] text-muted">Доступ к задачам не назначен.</p> : taskError ? <div role="alert" className="mt-4 text-[13px] text-muted">Не удалось загрузить задачи. {retryButton}</div> : !tasks ? <p role="status" className="mt-4 text-[13px] text-muted">Загружаем задачи…</p> : sortedTasks.length === 0 ? <p className="mt-4 text-[13px] text-muted">Открытых назначенных задач нет.</p> : <ul className="mt-4 divide-y divide-border">{sortedTasks.slice(0, 5).map((task) => <li key={task.id}><button type="button" onClick={() => navigate(`/tasks?scope=mine&status=open&task=${task.id}`)} className="w-full py-3 text-left"><span className="block text-[13px] font-medium text-ink">{task.title}</span><span className="mt-1 block text-[12px] text-muted">{TASK_STATES.find((state) => state.key === task.status)?.label}{task.responsible?.id === userId ? ' · ответственный' : ''}{deadlineLabel(task.deadline) ? ` · ${deadlineLabel(task.deadline)?.text}` : ' · срок не указан'}</span></button></li>)}</ul>}
      {canTasks && <button type="button" onClick={() => navigate('/tasks?scope=mine&status=open')} className="mt-4 text-[13px] font-medium text-brand">Открыть задачи →</button>}
    </section>}
    {manager && <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="personal-clients-title">
      <div className="flex items-start justify-between gap-3"><div><h2 id="personal-clients-title" className="text-[18px] font-semibold text-ink">Мои клиенты</h2><p className="mt-1 text-[12px] text-muted">Активные клиенты, закреплённые за вами, и ваши следующие задачи по ним.</p></div>{clients && <span className="rounded-lg bg-surface-muted px-3 py-1 text-[18px] font-semibold">{clients.length}</span>}</div>
      {!canClients ? <p className="mt-4 text-[13px] text-muted">Доступ к клиентам не назначен.</p> : clientError ? <div role="alert" className="mt-4 text-[13px] text-muted">Не удалось загрузить клиентов. {retryButton}</div> : !clients ? <p role="status" className="mt-4 text-[13px] text-muted">Загружаем клиентов…</p> : clients.length === 0 ? <p className="mt-4 text-[13px] text-muted">Активных клиентов, закреплённых за вами, пока нет.</p> : nextContacts.length === 0 ? <p className="mt-4 text-[13px] text-muted">Назначенных вам открытых задач по этим клиентам нет.</p> : <ul className="mt-4 divide-y divide-border">{nextContacts.slice(0, 5).map(({ client, task }) => <li key={client.id}><button type="button" onClick={() => navigate(`/clients/${client.id}`)} className="w-full py-3 text-left"><span className="block text-[13px] font-medium text-ink">{client.full_name} · {task?.title}</span><span className="mt-1 block text-[12px] text-muted">{deadlineLabel(task?.deadline ?? null)?.text ?? 'Срок не указан'}</span></button></li>)}</ul>}
      {canClients && <button type="button" onClick={() => navigate('/crm')} className="mt-4 text-[13px] font-medium text-brand">Открыть продажи →</button>}
    </section>}
  </div>
}

