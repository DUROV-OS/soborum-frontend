import { useId } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/shared/ui/Field'
import { Material } from '../types'

/** Строка документа операции склада (0088): материал + количество строкой,
 * чтобы поле можно было очистить и ввести дробь с запятой. */
export interface OperationLineDraft {
  materialId: number | null
  /** Текст в поле выбора материала — то, что набрал пользователь. */
  materialText: string
  qty: string
}

export const EMPTY_LINE: OperationLineDraft = { materialId: null, materialText: '', qty: '' }

export function parseQty(value: string): number {
  const n = Number(value.replace(',', '.').trim())
  return Number.isFinite(n) ? n : NaN
}

export function formatQty(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

function materialLabel(m: Material): string {
  return m.code ? `${m.title} · ${m.code}` : m.title
}

/** Значение для `<input type="datetime-local">` — текущее местное время. */
export function localNowInput(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** datetime-local (местное время) → ISO с часовым поясом для API. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export interface LineCheck {
  material: Material | null
  qty: number
  balanceAfter: number | null
  error: string | null
}

/** Проверка строки так же, как на сервере: материал выбран, количество > 0,
 * целое для недробного, для расхода остаток после не уходит в минус. */
export function checkLine(line: OperationLineDraft, materials: Material[], sign: 1 | -1): LineCheck {
  const material = materials.find((m) => m.id === line.materialId) ?? null
  const qty = parseQty(line.qty)
  if (!material) return { material, qty, balanceAfter: null, error: line.materialText ? 'Выберите материал из списка' : null }
  if (!line.qty.trim()) return { material, qty, balanceAfter: null, error: null }
  if (!(qty > 0)) return { material, qty, balanceAfter: null, error: 'Количество больше нуля' }
  if (!material.is_fractional && !Number.isInteger(qty)) {
    return { material, qty, balanceAfter: null, error: `Только целое количество (${material.unit})` }
  }
  const balanceAfter = material.quantity_in_stock + sign * qty
  if (balanceAfter < 0) return { material, qty, balanceAfter, error: 'Не хватает на складе' }
  return { material, qty, balanceAfter, error: null }
}

/** Все строки заполнены корректно и материал не повторяется. */
export function linesReady(lines: OperationLineDraft[], materials: Material[], sign: 1 | -1): boolean {
  const filled = lines.filter((l) => l.materialId !== null || l.materialText || l.qty)
  if (filled.length === 0) return false
  const ids = filled.map((l) => l.materialId)
  if (new Set(ids).size !== ids.length) return false
  return filled.every((l) => {
    const check = checkLine(l, materials, sign)
    return check.material && check.balanceAfter !== null && !check.error
  })
}

export function linesPayload(lines: OperationLineDraft[]) {
  return lines
    .filter((l) => l.materialId !== null && l.qty.trim())
    .map((l) => ({ warehouse_material_id: l.materialId as number, quantity: parseQty(l.qty) }))
}

export function OperationLinesEditor({
  materials,
  lines,
  onChange,
  sign,
}: {
  materials: Material[]
  lines: OperationLineDraft[]
  onChange: (lines: OperationLineDraft[]) => void
  /** +1 — приход (оприходование), −1 — расход (списание, отпуск). */
  sign: 1 | -1
}) {
  const listId = useId()
  const sorted = [...materials].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  const usedIds = lines.map((l) => l.materialId)

  function update(index: number, patch: Partial<OperationLineDraft>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function pickMaterial(index: number, text: string) {
    const match = sorted.find((m) => materialLabel(m) === text || m.code === text.trim())
    update(index, { materialText: match ? materialLabel(match) : text, materialId: match?.id ?? null })
  }

  return (
    <div className="flex flex-col gap-2">
      <datalist id={listId}>
        {sorted.map((m) => (
          <option key={m.id} value={materialLabel(m)} />
        ))}
      </datalist>
      {lines.map((line, index) => {
        const check = checkLine(line, materials, sign)
        const duplicate = line.materialId !== null && usedIds.indexOf(line.materialId) !== index
        const error = duplicate ? 'Материал уже есть в другой строке' : check.error
        return (
          <div key={index} className="rounded-md border border-border p-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                list={listId}
                placeholder="Материал — название или код"
                value={line.materialText}
                onChange={(e) => pickMaterial(index, e.target.value)}
                className="sm:flex-1"
              />
              <div className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  placeholder="Кол-во"
                  value={line.qty}
                  onChange={(e) => update(index, { qty: e.target.value })}
                  className="w-28"
                />
                <span className="w-10 text-[12px] text-muted">{check.material?.unit ?? ''}</span>
                <button
                  type="button"
                  onClick={() => onChange(lines.length > 1 ? lines.filter((_, i) => i !== index) : [EMPTY_LINE])}
                  className="rounded-pill p-2 text-muted hover:bg-surface-muted hover:text-danger"
                  aria-label="Убрать строку"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            {check.material && (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] tabular">
                <span className="text-muted">
                  На складе: {formatQty(check.material.quantity_in_stock)} {check.material.unit}
                </span>
                {check.balanceAfter !== null && (
                  <span className={check.balanceAfter < 0 ? 'font-medium text-danger' : 'font-medium text-ink'}>
                    Остаток после: {formatQty(check.balanceAfter)} {check.material.unit}
                  </span>
                )}
              </div>
            )}
            {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onChange([...lines, EMPTY_LINE])}
        className="flex items-center gap-1.5 self-start text-[13px] text-brand-dark hover:underline"
      >
        <Plus size={14} />
        Добавить строку
      </button>
    </div>
  )
}
