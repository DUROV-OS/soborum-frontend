import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, House } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { Markdown } from '@/shared/ui/Markdown'
import { call, CatalogItem, Calculation, money } from './api'
import { CatalogConnections, Connection } from './CatalogConnections'

export type CatalogModel = { key: string; title: string; series: string; area_footprint_m2: number | null; area_total_m2: number | null; price_site_rub: number | null; template_count: number; technical_status: string; material_count: number }
type ItemDetail = CatalogItem & { archived: boolean; dimensions: { length: string | null; width: string | null; modules: { length: string; width: string; count: number }[] }; price_basis: string; retail_rate: string | null; model_linked: boolean; internal: boolean; packages: (CatalogItem & { quantity: string })[]; calculation?: Calculation; note?: string; connections: Connection[] }
type ModelDetail = CatalogModel & { sections: Record<string, string | null>; items: CatalogItem[]; connections: Connection[] }
const format = (value: string | number | null | undefined) => value == null || value === '' ? 'Не указано' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
const sectionTitles: Record<string, string> = { characteristics_md: 'Характеристики дома', planning_md: 'Планировка', configurations_md: 'Комплектации', modules_md: 'Модули' }
const actionClass = 'inline-flex min-h-10 items-center rounded-full border border-brand/40 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/5'

