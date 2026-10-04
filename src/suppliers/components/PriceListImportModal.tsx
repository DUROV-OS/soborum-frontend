import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, FileSpreadsheet, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { useSuppliersStore } from '../store'
import { IMPORT_FIELD_LABEL, PriceListImportResult } from '../types'

export function PriceListImportModal({
  supplierId,
  open,
  onClose,
  onRequestLinkChat,
}: {
  supplierId: number
  open: boolean
  onClose: () => void
  /** Открыть диалог привязки чата MAX (для строки «срок поставки» без чата). */
  onRequestLinkChat: () => void
}) {
  const importPriceList = useSuppliersStore((s) => s.importPriceList)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PriceListImportResult | null>(null)

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
    const res = await importPriceList(supplierId, file)
    setBusy(false)
    if (res.ok && res.result) setResult(res.result)
    else setError(res.reason ?? 'Не удалось импортировать файл')
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Загрузить прайс-лист таблицей"
      width="max-w-xl"
      footer={
        result ? (
          <Button onClick={close}>Готово</Button>
        ) : (
          <Button variant="ghost" onClick={close}>
            Закрыть
          </Button>
        )
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
            Файл <span className="text-ink">.xlsx</span> или <span className="text-ink">.csv</span>: первая строка —
            заголовки. ИИ сам определит, где материал, цена, категория и срок. Строки добавляются к текущему прайсу.
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
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      )}

      {result && (
        <ImportReport
          result={result}
          supplierId={supplierId}
          onOpenTasks={() => navigate('/tasks')}
          onRequestLinkChat={() => {
            close()
            onRequestLinkChat()
          }}
        />
      )}
    </Modal>
  )
}

type FieldState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'draft'; text: string } // только для lead_time — показываем черновик

