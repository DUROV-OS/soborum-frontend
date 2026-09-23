import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Stepper } from '@/shared/ui/Stepper'
import { useClientsStore } from '../store'
import { CLIENT_STAGES } from '../types'
import { isStageManual, nextStageOf, stageLabel } from '../rules'
import { ReadRow, Section } from '../components/PanelPrimitives'
import { DocumentPanel } from '../components/DocumentPanel'
import { SourcePanel } from '../components/SourcePanel'
import { PaymentPanel } from '../components/PaymentPanel'
import { BalancePaymentPanel } from '../components/BalancePaymentPanel'
import { NotesPanel } from '../components/NotesPanel'
import { MaxChatPanel } from '../components/MaxChatPanel'

export function ClientDetailPage() {
  const { id = '' } = useParams()
  const clientId = Number(id)
  const navigate = useNavigate()
  const clients = useClientsStore((s) => s.clients)
  const load = useClientsStore((s) => s.load)
  const advance = useClientsStore((s) => s.advance)
  const deleteClient = useClientsStore((s) => s.deleteClient)
  const level = useAccessLevel('clients')
  const canEdit = accessLevelAtLeast(level, 'edit')
  const canFull = accessLevelAtLeast(level, 'full')
  const [error, setError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (clients.length === 0) load()
  }, [clients.length, load])

  const client = clients.find((c) => c.id === clientId)

  if (!client) {
    return <p className="text-[13px] text-muted">Загрузка…</p>
  }

  const next = nextStageOf(client.stage)
  // После старта производства клиента двигает не человек, а раздел «Монтаж»
  // (0079): бэкенд такой ручной перевод всё равно отклоняет.
  const manualStage = isStageManual(client.stage)

  async function handleAdvance() {
    setAdvancing(true)
    const result = await advance(clientId)
    setAdvancing(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось перевести на следующую стадию')
  }

  async function handleDelete() {
    if (!client) return
    if (!window.confirm(`Удалить клиента «${client.full_name}»? Отменить нельзя.`)) return
    setDeleting(true)
    const result = await deleteClient(clientId)
    if (result.ok) {
      navigate('/clients', { replace: true })
      return
    }
    setDeleting(false)
    setError(result.reason ?? 'Не удалось удалить клиента')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        Все клиенты
      </Link>

      <div className="mb-6 rounded-md border border-border bg-surface p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[18px] font-medium text-ink">{client.full_name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              Клиент с {new Date(client.created_at).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:text-right">
            <AskAiButton
              domain="clients"
              contextLabel={`Клиент: ${client.full_name}`}
              contextNote={`[client_id=${client.id}, ${client.full_name}] `}
            />
            {next && canEdit && manualStage && (
              <Button size="sm" onClick={handleAdvance} disabled={advancing}>
                {advancing ? 'Переход…' : `Перевести на «${stageLabel(next)}»`}
              </Button>
            )}
            {!manualStage && (
              <p className="max-w-[260px] text-[12px] text-muted sm:text-right">
                Стадия «{stageLabel(client.stage)}» двигается сама — по ходу работ в разделе «Монтаж».
              </p>
            )}
            {canFull && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Удалить клиента"
                title="Удалить клиента"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <Stepper steps={CLIENT_STAGES} currentKey={client.stage} />
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      </div>

      <div className="flex flex-col gap-4">
        <Section title="Базовые данные">
          <ReadRow label="Телефон" value={client.phone} />
          <ReadRow label="Почта" value={client.email} />
          {client.contacts.length > 0
            ? client.contacts.map((c, i) => (
                <ReadRow key={i} label={c.messenger} value={c.contact} />
              ))
            : <ReadRow label="Способы связи" value={undefined} />}
        </Section>

        <SourcePanel client={client} />

        <DocumentPanel client={client} />
        <PaymentPanel client={client} />
        <BalancePaymentPanel client={client} />
        <NotesPanel client={client} />
        <MaxChatPanel client={client} />
      </div>
    </div>
  )
}
