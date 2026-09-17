import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip, ChipTone } from '@/shared/ui/Chip'
import { Modal } from '@/shared/ui/Modal'
import { findNode } from '../lib/tree'
import { useBoardStore } from '../store'
import { BoardNodeColor } from '../types'

export const STATUS_LABEL: Record<BoardNodeColor, string> = {
  green: 'В порядке',
  yellow: 'Требует внимания',
  red: 'Критично',
}

const STATUS_TONE: Record<BoardNodeColor, ChipTone> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
}

export function NodePopover() {
  const nodeId = useBoardStore((s) => s.popoverNodeId)
  const tree = useBoardStore((s) => s.tree)
  const closePopover = useBoardStore((s) => s.closePopover)
  const openProposal = useBoardStore((s) => s.openProposal)
  const canEdit = accessLevelAtLeast(useAccessLevel('board'), 'edit')

  const node = nodeId !== null && tree ? findNode(tree, nodeId) : null
  const text = node?.summary || node?.description
  const paragraphs = text ? text.split(/\n{2,}/) : []

  return (
    <Modal
      open={node !== null}
      onClose={closePopover}
      title={node?.title ?? ''}
      footer={canEdit ? <Button onClick={() => node && openProposal(node.id)}>Внести изменения</Button> : undefined}
    >
      {node && (
        <>
          <Chip tone={STATUS_TONE[node.color]}>{STATUS_LABEL[node.color]}</Chip>
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, i) => (
              <p key={i} className="mt-3 text-[13px] leading-relaxed text-ink">
                {paragraph}
              </p>
            ))
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-ink">Описание пока не заполнено.</p>
          )}
        </>
      )}
    </Modal>
  )
}
