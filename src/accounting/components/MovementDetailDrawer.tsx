import { useEffect, useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { FileAsset } from '@/clients/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Drawer } from '@/shared/ui/Drawer'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { FileLink } from '@/shared/ui/FileLink'
import { useAccountingStore } from '../store'
import { MovementDocumentsField } from './MovementDocumentsField'
import {
  ASSESSMENT_LABEL,
  DIRECTION_LABEL,
  MoneyMovement,
  SOURCE_KIND_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  SUBKIND_LABEL,
} from '../types'

function money(amount: number, sign: '' | '−'): string {
  return `${sign}${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

export function MovementDetailDrawer({
  movement,
  onClose,
}: {
  movement: MoneyMovement | null
  onClose: () => void
}) {
  const changeStatus = useAccountingStore((s) => s.changeStatus)
  const update = useAccountingStore((s) => s.update)
  const remove = useAccountingStore((s) => s.remove)
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [documents, setDocuments] = useState<FileAsset[]>([])
  const [link, setLink] = useState('')
  const [savingAttachments, setSavingAttachments] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setCancelling(false)
    setReason('')
    setDocuments(movement?.documents ?? [])
    setLink(movement?.link ?? '')
    setAttachmentsError(null)
  }, [movement?.id])

  if (!movement) return null

  const id = movement.id
  const isPosted = movement.status === 'posted'
  const attachmentsEditable = movement.status === 'draft' || movement.status === 'approved'
  const sign = movement.direction === 'expense' ? '−' : ''

  async function saveAttachments() {
    setSavingAttachments(true)
    setAttachmentsError(null)
    const result = await update(id, { document_ids: documents.map((d) => d.id), link: link.trim() || null })
    setSavingAttachments(false)
    if (!result.ok) setAttachmentsError(result.reason ?? 'Не удалось сохранить вложения')
  }

  async function run(fn: () => Promise<{ ok: boolean; reason?: string }>, closeOnOk = false) {
    setBusy(true)
    const result = await fn()
    setBusy(false)
    if (result.ok) {
      setError(null)
      setCancelling(false)
      setReason('')
      if (closeOnOk) onClose()
    } else {
      setError(result.reason ?? 'Не удалось выполнить действие')
    }
  }

  return (
    <Drawer
      open={!!movement}
      onClose={onClose}
      title={`${SUBKIND_LABEL[movement.subkind]} · ${money(movement.amount, sign)}`}
      subtitle={
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={STATUS_TONE[movement.status]}>{STATUS_LABEL[movement.status]}</Chip>
          <span>{DIRECTION_LABEL[movement.direction]}</span>
          <span>·</span>
          <span>№{movement.id}</span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2">
          <Row label="Сумма" value={money(movement.amount, sign)} />
          <Row label="Налог" value={money(movement.tax, '')} />
          <Row label="Оценка" value={ASSESSMENT_LABEL[movement.assessment]} />
          <Row label="Учитывать в прибыли" value={movement.affects_profit ? 'Да' : 'Нет'} />
          <Row label="Инициатор" value={movement.initiator_name ?? `№${movement.initiator_id}`} />
          <Row label="Тип источника" value={SOURCE_KIND_LABEL[movement.source_kind]} />
          {movement.source_label && <Row label="Источник" value={movement.source_label} />}
          <Row label="Создана" value={new Date(movement.created_at).toLocaleString('ru-RU')} />
          {movement.posted_at && (
            <Row label="Проведена" value={new Date(movement.posted_at).toLocaleString('ru-RU')} />
          )}
          {movement.payment_purpose && <Row label="Назначение платежа" value={movement.payment_purpose} />}
          {movement.external_number && <Row label="Внешний номер" value={movement.external_number} />}
        </div>

        {movement.comment && (
          <div className="text-[13px]">
            <div className="text-muted">Комментарий</div>
            <div className="whitespace-pre-wrap text-ink">{movement.comment}</div>
          </div>
        )}

        {movement.status === 'cancelled' && movement.cancel_reason && (
          <div className="rounded-md border border-danger/30 bg-danger-bg/40 px-3 py-2 text-[13px]">
            <div className="text-muted">Причина отмены</div>
            <div className="text-ink">{movement.cancel_reason}</div>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <div className="mb-2 text-[13px] font-medium text-ink">Документы и ссылка</div>
          {attachmentsEditable ? (
            <div className="flex flex-col gap-3">
              <Field label="Ссылка">
                <Input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Документы">
                <MovementDocumentsField documents={documents} onChange={setDocuments} />
              </Field>
              <div>
                <Button size="sm" disabled={savingAttachments} onClick={saveAttachments}>
                  {savingAttachments ? 'Сохранение…' : 'Сохранить вложения'}
                </Button>
              </div>
              {attachmentsError && <p className="text-[12px] text-danger">{attachmentsError}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-[13px]">
              {movement.link && (
                <a
                  href={movement.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand-dark hover:underline"
                >
                  <ExternalLink size={13} />
                  {movement.link}
                </a>
              )}
              {movement.documents.map((doc) => (
                <FileLink key={doc.id} id={doc.id} filename={doc.filename} />
              ))}
              {!movement.link && movement.documents.length === 0 && (
                <span className="text-muted">Не прикреплено</span>
              )}
            </div>
          )}
        </div>

        {movement.status !== 'cancelled' && (
          <div className="border-t border-border pt-4">
            <div className="mb-2 text-[13px] font-medium text-ink">Статус</div>
            {isPosted && (
              <p className="mb-2 text-[12px] text-muted">
                Проведённая проводка не редактируется — доступна только отмена с указанием причины.
              </p>
            )}

            {cancelling ? (
              <div className="flex flex-col gap-2">
                <Field label="Причина отмены" required>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Например: ошиблись контрагентом"
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy || !reason.trim()}
                    onClick={() => run(() => changeStatus(id, 'cancelled', reason))}
                  >
                    Отменить проводку
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setCancelling(false)}>
                    Назад
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {movement.status === 'draft' && (
                  <Button size="sm" disabled={busy} onClick={() => run(() => changeStatus(id, 'approved'))}>
                    Согласовать
                  </Button>
                )}
                {movement.status === 'approved' && (
                  <Button size="sm" disabled={busy} onClick={() => run(() => changeStatus(id, 'posted'))}>
                    Провести
                  </Button>
                )}
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setCancelling(true)}>
                  Отменить
                </Button>
                {movement.status === 'draft' && isAdmin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Удалить черновик проводки? Отменить нельзя.')) run(() => remove(id), true)
                    }}
                    aria-label="Удалить черновик проводки"
                    title="Удалить черновик проводки"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Drawer>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  )
}
