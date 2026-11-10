const labels: Record<string, string> = {
  id: 'Номер записи', description: 'Описание', status: 'Статус', priority: 'Приоритет', deadline: 'Срок',
  is_overdue: 'Срок прошёл', your_role: 'Ваша роль', blocked: 'Есть незавершённые зависимости',
  blocks_open_tasks: 'Зависимых открытых задач', assignee: 'Исполнитель', reviewer: 'Проверяющий',
  assignees: 'Исполнители', reviewers: 'Проверяющие', full_name: 'Имя', high: 'Высокий', medium: 'Обычный', low: 'Низкий',
  not_ready: 'Ожидает подготовки', in_review: 'На проверке', link_type: 'Тип связи', link_id: 'Связанная запись',
  total_clients: 'Клиентов', stage_counts: 'По стадиям', status_counts: 'По статусам',
  awaiting_payment_confirmation: 'Ожидают отметки оплаты', balance_pending: 'Остаток оплаты в срок', balance_overdue: 'Просрочен остаток оплаты', balance_no_due_date: 'Срок оплаты не указан',
  new_leads_last_7_days: 'Новые лиды за 7 дней', leads_stuck_over_14_days: 'Лиды без движения более 14 дней',
  total_cycles: 'Циклов', stuck_over_14_days: 'Без перехода более 14 дней', total_installations: 'Монтажей',
  total_content_items: 'Публикаций', release_due_next_7_days: 'Публикации в ближайшие 7 дней', release_overdue: 'Просроченные публикации', acquisition: 'Привлечение клиентов',
  total_productions: 'Производств', total_blocks: 'Блоков', productions_in_work: 'Производств в работе', productions_insufficient_data: 'Не хватает данных',
  productions_needs_reconciliation: 'Нужна сверка материалов', productions_shortfall: 'Недостаточно материалов', productions_provided: 'Материалы обеспечены', productions_not_required: 'Материалы не требуются', productions_needing_attention: 'Требуют внимания',
  worst_state: 'Состояние материалов', worst_state_label: 'Оценка состояния', top_reasons: 'Основные причины', attention_productions: 'Производства с отклонениями', readiness_version: 'Методика проверки материалов', pending_material_requests: 'Ожидающие заявки',
  total_materials: 'Позиций склада', materials_needing_supply: 'Требуют пополнения или сверки', supplies_recorded_last_7_days: 'Приходов за 7 дней', top_shortage_materials: 'Позиции с нехваткой',
  total_tasks: 'Задач', open_tasks: 'Открытых задач', open_tasks_scope: 'Область задач', overdue_tasks: 'Просроченных задач', due_today: 'Срок сегодня',
  production_id: 'Производство №', production: 'Производство', materials_state: 'Материалы', materials_label: 'Состояние материалов', reasons_count: 'Количество причин', reasons: 'Причины', text: 'Описание', code: 'Причина',
  title: 'Наименование', warehouse: 'Склад', quantity_in_stock: 'Учётный остаток', threshold: 'Порог пополнения',
  signals: 'Выявленные сигналы', kind: 'Тип', block_name: 'Блок', detail: 'Основание', since: 'Дата события', days_since: 'Прошло дней', source_entity: 'Источник записи', source_id: 'Запись №',
  lead: 'Лид', discussion: 'Обсуждение', site_visit: 'Визит', approval: 'Одобрение', payment: 'Оплата', postpayment: 'Производство', acceptance: 'Приёмка', completed: 'Завершён',
  ready: 'Готова к работе', in_progress: 'В работе', review: 'На проверке', done: 'Завершена', client: 'Работа с клиентом', installation: 'Монтаж',
  insufficient_data: 'Недостаточно данных', needs_reconciliation: 'Нужна сверка', shortfall: 'Нехватка', provided: 'Обеспечено', not_required: 'Не требуется',
  mine: 'Мои задачи', all: 'Все доступные задачи', company: 'Компания', tasks: 'Задачи', material_requests: 'Заявки на материалы', block_materials: 'Материалы блока',
  overdue_task: 'Просроченная задача', pending_material_request: 'Ожидающая заявка', material_reconciliation: 'Сверка материалов', material_shortfall: 'Нехватка материалов',
  recorded_ad_spend: 'Учтённые расходы рекламы', offline_delivery_confirmed: 'Передача конверсий подтверждена', issues: 'Недостающие основания',
}
export const evidenceLabel = (key: string) => labels[key] ?? key.replace(/_/g, ' ')

export function EvidenceValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <>Нет данных</>
  if (typeof value === 'boolean') return <>{value ? 'Да' : 'Нет'}</>
  if (typeof value === 'number') return <>{value.toLocaleString('ru-RU', { maximumFractionDigits: 8 })}</>
  if (typeof value === 'string') return <>{labels[value] ?? value}</>
  if (Array.isArray(value)) return value.length ? <ul className="space-y-2">{value.map((item, i) => <li className="border-l border-border pl-2" key={i}><EvidenceValue value={item} /></li>)}</ul> : <>Записей нет</>
  return <dl className="space-y-2">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="flex flex-wrap gap-x-3 gap-y-1"><dt className="text-muted">{evidenceLabel(key)}:</dt><dd className="min-w-0 break-words"><EvidenceValue value={item} /></dd></div>)}</dl>
}

export function AnalysisEvidence({ snapshot, sourceHash, version, citations = [] }: { snapshot?: Record<string, unknown>; sourceHash?: string | null; version?: string | null; citations?: string[] }) {
  if (!sourceHash || !snapshot) return <p className="mt-3 text-xs text-muted">Основания старого резюме не зафиксированы. Обновите анализ.</p>
  return <details className="mt-3 rounded-xl border border-border p-3 text-xs"><summary className="cursor-pointer font-medium text-brand">Исходные данные и основания</summary>
    <p className="mt-3 text-muted">Источник — база Durov OS. Это показатели из записей системы; их наличие не подтверждает подлинность первичных документов.</p>
    {citations.length > 0 && <p className="mt-2">Ссылки в выводе ИИ: {citations.map(evidenceLabel).join(', ')}.</p>}
    <div className="mt-3"><EvidenceValue value={snapshot} /></div>
    <p className="mt-3 border-t border-border pt-3 text-muted">Версия расчёта: <span className="break-all">{version ?? 'не указана'}</span></p><p className="mt-1 text-muted">Контрольная сумма исходных данных:</p><code className="mt-1 block break-all text-muted">{sourceHash}</code>
  </details>
}
