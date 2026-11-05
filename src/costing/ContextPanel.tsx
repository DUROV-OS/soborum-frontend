import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Field'
import { call, Estimate, money } from './api'

export type OrderLink = { order_id: number; order_line: number; estimate_id: number; revision: number; fresh: boolean; production_recipe_id: number | null }
export type ContextData = { title: string; estimates: Estimate[]; templates: { id: number; title: string; version: number; source_version: number | null }[]; links: OrderLink[]; order_version: number | null; can_import_recipe: boolean; order_lines: { index: number; title: string; quantity: string; price: string; material_id: number | null }[] | null }
export function ContextPanel({ kind, id }: { kind: 'client' | 'deal' | 'order' | 'recipe' | 'model' | 'product'; id: number | string }) {
  const [data, setData] = useState<ContextData | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [warehouse, setWarehouse] = useState('Склад Технология'), [revision, setRevision] = useState(0)
  const hasAccess = useAuthStore(s => s.hasAccess), cost = useAuthStore(s => s.accessLevel('costing'))
  useEffect(() => { let current = true; setData(null); setError(''); call<ContextData>('/context', 'GET', undefined, { kind, id }).then(r => { if (current) setData(r) }).catch(e => { if (current) setError(e.message) }); return () => { current = false } }, [kind, id, revision])
  const estimateLevel = useAuthStore(s=>s.accessLevel('estimates'))
  const canQuote = ['edit','full'].includes(estimateLevel), canRecipe = hasAccess('recipes')
  const target = kind === 'client' ? 'client' : kind === 'deal' ? 'deal' : kind === 'order' ? 'order' : ''
  return <section className="space-y-3 rounded-xl border border-border bg-surface p-4" aria-label="Связанные сметы и исполнение"><h3 className="text-sm font-semibold">Сметы и исполнение</h3>
    {error && <p className="text-xs text-danger">{error}</p>}
    {data && <>
      {canQuote && target && kind !== 'order' && <Link className="inline-flex rounded-full border border-brand/40 px-3 py-2 text-sm text-brand" to={`/costing?tab=estimates&${target}=${id}&new=1`}>Создать смету по этой карточке</Link>}
      {canQuote && data.order_lines?.map(line => <Link className="mr-2 inline-flex rounded-full border border-brand/40 px-3 py-2 text-sm text-brand" key={line.index} to={`/costing?tab=estimates&order=${id}&line=${line.index}&new=1`}>Рассчитать: {line.title}</Link>)}
      {data.estimates.map(estimate => <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm" key={estimate.id}><Link className="font-medium text-brand hover:underline" to={`/costing?tab=estimates&estimate=${estimate.id}`}>{estimate.number || 'Смета №' + estimate.id} · {estimate.title}</Link><span>{money(estimate.price)} · {estimate.status === 'approved' ? 'утверждена' : 'черновик'} · v{estimate.version}</span></div>)}
      {data.templates.map(template => <div className="border-t border-border pt-2 text-sm" key={template.id}>{cost !== 'none' ? <Link className="text-brand" to={`/costing/catalog/${template.id}`}>{template.title} · типовая смета</Link> : <span>{template.title} · типовая смета</span>}{kind === 'recipe' && template.source_version && <span className="ml-2 text-xs text-muted">из техкарты v{template.source_version}</span>}</div>)}
      {data.links.map(link => <div className="flex flex-wrap gap-2 border-t border-border pt-2 text-sm" key={`${link.order_id}:${link.order_line}`}>{hasAccess('sales') ? <Link className="text-brand" to={`/sales?tab=orders&order=${link.order_id}`}>Заказ №{link.order_id}, строка {link.order_line + 1}</Link> : <span>Заказ №{link.order_id}, строка {link.order_line + 1}</span>}<span>Смета №{link.estimate_id} · v{link.revision}</span><span className={link.fresh ? 'text-muted' : 'text-danger'}>{link.fresh ? 'Расчёт закреплён' : 'Нужна повторная сверка'}</span>{link.production_recipe_id && canRecipe && <Link className="text-brand" to={`/recipes?recipe=${link.production_recipe_id}`}>Производственный норматив</Link>}</div>)}
      {data.can_import_recipe && <div className="space-y-2 border-t border-border pt-3"><p className="text-xs text-muted">Материалы и изделие берутся из общей номенклатуры выбранного склада. Остатки и исходная техкарта при расчёте сохраняются.</p><Select aria-label="Склад для расчёта техкарты" value={warehouse} onChange={e => setWarehouse(e.target.value)}><option>Склад Технология</option><option>Склад ИД Групп</option></Select><Button variant="secondary" size="sm" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await call(`/integration/recipes/${id}/import`, 'POST', { warehouse, ...(data.templates[0] ? { item_version: data.templates[0].version } : {}) }); setRevision(r => r + 1) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось связать техкарту') } finally { setBusy(false) } }}>{data.templates.length ? 'Обновить состав сметы из техкарты' : 'Создать типовую смету из техкарты'}</Button></div>}
      {!data.estimates.length && !data.templates.length && !data.links.length && <p className="text-xs text-muted">Связанных расчётов пока нет.</p>}
    </>}
  </section>
}
