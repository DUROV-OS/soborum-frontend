import { HouseModelBrief } from '@/house_models/types'

/** Путь клиента из восьми стадий (0079). Значения первых пяти остались от
 * прежнего пятиколоночного пути — поменялись только подписи: `approval` —
 * «Ипотека/Одобрение в банке», `payment` — «Договор подписан/Аванс внесён»,
 * `postpayment` — «Дом в производстве». */
export type ClientStage =
  | 'lead'
  | 'discussion'
  | 'site_visit'
  | 'approval'
  | 'payment'
  | 'postpayment'
  | 'acceptance'
  | 'completed'

/** Одиночный заказ — один дом в производстве. Множественный — несколько домов
 * у одного клиента, под каждый на стадии производства заводится отдельный проект. */
export type OrderType = 'single' | 'multiple'

export const ORDER_TYPES: { key: OrderType; label: string }[] = [
  { key: 'single', label: 'Одиночный' },
  { key: 'multiple', label: 'Множественный' },
]

export function orderTypeLabel(type: OrderType | null): string {
  return ORDER_TYPES.find((o) => o.key === type)?.label ?? '—'
}

/** Формат расчёта клиента — фиксируется в документных данных на «Согласовании».
 * Значения совпадают с backend enum `app.clients.models.PaymentPlan` дословно
 * (регрессия 0018 — раньше фронт слал свои короткие ключи `full`/`advance`/
 * `postpay`, бэк ждал `full_prepayment`/`advance_then_balance`/`post_payment`,
 * запрос падал 422). `advance_then_balance` требует `advance_amount`;
 * `advance_then_balance` и `post_payment` подразумевают приём остатка на
 * «Постоплате» (см. balance_paid). */
export type PaymentPlan = 'full_prepayment' | 'advance_then_balance' | 'post_payment'

export const PAYMENT_PLANS: { key: PaymentPlan; label: string }[] = [
  { key: 'full_prepayment', label: 'Полная предоплата' },
  { key: 'advance_then_balance', label: 'Аванс + оплата после получения' },
  { key: 'post_payment', label: 'Оплата после получения' },
]

export function paymentPlanLabel(plan: PaymentPlan | null): string {
  return PAYMENT_PLANS.find((p) => p.key === plan)?.label ?? '—'
}

/** true — по плану есть остаток, который принимают уже после получения дома. */
export function planHasBalance(plan: PaymentPlan | null): boolean {
  return plan === 'advance_then_balance' || plan === 'post_payment'
}

/** Состояние остатка «после получения» (0084-j) — вычисляет бэк из плана,
 * отметки приёма и срока. `pending` — срок не наступил, это не нарушение;
 * `no_due_date` — срок не указан, просрочку не определить. */
export type BalanceState = 'not_applicable' | 'no_due_date' | 'pending' | 'overdue' | 'paid'

export const BALANCE_STATE_LABEL: Record<BalanceState, string> = {
  not_applicable: 'Остатка нет',
  no_due_date: 'Срок оплаты не указан',
  pending: 'Остаток в срок',
  overdue: 'Остаток просрочен',
  paid: 'Остаток принят',
}

export const CLIENT_STAGES: { key: ClientStage; label: string }[] = [
  { key: 'lead', label: 'Лид' },
  { key: 'discussion', label: 'Обсуждение' },
  { key: 'site_visit', label: 'Гость на объекте' },
  { key: 'approval', label: 'Ипотека/Одобрение в банке' },
  { key: 'payment', label: 'Договор подписан/Аванс внесён' },
  { key: 'postpayment', label: 'Дом в производстве' },
  { key: 'acceptance', label: 'Приёмка' },
  { key: 'completed', label: 'Успешно реализовано' },
]

/** Стадии, которые двигает не человек, а ход работ: «Дом в производстве» и
 * дальше переводит сам бэкенд по разделу «Монтаж» (0079). Кнопки перевода на
 * них нет — попытка всё равно вернулась бы отказом с бэка. Список держим
 * здесь одной константой, чтобы он не разъезжался по компонентам. */
export const AUTOMATIC_STAGES: ClientStage[] = ['postpayment', 'acceptance', 'completed']

export type ClientChatState = 'agreement' | 'waiting' | 'analysis'

export const CLIENT_CHAT_STATES: { key: ClientChatState; label: string }[] = [
  { key: 'agreement', label: 'Согласование' },
  { key: 'waiting', label: 'Ожидание' },
  { key: 'analysis', label: 'Анализ' },
]

export function chatStateLabel(state: ClientChatState | null): string {
  return CLIENT_CHAT_STATES.find((s) => s.key === state)?.label ?? '—'
}

/** Задача менеджера по клиенту (0079-d): «связаться», «выслать каталог»,
 * «уточнить по ипотеке». Обычная задача системы — она же видна в «Моих
 * задачах». Пока открыта задача с `blocking`, клиента нельзя перевести на
 * следующую стадию. */
export interface ClientTask {
  id: number
  title: string
  description: string | null
  deadline: string | null
  status: 'not_ready' | 'ready' | 'in_progress' | 'in_review' | 'done'
  blocking: boolean
  /** Стадия клиента на момент постановки — видно, на каком шаге он застрял. */
  stage: ClientStage | null
  assignee_ids: number[]
  reports: ClientTaskReport[]
}

