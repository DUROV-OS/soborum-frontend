import { RowSelectionCheckbox, type RowSelection } from '@/shared/ui/DataTable'
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Input, Select } from '@/shared/ui/Field'
import { statusLabels, type RegistryStatus, type Row } from '@/counterparties/api'

const columns = [
  ['name', 'Контрагент'],
  ['inn', 'ИНН / КПП'],
  ['phone', 'Номер телефона'],
  ['status', 'Статус'],
  ['comment', 'Комментарии'],
] as const
const filters = [
  ['name', 'Контрагент', 255],
  ['inn', 'ИНН / КПП', 32],
  ['phone', 'Номер телефона', 100],
  ['comment', 'Комментарии', 255],
] as const

export type TextFilters = Record<typeof filters[number][0], string>
export const emptyFilters: TextFilters = { name: '', inn: '', phone: '', comment: '' }
export type Sort = { key: typeof columns[number][0]; direction: 'asc' | 'desc' }
export const defaultSort: Sort = { key: 'name', direction: 'asc' }
export const statuses = Object.entries(statusLabels) as [RegistryStatus, string][]

export function RegistryFilters({ open, onOpen, values, selected, onText, onStatus, onReset }: {
  open: boolean
  onOpen: (open: boolean) => void
  values: TextFilters
  selected: RegistryStatus[]
  onText: (key: keyof TextFilters, value: string) => void
  onStatus: (status: RegistryStatus) => void
  onReset: () => void
}) {
  const count = Object.values(values).filter(value => value.trim()).length + selected.length
  return <details open={open} onToggle={event => onOpen(event.currentTarget.open)} className="rounded-md border border-border bg-surface">
    <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
      Фильтры{count > 0 && ` · ${count}`}
    </summary>
    <div className="space-y-3 border-t border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {filters.map(([key, title, length]) => <label key={key} className="space-y-1 text-[13px] font-medium">
          <span>{title}</span>
          <Input value={values[key]} maxLength={length} onChange={event => onText(key, event.target.value)} />
        </label>)}
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <legend className="text-[13px] font-medium">Статус</legend>
        {statuses.map(([key, title]) => <label key={key} className="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(key)} onChange={() => onStatus(key)} />
          {title}
        </label>)}
      </fieldset>
      {count > 0 && <button type="button" onClick={onReset} className="min-h-10 text-sm font-medium text-brand-dark underline">
        Сбросить фильтры
      </button>}
    </div>
  </details>
}

export function RegistryTable({ rows, loading, sort, onSort, cardUrl, onComment, onStatus, onArchive, selection }: {
  rows: Row[]
  selection: RowSelection
  loading: boolean
  sort: Sort
  onSort: (key: Sort['key']) => void
  cardUrl: (row: Row) => string
  onComment: (row: Row) => void
  onArchive: (row: Row) => void
  onStatus: (row: Row, status: RegistryStatus) => void
}) {
  return <div tabIndex={0} role="region" aria-label="Реестр контрагентов" aria-busy={loading}
    className="max-h-[min(65vh,680px)] overflow-auto rounded-md border border-border bg-surface focus-visible:ring-2 focus-visible:ring-brand">
    <table className="w-full min-w-[900px] table-fixed text-left text-sm">
      <colgroup>
        <col className="w-[24%]" /><col className="w-[19%]" /><col className="w-[16%]" />
        <col className="w-[21%]" /><col className="w-[20%]" />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-surface-muted shadow-sm">
        <tr>
          {columns.map(([key, label]) => {
            const active = sort.key === key
            const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
            return <th key={key} scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              className="border-b border-border px-3">
              <button type="button" onClick={() => onSort(key)} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold hover:text-brand-dark">
                {label}<Icon size={14} aria-hidden className={active ? 'text-brand-dark' : 'text-muted'} />
              </button>
            </th>
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map(row => <tr key={row.id} className={selection.keys.includes(String(row.id)) ? 'bg-brand/5' : 'hover:bg-surface-muted/60'}>
          <td className="px-3 py-1.5">
            <div className="flex items-center gap-1">
            <RowSelectionCheckbox label={row.card.name} rowKey={String(row.id)} selection={selection} />
            <Link to={cardUrl(row)} className="inline-flex min-h-8 items-center break-words font-medium text-brand-dark hover:underline">
              <span className="min-w-0 break-words">{row.card.name}</span>
            </Link>
            </div>
            {!row.active && <span className="block text-xs text-muted">В архиве</span>}
          </td>
          <td className="px-3 py-1.5 tabular-nums">{[row.card.inn, row.card.kpp].filter(Boolean).join(' / ') || '—'}</td>
          <td className="break-words px-3 py-1.5 tabular-nums">{row.phone || '—'}</td>
          <td className="px-3 py-1.5">
            {row.can_edit ? <Select aria-label={`Статус: ${row.card.name}`} className="!py-1.5"
              value={row.status ?? ''} disabled={loading} onChange={event => onStatus(row, event.target.value as RegistryStatus)}>
              {!row.status && <option value="" disabled>—</option>}
              {statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select> : row.status ? statusLabels[row.status] : '—'}
          </td>
          <td className="px-3 py-1.5">
            {row.can_edit ? <div className="flex min-w-0 items-center gap-2">
              <button type="button" aria-label={`Комментарий: ${row.card.name}`} title={row.comment}
                disabled={loading} onClick={() => onComment(row)} className="flex min-h-8 min-w-0 flex-1 items-center gap-2 text-left hover:text-brand-dark">
                <span className="min-w-0 flex-1 truncate">{row.comment || 'Добавить'}</span>
                <Pencil size={14} className="shrink-0 text-muted" aria-hidden />
              </button>
              <button type="button" aria-label={`${row.active ? 'Удалить' : 'Восстановить'}: ${row.card.name}`}
                disabled={loading} onClick={() => onArchive(row)}
                className={'min-h-11 shrink-0 rounded px-1.5 text-xs font-medium hover:underline ' +
                  (row.active ? 'text-danger' : 'text-brand-dark')}>
                {row.active ? 'Удалить' : 'Восстановить'}
              </button>
            </div> : <p className="break-words whitespace-pre-wrap">{row.comment || '—'}</p>}
          </td>
        </tr>)}
        {!rows.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted">
          {loading ? 'Загрузка…' : 'Контрагенты не найдены'}
        </td></tr>}
      </tbody>
    </table>
  </div>
}
