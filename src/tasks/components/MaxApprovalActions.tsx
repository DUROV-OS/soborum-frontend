import { useState } from 'react'
import { Send } from 'lucide-react'
import { ApiError, apiRequest } from '@/shared/lib/httpClient'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { useTasksStore } from '../store'
import type { Task } from '../types'

/** Карточка агента «Сообщение в MAX» (0112): сообщение уходит только после решения администратора. */
export function isMaxProposal(task: Task): boolean {
  return task.link_type === 'agent_proposal' && task.link_meta?.scenario === 'max_send' && task.status === 'in_review'
}

export function MaxApprovalActions({ task, onDone }: { task: Task; onDone: () => void }) {
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')
  const load = useTasksStore((s) => s.load)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!isAdmin || !isMaxProposal(task)) return null

  const act = async (action: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest({ section: 'agents', path: `/autonomy/max/${task.id}/${action}`, method: 'POST' })
      await load()
      onDone()
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Не удалось выполнить действие')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <p className="text-[13px] text-muted">Сообщение ещё не отправлено. Оно уйдёт в MAX только после вашего подтверждения.</p>
      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => act('approve')}>
            <Send size={14} />
            {busy ? 'Отправляем…' : 'Да, отправить в MAX'}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
            <Send size={14} />
            Согласовать и отправить
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => (confirming ? setConfirming(false) : act('reject'))}>
          {confirming ? 'Отмена' : 'Отклонить'}
        </Button>
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
