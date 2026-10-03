import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import * as warehouseApi from '../api'
import { useWarehouseStore } from '../store'
import { DESTINATION_KIND_LABEL, DestinationKind, IssueSuggestions, TechcardHouse } from '../types'
import {
  EMPTY_LINE,
  OperationLineDraft,
  OperationLinesEditor,
  linesPayload,
  linesReady,
  localInputToIso,
  localNowInput,
} from './OperationLinesEditor'
import { SuggestInput } from './SuggestInput'

const KINDS: DestinationKind[] = ['object', 'workshop', 'rework', 'house']

const DESTINATION_PLACEHOLDER: Record<Exclude<DestinationKind, 'house'>, string> = {
  object: 'Напр.: объект в Солнечногорске',
  workshop: 'Напр.: Цех №2',
  rework: 'Что дорабатывается',
}

/** Отпуск на объект / в цех / на доработки / в дом без привязки к техкарте
 * (0088-d): материалы и количества вручную, обязательно — куда и кто получил. */
export function ManualIssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const materials = useWarehouseStore((s) => s.materials)
  const createManualIssue = useWarehouseStore((s) => s.createManualIssue)
  const [kind, setKind] = useState<DestinationKind>('object')
  const [destination, setDestination] = useState('')
  const [productionId, setProductionId] = useState<number | null>(null)
  const [houses, setHouses] = useState<TechcardHouse[]>([])
  const [suggestions, setSuggestions] = useState<IssueSuggestions>({ destinations: [], received_by: [] })
  const [receivedBy, setReceivedBy] = useState('')
  const [occurredAt, setOccurredAt] = useState(localNowInput)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<OperationLineDraft[]>([EMPTY_LINE])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setKind('object')
    setDestination('')
    setProductionId(null)
    setReceivedBy('')
    setNote('')
    setOccurredAt(localNowInput())
    setLines([EMPTY_LINE])
    setError(null)
    warehouseApi
      .techcardHouses(true)
      .then(setHouses)
      .catch(() => setHouses([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    warehouseApi
      .issueSuggestions(kind === 'house' ? undefined : kind)
      .then(setSuggestions)
      .catch(() => setSuggestions({ destinations: [], received_by: [] }))
  }, [open, kind])

  if (!open) return null

  const destinationOk = kind === 'house' ? productionId !== null : destination.trim().length > 0
  const ready = destinationOk && receivedBy.trim().length > 0 && linesReady(lines, materials, -1)

  async function submit() {
    if (!ready) return
    setSaving(true)
    setError(null)
    const result = await createManualIssue({
      occurred_at: localInputToIso(occurredAt),
      destination_kind: kind,
      destination: kind === 'house' ? undefined : destination.trim(),
      production_id: kind === 'house' ? productionId ?? undefined : undefined,
      received_by: receivedBy.trim(),
      note: note.trim() || undefined,
      lines: linesPayload(lines),
    })
    setSaving(false)
    if (result.ok) onClose()
    else setError(result.reason ?? 'Не удалось провести отпуск')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Отпуск на объект / в цех"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!ready || saving}>
            {saving ? 'Проведение…' : 'Отпустить'}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <p className="text-[13px] text-muted">
          Ручной расход без привязки к техкарте: нормативы производства дома не меняются.
        </p>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="Куда" required>
            <Select value={kind} onChange={(e) => setKind(e.target.value as DestinationKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {DESTINATION_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          {kind === 'house' ? (
            <Field label="Дом" required>
              <Select
                value={productionId ?? ''}
                onChange={(e) => setProductionId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Выберите дом</option>
                {houses.map((h) => (
                  <option key={h.production_id} value={h.production_id}>
                    {h.house_name}
                    {h.client_name ? ` — ${h.client_name}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label={DESTINATION_KIND_LABEL[kind]} required>
              <SuggestInput
                suggestions={suggestions.destinations}
                value={destination}
                maxLength={255}
                placeholder={DESTINATION_PLACEHOLDER[kind]}
                onChange={(e) => setDestination(e.target.value)}
              />
            </Field>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Кто получил" required>
            <SuggestInput
              suggestions={suggestions.received_by}
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
        </div>
        <Field label="Комментарий">
          <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <OperationLinesEditor materials={materials} lines={lines} onChange={setLines} sign={-1} />
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
