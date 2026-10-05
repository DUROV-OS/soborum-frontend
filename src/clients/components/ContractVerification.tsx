import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { Client, ContractDocument, FileAsset } from '../types'

const DOCUMENT_LABEL: Record<ContractDocument, string> = {
  contract: 'Договор',
  contract_appendix: 'Приложение к договору',
}

const SPREADSHEET_EXTENSIONS = ['.xls', '.xlsx', '.xlsm', '.ods', '.csv']

/** Договор ожидается PDF-файлом или сканом-изображением. Любой другой тип —
 * повод открыть вложение: на осмотре 26.09 в поле договора оказался складской
 * XLS (0084-i). Гейт это не блокирует — только предупреждает. */
function fileTypeWarning(asset: FileAsset, document: ContractDocument): string | null {
  const type = asset.content_type.toLowerCase()
  if (type === 'application/pdf' || type.startsWith('image/')) return null
  const name = asset.filename.toLowerCase()
  const isSpreadsheet =
    type.includes('spreadsheet') ||
    type.includes('ms-excel') ||
    type === 'text/csv' ||
    SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext))
  const subject = document === 'contract' ? 'Файл договора' : 'Файл приложения'
  return isSpreadsheet
    ? `${subject} — таблица, проверьте вложение`
    : `${subject} — не PDF и не скан, проверьте вложение`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU')
}

/** Статус проверки договора или приложения (0084-i): «Загружен · не
 * проверен», «Сгенерирован Мариной · не проверен» или «Проверен: кто, когда,
 * что сверено», плюс кнопка «Отметить проверенным». Проверка — отдельное
 * действие, загрузка файла её не заменяет. */
export function ContractVerification({ client, document }: { client: Client; document: ContractDocument }) {
  const verify = useClientsStore((s) => s.verifyContractDocument)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const asset = client[`${document}_file` as const]
  if (!asset) return null

  const source = client[`${document}_source` as const]
  const verifiedAt = client[`${document}_verified_at` as const]
  const verifiedBy = client[`${document}_verified_by` as const]
  const verificationNote = client[`${document}_verification_note` as const]
  const required = client[`${document}_verification_required` as const]
  const generated = source === 'generated'
  const neuter = document === 'contract_appendix'
  const notVerified = neuter ? 'не проверено' : 'не проверен'
  const typeWarning = fileTypeWarning(asset, document)

  async function submit() {
    if (!note.trim()) {
      setError('Напишите, что сверено: стороны, сумма, график оплаты, модель дома')
      return
    }
    setSaving(true)
    const result = await verify(client.id, document, note.trim())
    setSaving(false)
    if (result.ok) {
      setOpen(false)
      setNote('')
      setError(null)
    } else {
      setError(result.reason ?? 'Не удалось отметить проверку')
    }
  }

  let status: React.ReactNode
  if (generated) {
    status = (
      <span className="flex items-start gap-1.5 text-danger">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <span>
          {neuter ? 'Сгенерировано' : 'Сгенерирован'} Мариной · {notVerified}. Это черновик — стадию дальше не
          пропустит, приложите подписанный файл.
        </span>
      </span>
    )
  } else if (verifiedAt) {
    status = (
      <span className="flex items-start gap-1.5 text-success">
        <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
        <span>
          {neuter ? 'Проверено' : 'Проверен'}: {verifiedBy?.full_name ?? '—'}, {formatDate(verifiedAt)}
          {verificationNote && <span className="text-muted"> — {verificationNote}</span>}
        </span>
      </span>
    )
  } else {
    status = (
      <span className="flex items-start gap-1.5 text-warning">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <span>
          {neuter ? 'Загружено' : 'Загружен'} · {notVerified}
          {!required && (
            <span className="text-muted"> (приложен до ввода проверки — переход не блокирует, но проверьте)</span>
          )}
        </span>
      </span>
    )
  }

  return (
    <div className="text-[12px]">
      <div className="text-[11px] text-muted">{DOCUMENT_LABEL[document]}</div>
      {status}
      {typeWarning && (
        <span className="mt-1 flex items-start gap-1.5 text-warning">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{typeWarning}</span>
        </span>
      )}
      {canEdit && !generated && !verifiedAt && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 block text-[12px] text-brand-dark hover:underline"
        >
          Отметить проверенным
        </button>
      )}
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            rows={2}
            value={note}
            placeholder="Что сверено: стороны, сумма, график оплаты, модель дома"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving ? 'Сохранение…' : 'Отметить проверенным'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              disabled={saving}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}

/** Статус проверки обоих документов — под полем договора в карточке. */
export function ContractVerificationList({ client }: { client: Client }) {
  if (!client.contract_file && !client.contract_appendix_file) return null
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface-muted px-3 py-2">
      <ContractVerification client={client} document="contract" />
      <ContractVerification client={client} document="contract_appendix" />
    </div>
  )
}