/** Строка журнала задачи: решение по задаче или перенос срока с причиной. */
export interface ClientTaskReport {
  id: number
  kind: 'submission' | 'review_accepted' | 'review_returned' | 'deadline_shift'
  comment: string
  author_id: number
  created_at: string
}

export interface ClientTaskInput {
  title: string
  description?: string | null
  /** ISO-строка. Срок обязателен — задача без срока теряется. */
  deadline: string
  assignee_ids?: number[]
  blocking?: boolean
}

/** Частые формулировки задач — подсказки, а не ограничение: текст произвольный. */
export const CLIENT_TASK_SUGGESTIONS = [
  'Связаться',
  'Напомнить о себе',
  'Выслать каталог',
  'Уточнить по ипотеке',
]

export interface FileAsset {
  id: number
  filename: string
  content_type: string
  purpose: string
  uploaded_by_id: number
  created_at: string
}

/** Откуда файл договора/приложения (0084-i): загружен человеком или написан
 * Мариной. Сгенерированный — черновик, гейт стадии его не пропускает. */
export type ContractSource = 'uploaded' | 'generated'

/** Договор и приложение — два документа с одинаковыми правилами проверки. */
export type ContractDocument = 'contract' | 'contract_appendix'

export interface ContractVerifier {
  id: number
  full_name: string
}

export interface ClientNote {
  id: number
  client_id: number
  author_id: number
  text: string
  created_at: string
}

/** Привязка клиента к чату MAX (0053) — у клиента может быть несколько
 * (например, отдельно с ним и с его помощником), но каждый чат по-прежнему
 * принадлежит не более чем одному клиенту. */
export interface ClientChatLink {
  id: number
  client_id: number
  max_chat_id: number
  label: string
  state: ClientChatState | null
  /** false — чат со старого аккаунта MAX (до перехода на бота): бот его не
   * видит, ленты по нему нет. */
  bot_chat_known: boolean
  created_at: string
}

/** Способ связи с клиентом: мессенджер/канал и адрес в нём. */
export interface ClientContact {
  messenger: string
  contact: string
}

/** Подсказки для поля «мессенджер» — не ограничение, просто частые варианты. */
export const MESSENGER_SUGGESTIONS = ['Telegram', 'WhatsApp', 'Viber', 'Телефон', 'Email', 'VK']

export interface Client {
  id: number
  cycle_id: number
  stage: ClientStage
  created_at: string
  full_name: string
  phone: string
  email: string
  contacts: ClientContact[]
  /** Источник клиента (0079-c): у прямого клиента via_agency = false и пустые agency_*. */
  via_agency: boolean
  agency_name: string | null
  agency_contact: string | null
  /** Чаты MAX, привязанные к клиенту (0053) — 1:N, редактируется в любой момент. */
  chat_links: ClientChatLink[]
  order_type: OrderType | null
  /** Ключ карточки каталога типовых проектов (0043), если дом клиента совпадает
   * с одной из моделей — необязателен, индивидуальный дом может не совпасть ни с одной. */
  house_model_key: string | null
  house_model: HouseModelBrief | null
  houses_count: number
  final_price: number | null
  installation_address: string | null
  payment_plan: PaymentPlan | null
  /** Сумма аванса — только для payment_plan === 'advance_then_balance', меньше final_price. */
  advance_amount: number | null
  contract_file: FileAsset | null
  contract_appendix_file: FileAsset | null
  /** Источник и проверка договора/приложения (0084-i). Загрузка ≠ проверка:
   * `*_verified_at` ставит отдельное действие «Отметить проверенным». Флаг
   * `*_verification_required` false — файл приложен до ввода проверки: гейт
   * стадии только предупреждает, переход не блокирует. */
  contract_source: ContractSource | null
  contract_verification_required: boolean
  contract_verified_by: ContractVerifier | null
  contract_verified_at: string | null
  contract_verification_note: string | null
  contract_appendix_source: ContractSource | null
  contract_appendix_verification_required: boolean
  contract_appendix_verified_by: ContractVerifier | null
  contract_appendix_verified_at: string | null
  contract_appendix_verification_note: string | null
  /** Необязателен с 0061 — не у каждого клиента есть проект дома в системе. */
  house_project_file: FileAsset | null
  ar_file: FileAsset | null
  kr_file: FileAsset | null
  documents_locked_at: string | null
  is_paid: boolean | null
  payment_locked_at: string | null
  /** Разрешение администратора обходить payment_locked_at (0054). */
  payment_edit_unlocked: boolean
  /** Приём остатка после получения дома — стадия «Постоплата», планы advance/postpay. */
  balance_paid: boolean | null
  balance_paid_at: string | null
  /** Срок оплаты остатка по договору (0084-j), `YYYY-MM-DD`; вводится вручную. */
  balance_due_date: string | null
  balance_state: BalanceState
  notes: ClientNote[]
  /** Задачи по клиенту (0079-d), свежие сверху — и открытые, и закрытые. */
  tasks: ClientTask[]
}

/** Источник клиента (0079-c): пришёл сам или его привело агентство-партнёр.
 * `agency_name` обязательно при `via_agency = true`; при снятии отметки бэк
 * чистит оба поля агентства. */
export interface ClientSourceInput {
  via_agency: boolean
  agency_name?: string | null
  agency_contact?: string | null
}

export interface ClientCreateInput extends ClientSourceInput {
  full_name: string
  phone: string
  email: string
  contacts: ClientContact[]
}
