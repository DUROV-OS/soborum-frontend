import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { useAccountingStore } from '../store'
import { COUNTERPARTY_KIND_LABEL, CounterpartyKind } from '../types'

/**
 * Подстановка контрагента из единого справочника (0081-d) с возможностью
 * завести нового прямо здесь: в выписке регулярно встречается контрагент,
 * которого в системе ещё нет, и закрывать форму ради него — лишний шаг.
 */
export function CounterpartyPicker({
  value,
  onChange,
  allowCreate = true,
}: {
  value: number | null
  onChange: (id: number | null) => void
  allowCreate?: boolean
}) {
  const counterparties = useAccountingStore((s) => s.counterparties)
  const loadCounterparties = useAccountingStore((s) => s.loadCounterparties)
  const createCounterparty = useAccountingStore((s) => s.createCounterparty)

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '', inn: '', kind: 'other' as CounterpartyKind })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!counterparties.length) void loadCounterparties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitNew() {
    if (!draft.name.trim()) {
      setError('Укажите наименование')
      return
    }
    setBusy(true)
    const result = await createCounterparty({
      name: draft.name.trim(),
      inn: draft.inn.trim() || undefined,
      kind: draft.kind,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.reason ?? 'Не удалось создать контрагента')
      return
    }
    setError(null)
    setCreating(false)
    setDraft({ name: '', inn: '', kind: 'other' })
    if (result.counterparty) onChange(result.counterparty.id)
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <Input
          placeholder="Наименование"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <div className="flex gap-2">
          <Input
            className="w-40"
            placeholder="ИНН"
            value={draft.inn}
            onChange={(e) => setDraft({ ...draft, inn: e.target.value })}
          />
          <Select
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as CounterpartyKind })}
          >
            {(Object.keys(COUNTERPARTY_KIND_LABEL) as CounterpartyKind[]).map((k) => (
              <option key={k} value={k}>
                {COUNTERPARTY_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={submitNew} disabled={busy}>
            {busy ? '…' : 'Создать'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
            Отмена
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="min-w-0 flex-1"
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">— не указан —</option>
        {counterparties.map((c) => (
          <option key={c.id} value={c.id}>
            {c.inn ? `${c.name} (ИНН ${c.inn})` : c.name}
          </option>
        ))}
      </Select>
      {allowCreate && (
        <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
          <Plus size={14} />
          Создать
        </Button>
      )}
    </div>
  )
}