function ImportReport({
  result,
  supplierId,
  onOpenTasks,
  onRequestLinkChat,
}: {
  result: PriceListImportResult
  supplierId: number
  onOpenTasks: () => void
  onRequestLinkChat: () => void
}) {
  const aiFillCategory = useSuppliersStore((s) => s.aiFillCategory)
  const draftLeadTimeQuestion = useSuppliersStore((s) => s.draftLeadTimeQuestion)
  const sendLeadTimeQuestion = useSuppliersStore((s) => s.sendLeadTimeQuestion)
  const createBackfillTask = useSuppliersStore((s) => s.createBackfillTask)
  const supplier = useSuppliersStore((s) => s.suppliers.find((x) => x.id === supplierId))

  const map = result.column_mapping
  const foundRows: [string, string | null][] = [
    ['material', map.material],
    ['price', map.price],
    ['category', map.category],
    ['lead_time', map.lead_time],
  ]

  const [states, setStates] = useState<Record<string, FieldState>>({})
  const [draftText, setDraftText] = useState('')
  const [task, setTask] = useState<{ id: number } | 'dismissed' | null>(null)

  const set = (field: string, s: FieldState) => setStates((prev) => ({ ...prev, [field]: s }))

  async function fillCategory() {
    set('category', { kind: 'busy' })
    const res = await aiFillCategory(supplierId)
    if (!res.ok) return set('category', { kind: 'error', text: res.reason ?? 'Не удалось' })
    const tail = res.skipped ? `, не определил ${res.skipped}` : ''
    set('category', { kind: 'done', text: `проставлено ИИ: ${res.filled ?? 0}${tail}` })
  }

  async function startLeadTime() {
    if (!supplier || supplier.max_chat_id == null) {
      set('lead_time', {
        kind: 'error',
        text: 'Проставить не получится — сначала привяжите чат MAX к поставщику',
      })
      return
    }
    set('lead_time', { kind: 'busy' })
    const res = await draftLeadTimeQuestion(supplierId)
    if (!res.ok || !res.draft) return set('lead_time', { kind: 'error', text: res.reason ?? 'Не удалось' })
    setDraftText(res.draft.message)
    set('lead_time', { kind: 'draft', text: '' })
  }

  async function sendLeadTime() {
    set('lead_time', { kind: 'busy' })
    const res = await sendLeadTimeQuestion(supplierId, draftText)
    if (!res.ok) return set('lead_time', { kind: 'error', text: res.reason ?? 'Не удалось отправить' })
    set('lead_time', { kind: 'done', text: 'вопрос отправлен поставщику в MAX' })
  }

  async function makeTask() {
    const missing = result.missing_fields.filter((f) => states[f]?.kind !== 'done')
    const res = await createBackfillTask(supplierId, missing.length ? missing : result.missing_fields)
    if (res.ok && res.taskId) setTask({ id: res.taskId })
  }

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-success" />
        <span className="text-ink">
          Добавлено строк: <b>{result.imported}</b>
          {result.skipped > 0 && <span className="text-muted"> · пропущено: {result.skipped}</span>}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        {result.ai_used ? (
          <>
            <Sparkles size={13} className="text-ai-accent" /> колонки разметил ИИ
          </>
        ) : (
          <>
            <FileSpreadsheet size={13} /> {result.note || 'разметка без ИИ'}
          </>
        )}
      </div>

      <div>
        <div className="mb-1.5 font-medium text-ink">Колонки файла</div>
        <div className="flex flex-col gap-1.5">
          {foundRows.map(([field, header]) => {
            const missing = result.missing_fields.includes(field)
            const st = states[field] ?? { kind: 'idle' }
            return (
              <div key={field} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">{IMPORT_FIELD_LABEL[field]}</span>
                  {header ? (
                    <span className="text-ink">«{header}»</span>
                  ) : missing && st.kind === 'done' ? (
                    <span className="text-[12px] text-success">{st.text}</span>
                  ) : missing ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[12px] text-danger">не найдена</span>
                      {st.kind !== 'draft' && (
                        <Button
                          size="sm"
                          variant="ai"
                          disabled={st.kind === 'busy'}
                          onClick={() => (field === 'category' ? fillCategory() : startLeadTime())}
                        >
                          <Sparkles size={13} />
                          {st.kind === 'busy' ? '…' : 'Поручить ИИ'}
                        </Button>
                      )}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted">—</span>
                  )}
                </div>

                {st.kind === 'error' && (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-danger-bg px-2.5 py-1.5 text-[12px] text-danger">
                    <span>{st.text}</span>
                    {field === 'lead_time' && (!supplier || supplier.max_chat_id == null) && (
                      <Button size="sm" variant="secondary" onClick={onRequestLinkChat}>
                        Привязать чат
                      </Button>
                    )}
                  </div>
                )}

                {field === 'lead_time' && st.kind === 'draft' && (
                  <div className="rounded-md border border-border bg-surface-muted/40 p-2.5">
                    <div className="mb-1.5 text-[12px] text-muted">
                      Черновик сообщения поставщику — можно поправить перед отправкой:
                    </div>
                    <Textarea
                      rows={6}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => set('lead_time', { kind: 'idle' })}>
                        Отмена
                      </Button>
                      <Button size="sm" disabled={!draftText.trim()} onClick={sendLeadTime}>
                        Отправить в MAX
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {map.qty_breaks.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">Цена по партии</span>
              <span className="text-ink">{map.qty_breaks.map((h) => `«${h}»`).join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {result.backfill_suggested && (
        <div className="rounded-md border border-border bg-surface-muted/50 px-3 py-2.5">
          {task && task !== 'dismissed' ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">Задача «дозаполнить прайс» создана</span>
              <Button size="sm" variant="secondary" onClick={onOpenTasks}>
                Открыть задачи
              </Button>
            </div>
          ) : task === 'dismissed' ? (
            <span className="text-[12px] text-muted">Задача не создана</span>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">ИИ предлагает создать задачу дозаполнить прайс</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={makeTask}>
                  Да
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTask('dismissed')}>
                  Нет
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {result.missing_fields.length > 0 && !result.backfill_suggested && (
        <div className="flex flex-wrap gap-1.5">
          {result.missing_fields.map((f) => (
            <Chip key={f} tone="warning">
              {IMPORT_FIELD_LABEL[f] ?? f}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}
