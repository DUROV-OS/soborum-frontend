import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Download, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Modal } from '@/shared/ui/Modal'
import { useAccountingStore } from '../store'
import { IMPORT_FIELD_LABEL, PaymentColumnMapping, PaymentImportResult } from '../types'

const MAPPED_FIELDS: (keyof PaymentColumnMapping)[] = [
  'amount',
  'amount_debit',
  'amount_credit',
  'direction_col',
  'doc_date',
  'counterparty',
  'tax',
  'external_number',
  'subkind',
  'payment_purpose',
]

export function ImportPaymentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importPayments = useAccountingStore((s) => s.importPayments)
  const downloadImportTemplate = useAccountingStore((s) => s.downloadImportTemplate)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PaymentImportResult | null>(null)

  function close() {
    setResult(null)
    setError(null)
    setBusy(false)
    onClose()
  }

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    setResult(null)
    const res = await importPayments(file)
    setBusy(false)
    if (res.ok && res.result) setResult(res.result)
    else setError(res.reason ?? 'Не удалось импортировать файл')
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Импорт платежей"
      width="max-w-xl"
      footer={
        result ? <Button onClick={close}>Готово</Button> : <Button variant="ghost" onClick={close}>Закрыть</Button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) handleFile(file)
        }}
      />

      {!result && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            Таблица <span className="text-ink">.xlsx</span> или <span className="text-ink">.csv</span>: первая
            строка — заголовки. ИИ сам определит, где сумма, дата, контрагент, НДС и номер документа. Каждая
            строка становится проводкой в статусе «черновик».
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-[13px] text-muted hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            <Upload size={20} />
            {busy ? 'Разбираем файл и размечаем колонки…' : 'Выбрать файл'}
          </button>
          <button
            type="button"
            onClick={() => downloadImportTemplate()}
            className="inline-flex items-center gap-1.5 self-start text-[12px] text-brand hover:underline"
          >
            <Download size={13} />
            Скачать шаблон
          </button>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      )}

      {result && <ImportReport result={result} onDone={close} />}
    </Modal>
  )
}

function ImportReport({ result, onDone }: { result: PaymentImportResult; onDone: () => void }) {
  const aiFillSubkind = useAccountingStore((s) => s.aiFillSubkind)
  const createImportBackfillTask = useAccountingStore((s) => s.createImportBackfillTask)
  const navigate = useNavigate()

  const [aiState, setAiState] = useState<'idle' | 'busy' | { done: string } | { error: string }>('idle')
  const [taskState, setTaskState] = useState<'idle' | 'busy' | { id: number } | { error: string }>('idle')

  const missing: string[] = [
    ...result.missing_fields,
    ...(result.preliminary_subkind ? ['subkind'] : []),
    ...(result.unmatched_source ? ['source'] : []),
  ].filter((v, i, a) => a.indexOf(v) === i)

  async function fillSubkind() {
    setAiState('busy')
    const res = await aiFillSubkind(result.created_ids)
    if (!res.ok) return setAiState({ error: res.reason ?? 'Не удалось' })
    const tail = res.skipped ? `, не определил ${res.skipped}` : ''
    setAiState({ done: `ИИ уточнил вид: ${res.updated ?? 0}${tail}` })
  }

  async function makeTask() {
    setTaskState('busy')
    const res = await createImportBackfillTask(result.created_ids, missing.length ? missing : ['subkind'])
    if (res.ok && res.taskId) setTaskState({ id: res.taskId })
    else setTaskState({ error: res.reason ?? 'Не удалось создать задачу' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <CheckCircle2 size={16} className="text-success" />
        <span className="text-ink">Импортировано: {result.imported}</span>
        {result.skipped > 0 && <span className="text-muted">· пропущено: {result.skipped}</span>}
        <Chip tone={result.ai_used ? 'ai' : 'neutral'}>
          {result.ai_used ? 'колонки разметил ИИ' : 'разметка по словарю'}
        </Chip>
      </div>
      {result.note && <p className="text-[12px] text-muted">{result.note}</p>}

      <div>
        <div className="mb-1.5 text-[13px] font-medium text-ink">Колонки файла</div>
        <div className="flex flex-col gap-1 text-[12px]">
          {MAPPED_FIELDS.filter((f) => result.column_mapping[f]).map((f) => (
            <div key={f} className="flex justify-between">
              <span className="text-muted">{IMPORT_FIELD_LABEL[f] ?? f}</span>
              <span className="text-ink">{result.column_mapping[f]}</span>
            </div>
          ))}
        </div>
      </div>

      {(result.preliminary_subkind > 0 || result.unmatched_source > 0) && (
        <div className="rounded-md border border-warning/40 bg-warning-bg/40 px-3 py-2 text-[12px] text-ink">
          {result.preliminary_subkind > 0 && (
            <div>Вид не задан у {result.preliminary_subkind} проводок — поставлен предварительный.</div>
          )}
          {result.unmatched_source > 0 && (
            <div>Контрагент не сопоставлен клиенту у {result.unmatched_source} проводок — без источника.</div>
          )}
        </div>
      )}

      {result.backfill_suggested && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ai"
              size="sm"
              disabled={aiState === 'busy' || !result.created_ids.length}
              onClick={fillSubkind}
            >
              <Sparkles size={14} />
              Поручить ИИ проставить вид
            </Button>
            {aiState === 'busy' && <span className="text-[12px] text-muted">ИИ разбирает назначения…</span>}
            {typeof aiState === 'object' && 'done' in aiState && (
              <span className="text-[12px] text-success">{aiState.done}</span>
            )}
            {typeof aiState === 'object' && 'error' in aiState && (
              <span className="text-[12px] text-danger">{aiState.error}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {taskState !== 'idle' && typeof taskState === 'object' && 'id' in taskState ? (
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="text-[12px] text-brand hover:underline"
              >
                Задача №{taskState.id} создана — открыть «Задачи»
              </button>
            ) : (
              <Button variant="secondary" size="sm" disabled={taskState === 'busy'} onClick={makeTask}>
                Создать задачу на дозаполнение
              </Button>
            )}
            {typeof taskState === 'object' && 'error' in taskState && (
              <span className="text-[12px] text-danger">{taskState.error}</span>
            )}
          </div>
        </div>
      )}

      <Button variant="ghost" size="sm" className="self-end" onClick={onDone}>
        Закрыть отчёт
      </Button>
    </div>
  )
}
