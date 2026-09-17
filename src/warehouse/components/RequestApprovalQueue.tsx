import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useTasksStore } from '@/tasks/store'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { useWarehouseStore } from '../store'

export function RequestApprovalQueue() {
  const tasks = useTasksStore((s) => s.tasks)
  const tasksLoading = useTasksStore((s) => s.loading)
  const loadTasks = useTasksStore((s) => s.load)
  const approveRequest = useWarehouseStore((s) => s.approveRequest)
  const rejectRequest = useWarehouseStore((s) => s.rejectRequest)
  const canEdit = accessLevelAtLeast(useAccessLevel('warehouse'), 'edit')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTasks({ link_type: 'warehouse_request' })
  }, [loadTasks])

  const pending = tasks.filter((t) => t.link_type === 'warehouse_request' && t.status !== 'done')

  async function decide(requestId: number, decision: 'approve' | 'reject') {
    setBusyId(requestId)
    const result = decision === 'approve' ? await approveRequest(requestId) : await rejectRequest(requestId)
    setBusyId(null)
    setError(result.ok ? null : result.reason ?? 'Не удалось обработать заявку')
    if (result.ok) loadTasks({ link_type: 'warehouse_request' })
  }

  if (tasksLoading && tasks.length === 0) {
    return <LoadingState label="Загружаем заявки…" />
  }

  if (pending.length === 0) {
    return <EmptyState title="Нет заявок на проверку" description="Все запросы материалов от производства обработаны." />
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-[12px] text-danger">{error}</p>}
      {pending.map((task) => (
        <div key={task.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
          <span className="text-[13px] text-ink">{task.title}</span>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" disabled={busyId === task.link_id} onClick={() => decide(task.link_id!, 'approve')}>
                <Check size={14} />
                Одобрить
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === task.link_id}
                onClick={() => decide(task.link_id!, 'reject')}
              >
                <X size={14} />
                Отклонить
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
