import { useEffect, useState } from 'react'
import { User, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as clientsApi from '@/clients/api'
import { CreateClientInitial, CreateClientModal } from '@/clients/components/CreateClientModal'
import { Client } from '@/clients/types'
import * as partnersApi from '@/partners/api'
import { PartnerFormInitial, PartnerFormModal } from '@/partners/components/PartnerFormModal'
import { Partner } from '@/partners/types'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { formatPhone } from '../phone'
import { MaxDialogPeer } from '../types'

/** Название привязки чата, созданного вместе с клиентом из MAX (0099). */
const NEW_CLIENT_LINK_LABEL = 'С клиентом'
/** Название привязки чата, созданного вместе с партнёром из MAX (0105). */
const NEW_PARTNER_LINK_LABEL = 'С партнёром'

/** Способ связи MAX для новой карточки из личного диалога: номер, а без него
 * имя собеседника в MAX (общее для клиента и партнёра, 0099/0105). */
function maxContactFromPeer(peer: MaxDialogPeer, title: string | null): { name: string; phone: string; contact: string } {
  const name = peer.name ?? title ?? ''
  const phone = peer.phone ? formatPhone(peer.phone) : ''
  const contact = phone || name
  return { name, phone, contact }
}

/** Данные для формы «Новый клиент» из личного диалога (0099). */
function initialClientFromChat(peer: MaxDialogPeer, title: string | null): CreateClientInitial {
  const { name, phone, contact } = maxContactFromPeer(peer, title)
  return { fullName: name, phone, contacts: contact ? [{ messenger: 'MAX', contact }] : undefined }
}

/** Данные для формы «Новый партнёр» из личного диалога (0105) — категорию и
 * город оттуда не вывести, их дозаполняет сотрудник. */
function initialPartnerFromChat(peer: MaxDialogPeer, title: string | null): PartnerFormInitial {
  const { name, phone, contact } = maxContactFromPeer(peer, title)
  return { name, phone, contacts: contact ? [{ messenger: 'MAX', contact }] : undefined }
}

/** Обратная привязка (0053): выбор клиента, к которому привязывается открытый
 * чат MAX, с указанием названия привязки (различает несколько чатов одного
 * клиента). Если чат уже привязан к другому клиенту — бэк отдаёт явный отказ
 * (409) с предложением открепить его там. */
export function LinkClientModal({
  chatId,
  peer,
  chatTitle,
  open,
  onClose,
  onLinked,
}: {
  chatId: number
  /** Собеседник личного диалога — для «Новый клиент из этого чата» (0099);
   * у группы и «Избранного» null, и кнопки нет. */
  peer: MaxDialogPeer | null
  chatTitle: string | null
  open: boolean
  onClose: () => void
  onLinked: () => void
}) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [creatingPartner, setCreatingPartner] = useState(false)
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

  /** Клиент из чата создан — сразу привязываем к нему этот чат и открываем
   * карточку. Привязка не удалась — клиент остаётся, показываем причину. */
  async function linkCreated(client: Client) {
    try {
      await clientsApi.createChatLink(client.id, chatId, NEW_CLIENT_LINK_LABEL)
      onLinked()
      onClose()
      navigate(`/clients/${client.id}`)
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'неизвестная ошибка'
      setError(`Клиент «${client.full_name}» создан, но чат к нему не привязан: ${reason}`)
    }
  }

  /** То же самое для партнёра (0105) — новая карточка сразу привязывается к
   * этому чату; если привязка не удалась (чат уже занят), партнёр остаётся
   * созданным отдельно. */
  async function linkCreatedPartner(partner: Partner) {
    try {
      await partnersApi.createChatLink(partner.id, chatId, NEW_PARTNER_LINK_LABEL)
      onLinked()
      onClose()
      navigate(`/partners/${partner.id}`)
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'неизвестная ошибка'
      setError(`Партнёр «${partner.name}» создан, но чат к нему не привязан: ${reason}`)
    }
  }

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
    <>
      <Modal open={open && !creating && !creatingPartner} onClose={onClose} title="Привязать чат" width="max-w-xl">
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
            {peer && (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setCreating(true)}>
                  <UserPlus size={14} />
                  Новый клиент из этого чата
                </Button>
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setCreatingPartner(true)}>
                  <UserPlus size={14} />
                  Новый партнёр из этого чата
                </Button>
              </div>
            )}
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
      {/* Форма клиента — вместо окна привязки, а не поверх него. */}
      {open && creating && peer && (
        <CreateClientModal
          open
          onClose={() => setCreating(false)}
          initial={initialClientFromChat(peer, chatTitle)}
          onCreated={linkCreated}
        />
      )}
      {/* Форма партнёра — то же самое (0105). */}
      {open && creatingPartner && peer && (
        <PartnerFormModal
          open
          onClose={() => setCreatingPartner(false)}
          initial={initialPartnerFromChat(peer, chatTitle)}
          onCreated={linkCreatedPartner}
        />
      )}
    </>
  )
}
