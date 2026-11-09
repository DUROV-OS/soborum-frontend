import { ArrowUpRight, Copy, Home, Layers, Pencil, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Item, money } from './api'

export function TemplateCards({ items, edit, quote, onView, onEdit, onCopy, onQuote }: { items: Item[]; edit: boolean; quote: boolean; onView: (item: Item) => void; onEdit: (item: Item) => void; onCopy: (item: Item) => void; onQuote: (item: Item) => void }) {
  if (!items.length) return <div className="rounded-2xl border border-dashed border-brand/30 bg-brand/5 px-5 py-12 text-center"><Home size={32} className="mx-auto text-brand" /><p className="mt-4 text-lg font-medium">Здесь будут ваши типовые изделия</p><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">Добавьте состав один раз, сохраните цену и используйте его для предложений клиентам. Для другого варианта комплектации создайте копию.</p></div>
  return <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">{items.map(item => {
    const calc = item.calculation
    return <article key={item.id} aria-label={'Типовая смета: ' + item.title} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
      <div className="flex min-h-36 items-center gap-5 bg-gradient-to-br from-brand/10 to-surface-muted px-6 py-5">
        {item.content.image ? <img src={item.content.image} alt={'Проект ' + item.title} className="h-28 w-32 rounded-xl object-contain" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-brand/10 bg-surface/80 text-brand"><Home size={40} strokeWidth={1.25} /></div>}
        <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-widest text-muted">{item.content.category || 'Типовое изделие'}{item.archived ? ' · Архив' : ''}</p><button onClick={() => onView(item)} className="mt-2 text-left text-xl font-semibold tracking-tight text-ink hover:text-brand">{item.title}</button><p className="mt-1 text-sm text-muted">{item.content.model || 'Готовый состав для ваших предложений'}</p></div>
      </div>
      <div className="space-y-5 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted">Прайсовая цена</p><p className="mt-1 text-3xl font-semibold tracking-tight">{money(calc.price)}</p></div><span className={'rounded-full px-3 py-1.5 text-xs font-medium ' + (calc.missing.length || calc.below_target ? 'bg-danger/5 text-danger' : 'bg-brand/10 text-brand')}>{calc.missing.length ? 'Нужна проверка' : calc.margin_percent == null ? 'Цена не задана' : 'Маржа ' + calc.margin_percent + '%'}</span></div>
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface-muted p-4"><div><p className="text-xs text-muted">Материалы</p><p className="mt-1 text-sm font-semibold">{money(calc.materials)}</p></div><div><p className="text-xs text-muted">Прибыль по расчёту</p><p className="mt-1 text-sm font-semibold">{money(calc.profit)}</p></div></div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span className="flex items-center gap-1.5"><Layers size={14} />{item.content.lines.length} позиций</span><span>Расчётная цена · {money(calc.recommended)}</span></div>
        <p className="text-xs leading-relaxed text-muted">Предварительный расчёт состава. Полная себестоимость и маржа проверяются в смете проекта с утверждённым месячным планом расходов.</p>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4"><Button variant="secondary" onClick={() => onView(item)}>Состав<ArrowUpRight size={15} /></Button>{edit && <><Button variant="ghost" aria-label="Изменить" onClick={() => onEdit(item)}><Pencil size={14} />Изменить</Button><Button variant="ghost" aria-label="Копия" onClick={() => onCopy(item)}><Copy size={14} />Копия</Button></>}{quote && !item.archived && <Button onClick={() => onQuote(item)}><Plus size={15} />Для клиента</Button>}</div>
      </div>
    </article>
  })}</div>
}
