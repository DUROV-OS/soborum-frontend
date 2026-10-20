import { useState } from 'react'
import { Globe } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { useClientsStore } from '../store'
import { Client } from '../types'
import { ReadRow } from './PanelPrimitives'

/**
 * Заявка с сайта (0111-b): откуда пришёл лид и что написал клиент. Пока заявка
 * не обработана, плашка подсвечена и предлагает «Взять в работу»; остальные
 * действия с лидом (задача, сообщение, смена стадии) снимают признак сами.
 * У лидов, заведённых вручную, плашки нет.
 */
export function LeadRequestPanel({ client }: { client: Client }) {
  const takeLead = useClientsStore((s) => s.takeLead)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [taking, setTaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!client.lead_source && !client.lead_message && !client.lead_unprocessed) return null

  async function take() {
    setTaking(true)
    const result = await takeLead(client.id)
    setTaking(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось взять заявку в работу')
  }

  const fresh = client.lead_unprocessed
  return (
    <div
      className={`rounded-md border p-5 ${fresh ? 'border-brand bg-brand/5 ring-1 ring-brand/30' : 'border-border bg-surface'}`}
    >
      <h3 className="mb-4 flex items-center gap-2 text-[14px] font-medium text-ink">
        <Globe size={15} className="text-brand" />
        {fresh ? 'Новая заявка с сайта' : 'Заявка с сайта'}
      </h3>
      <ReadRow label="Источник" value={client.lead_source} />
      <div className="border-b border-border py-2 text-[13px] last:border-0">
        <div className="text-muted">Обращение</div>
        <p className="mt-1 whitespace-pre-line text-ink">{client.lead_message?.trim() || 'Клиент не оставил текста'}</p>
      </div>
      {fresh && canEdit && (
        <Button size="sm" className="mt-3" onClick={take} disabled={taking}>
          {taking ? 'Сохранение…' : 'Взять в работу'}
        </Button>
      )}
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
