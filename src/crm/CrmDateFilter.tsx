import { Field, Input } from '@/shared/ui/Field'

export type CrmDateSelection = { from: string; to: string; unknown: boolean }

export function CrmDateFilter({ dateFrom = '', dateTo = '', dateUnknown = false, onChange }: {
  dateFrom?: string
  dateTo?: string
  dateUnknown?: boolean
  onChange: (selection: CrmDateSelection) => void
}) {
  const invalid = !dateUnknown && !!dateFrom && !!dateTo && dateFrom > dateTo
  return <div className="flex flex-wrap items-end gap-3" aria-label="Фильтр по исходной дате заявки">
    <Field label="Дата заявки с">
      <Input type="date" aria-label="Дата заявки с" value={dateFrom} disabled={dateUnknown} max={dateTo || undefined}
        aria-invalid={invalid} onChange={event => onChange({ from: event.target.value, to: dateTo, unknown: false })} />
    </Field>
    <Field label="По дату включительно">
      <Input type="date" aria-label="Дата заявки по" value={dateTo} disabled={dateUnknown} min={dateFrom || undefined}
        aria-invalid={invalid} onChange={event => onChange({ from: dateFrom, to: event.target.value, unknown: false })} />
    </Field>
    <label className="flex min-h-10 items-center gap-2 text-sm">
      <input type="checkbox" checked={dateUnknown} onChange={event => onChange({ from: '', to: '', unknown: event.target.checked })} />
      Без исходной даты
    </label>
    <p className={`w-full text-xs ${invalid ? 'text-danger' : 'text-muted'}`} role={invalid ? 'alert' : undefined}>
      {invalid ? 'Дата начала не может быть позже даты окончания.' : 'Исходная дата заявки, московское время. Новые сверху; неизвестные даты в конце.'}
    </p>
  </div>
}
