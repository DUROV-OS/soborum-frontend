import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { useWarehouseStore } from '../store'
import {
  EMPTY_LINE,
  OperationLineDraft,
  OperationLinesEditor,
  linesPayload,
  linesReady,
  localInputToIso,
  localNowInput,
} from './OperationLinesEditor'

const COPY = {
  receipt: {
    title: 'Оприходование',
    hint: 'Излишки, найденные при пересчёте остатков. Остаток на складе увеличится.',
    placeholder: 'Напр.: излишек при инвентаризации',
    submit: 'Оприходовать',
  },
  write_off: {
    title: 'Списание',
    hint: 'Брак, недостача при пересчёте, порча. Остаток на складе уменьшится.',
    placeholder: 'Напр.: брак, недостача при инвентаризации',
    submit: 'Списать',
  },
} as const

/** Оприходование / списание по итогам контроля остатков (0088-c):
 * документ из нескольких позиций, у каждой — остаток после. */
export function InventoryOperationModal({
  kind,
  onClose,
}: {
  kind: 'receipt' | 'write_off' | null
  onClose: () => void
}) {
  const materials = useWarehouseStore((s) => s.materials)
  const createInventoryOperation = useWarehouseStore((s) => s.createInventoryOperation)
  const [occurredAt, setOccurredAt] = useState(localNowInput)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<OperationLineDraft[]>([EMPTY_LINE])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (kind) {
      setOccurredAt(localNowInput())
      setNote('')
      setLines([EMPTY_LINE])
      setError(null)
    }
  }, [kind])

  if (!kind) return null
  const copy = COPY[kind]
  const sign = kind === 'receipt' ? 1 : -1
  const ready = note.trim().length > 0 && linesReady(lines, materials, sign)

  async function submit() {
    if (!kind || !ready) return
    setSaving(true)
    setError(null)
    const result = await createInventoryOperation(kind, {
      occurred_at: localInputToIso(occurredAt),
      note: note.trim(),
      lines: linesPayload(lines),
    })
    setSaving(false)
    if (result.ok) onClose()
    else setError(result.reason ?? 'Не удалось провести операцию')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!ready || saving}>
            {saving ? 'Проведение…' : copy.submit}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <p className="text-[13px] text-muted">{copy.hint}</p>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <Field label="Дата и время" required>
            <Input
              type="datetime-local"
              value={occurredAt}
              max={localNowInput()}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </Field>
          <Field label="Причина" required>
            <Input value={note} maxLength={500} placeholder={copy.placeholder} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <OperationLinesEditor materials={materials} lines={lines} onChange={setLines} sign={sign} />
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
