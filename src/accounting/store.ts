import { create } from 'zustand'
import { listClients } from '@/clients/api'
import { ApiError } from '@/shared/lib/httpClient'
import { DateFilter, dateFilterRange } from '@/shared/lib/dateFilter'
import * as accountingApi from './api'
import { MoneyMovementCreateInput, MoneyMovementUpdateInput } from './api'
import {
  BankAccount,
  Counterparty,
  EmployeeSalaryOverview,
  MoneyDirection,
  MoneyMovement,
  MoneyMovementEnums,
  MoneyMovementStatus,
  CounterpartyKind,
  MoneySourceKind,
  MoneySubkind,
  MoneySummary,
  Organization,
  PaymentImportResult,
} from './types'

export interface ActionResult {
  ok: boolean
  reason?: string
}

export interface ClientOption {
  id: number
  name: string
}

export type AmountFilterMode = 'all' | 'range' | 'gt' | 'lt' | 'eq'

export interface MovementFilters {
  direction: MoneyDirection | 'all'
  subkind: MoneySubkind | 'all'
  status: MoneyMovementStatus | 'all'
  source_kind: MoneySourceKind | 'all'
  period: DateFilter
  /** Произвольный диапазон дат ('' — не задан), берёт верх над `period`, если оба края заданы (0072-b). */
  custom_date_from: string
  custom_date_to: string
  initiator_id: number | 'all'
  /** Фильтр реестра по контрагенту (0081-d). */
  counterparty_id: number | 'all'
  /** `range` — оба поля границы; `gt`/`lt`/`eq` — используется только `_from` как значение сравнения. */
  amount_mode: AmountFilterMode
  amount_from: string
  amount_to: string
  tax_mode: AmountFilterMode
  tax_from: string
  tax_to: string
}

const DEFAULT_FILTERS: MovementFilters = {
  direction: 'all',
  subkind: 'all',
  status: 'all',
  source_kind: 'all',
  period: 'all',
  custom_date_from: '',
  custom_date_to: '',
  initiator_id: 'all',
  counterparty_id: 'all',
  amount_mode: 'all',
  amount_from: '',
  amount_to: '',
  tax_mode: 'all',
  tax_from: '',
  tax_to: '',
}

interface AccountingState {
  // --- Организации и счета (0081-b) ---
  organizations: Organization[]
  /** Организация открытой вкладки. null — справочник ещё не загружен. */
  selectedOrganizationId: number | null
  /** Счёт внутри выбранной организации; реестр и сводка режутся по нему. */
  selectedAccountId: number | null
  summary: MoneySummary | null
  summaryLoading: boolean
  selectOrganization: (organizationId: number) => void
  selectAccount: (accountId: number) => void
  loadSummary: () => Promise<void>
  // --- Справочник контрагентов (0081-d) ---
  counterparties: Counterparty[]
  counterpartiesLoading: boolean
  counterpartyQuery: string
  counterpartyKind: CounterpartyKind | 'all'
  loadCounterparties: () => Promise<void>
  setCounterpartyFilters: (patch: {
    query?: string
    kind?: CounterpartyKind | 'all'
  }) => void
  createCounterparty: (
    input: accountingApi.CounterpartyCreateInput,
  ) => Promise<ActionResult & { counterparty?: Counterparty }>
  /** Карточка: сам контрагент и его платежи; null — карточка закрыта. */
  openCounterpartyId: number | null
  openCounterparty: Counterparty | null
  counterpartyPayments: MoneyMovement[]
  counterpartyCardLoading: boolean
  showCounterparty: (id: number | null) => Promise<void>
  /** Проводка, открытая не из текущего реестра (например из карточки
   * контрагента — там платежи всех счетов). null — такой нет. */
  externalMovement: MoneyMovement | null
  openMovementById: (id: number) => Promise<void>

