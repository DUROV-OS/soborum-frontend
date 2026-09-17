import { Modal } from '@/shared/ui/Modal'
import { PendingActionOut } from '../types'
import { PendingActionCard } from './PendingActionCard'

export function PendingActionModal({
  actions,
  onClose,
  onResolve,
  canAct = true,
}: {
  actions: PendingActionOut[]
  onClose: () => void
  onResolve: (id: number, decision: 'approve' | 'reject') => Promise<unknown>
  canAct?: boolean
}) {
  if (actions.length === 0) return null

  return (
    <Modal open title="Марина предлагает изменение" onClose={onClose}>
      <p className="mb-3 text-[13px] text-muted">
        Проверьте {actions.length > 1 ? 'предложенные действия' : 'предложенное действие'} и одобрите или отклоните.
      </p>
      <div className="flex flex-col gap-3">
        {actions.map((action) => (
          <PendingActionCard key={action.id} action={action} onResolve={onResolve} canAct={canAct} />
        ))}
      </div>
    </Modal>
  )
}
