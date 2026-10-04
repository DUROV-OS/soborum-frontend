import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '@/clients/components/PanelPrimitives'
import { stageLabel } from '@/clients/rules'
import { ClientStage } from '@/clients/types'
import { listReferredClients } from '../api'
import { ReferredClient } from '../types'

/** Клиенты, у которых партнёр указан в «Кто рекомендовал» (0083-c) — «чьи» они. */
export function ReferredClientsPanel({ partnerId }: { partnerId: number }) {
  const [clients, setClients] = useState<ReferredClient[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setClients(null)
    listReferredClients(partnerId)
      .then((rows) => !cancelled && setClients(rows))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов'))
    return () => {
      cancelled = true
    }
  }, [partnerId])

  return (
    <Section title={clients ? `Приведённые клиенты · ${clients.length}` : 'Приведённые клиенты'}>
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : clients === null ? (
        <p className="text-[13px] text-muted">Загрузка…</p>
      ) : clients.length === 0 ? (
        <p className="text-[13px] text-muted">
          Пока никого. Клиент появится здесь, когда в его карточке этот партнёр будет выбран в «Кто рекомендовал».
        </p>
      ) : (
        <div className="flex flex-col">
          {clients.map((c) => (
            <Link
              key={c.id}
              to={`/clients/${c.id}`}
              className="flex items-baseline justify-between border-b border-border py-2 text-[13px] last:border-0 hover:text-brand-dark"
            >
              <span className="text-ink">{c.full_name}</span>
              <span className="text-muted">
                {stageLabel(c.stage as ClientStage)} · с {new Date(c.created_at).toLocaleDateString('ru-RU')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}