  movements: MoneyMovement[]
  enums: MoneyMovementEnums | null
  clients: ClientOption[]
  loading: boolean
  /** Причина, по которой последняя загрузка не удалась (например невалидный диапазон суммы/налога, 0072-c). */
  loadError: string | null
  filters: MovementFilters
  load: () => Promise<void>
  setFilters: (patch: Partial<MovementFilters>) => void
  resetFilters: () => void
  create: (input: MoneyMovementCreateInput) => Promise<ActionResult>
  update: (id: number, input: MoneyMovementUpdateInput) => Promise<ActionResult>
  changeStatus: (
    id: number,
    to: Exclude<MoneyMovementStatus, 'draft'>,
    reason?: string,
  ) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  importStatement: (
    file: File,
    accountId: number,
  ) => Promise<ActionResult & { result?: PaymentImportResult }>
  aiFillSubkind: (ids: number[]) => Promise<ActionResult & { updated?: number; skipped?: number }>
  createImportBackfillTask: (
    ids: number[],
    missingFields: string[],
  ) => Promise<ActionResult & { taskId?: number }>
  downloadImportTemplate: () => Promise<ActionResult>

  // Раздел «Сотрудники» (0023): отдельный источник данных (salary-overview),
  // но проводки заводятся/переводятся через те же create/changeStatus выше.
  salaryOverview: EmployeeSalaryOverview[]
  salaryLoading: boolean
  loadSalaryOverview: () => Promise<void>
  accrueSalary: (employeeId: number, amount: number) => Promise<ActionResult>
  advanceSalaryStatus: (
    movementId: number,
    to: Exclude<MoneyMovementStatus, 'draft'>,
  ) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Не удалось выполнить действие'
}

function numericBounds(
  mode: AmountFilterMode,
  from: string,
  to: string,
): { min?: number; max?: number } {
  const fromNum = from === '' ? undefined : Number(from)
  const toNum = to === '' ? undefined : Number(to)
  switch (mode) {
    case 'range':
      return { min: fromNum, max: toNum }
    case 'gt':
      return { min: fromNum }
    case 'lt':
      return { max: fromNum }
    case 'eq':
      return { min: fromNum, max: fromNum }
    default:
      return {}
  }
}

function toQuery(filters: MovementFilters): accountingApi.MoneyMovementFilters {
  const customRange: [Date, Date] | null =
    filters.custom_date_from && filters.custom_date_to
      ? [new Date(`${filters.custom_date_from}T00:00:00`), new Date(`${filters.custom_date_to}T23:59:59.999`)]
      : null
  const range = customRange ?? dateFilterRange(filters.period)
  const amountBounds = numericBounds(filters.amount_mode, filters.amount_from, filters.amount_to)
  const taxBounds = numericBounds(filters.tax_mode, filters.tax_from, filters.tax_to)
  return {
    direction: filters.direction === 'all' ? undefined : filters.direction,
    subkind: filters.subkind === 'all' ? undefined : filters.subkind,
    status: filters.status === 'all' ? undefined : filters.status,
    source_kind: filters.source_kind === 'all' ? undefined : filters.source_kind,
    initiator_id: filters.initiator_id === 'all' ? undefined : filters.initiator_id,
    counterparty_id: filters.counterparty_id === 'all' ? undefined : filters.counterparty_id,
    amount_min: amountBounds.min,
    amount_max: amountBounds.max,
    tax_min: taxBounds.min,
    tax_max: taxBounds.max,
    date_from: range ? range[0].toISOString() : undefined,
    date_to: range ? range[1].toISOString() : undefined,
  }
}

/** Действующие счета организации, счёт по умолчанию первым. */
function accountsOf(organizations: Organization[], organizationId: number | null): BankAccount[] {
  const org = organizations.find((o) => o.id === organizationId)
  if (!org) return []
  return [...org.accounts]
    .filter((a) => a.is_active)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.id - b.id)
}

