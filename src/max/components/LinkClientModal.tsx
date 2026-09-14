import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import * as clientsApi from '@/clients/api'
import { Client } from '@/clients/types'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

/** Обратная привязка: выбор клиента, к которому привязывается открытый чат MAX. */
export function LinkClientModal({
  chatId,
  open,
  onClose,
  onLinked,
}: {
  chatId: number
  open: boolean
  onClose: () => void
  onLinked: () => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setError(null)
    setLoading(true)
    clientsApi
      .listClients()
      .then(setClients)
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов'))
      .finally(() => setLoading(false))
  }, [open])

  const q = query.trim().toLowerCase()
  const visible = clients.filter((c) => {
    if (!q) return true
    return [c.full_name, c.phone, c.email].filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  async function pick(client: Client) {
    setLinkingId(client.id)
    setError(null)
    try {
      await clientsApi.setMaxChat(client.id, chatId)
      onLinked()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось привязать клиента')
    } finally {
      setLinkingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Привязать чат к клиенту" width="max-w-xl">
      <div className="flex flex-col gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени, телефону, email…" />
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {loading && <p className="py-6 text-center text-[13px] text-muted">Загрузка клиентов…</p>}
          {!loading && visible.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted">Клиенты не найдены</p>
          )}
          {visible.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => pick(client)}
              disabled={linkingId !== null}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:bg-surface-muted disabled:opacity-50"
            >
              <User size={16} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{client.full_name}</span>
                <span className="block truncate text-[12px] text-muted">{client.phone}</span>
              </span>
              {linkingId === client.id && <span className="text-[12px] text-muted">…</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
