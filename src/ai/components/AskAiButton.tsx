import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { ChatDomain } from '../types'
import { AskAiDrawer } from './AskAiDrawer'

export function AskAiButton({
  domain,
  contextLabel,
  contextNote,
}: {
  domain: ChatDomain
  contextLabel?: string
  contextNote?: string
}) {
  // Кнопка запускает диалог с Мариной — действие, а не просмотр, поэтому
  // нужен edit на AI, а не просто любой доступ (0052-d).
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')
  const [open, setOpen] = useState(false)

  if (!canEdit) return null

  return (
    <>
      <Button variant="ai" size="sm" onClick={() => setOpen(true)}>
        <Sparkles size={14} />
        Спросить ИИ
      </Button>
      <AskAiDrawer
        open={open}
        onClose={() => setOpen(false)}
        domain={domain}
        contextLabel={contextLabel}
        contextNote={contextNote}
      />
    </>
  )
}
