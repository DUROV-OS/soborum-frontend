import { FormEvent, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'

type FieldKey = 'sale_price' | 'materials' | 'labor' | 'purchase' | 'other_variable' | 'advertising' | 'realtor_percent' | 'salesperson_percent' | 'fixed_per_month' | 'planned_items'
type Result = { status: 'incomplete' | 'below_target' | 'meets_target' | 'infeasible'; missing: string[]; cost: string | null; fixed_share: string | null; realtor_fee: string | null; salesperson_fee: string | null; profit: string | null; margin_percent: string | null; markup_percent: string | null; minimum_price: string | null }
const fields: { key: FieldKey; label: string; hint?: string }[] = [
  { key: 'sale_price', label: 'Цена продажи изделия, ₽', hint: 'После скидок' },
  { key: 'materials', label: 'Материалы на изделие, ₽' },
  { key: 'labor', label: 'Работы на изделие, ₽' },
  { key: 'purchase', label: 'Закупка изделия, ₽' },
  { key: 'other_variable', label: 'Прочие расходы на изделие, ₽' },
  { key: 'advertising', label: 'Реклама на изделие, ₽', hint: 'Не включайте её повторно в другие расходы' },
  { key: 'realtor_percent', label: 'Комиссия риелтора, %', hint: 'В этом расчёте — от цены после скидок' },
  { key: 'salesperson_percent', label: 'Вознаграждение продавца, %', hint: 'В этом расчёте — от цены после скидок' },
  { key: 'fixed_per_month', label: 'Постоянные расходы за месяц, ₽' },
  { key: 'planned_items', label: 'План изделий за календарный месяц, шт.' },
]
const money = (value: string | null) => value === null ? '—' : `${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`

export function MarginPreviewPanel() {
  const [values, setValues] = useState<Record<FieldKey, string>>({ sale_price: '', materials: '', labor: '', purchase: '', other_variable: '', advertising: '', realtor_percent: '', salesperson_percent: '', fixed_per_month: '', planned_items: '' })
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setResult(null)
    try {
      const body = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() ? (key === 'planned_items' ? Number(value) : value.trim().replace(',', '.')) : null]))
      const next = await apiRequest<Result>({ section: 'clients', path: '/margin-preview', method: 'POST', body })
      setResult(next)
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось рассчитать') }
    finally { setLoading(false) }
  }
  return <details className="rounded-md border border-border bg-surface p-5">
    <summary className="cursor-pointer text-[16px] font-medium text-ink">Предварительный расчёт маржи изделия</summary>
    <p className="mt-2 text-[12px] leading-relaxed text-muted">Постоянные расходы месяца делятся на плановое число изделий. Укажите 0, если расход точно отсутствует; пустое поле означает, что данные неизвестны.</p>
    <p className="mt-2 text-[12px] leading-relaxed text-muted">Расчёт пока не сохраняется и не блокирует оформление продажи. Для защиты сделок его нужно связать с составом заказа и подтверждёнными расходами.</p>
    <form onSubmit={submit} className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-2">{fields.map(({ key, label, hint }) => <label key={key} className="text-[12px] font-medium text-ink">{label}<Input className="mt-1" inputMode={key === 'planned_items' ? 'numeric' : 'decimal'} aria-label={label} value={values[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setResult(null) }} />{hint && <span className="mt-1 block text-[11px] font-normal text-muted">{hint}</span>}</label>)}</div>
      <Button size="sm" type="submit" disabled={loading}>{loading ? 'Считаем…' : 'Рассчитать'}</Button>
    </form>
    {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
    {result && <div role="status" className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-[13px] text-ink">
      {result.status === 'incomplete' ? <p>Недостаточно данных: {result.missing.join(', ')}.</p> : <><p className="font-semibold">{result.status === 'meets_target' ? 'Маржа не ниже 35%' : result.status === 'infeasible' ? 'При таких процентах достичь 35% маржи невозможно' : 'Маржа ниже 35%'}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p>Себестоимость: {money(result.cost)}</p><p>Доля постоянных расходов: {money(result.fixed_share)}</p><p>Комиссия риелтора: {money(result.realtor_fee)}</p><p>Вознаграждение продавца: {money(result.salesperson_fee)}</p><p>Прибыль: {money(result.profit)}</p><p>Маржа: {result.margin_percent === null ? '—' : `${result.margin_percent}%`}</p><p>Наценка: {result.markup_percent === null ? '—' : `${result.markup_percent}%`}</p><p className="font-semibold">Минимальная цена при марже 35%: {money(result.minimum_price)}</p></div></>}
    </div>}
  </details>
}
