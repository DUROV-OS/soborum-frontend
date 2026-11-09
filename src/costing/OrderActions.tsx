import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Access, call, Estimate, money } from './api'
import { ContextData, ContextPanel, OrderLink } from './ContextPanel'
import { OrderJourney } from '@/sales/OrderJourney'

export function OrderActions({ estimate, access, onChanged }: { estimate: Estimate; access: Access; onChanged: () => Promise<void> }) {
  const level = useAuthStore(s => s.accessLevel), hasAccess = useAuthStore(s => s.hasAccess)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [newOrder, setNewOrder] = useState(false)
  const [catalog, setCatalog] = useState<{ counterparties: { id: number; name: string; active: boolean }[]; organizations: { id: number; name: string }[] }>({ counterparties: [], organizations: [] })
  const [buyer, setBuyer] = useState(''), [organization, setOrganization] = useState(''), [recipeId, setRecipeId] = useState<number | null>(null)
  const context = estimate.context
  const [journey, setJourney] = useState(false)
  const canSales = ['edit', 'full'].includes(level('sales')), canProduce = ['edit', 'full'].includes(level('production'))
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось связать расчёт') } finally { setBusy(false) } }
  const version = () => ({ version: estimate.version, request_id: crypto.randomUUID(), reason: 'Закрепление утверждённой версии сметы за исполнением' })
  return <section className="space-y-3 rounded-xl border border-border p-4"><h3 className="text-sm font-semibold">Связи с системой</h3><div className="flex flex-wrap gap-3 text-sm">
    {context?.client_id && <Link className="text-brand" to={`/clients/${context.client_id}`}>Карточка клиента №{context.client_id}</Link>}
    {context?.crm_deal_id && <Link className="text-brand" to={`/crm?tab=deal&entry=${context.crm_deal_id}`}>Сделка №{context.crm_deal_id}</Link>}
    {context?.sales_order_id && hasAccess('sales') && <Link className="text-brand" to={`/sales?tab=orders&order=${context.sales_order_id}`}>Заказ №{context.sales_order_id} · строка {(context.sales_order_line ?? 0) + 1}</Link>}
    {estimate.source?.source_recipe_id && hasAccess('recipes') && <Link className="text-brand" to={`/recipes?recipe=${estimate.source.source_recipe_id}`}>Исходная техкарта · v{estimate.source.source_recipe_version}</Link>}
    {estimate.source?.house_model_key && hasAccess('house_models') && <Link className="text-brand" to={`/house-models/${encodeURIComponent(estimate.source.house_model_key)}`}>Проект дома</Link>}
  </div>
  {access.edit && (estimate.governance?.director_approved ?? estimate.status === 'approved') && !estimate.archived && <div className="flex flex-wrap gap-2">
    {canSales && !context?.sales_order_id && <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(async () => { const data = await apiRequest<typeof catalog>({ section: 'sales', path: '/catalog' }); setCatalog(data); setNewOrder(true) })}>Создать заказ покупателя</Button>}
    {canSales && context?.sales_order_id && context.sales_order_line != null && <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(async () => { const order = await call<ContextData>('/context', 'GET', undefined, { kind: 'order', id: context.sales_order_id! }); await call(`/integration/estimates/${estimate.id}/bind-order`, 'POST', { ...version(), order_id: context.sales_order_id, order_version: order.order_version, line_index: context.sales_order_line }); await onChanged() })}>Закрепить расчёт за строкой заказа</Button>}
    {canProduce && !estimate.source?.service_only && context?.sales_order_id && context.sales_order_line != null && <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(async () => { const result = await call<{ recipe_id: number }>(`/integration/estimates/${estimate.id}/production-recipe`, 'POST', { ...version(), order_id: context.sales_order_id, line_index: context.sales_order_line }); setRecipeId(result.recipe_id); await onChanged() })}>Передать норматив в производство</Button>}
  </div>}
  {recipeId && <Link className="block text-sm text-brand" to={`/recipes?recipe=${recipeId}`}>Открыть производственный норматив №{recipeId}</Link>}
  {context?.sales_order_id && <Button variant="secondary" size="sm" onClick={() => setJourney(true)}>Открыть маршрут заказа</Button>}
  {journey && context?.sales_order_id && <Modal open title={`Маршрут заказа №${context.sales_order_id}`} width="max-w-3xl" onClose={() => setJourney(false)}><OrderJourney orderId={context.sales_order_id} /></Modal>}
  {context?.sales_order_id && hasAccess('sales') && <ContextPanel key={`${estimate.version}:${recipeId}`} kind="order" id={context.sales_order_id} />}
  {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  {newOrder && <Modal open title="Заказ из утверждённой сметы" onClose={() => setNewOrder(false)}><div className="space-y-4"><p className="text-sm">{estimate.title} · {money(estimate.price)}. Изделие берётся из общей номенклатуры. Будет создан черновик заказа с закреплённой версией расчёта.</p><Field label="Покупатель"><Select aria-label="Покупатель" value={buyer} onChange={e => setBuyer(e.target.value)}><option value="">Выберите существующего покупателя</option>{catalog.counterparties.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Организация"><Select aria-label="Организация" value={organization} onChange={e => setOrganization(e.target.value)}><option value="">Выберите организацию</option>{catalog.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field><Button disabled={busy || !buyer || !organization} onClick={() => run(async () => { const result = await call<OrderLink>(`/integration/estimates/${estimate.id}/create-order`, 'POST', { ...version(), counterparty_id: Number(buyer), organization_id: Number(organization) }); setNewOrder(false); await onChanged(); if (!result.order_id) throw new Error('Заказ не создан') })}>Создать связанный заказ</Button></div></Modal>}
  </section>
}
