import { create } from 'zustand'
import { listClients } from '@/clients/api'
import { ApiError } from '@/shared/lib/httpClient'
import { DateFilter, dateFilterRange } from '@/shared/lib/dateFilter'
import * as accountingApi from './api'
import { MoneyMovementCreateInput } from './api'
import {
  EmployeeSalaryOverview,
  MoneyDirection,
  MoneyMovement,
  MoneyMovementEnums,
  MoneyMovementStatus,
  MoneySourceKind,
  MoneySubkind,
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
  amount_mode: 'all',
  amount_from: '',
  amount_to: '',
  tax_mode: 'all',
  tax_from: '',
  tax_to: '',
}

interface AccountingState {
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
  changeStatus: (
    id: number,
    to: Exclude<MoneyMovementStatus, 'draft'>,
    reason?: string,
  ) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  importPayments: (file: File) => Promise<ActionResult & { result?: PaymentImportResult }>
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
  const range = dateFilterRange(filters.period)
  const amountBounds = numericBounds(filters.amount_mode, filters.amount_from, filters.amount_to)
  const taxBounds = numericBounds(filters.tax_mode, filters.tax_from, filters.tax_to)
  return {
    direction: filters.direction === 'all' ? undefined : filters.direction,
    subkind: filters.subkind === 'all' ? undefined : filters.subkind,
    status: filters.status === 'all' ? undefined : filters.status,
    source_kind: filters.source_kind === 'all' ? undefined : filters.source_kind,
    amount_min: amountBounds.min,
    amount_max: amountBounds.max,
    tax_min: taxBounds.min,
    tax_max: taxBounds.max,
    date_from: range ? range[0].toISOString() : undefined,
    date_to: range ? range[1].toISOString() : undefined,
  }
}

export const useAccountingStore = create<AccountingState>((set, get) => ({
  movements: [],
  enums: null,
  clients: [],
  loading: true,
  loadError: null,
  filters: DEFAULT_FILTERS,

  load: async () => {
    set({ loading: true, loadError: null })
    try {
      const [movements, enums, clients] = await Promise.all([
        accountingApi.listMovements(toQuery(get().filters)),
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
    } catch (error) {
      set({ movements: [], loading: false, loadError: reasonOf(error) })
    }
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

  importPayments: async (file) => {
    try {
      const result = await accountingApi.importPayments(file)
      await get().load()
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
      await accountingApi.createMovement({ subkind: 'salary_payout', amount, employee_id: employeeId })
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
