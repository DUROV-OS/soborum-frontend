// Соответствует SupplierOut / SupplierPriceItemOut на бэкенде
// (app/warehouse/schemas.py, задача 0011-a). Раздел смонтирован под
// /api/warehouse, но в интерфейсе живёт отдельной вкладкой «Поставщики».

export type SupplierStatus = 'active' | 'archived'

export type ContactKind = 'phone' | 'email' | 'messenger' | 'website'

export interface SupplierContact {
  kind: ContactKind
  value: string
  person?: string | null
}

/** Один диапазон размера партии. `max_qty === null` — «и больше». */
export interface PriceTier {
  min_qty: number
  max_qty: number | null
  price: number
}

export interface PriceItem {
  id: number
  supplier_id: number
  material: string
  category: string | null
  tiers: PriceTier[]
  lead_time: string | null
  /** Задел под принцип «предложение хранится после 3 раундов переговоров». */
  round: number | null
  created_at: string
  updated_at: string
}

export interface SupplierNote {
  id: number
  supplier_id: number
  author_id: number
  author_name: string | null
  text: string
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  categories: string[]
  status: SupplierStatus
  contacts: SupplierContact[]
  /** ID привязанного чата MAX (app/max). null — чат не привязан. */
  max_chat_id: number | null
  created_at: string
  price_items: PriceItem[]
  price_items_count: number
  /** Свободные заметки, новые сверху. */
  notes: SupplierNote[]
  /** Взаиморасчёты (0011-d/0011-f): сумма заказов, оплаченная сумма, разница. */
  total_ordered: number
  total_paid: number
  balance: number
}

/** Ответ POST /api/warehouse/suppliers/:id/price-items/import (задача 0011-g). */
export interface PriceListImportResult {
  supplier: Supplier
  imported: number
  skipped: number
  /** Разметку колонок сделал ИИ (true) или словарь-эвристика (false). */
  ai_used: boolean
  note: string
  column_mapping: {
    material: string | null
    price: string | null
    category: string | null
    lead_time: string | null
    qty_breaks: string[]
  }
  /** Необязательные поля, для которых в файле не нашлось колонки. */
  missing_fields: string[]
  /** Есть смысл предложить задачу «дозаполнить» (не хватает полей / есть пропуски). */
  backfill_suggested: boolean
}

export interface AiFillCategoryResult {
  supplier: Supplier
  filled: number
  skipped: number
}

export interface LeadTimeQuestionDraft {
  message: string
  materials: string[]
  chat_id: number
}

export const IMPORT_FIELD_LABEL: Record<string, string> = {
  material: 'Материал',
  price: 'Цена',
  category: 'Категория',
  lead_time: 'Срок поставки',
}

export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = {
  active: 'Активный',
  archived: 'В архиве',
}

export const CONTACT_KIND_LABEL: Record<ContactKind, string> = {
  phone: 'Телефон',
  email: 'Почта',
  messenger: 'Мессенджер',
  website: 'Сайт',
}

export const CONTACT_KINDS = Object.keys(CONTACT_KIND_LABEL) as ContactKind[]

/** «до 100: 950 ₽», «100–500: 900 ₽», «500+: 850 ₽» */
export function tierLabel(tier: PriceTier): string {
  const low = tier.min_qty || 0
  let range: string
  if (tier.max_qty == null) range = `${low}+`
  else if (!low) range = `до ${tier.max_qty}`
  else range = `${low}–${tier.max_qty}`
  return `${range}: ${tier.price.toLocaleString('ru-RU')} ₽`
}
