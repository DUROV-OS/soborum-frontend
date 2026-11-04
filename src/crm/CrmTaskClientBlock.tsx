import { useEffect, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { CrmPhoneActions } from './CrmPhoneActions'
import type { Entry } from './api'

type Props = {
  entityId?: number | null
  /** Common-board tasks already carry the CRM task pointer; verify its canonical link before following it. */
  crmTaskId?: number | null
  boardTaskId?: number | null
  canMessage: boolean
  onOpenCRM: (entry: Entry) => void
}
const id = (value: unknown): number | null => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
const getEntry = (entryId: number) => apiRequest<Entry>({ section: 'crm', path: `/entries/${entryId}`, timeoutMs: 15000 })

export function CrmTaskClientBlock({ entityId, crmTaskId, boardTaskId, canMessage, onOpenCRM }: Props) {
  const [parent, setParent] = useState<Entry | null>(null)
  const [contacts, setContacts] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let current = true
    setParent(null); setContacts([]); setError(''); setLoading(true)
    void (async () => {
      let relatedId = id(entityId)
      if (!relatedId && id(crmTaskId)) {
        const task = await getEntry(Number(crmTaskId))
        if (!current) return
        if (task.kind !== 'task' || (boardTaskId != null && task.board_task_id !== boardTaskId)) throw new Error('Связь задачи с CRM не подтверждена. Обновите задачу.')
        relatedId = id(task.data.entity_id)
      }
      if (!relatedId) return
      const record = await getEntry(relatedId)
      if (!current) return
      if (!['deal', 'inquiry', 'contact', 'company'].includes(record.kind)) throw new Error('У задачи нет связанной карточки клиента.')
      setParent(record)
      let commercial = record
      if (record.kind === 'inquiry') {
        const linkedId = id(record.data.accepted_deal_id) || id(record.data.deal_id)
        if (linkedId) {
          const linked = await getEntry(linkedId)
          if (!current) return
          if (linked.kind === 'deal') commercial = linked
        }
      }
      const ids = new Set<number>()
      if (commercial.kind === 'deal' && Array.isArray(commercial.data.contact_ids)) {
        for (const value of commercial.data.contact_ids) { const contactId = id(value); if (contactId) ids.add(contactId) }
      }
      const companyId = id(commercial.data.company_id)
      if (!ids.size && companyId) ids.add(companyId)
      ids.delete(record.id)
      const remaining = [...ids], found: Entry[] = [], problems: string[] = []
      // A large imported deal must not create an unbounded request fan-out.
      await Promise.all(Array.from({ length: Math.min(3, remaining.length) }, async () => {
        while (current && remaining.length) {
          const next = remaining.shift()!
          try {
            const contact = await getEntry(next)
            if (['contact', 'company'].includes(contact.kind)) found.push(contact)
          } catch { problems.push('Часть контактов недоступна. Повторите загрузку.') }
        }
      }))
      if (current) { setContacts(found); if (problems.length) setError(problems[0]) }
    })().catch(() => { if (current) setError('Не удалось открыть клиента по задаче. Проверьте доступ к CRM и повторите загрузку.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [entityId, crmTaskId, boardTaskId, revision])

  const phone = (record: Entry) => {
    const value = text(record.data.phone)
    return value ? <CrmPhoneActions phone={value} name={text(record.data.contact_name) || record.name} canMessage={canMessage} />
      : <span className="text-xs text-muted">Телефон не указан</span>
  }
  const ownPhone = parent && ['contact', 'company', 'inquiry'].includes(parent.kind)
  const contactHasOwnPhone = parent && contacts.some(contact => text(contact.data.phone).replace(/\D/g, '') === text(parent.data.phone).replace(/\D/g, '') && text(parent.data.phone))

  return <section aria-label="Клиент по задаче" data-crm-task-client={parent?.id ?? ''} aria-busy={loading} className="space-y-3 rounded-lg border border-border bg-surface-muted/40 p-4">
    <h3 className="text-[13px] font-semibold">Клиент по задаче</h3>
    {loading && <p role="status" className="text-[13px] text-muted">Загрузка клиента…</p>}
    {parent && <div className="space-y-2">
      <button type="button" className="block break-words text-left text-sm font-medium text-brand hover:underline" aria-label={`Открыть CRM-карточку: ${parent.name}`} onClick={() => onOpenCRM(parent)}>{parent.name}</button>
      {ownPhone && !contactHasOwnPhone && <div className="space-y-1">
        {parent.kind === 'inquiry' && text(parent.data.contact_name) && <p className="text-[13px]">{text(parent.data.contact_name)}</p>}
        {phone(parent)}
      </div>}
      {contacts.map(contact => <div key={contact.id} className="space-y-1 border-t border-border pt-2">
        <button type="button" className="block break-words text-left text-[13px] text-brand hover:underline" aria-label={`Открыть CRM-карточку: ${contact.name}`} onClick={() => onOpenCRM(contact)}>{contact.name}</button>
        {phone(contact)}
      </div>)}
      {!loading && parent.kind === 'deal' && !contacts.length && !error && <p className="text-xs text-muted">Контакт с телефоном пока не привязан к сделке.</p>}
    </div>}
    {!loading && !parent && !error && <p className="text-[13px] text-muted">Клиент не привязан к задаче.</p>}
    {error && <div role="alert" className="space-y-2 text-[13px] text-danger"><p>{error}</p><Button size="sm" variant="secondary" onClick={() => setRevision(value => value + 1)}>Повторить загрузку клиента</Button></div>}
  </section>
}
