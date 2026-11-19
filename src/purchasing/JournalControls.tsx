import { Filter, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'

export type JournalFilters = { supplier_id: string; payment: string; delivery: string; date_from: string; date_to: string; sort: string }
export const emptyFilters: JournalFilters = { supplier_id: '', payment: 'all', delivery: 'all', date_from: '', date_to: '', sort: 'newest' }
export type JournalSummary = { currency: string; total: number; paid: number; pending: number; net: number; unpaid: number; overpaid: number }
export const journalMoney = (value: number, currency = 'RUB') => new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
export const journalDate = (value?: string | null) => value ? new Date(value.length === 10 ? value + 'T12:00:00+03:00' : value).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—'

export function JournalAmount({ value, target, currency, label }: {
  value: number | null
  target?: number
  currency: string
  label: string
}) {
  const progress = target && target > 0 ? Math.min(100, Math.max(0, (value ?? 0) / target * 100)) : null
  const description = progress === null ? undefined :
    `${label} — ${journalMoney(value ?? 0, currency)} из ${journalMoney(target!, currency)}`
  return <div>
    <div>{value === null ? '—' : journalMoney(value, currency)}</div>
    {progress !== null && <div role="img" aria-label={description} title={description}
      className="ml-auto mt-1 h-1 min-w-12 max-w-28 overflow-hidden rounded-full bg-danger">
      <div className="h-full bg-success" style={{ width: `${progress}%` }} />
    </div>}
  </div>
}

export function JournalControls({ query, onQuery, filters, onFilters, archive, onArchive, suppliers, receipts, expanded, onExpanded }: {
  query: string; onQuery: (value: string) => void; filters: JournalFilters; onFilters: (value: JournalFilters) => void;
  archive: string; onArchive: (value: string) => void; suppliers: { id: number; name: string }[]; receipts: boolean; expanded: boolean; onExpanded: (value: boolean) => void;
}) {
  const count = Object.entries(filters).filter(([key, value]) => key !== 'sort' && value !== '' && value !== 'all' && (!receipts || !['payment', 'delivery'].includes(key))).length + (!receipts && archive !== 'active' ? 1 : 0)
  const set = (key: keyof JournalFilters, value: string) => onFilters({ ...filters, [key]: value })
  return <div className="my-4 rounded-xl border border-border bg-surface p-3">
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" aria-expanded={expanded} onClick={() => onExpanded(!expanded)}><Filter size={16} />Фильтр{count ? ` · ${count}` : ''}</Button>
      <div className="relative min-w-[180px] flex-1"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><Input className="pl-9" aria-label="Поиск закупок" placeholder="Номер, поставщик, товар или комментарий" value={query} onChange={e => onQuery(e.target.value)} /></div>
      {<Select className="sm:!w-auto" aria-label={receipts ? 'Порядок приёмок' : 'Порядок заказов'} value={filters.sort} onChange={e => set('sort', e.target.value)}>
        <option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="number">По номеру</option>{!receipts && <><option value="supplier">По поставщику</option><option value="amount_desc">По убыванию суммы</option><option value="expected">По сроку поставки</option></>}
      </Select>}
    </div>
    {expanded && <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Поставщик"><Select value={filters.supplier_id} onChange={e => set('supplier_id', e.target.value)}><option value="">Все поставщики</option>{suppliers.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Дата документа — с"><Input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} /></Field>
      <Field label="Дата документа — по" hint="Включительно, по московскому времени"><Input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} /></Field>
      {!receipts && <>
        <Field label="Оплата"><Select value={filters.payment} onChange={e => set('payment', e.target.value)}><option value="all">Любая оплата</option><option value="unpaid">Не оплачено</option><option value="partial">Частично оплачено</option><option value="paid">Полностью оплачено</option><option value="overpaid">Есть переплата</option><option value="pending">Есть заявка на оплату</option></Select></Field>
        <Field label="Приёмка"><Select value={filters.delivery} onChange={e => set('delivery', e.target.value)}><option value="all">Любая приёмка</option><option value="ordered">Не получено</option><option value="in_transit">Частично получено / в пути</option><option value="received">Получено полностью</option><option value="overdue">Поставка просрочена</option></Select></Field>
        <Field label="Архив"><Select value={archive} onChange={e => onArchive(e.target.value)}><option value="active">Действующие</option><option value="archived">Архивные</option><option value="all">Все заказы</option></Select></Field>
      </>}
      <div><Button variant="ghost" onClick={() => { onFilters(emptyFilters); onArchive('active'); onQuery('') }}><RotateCcw size={14} />Сбросить фильтры</Button></div>
    </div>}
  </div>
}

export function JournalTotals({ rows, loading }: { rows: JournalSummary[]; loading: boolean }) {
  return <div aria-busy={loading} className={`mt-3 space-y-2 ${loading ? 'opacity-50' : ''}`}>
    {rows.map(row => <div key={row.currency} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-5">
      {[['Сумма после возвратов', row.net], ['Оплачено', row.paid], ['Осталось оплатить', row.unpaid], ['Переплата', row.overpaid], ['Заявки на оплату', row.pending]].map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-1 text-base font-semibold tabular-nums text-ink">{journalMoney(Number(value), row.currency)}</p></div>)}
    </div>)}
    {rows.length > 0 && <p className="text-xs text-muted">Итоги по всем найденным заказам. Долг и переплата считаются отдельно по каждому заказу; заявки ещё не являются оплатой.</p>}
  </div>
}