export function CatalogDetailPage() {
  const { itemId, modelKey } = useParams()
  const [item, setItem] = useState<ItemDetail | null>(null), [model, setModel] = useState<ModelDetail | null>(null), [error, setError] = useState('')
  const estimateLevel = useAuthStore(s => s.accessLevel('estimates'))
  const costingLevel = useAuthStore(s => s.accessLevel('costing'))
  useEffect(() => {
    let active = true
    setItem(null); setModel(null); setError('')
    const path = modelKey ? '/catalog/models/' + encodeURIComponent(modelKey) : '/catalog/items/' + encodeURIComponent(itemId || '')
    call<ItemDetail | ModelDetail>(path).then(r => { if (active) { if (modelKey) setModel(r as ModelDetail); else setItem(r as ItemDetail) } }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [itemId, modelKey])
  const data = model || item
  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <Link className="inline-flex items-center gap-2 text-sm text-brand hover:underline" to="/costing?tab=catalog"><ArrowLeft size={16} />Каталог и цены</Link>
    {error && <p role="alert" className="rounded-xl bg-danger/5 p-4 text-sm text-danger">{error}</p>}
    {!data && !error && <p role="status" className="py-10 text-muted">Открываем карточку…</p>}
    {data && <><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Продажи · {model ? 'Модель дома' : 'Прайсовая комплектация'}</p><h1 className="text-3xl font-semibold tracking-tight text-ink">{data.title}</h1>{item && <p className="mt-2 text-sm text-muted">{[item.code, item.category, item.model, `Версия ${item.version}`, item.archived ? 'Архив' : ''].filter(Boolean).join(' · ')}</p>}</div>{item && item.kind === 'template' && !item.archived && ['edit', 'full'].includes(estimateLevel) && <Link className={actionClass + ' bg-brand !text-white'} to={`/costing?tab=estimates&new=1&template=${item.id}`}>Создать клиентскую смету</Link>}</header>
      {item && <>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)]">{item.image && <img className="max-h-96 w-full rounded-2xl border border-border bg-surface object-contain" src={item.image} alt={`Планировка ${item.title}`} />}<section className="space-y-4 rounded-2xl border border-border bg-surface p-5"><p className="text-sm text-muted">Сохранённая прайсовая цена</p><p className="text-3xl font-semibold">{money(item.price)}</p><p className="text-sm text-muted">{item.price_basis}{item.mode === 'area' && ` · ${money(item.retail_rate)}/м² · ${format(item.area)} м²`}</p><p className={'text-sm ' + (item.available ? 'text-brand' : 'text-amber-800')}>{item.available ? 'Цена и состав заполнены' : 'Расчёт требует проверки перед предложением клиенту'}</p><dl className="grid grid-cols-2 gap-3 text-sm">{[['Площадь, м²', item.area], ['Длина, м', item.dimensions.length], ['Ширина, м', item.dimensions.width]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-medium">{format(value)}</dd></div>)}</dl></section></div>
        {!item.model_linked && <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm"><p>Эта комплектация пока не связана с моделью дома. Её состав и расчёт доступны отдельно.</p>{item.internal && ['edit', 'full'].includes(costingLevel) && <Link className="mt-2 inline-block text-brand hover:underline" to={`/costing?tab=${item.kind}&item=${item.id}`}>Указать модель в настройках комплектации →</Link>}</div>}
        {!!item.dimensions.modules?.length && <section className="rounded-xl border border-border p-4"><h2 className="font-semibold">Модули комплектации</h2><ul className="mt-3 space-y-2 text-sm">{item.dimensions.modules.map((m, i) => <li key={i}>{format(m.length)} × {format(m.width)} м · {m.count} шт.</li>)}</ul></section>}
        <CatalogConnections links={item.connections} />
        {!!item.packages.length && <section className="space-y-3"><h2 className="text-lg font-semibold">Опции в пакете</h2>{item.packages.map(p => <Link key={p.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-border p-4 text-brand hover:bg-brand/5" to={`/costing/catalog/${p.id}`}><span>{p.title} · {p.quantity} шт.</span><span>{money(p.price)} / шт.</span></Link>)}</section>}
        {item.calculation && <section className="space-y-4"><h2 className="text-lg font-semibold">Внутренний расчёт</h2><div className="grid gap-3 sm:grid-cols-3">{[['Себестоимость', money(item.calculation.cost)], ['Расчётная цена', money(item.calculation.recommended)], ['Маржа', item.calculation.margin_percent == null ? '—' : item.calculation.margin_percent + '%']].map(([label, value]) => <div className="rounded-xl bg-brand/5 p-4" key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>{!!item.calculation.missing.length && <p className="text-sm text-danger">{item.calculation.missing.join('; ')}</p>}<h3 className="font-medium">Материалы · {item.calculation.lines?.length ?? 0} позиций</h3><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-surface-muted"><tr>{['Материал', 'Ед.', 'Количество', 'Цена закупки', 'Сумма'].map(t => <th className="px-4 py-3 font-medium" key={t}>{t}</th>)}</tr></thead><tbody>{item.calculation.lines?.map(l => <tr key={l.material_id} className="border-t border-border"><td className="min-w-48 px-4 py-3">{l.name}</td><td className="p-3">{l.unit}</td><td className="p-3">{format(l.quantity)}</td><td className="whitespace-nowrap p-3">{money(l.price)}</td><td className="whitespace-nowrap p-3">{money(l.amount)}</td></tr>)}</tbody></table></div>{item.note && <details className="rounded-xl bg-surface-muted p-4"><summary className="text-sm font-medium">Примечания к расчёту</summary><p className="mt-3 whitespace-pre-wrap text-sm text-muted">{item.note}</p></details>}</section>}
      </>}
      {model && <>
        <div className="grid gap-3 sm:grid-cols-3">{[['Площадь застройки', model.area_footprint_m2 == null ? 'Не указана' : `${format(model.area_footprint_m2)} м²`], ['Общая площадь', model.area_total_m2 == null ? 'Не указана' : `${format(model.area_total_m2)} м²`], ['Цена из каталога сайта', money(model.price_site_rub == null ? null : String(model.price_site_rub))]].map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-surface p-5"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>
        <p className="text-sm text-muted">Цена сайта — справочная запись. Для предложения клиенту используйте цену связанной комплектации и сохранённую версию сметы.</p>
        <CatalogConnections links={model.connections.filter(l => l.href !== `/costing/models/${model.key}`)} />
        <section className="space-y-3"><h2 className="text-lg font-semibold">Связанные комплектации и цены</h2>{model.items.length ? model.items.map(i => <Link key={i.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-brand hover:bg-brand/5" to={`/costing/catalog/${i.id}`}><span>{i.title} · версия {i.version}</span><span>{money(i.price)} →</span></Link>) : <p className="rounded-xl bg-surface-muted p-4 text-sm text-muted">Прайсовая комплектация ещё не привязана к этому дому. Цена и материалы другой модели сюда не подставляются.</p>}</section>
        <div className="grid items-start gap-4 lg:grid-cols-2">{Object.entries(sectionTitles).map(([field, title]) => <section key={field} className="min-w-0 rounded-2xl border border-border bg-surface p-5"><h2 className="mb-3 text-base font-semibold">{title}</h2>{model.sections[field] ? <Markdown text={model.sections[field]!} className="text-sm leading-relaxed" /> : <p className="text-sm text-muted">Сведения ещё не добавлены.</p>}</section>)}</div>
      </>}
    </>}
  </div>
}

export function CatalogModels({ query }: { query: string }) {
  const [models, setModels] = useState<CatalogModel[]>([]), [error, setError] = useState('')
  useEffect(() => { let active = true; call<{ items: CatalogModel[] }>('/catalog/models').then(r => { if (active) setModels(r.items) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
  const shown = models.filter(m => m.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="space-y-4 pt-4"><div><h2 className="text-xl font-semibold">Модели домов</h2><p className="mt-1 text-sm text-muted">Откройте дом: характеристики, комплектации, проект и связанные техкарты.</p></div>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map(m => <Link key={m.key} to={`/costing/models/${m.key}`} className="space-y-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand/50 hover:bg-brand/5"><span className="flex items-center gap-2 text-lg font-semibold text-brand"><House size={19} />{m.title}</span><span className="block text-sm text-muted">{m.area_footprint_m2 == null ? 'Площадь уточняется' : `${format(m.area_footprint_m2)} м² застройки`}{m.area_total_m2 != null && ` · ${format(m.area_total_m2)} м² общая`}</span><span className="block text-xs text-muted">{m.template_count ? `${m.template_count} прайсовых комплектаций` : 'Прайсовая комплектация ещё не привязана'} · {m.technical_status === 'exact' ? 'Техкарта по модели' : m.technical_status === 'analogue' ? 'Черновик по аналогу' : 'Техкарта не заполнена'}</span><span className="block text-sm font-medium text-brand">Открыть карточку дома →</span></Link>)}</div>{!!models.length && !shown.length && <p className="text-sm text-muted">По запросу моделей не найдено.</p>}</section>
}
