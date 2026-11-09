import { useEffect, useState } from 'react'
import { Download, History, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'

type Checkpoint = { format: 'durov-integrity-v1'; sequence: number; event_hash: string; genesis_hash: string }
type Verification = {
  state: 'consistent' | 'broken' | 'empty' | 'checkpoint_mismatch'; checked_events: number; problem_sequence?: number
  checkpoint?: Checkpoint; independent_checkpoint?: string
  protection: { state: 'active' | 'incomplete' | 'unavailable'; covered_tables: string[]; missing_controls: string[] }
}
type Entry = { sequence: number; entity: string; entity_key: string; action: string; event_hash: string; occurred_at?: string;
  actor?: { kind: string; id?: number; name?: string }; references: { table: string; target_column: string; value: unknown }[] }
type Feed = { items: Entry[]; next_before: number | null }
const labels: Record<string, string> = {
  users: 'Сотрудник', user_module_access: 'Права доступа', file_assets: 'Документ', clients: 'Клиент', client_notes: 'Заметка о клиенте',
  crm_entities: 'Запись CRM', crm_events: 'Событие CRM', costing_settings: 'Правила расчёта', costing_materials: 'Цена материала',
  costing_items: 'Изделие и комплектация', costing_estimates: 'Расчёт', costing_revisions: 'Версия расчёта', costing_audit: 'Событие расчёта',
  costing_price_versions: 'Версия цен', costing_order_links: 'Основание заказа', sales_orders: 'Заказ покупателя', sales_shipments: 'Отгрузка',
  sales_events: 'Событие продажи', supplier_orders: 'Заказ поставщику', supplies: 'Поставка', supply_lines: 'Строка поставки', suppliers: 'Поставщик',
  supplier_price_items: 'Цена поставщика', purchase_receipts: 'Приёмка', purchase_returns: 'Возврат поставщику', warehouse_materials: 'Складская позиция',
  warehouse_operations: 'Операция склада', stock_documents: 'Складской документ', stock_movements: 'Движение товара', stock_reservations: 'Резерв',
  stock_reservation_events: 'Изменение резерва', productions: 'Производство', production_blocks: 'Этап производства', block_materials: 'Материал этапа',
  material_requests: 'Заявка на выдачу', house_technical_cards: 'Техкарта дома', local_recipes: 'Техкарта', manufacture_runs: 'Выпуск изделия',
  organizations: 'Организация', bank_accounts: 'Банковский счёт', counterparties: 'Контрагент', money_movements: 'Денежная операция',
  production_stage_templates: 'Шаблон производства', template_blocks: 'Этап шаблона', template_block_tasks: 'Работа по шаблону',
  template_block_materials: 'Материал шаблона', ledger: 'Начало защищённой истории',
}
const actions: Record<string, string> = { INSERT: 'Добавлено', UPDATE: 'Изменено', DELETE: 'Удалено из рабочего списка', START: 'Начало записи' }
function keyLabel(value: string) {
  try { const key = JSON.parse(value); return Object.values(key).join(' · ') } catch { return value === 'genesis' ? '' : value }
}

export function IntegrityPage() {
  const [result, setResult] = useState<Verification | null>(null)
  const [feed, setFeed] = useState<Feed>({ items: [], next_before: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState('')
  const [supplied, setSupplied] = useState<Checkpoint | undefined>()
  async function check(checkpoint = supplied) {
    setBusy(true); setError(''); setResult(null)
    try {
      const [verification, history] = await Promise.all([
        apiRequest<Verification>({ section: 'integrity', path: '/verify', method: 'POST', body: checkpoint, timeoutMs: 60000 }),
        apiRequest<Feed>({ section: 'integrity', path: '/events' }),
      ])
      setResult(verification); setFeed(history); setCheckedAt(new Date().toLocaleString('ru-RU'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось проверить историю') }
    finally { setBusy(false) }
  }
  useEffect(() => { void check() }, [])
  async function compare(file?: File) {
    if (!file) return
    try {
      if (file.size > 16384) throw new Error('Выберите файл контрольной отметки, сохранённый на этом экране.')
      const value = JSON.parse(await file.text()) as Checkpoint
      if (value.format !== 'durov-integrity-v1' || !Number.isSafeInteger(value.sequence) || value.sequence < 1 ||
          !/^[0-9a-f]{64}$/.test(value.event_hash) || !/^[0-9a-f]{64}$/.test(value.genesis_hash)) throw new Error('Формат контрольной отметки не распознан.')
      setSupplied(value); await check(value)
    } catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'Не удалось открыть отметку') }
  }
  function download() {
    if (!result?.checkpoint) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.checkpoint, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `durov-history-${result.checkpoint.sequence}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function more() {
    if (!feed.next_before) return
    setBusy(true); setError('')
    try {
      const next = await apiRequest<Feed>({ section: 'integrity', path: '/events', query: { before: feed.next_before } })
      setFeed({ items: [...feed.items, ...next.items], next_before: next.next_before })
    } catch (e) { setError(e instanceof Error ? e.message : 'История недоступна') }
    finally { setBusy(false) }
  }
  const sound = result?.state === 'consistent' && result.protection.state === 'active'
  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Контроль руководителя</p>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">История и подтверждения</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Кто изменил данные, с чем связана операция и сохранилась ли история без изменений.</p></div>
      <Button variant="secondary" disabled={busy} onClick={() => void check()}><RefreshCw size={16} className={busy ? 'animate-spin' : ''} />Проверить историю</Button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger-bg p-4 text-sm text-danger">{error}</p>}
    {busy && !result && <p role="status" className="text-sm text-muted">Проверяем связи и контрольные суммы записей…</p>}
    {result && <section aria-label="Результат проверки истории" className={`rounded-2xl border p-5 sm:p-6 ${sound ? 'border-brand/30 bg-brand/5' : 'border-danger/30 bg-danger-bg'}`}>
      <div className="flex items-start gap-3"><ShieldCheck className={`shrink-0 ${sound ? 'text-brand' : 'text-danger'}`} size={26} />
        <div><h2 className="text-lg font-semibold text-ink">{sound ? 'Нарушений цепочки не найдено' : 'История требует проверки'}</h2>
          <p className="mt-1 text-sm text-muted">{result.state === 'broken' ? `Нарушение в записи №${result.problem_sequence}.` : result.state === 'checkpoint_mismatch' ? 'Сохранённая ранее отметка не совпадает с текущей историей.' : result.state === 'empty' ? 'История ещё не начата.' : `Проверено записей: ${result.checked_events.toLocaleString('ru-RU')}.`}</p>
          <p className="mt-2 text-xs text-muted">Проверка выполнена: {checkedAt}. Подтверждение достоверности документов выполняют ответственные сотрудники.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-surface p-4"><p className="text-sm font-medium text-ink">Запись изменений</p><p className="mt-1 text-sm text-muted">{result.protection.state === 'active' ? `Включена для ${result.protection.covered_tables.length} групп данных.` : 'Защита базы недоступна или включена не полностью.'}</p></div>
        <div className="rounded-xl bg-surface p-4"><p className="text-sm font-medium text-ink">Сравнение с отдельной копией</p><p className="mt-1 text-sm text-muted">{result.independent_checkpoint === 'matches_supplied_checkpoint' ? `Совпадает с загруженной отметкой №${supplied?.sequence}.` : 'Загрузите ранее сохранённую контрольную отметку. Без неё нельзя исключить полную замену истории на сервере.'}</p></div></div>
      {sound && <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="secondary" onClick={download}><Download size={16} />Сохранить контрольную отметку</Button></div>}
    </section>}
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-ink">Независимая проверка</h2><p className="mt-1 max-w-2xl text-sm text-muted">Храните отметку отдельно от сервера. Автоматическое внешнее хранение пока не подключено.</p></div>
        <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-sm text-ink ${busy ? 'pointer-events-none opacity-50' : ''}`}><Upload size={16} />Сравнить с сохранённой отметкой<input aria-label="Загрузить контрольную отметку" type="file" accept="application/json,.json" disabled={busy} className="sr-only" onChange={event => { void compare(event.target.files?.[0]); event.target.value = '' }} /></label></div>
      <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted">Это журнал с контролем целостности. Он не является распределённым блокчейном и не заменяет согласования Ильи, Татьяны и руководителя. Исторические данные до включения журнала не считаются проверенными.</p>
    </section>
    <section className="overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Последние изменения">
      <div className="flex items-center gap-2 border-b border-border p-5"><History size={19} className="text-brand" /><h2 className="font-semibold text-ink">Последние изменения</h2></div>
      {!feed.items.length && <p className="p-5 text-sm text-muted">Записи пока не загружены.</p>}
      <ol className="divide-y divide-border">{feed.items.map(entry => <li key={entry.sequence} className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-medium text-ink">{labels[entry.entity] ?? entry.entity} {keyLabel(entry.entity_key) ? `№${keyLabel(entry.entity_key)}` : ''}</h3><span className="text-xs text-muted">Запись №{entry.sequence}</span></div>
        <p className="mt-1 text-sm text-muted">{actions[entry.action] ?? entry.action} · {entry.actor?.name ?? (entry.actor?.id ? `Учётная запись №${entry.actor.id}` : entry.action === 'START' ? 'Запуск истории' : 'Служебная операция или автор не указан')}{entry.occurred_at ? ` · ${new Date(entry.occurred_at).toLocaleString('ru-RU')}` : ''}</p>
        {!!entry.references.length && <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer py-1 text-brand">Связанные записи: {entry.references.length}</summary><ul className="mt-2 space-y-1">{entry.references.map((ref, index) => <li key={index}>{labels[ref.table] ?? ref.table} №{String(ref.value)}</li>)}</ul><p className="mt-2">Наличие связи само по себе не означает согласования документа.</p></details>}
      </li>)}</ol>
      {feed.next_before && <div className="border-t border-border p-4"><Button variant="secondary" disabled={busy} onClick={() => void more()}>Показать ещё</Button></div>}
    </section>
  </div>
}
