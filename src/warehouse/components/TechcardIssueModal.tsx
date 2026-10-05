import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import * as warehouseApi from '../api'
import { useWarehouseStore } from '../store'
import { TechcardHouse, TechcardPreview, TechcardPreviewLine } from '../types'
import { formatQty, localInputToIso, localNowInput, parseQty } from './OperationLinesEditor'
import { SuggestInput } from './SuggestInput'

function lineState(line: TechcardPreviewLine, raw: string) {
  const qty = raw.trim() ? parseQty(raw) : 0
  let error: string | null = null
  if (Number.isNaN(qty) || qty < 0) error = 'Неверное количество'
  else if (qty > line.to_issue + 1e-9) error = `Не больше ${formatQty(line.to_issue)} по техкарте`
  else if (!line.is_fractional && !Number.isInteger(qty)) error = 'Только целое количество'
  const balanceAfter = line.in_stock - (Number.isNaN(qty) ? 0 : qty)
  return { qty, error, balanceAfter, shortage: balanceAfter < -1e-9 }
}

/** Отпуск по техкарте (0088-d): выбор дома → нормативы из КР типового проекта
 * с остатком на складе после отпуска. Пока есть нехватка — провести нельзя. */
export function TechcardIssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const issueByTechcard = useWarehouseStore((s) => s.issueByTechcard)
  const [houses, setHouses] = useState<TechcardHouse[] | null>(null)
  const [preview, setPreview] = useState<TechcardPreview | null>(null)
  const [qty, setQty] = useState<Record<number, string>>({})
  const [receivedBy, setReceivedBy] = useState('')
  const [occurredAt, setOccurredAt] = useState(localNowInput)
  const [note, setNote] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setHouses(null)
    setPreview(null)
    setReceivedBy('')
    setNote('')
    setOccurredAt(localNowInput())
    setError(null)
    warehouseApi
      .techcardHouses()
      .then(setHouses)
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить дома'))
    warehouseApi
      .issueSuggestions('house')
      .then((s) => setSuggestions(s.received_by))
      .catch(() => setSuggestions([]))
  }, [open])

  async function pickHouse(productionId: number) {
    setLoading(true)
    setError(null)
    try {
      const data = await warehouseApi.techcardPreview(productionId)
      setPreview(data)
      setQty(Object.fromEntries(data.lines.map((l) => [l.warehouse_material_id, formatQty(l.to_issue)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить техкарту')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const issuable = preview ? preview.lines.filter((l) => l.to_issue > 0) : []
  const fullyIssued = preview ? preview.lines.filter((l) => l.to_issue <= 0 && l.norm_total > 0).length : 0
  const states = new Map(issuable.map((l) => [l.warehouse_material_id, lineState(l, qty[l.warehouse_material_id] ?? '')]))
  const shortageCount = [...states.values()].filter((s) => s.shortage).length
  const hasErrors = [...states.values()].some((s) => s.error)
  const totalLines = issuable.filter((l) => (states.get(l.warehouse_material_id)?.qty ?? 0) > 0)
  const ready = !!preview && receivedBy.trim().length > 0 && shortageCount === 0 && !hasErrors && totalLines.length > 0

  async function submit() {
    if (!preview || !ready) return
    setSaving(true)
    setError(null)
    const result = await issueByTechcard(preview.production_id, {
      occurred_at: localInputToIso(occurredAt),
      received_by: receivedBy.trim(),
      note: note.trim() || undefined,
      lines: totalLines.map((l) => ({
        warehouse_material_id: l.warehouse_material_id,
        quantity: states.get(l.warehouse_material_id)!.qty,
      })),
    })
    setSaving(false)
    if (result.ok) onClose()
    else setError(result.reason ?? 'Не удалось провести отпуск')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={preview ? `Отпуск по техкарте — ${preview.house_label}` : 'Отпуск по техкарте — выберите дом'}
      width="max-w-5xl"
      footer={
        preview ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={!ready || saving}>
              {saving ? 'Проведение…' : 'Провести отпуск'}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {!preview && (
          <>
            <p className="text-[13px] text-muted">
              Техкарта — нормативы материалов из КР типового проекта, развёрнутые в производство дома. В списке —
              дома, по которым ещё не всё выдано.
            </p>
            {houses === null && !error && <p className="text-[13px] text-muted">Загрузка…</p>}
            {houses?.length === 0 && (
              <p className="text-[13px] text-muted">Нет домов с невыданными материалами по техкарте.</p>
            )}
            <div className="flex flex-col gap-2">
              {houses?.map((h) => (
                <button
                  key={h.production_id}
                  type="button"
                  disabled={loading}
                  onClick={() => pickHouse(h.production_id)}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:border-brand/40 hover:bg-surface-muted disabled:opacity-50"
                >
                  <div>
                    <div className="text-[13px] font-medium text-ink">
                      {h.house_name}
                      {h.client_name ? ` — ${h.client_name}` : ''}
                    </div>
                    {h.house_model_title && <div className="text-[12px] text-muted">{h.house_model_title}</div>}
                  </div>
                  <span className="shrink-0 text-[12px] text-muted">к отпуску: {h.positions_to_issue} поз.</span>
                </button>
              ))}
            </div>
          </>
        )}

        {preview && (
          <>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex items-center gap-1.5 self-start text-[13px] text-brand-dark hover:underline"
            >
              <ArrowLeft size={14} />
              Другой дом
            </button>
            {preview.house_model_title && (
              <p className="text-[13px] text-muted">Типовой проект: {preview.house_model_title}</p>
            )}
            {(preview.zero_norm_count > 0 || preview.unmatched_materials_count > 0) && (
              <div className="flex gap-2 rounded-md border border-warning/40 bg-warning-bg px-3 py-2 text-[12px] text-ink">
                <AlertTriangle size={16} className="shrink-0 text-warning" />
                <div>
                  Техкарта выдаётся не полностью:
                  {preview.zero_norm_count > 0 && ` у ${preview.zero_norm_count} материалов не заполнен норматив;`}
                  {preview.unmatched_materials_count > 0 &&
                    ` ${preview.unmatched_materials_count} материалов КР не сопоставлены со складом.`}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] text-muted">
                    <th className="py-2 pr-3 font-medium">Материал</th>
                    <th className="py-2 pr-3 text-right font-medium">Норматив</th>
                    <th className="py-2 pr-3 text-right font-medium">Выдано</th>
                    <th className="py-2 pr-3 text-right font-medium">В заявках</th>
                    <th className="py-2 pr-3 text-right font-medium">К отпуску</th>
                    <th className="py-2 pr-3 text-right font-medium">На складе</th>
                    <th className="py-2 text-right font-medium">Остаток после</th>
                  </tr>
                </thead>
                <tbody>
                  {issuable.map((line) => {
                    const state = states.get(line.warehouse_material_id)!
                    return (
                      <tr
                        key={line.warehouse_material_id}
                        className={`border-b border-border align-top ${state.shortage ? 'bg-danger-bg' : ''}`}
                      >
                        <td className="py-2 pr-3">
                          <div className="font-medium text-ink">{line.material_title}</div>
                          <div className="text-[12px] text-muted">
                            {[line.material_code, line.blocks.map((b) => b.block_name).join(', ')]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </td>
                        <td className="tabular py-2 pr-3 text-right">{formatQty(line.norm_total)}</td>
                        <td className="tabular py-2 pr-3 text-right">{formatQty(line.provided)}</td>
                        <td className="tabular py-2 pr-3 text-right">{formatQty(line.requested)}</td>
                        <td className="py-2 pr-3 text-right">
                          <Input
                            inputMode="decimal"
                            value={qty[line.warehouse_material_id] ?? ''}
                            onChange={(e) => setQty((prev) => ({ ...prev, [line.warehouse_material_id]: e.target.value }))}
                            className="ml-auto w-24 text-right"
                            aria-label={`К отпуску: ${line.material_title}`}
                          />
                          <div className="mt-0.5 text-[11px] text-muted">из {formatQty(line.to_issue)}</div>
                          {state.error && <div className="mt-0.5 text-[11px] text-danger">{state.error}</div>}
                        </td>
                        <td className="tabular py-2 pr-3 text-right">
                          {formatQty(line.in_stock)} {line.unit}
                        </td>
                        <td
                          className={`tabular py-2 text-right text-[15px] font-semibold ${
                            state.shortage ? 'text-danger' : 'text-ink'
                          }`}
                        >
                          {formatQty(state.balanceAfter)} {line.unit}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
              <span className={shortageCount > 0 ? 'font-medium text-danger' : 'text-muted'}>
                Позиций с нехваткой: {shortageCount}
                {shortageCount > 0 && ' — уменьшите количество, чтобы провести отпуск'}
              </span>
              {fullyIssued > 0 && <span className="text-muted">Уже выдано полностью: {fullyIssued} поз.</span>}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Кто получил" required>
                <SuggestInput
                  suggestions={suggestions}
                  value={receivedBy}
                  maxLength={255}
                  placeholder="ФИО ответственного"
                  onChange={(e) => setReceivedBy(e.target.value)}
                />
              </Field>
              <Field label="Дата и время" required>
                <Input
                  type="datetime-local"
                  value={occurredAt}
                  max={localNowInput()}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </Field>
              <Field label="Комментарий">
                <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </>
        )}
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
