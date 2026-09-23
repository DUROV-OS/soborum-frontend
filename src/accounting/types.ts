// Зеркалит app/accounting/schemas.py::MoneyMovementOut на бэке (задача 0011-c).
// Терминология и модель повторяют МойСклад — см.
// backend/docs/moysklad-accounting-research.md (разведка 0011-b).

import { FileAsset } from '@/clients/types'

export type MoneyDirection = 'income' | 'expense'

export type MoneySubkind =
  | 'sale_income'
  | 'salary_payout'
  | 'supply_payment'
  | 'tax'
  | 'rent'
  | 'other_income'
  | 'other_expense'

export type MoneyAssessment = 'planned' | 'actual'

export type MoneyMovementStatus = 'draft' | 'approved' | 'posted' | 'cancelled'

export type MoneySourceKind = 'none' | 'client' | 'employee' | 'supply'

// --- Организации и банковские счета (задача 0081-a) ---

/** Зеркалит app/accounting/schemas.py::BankAccountOut. */
export interface BankAccount {
  id: number
  organization_id: number
  name: string
  bank_name: string | null
  account_number: string | null
  currency: string
  is_default: boolean
  is_active: boolean
}

/** Зеркалит OrganizationOut. Юрлицо компании — вкладка раздела. */
export interface Organization {
  id: number
  name: string
  short_name: string
  inn: string | null
  is_active: boolean
  accounts: BankAccount[]
}

export interface MoneyTotals {
  income: number
  expense: number
  /** income − expense; отрицательное — расход обогнал приход. */
  balance: number
  count: number
}

export interface AccountSummary extends MoneyTotals {
  account_id: number
  name: string
}

export interface OrganizationSummary extends MoneyTotals {
  organization_id: number
  name: string
  short_name: string
  accounts: AccountSummary[]
}

/** GET /api/accounting/money-summary — считает только проведённые проводки. */
export interface MoneySummary {
  total: MoneyTotals
  organizations: OrganizationSummary[]
}

// --- Единый справочник контрагентов (задача 0081-c) ---

export type CounterpartyKind = 'client' | 'supplier' | 'employee' | 'government' | 'other'

export const COUNTERPARTY_KIND_LABEL: Record<CounterpartyKind, string> = {
  client: 'Клиент',
  supplier: 'Поставщик',
  employee: 'Сотрудник',
  government: 'Госорган',
  other: 'Прочий',
}

/** Зеркалит app/accounting/schemas.py::CounterpartyOut. Суммы — только по
 * проведённым платежам; черновик деньгами ещё не является. */
export interface Counterparty {
  id: number
  name: string
  inn: string | null
  kind: CounterpartyKind
  client_id: number | null
  supplier_id: number | null
  comment: string | null
  is_active: boolean
  total_income: number
  total_expense: number
  payments_count: number
  last_payment_at: string | null
}

export interface MoneyMovement {
  id: number
  direction: MoneyDirection
  subkind: MoneySubkind
  amount: number
  currency: string
  tax: number
  assessment: MoneyAssessment
  affects_profit: boolean
  initiator_id: number
  initiator_name: string | null
  /** Счёт, по которому прошёл платёж (0081-a). null — только у проводок,
   * заведённых до появления счетов и не попавших под миграцию. */
  account_id: number | null
  account_name: string | null
  organization_id: number | null
  organization_name: string | null
  status: MoneyMovementStatus
  posted_at: string | null
  /** Дата платёжного документа (приходит с импортом выписки). История
   * контрагента сортируется по ней, а не по дате заведения записи. */
  doc_date: string | null
  cancel_reason: string | null
  payment_purpose: string | null
  comment: string | null
  external_number: string | null
  /** Контрагент из единого справочника (0081-c). Отдельно от source_kind:
   * та привязка есть не у каждого платежа, эта — у любого. */
  counterparty_id: number | null
  counterparty_name: string | null
  source_kind: MoneySourceKind
  client_id: number | null
  employee_id: number | null
  supply_id: number | null
  source_label: string | null
  documents: FileAsset[]
  link: string | null
  created_at: string
  updated_at: string
}

/** GET /api/accounting/money-movements/enums */
export interface MoneyMovementEnums {
  direction: MoneyDirection[]
  subkind: MoneySubkind[]
  status: MoneyMovementStatus[]
  source_kind: MoneySourceKind[]
}

export const DIRECTION_LABEL: Record<MoneyDirection, string> = {
  income: 'Приход',
  expense: 'Расход',
}

export const SUBKIND_LABEL: Record<MoneySubkind, string> = {
  sale_income: 'Доход от продажи',
  salary_payout: 'Выплата зарплаты',
  supply_payment: 'Оплата поставки',
  tax: 'Налоги и сборы',
  rent: 'Аренда',
  other_income: 'Прочий доход',
  other_expense: 'Прочий расход',
}