export const useAccountingStore = create<AccountingState>((set, get) => ({
  organizations: [],
  selectedOrganizationId: null,
  selectedAccountId: null,
  summary: null,
  summaryLoading: true,
  counterparties: [],
  counterpartiesLoading: true,
  counterpartyQuery: '',
  counterpartyKind: 'all',
  openCounterpartyId: null,
  openCounterparty: null,
  counterpartyPayments: [],
  counterpartyCardLoading: false,
  externalMovement: null,

  openMovementById: async (id) => {
    const known = get().movements.find((m) => m.id === id)
    if (known) {
      set({ externalMovement: null })
      return
    }
    try {
      set({ externalMovement: await accountingApi.getMovement(id) })
    } catch {
      set({ externalMovement: null })
    }
  },

  loadCounterparties: async () => {
    set({ counterpartiesLoading: true })
    try {
      const counterparties = await accountingApi.listCounterparties({
        query: get().counterpartyQuery.trim() || undefined,
        kind: get().counterpartyKind === 'all' ? undefined : (get().counterpartyKind as CounterpartyKind),
      })
      set({ counterparties, counterpartiesLoading: false })
    } catch {
      set({ counterparties: [], counterpartiesLoading: false })
    }
  },

  setCounterpartyFilters: (patch) => {
    set({
      counterpartyQuery: patch.query ?? get().counterpartyQuery,
      counterpartyKind: patch.kind ?? get().counterpartyKind,
    })
    get().loadCounterparties()
  },

  createCounterparty: async (input) => {
    try {
      const counterparty = await accountingApi.createCounterparty(input)
      // Свежесозданный сразу попадает в список подстановки, без перезагрузки.
      set({ counterparties: [counterparty, ...get().counterparties] })
      return { ok: true, counterparty }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  showCounterparty: async (id) => {
    if (id === null) {
      set({ openCounterpartyId: null, openCounterparty: null, counterpartyPayments: [] })
      return
    }
    set({ openCounterpartyId: id, counterpartyCardLoading: true })
    try {
      const [counterparty, payments] = await Promise.all([
        accountingApi.getCounterparty(id),
        accountingApi.listCounterpartyPayments(id),
      ])
      set({
        openCounterparty: counterparty,
        counterpartyPayments: payments,
        counterpartyCardLoading: false,
      })
    } catch {
      set({ openCounterparty: null, counterpartyPayments: [], counterpartyCardLoading: false })
    }
  },

  movements: [],
  enums: null,
  clients: [],
  loading: true,
  loadError: null,
  filters: DEFAULT_FILTERS,

  load: async () => {
    set({ loading: true, loadError: null })
    try {
      // Справочник организаций тянем один раз: он задаёт вкладки, и без счёта
      // непонятно, какой срез реестра запрашивать.
      const organizations = get().organizations.length
        ? get().organizations
        : await accountingApi.listOrganizations()
      let { selectedOrganizationId, selectedAccountId } = get()
      if (selectedOrganizationId === null || !organizations.some((o) => o.id === selectedOrganizationId)) {
        selectedOrganizationId = organizations[0]?.id ?? null
        selectedAccountId = null
      }
      const accounts = accountsOf(organizations, selectedOrganizationId)
      if (selectedAccountId === null || !accounts.some((a) => a.id === selectedAccountId)) {
        selectedAccountId = accounts[0]?.id ?? null
      }
      set({ organizations, selectedOrganizationId, selectedAccountId })

      const [movements, enums, clients] = await Promise.all([
        selectedAccountId === null
          ? Promise.resolve([])
          : accountingApi.listMovements({ ...toQuery(get().filters), account_id: selectedAccountId }),
        get().enums ? Promise.resolve(get().enums!) : accountingApi.getEnums(),
        get().clients.length ? Promise.resolve(null) : listClients().catch(() => null),
      ])
      set((state) => ({
        movements,
        enums,
        loading: false,
        clients: clients
          ? clients.map((c) => ({ id: c.id, name: c.full_name })).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
          : state.clients,
      }))
      void get().loadSummary()
    } catch (error) {
      set({ movements: [], loading: false, loadError: reasonOf(error) })
    }
  },

  loadSummary: async () => {
    set({ summaryLoading: true })
    try {
      // Период берём из тех же фильтров реестра, чтобы цифры над таблицей
      // совпадали с тем, что под ней.
      const { date_from, date_to } = toQuery(get().filters)
      const summary = await accountingApi.getMoneySummary({ date_from, date_to })
      set({ summary, summaryLoading: false })
    } catch {
      set({ summary: null, summaryLoading: false })
    }
  },

  selectOrganization: (organizationId) => {
    if (organizationId === get().selectedOrganizationId) return
    // Счёт сбрасывается на счёт по умолчанию новой организации; фильтры
    // (период, вид, статус) остаются — человек смотрит тот же срез, но по
    // другому юрлицу.
    const accounts = accountsOf(get().organizations, organizationId)
    set({ selectedOrganizationId: organizationId, selectedAccountId: accounts[0]?.id ?? null })
    get().load()
  },

  selectAccount: (accountId) => {
    if (accountId === get().selectedAccountId) return
    set({ selectedAccountId: accountId })
    get().load()
  },

  setFilters: (patch) => {
    set({ filters: { ...get().filters, ...patch } })
    get().load()
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS })
    get().load()
  },

  create: async (input) => {
    try {
      const created = await accountingApi.createMovement(input)
      set({ movements: [created, ...get().movements] })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  update: async (id, input) => {
    try {
      const updated = await accountingApi.updateMovement(id, input)
      set({ movements: get().movements.map((m) => (m.id === id ? updated : m)) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  changeStatus: async (id, to, reason) => {
    try {
      const updated = await accountingApi.changeStatus(id, to, reason)
      set({ movements: get().movements.map((m) => (m.id === id ? updated : m)) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  remove: async (id) => {
    try {
      await accountingApi.deleteMovement(id)
      set({ movements: get().movements.filter((m) => m.id !== id) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  importStatement: async (file, accountId) => {
    try {
      const result = await accountingApi.importStatement(file, accountId)
      await get().load()
      // Импорт заводит новых контрагентов — справочник перечитываем.
      void get().loadCounterparties()
      return { ok: true, result }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  aiFillSubkind: async (ids) => {
    try {
      const res = await accountingApi.aiFillSubkind(ids)
      await get().load()
      return { ok: true, updated: res.updated, skipped: res.skipped }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  createImportBackfillTask: async (ids, missingFields) => {
    try {
      const res = await accountingApi.createImportBackfillTask(ids, missingFields)
      return { ok: true, taskId: res.task_id }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  downloadImportTemplate: async () => {
    try {
      await accountingApi.downloadImportTemplate()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  salaryOverview: [],
  salaryLoading: true,

  loadSalaryOverview: async () => {
    set({ salaryLoading: true })
    const salaryOverview = await accountingApi.getSalaryOverview()
    set({ salaryOverview, salaryLoading: false })
  },

  accrueSalary: async (employeeId, amount) => {
    try {
      // Вкладка «Сотрудники» не разнесена по юрлицам (0081-b, осознанное
      // ограничение) — зарплатная проводка идёт на счёт по умолчанию первой
      // организации, как и до появления счетов.
      const organizations = get().organizations.length
        ? get().organizations
        : await accountingApi.listOrganizations()
      const accountId = accountsOf(organizations, organizations[0]?.id ?? null)[0]?.id
      if (accountId === undefined) {
        return { ok: false, reason: 'Не заведено ни одного действующего счёта' }
      }
      await accountingApi.createMovement({
        subkind: 'salary_payout',
        amount,
        employee_id: employeeId,
        account_id: accountId,
      })
      await get().loadSalaryOverview()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  advanceSalaryStatus: async (movementId, to) => {
    try {
      await accountingApi.changeStatus(movementId, to)
      await get().loadSalaryOverview()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },
}))
