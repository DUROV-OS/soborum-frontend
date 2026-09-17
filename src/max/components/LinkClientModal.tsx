import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import * as clientsApi from '@/clients/api'
import { Client } from '@/clients/types'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

/** Обратная привязка (0053): выбор клиента, к которому привязывается открытый
 * чат MAX, с указанием названия привязки (различает несколько чатов одного
 * клиента). Если чат уже привязан к другому клиенту — бэк отдаёт явный отказ
 * (409) с предложением открепить его там. */
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
  const [pendingClient, setPendingClient] = useState<Client | null>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setError(null)
    setPendingClient(null)
    setLabel('')
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

  async function confirmLink() {
    if (!pendingClient) return
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Укажите название привязки')
      return
    }
    setLinkingId(pendingClient.id)
    setError(null)
    try {
      await clientsApi.createChatLink(pendingClient.id, chatId, trimmed)
      onLinked()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось привязать клиента')
      setPendingClient(null)
    } finally {
      setLinkingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Привязать чат к клиенту" width="max-w-xl">
      {pendingClient ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink">
            Клиент «{pendingClient.full_name}» — укажите название привязки (например, «С клиентом»,
            «С помощником»):
          </p>
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Название привязки"
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmLink()
            }}
          />
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingClient(null)} disabled={linkingId !== null}>
              Назад
            </Button>
            <Button size="sm" onClick={confirmLink} disabled={linkingId !== null}>
              {linkingId !== null ? 'Привязка…' : 'Привязать'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, телефону, email…"
          />
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
                onClick={() => {
                  setPendingClient(client)
                  setLabel('')
                  setError(null)
                }}
                disabled={linkingId !== null}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:bg-surface-muted disabled:opacity-50"
              >
                <User size={16} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{client.full_name}</span>
                  <span className="block truncate text-[12px] text-muted">{client.phone}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
