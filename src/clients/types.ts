import { HouseModelBrief } from '@/house_models/types'

export type ClientStage = 'lead' | 'discussion' | 'approval' | 'payment' | 'postpayment'

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

export const CLIENT_STAGES: { key: ClientStage; label: string }[] = [
  { key: 'lead', label: 'Лид' },
  { key: 'discussion', label: 'Обсуждение' },
  { key: 'approval', label: 'Согласование' },
  { key: 'payment', label: 'Оплата' },
  { key: 'postpayment', label: 'Постоплата' },
]

export type ClientChatState = 'agreement' | 'waiting' | 'analysis'

export const CLIENT_CHAT_STATES: { key: ClientChatState; label: string }[] = [
  { key: 'agreement', label: 'Согласование' },
  { key: 'waiting', label: 'Ожидание' },
  { key: 'analysis', label: 'Анализ' },
]

export function chatStateLabel(state: ClientChatState | null): string {
  return CLIENT_CHAT_STATES.find((s) => s.key === state)?.label ?? '—'
}

export interface FileAsset {
  id: number
  filename: string
  content_type: string
  purpose: string
  uploaded_by_id: number
  created_at: string
}

export interface ClientNote {
  id: number
  client_id: number
  author_id: number
  text: string
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
  /** id чата в мессенджере MAX, к которому привязана переписка с клиентом.
   * `null` — переписка не привязана; `0` — «Избранное». Ни к одной стадии
   * не привязан, редактируется в любой момент. */
  max_chat_id: number | null
  /** Состояние переписки — хранится на связи, осмысленно только пока чат привязан. */
  max_chat_state: ClientChatState | null
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
  /** Необязателен с 0061 — не у каждого клиента есть проект дома в системе. */
  house_project_file: FileAsset | null
  ar_file: FileAsset | null
  kr_file: FileAsset | null
  documents_locked_at: string | null
  is_paid: boolean | null
  payment_locked_at: string | null
  /** Приём остатка после получения дома — стадия «Постоплата», планы advance/postpay. */
  balance_paid: boolean | null
  balance_paid_at: string | null
  notes: ClientNote[]
}

export interface ClientCreateInput {
  full_name: string
  phone: string
  email: string
  contacts: ClientContact[]
}