export const STATUS_LABEL: Record<MoneyMovementStatus, string> = {
  draft: 'Черновик',
  approved: 'Согласовано',
  posted: 'Проведено',
  cancelled: 'Отменено',
}

export const ASSESSMENT_LABEL: Record<MoneyAssessment, string> = {
  planned: 'Плановая',
  actual: 'Фактическая',
}

export const SOURCE_KIND_LABEL: Record<MoneySourceKind, string> = {
  none: 'Без источника',
  client: 'Клиент',
  employee: 'Сотрудник',
  supply: 'Поставка',
}

/** Виды, которые в 0011-e можно заводить руками. salary_payout и supply_payment
 * заводятся из своих разделов в 0011-f, поэтому в форме создания их нет. */
export const CREATABLE_SUBKINDS: MoneySubkind[] = [
  'sale_income',
  'other_income',
  'other_expense',
  'tax',
  'rent',
]

/** Подвиды, требующие привязку к клиенту (единственный источник, доступный в 0011-e). */
export const CLIENT_SOURCE_SUBKINDS: MoneySubkind[] = ['sale_income']

export const STATUS_TONE: Record<MoneyMovementStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  draft: 'neutral',
  approved: 'info',
  posted: 'success',
  cancelled: 'danger',
}

/** Порядок значимости статуса для сортировки реестра (0072-a) — не алфавитный. */
export const STATUS_SORT_ORDER: Record<MoneyMovementStatus, number> = {
  draft: 0,
  approved: 1,
  posted: 2,
  cancelled: 3,
}

/** GET /api/accounting/salary-overview — строка раздела «Сотрудники» (0023, карточка — 0041). */
export interface EmployeeSalaryOverview {
  employee_id: number
  full_name: string
  open_movement: MoneyMovement | null
  /** Последняя ПРОВЕДЁННАЯ (posted) зарплатная проводка — история, не открытая. */
  last_posted_at: string | null
  last_posted_amount: number | null
  /** KPI за текущий календарный месяц (0042: доля задач с прошедшим дедлайном,
   * выполненных в срок). `null` — за месяц нет ни одной оценённой задачи, это не то
   * же самое, что 0 — показывать «нет данных за период», а не число. */
  kpi: number | null
}

/** GET /api/accounting/employee-kpi-history/:employeeId — до 6 последних периодов. */
export interface EmployeeKpiPeriod {
  period_start: string
  period_end: string
  tasks_total: number
  tasks_on_time: number
  tasks_late: number
  tasks_overdue: number
  kpi: number | null
}

// --- Заказы у поставщика (задача 0011-d, UI — 0011-f) ---

export type SupplierOrderStatus = 'ordered' | 'in_transit' | 'received'

export interface SupplierOrderItem {
  material: string
  category: string | null
  quantity: number
  unit_price: number
}

export interface SupplierOrder {
  id: number
  supplier_id: number
  supplier_name: string | null
  items: SupplierOrderItem[]
  total_cost: number
  currency: string
  expected_at: string | null
  status: SupplierOrderStatus
  received_at: string | null
  comment: string | null
  created_at: string
  updated_at: string
}

export const SUPPLIER_ORDER_STATUS_LABEL: Record<SupplierOrderStatus, string> = {
  ordered: 'Заказана',
  in_transit: 'В пути',
  received: 'Принята',
}

export const SUPPLIER_ORDER_STATUS_TONE: Record<SupplierOrderStatus, 'neutral' | 'info' | 'success'> = {
  ordered: 'neutral',
  in_transit: 'info',
  received: 'success',
}

// --- Импорт платежей таблицей (задача 0011-k) ---

export interface PaymentColumnMapping {
  amount: string | null
  amount_debit: string | null
  amount_credit: string | null
  direction_col: string | null
  doc_date: string | null
  counterparty: string | null
  counterparty_inn: string | null
  tax: string | null
  external_number: string | null
  subkind: string | null
  payment_purpose: string | null
}

export interface PaymentImportResult {
  imported: number
  skipped: number
  ai_used: boolean
  note: string
  column_mapping: PaymentColumnMapping
  missing_fields: string[]
  /** Строк, где колонка контрагента оказалась пустой. */
  unmatched_source: number
  /** Строк, совпавших с уже загруженной проводкой этого счёта (0081-e). */
  duplicates: number
  counterparties_created: number
  counterparties_matched: number
  account_id: number | null
  account_label: string | null
  preliminary_subkind: number
  created_ids: number[]
  backfill_suggested: boolean
}

export const IMPORT_FIELD_LABEL: Record<string, string> = {
  amount: 'Сумма',
  amount_debit: 'Расход',
  amount_credit: 'Приход',
  direction_col: 'Тип операции',
  doc_date: 'Дата документа',
  counterparty: 'Контрагент',
  counterparty_inn: 'ИНН контрагента',
  tax: 'НДС',
  external_number: 'Номер документа',
  subkind: 'Вид',
  payment_purpose: 'Назначение платежа',
  source: 'Контрагент',
}
