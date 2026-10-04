import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import {
  DestinationKind,
  IssueSuggestions,
  JournalEntry,
  JournalFilters,
  Material,
  StockMovement,
  Supply,
  TechcardHouse,
  TechcardPreview,
  WarehouseOperation,
} from './types'

const SECTION = 'warehouse'

/** GET /api/warehouse/materials */
export function listMaterials(needsSupply?: boolean): Promise<Material[]> {
  return apiRequest<Material[]>({ section: SECTION, path: '/materials', query: { needs_supply: needsSupply } })
}

/** GET /api/warehouse/warehouses — список складов (значения enum) */
export function listWarehouses(): Promise<string[]> {
  return apiRequest<string[]>({ section: SECTION, path: '/warehouses' })
}

/** GET /api/warehouse/material-units — единицы измерения для формы материала */
export function listMaterialUnits(): Promise<string[]> {
  return apiRequest<string[]>({ section: SECTION, path: '/material-units' })
}

/** GET /api/warehouse/categories — список категорий материалов (значения enum) */
export function listCategories(): Promise<string[]> {
  return apiRequest<string[]>({ section: SECTION, path: '/categories' })
}

/** GET /api/warehouse/materials/suggest-code — код по умолчанию для нового
 * материала: «первое слово названия-номер позиции на складе» (0096) */
export async function suggestMaterialCode(warehouse: string, title: string): Promise<string> {
  const { code } = await apiRequest<{ code: string }>({
    section: SECTION,
    path: '/materials/suggest-code',
    query: { warehouse, title },
  })
  return code
}

/** GET /api/warehouse/materials/:id */
export function getMaterial(id: number): Promise<Material> {
  return apiRequest<Material>({ section: SECTION, path: `/materials/${id}` })
}

/** Характеристики материала (0078) — общая часть create/update.
 * `null` в PATCH очищает поле (в POST достаточно не передавать его). */
export interface MaterialCharacteristicsInput {
  kind?: string | null
  size?: string | null
  diameter?: string | null
  serial_number?: string | null
  pack_quantity?: number | null
  supplier_id?: number | null
}

export interface MaterialCreateInput extends MaterialCharacteristicsInput {
  warehouse: string
  category?: string
  title: string
  code: string
  unit: string
  is_fractional?: boolean
  quantity_in_stock?: number
  purchase_price?: number
  threshold?: number
}

/** POST /api/warehouse/materials */
export function createMaterial(input: MaterialCreateInput): Promise<Material> {
  return apiRequest<Material>({ section: SECTION, path: '/materials', method: 'POST', body: input })
}

export interface MaterialUpdateInput extends MaterialCharacteristicsInput {
  category?: string
  title?: string
  code?: string
  unit?: string
  is_fractional?: boolean
  purchase_price?: number
  threshold?: number
}

/** PATCH /api/warehouse/materials/:id */
export function updateMaterial(id: number, patch: MaterialUpdateInput): Promise<Material> {
  return apiRequest<Material>({ section: SECTION, path: `/materials/${id}`, method: 'PATCH', body: patch })
}

/** POST /api/warehouse/materials/:id/write-off */
export function writeOffMaterial(id: number, quantity: number, reason: string): Promise<Material> {
  return apiRequest<Material>({
    section: SECTION,
    path: `/materials/${id}/write-off`,
    method: 'POST',
    body: { quantity, reason },
  })
}

/** GET /api/warehouse/materials/:id/history */
export function materialHistory(id: number): Promise<StockMovement[]> {
  return apiRequest<StockMovement[]>({ section: SECTION, path: `/materials/${id}/history` })
}

/** GET /api/warehouse/supplies/template */
export function downloadSupplyTemplate(): Promise<void> {
  return downloadFile(SECTION, '/supplies/template', 'soborbum_shablon_postavki.xlsx')
}

export interface SupplyLineInput {
  warehouse_material_id: number
  quantity: number
}

/** POST /api/warehouse/supplies */
export function createSupply(supplier_name: string | undefined, lines: SupplyLineInput[]): Promise<Supply> {
  return apiRequest<Supply>({ section: SECTION, path: '/supplies', method: 'POST', body: { supplier_name, lines } })
}

/** POST /api/warehouse/supplies/import */
export function importSupply(file: File): Promise<Supply> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<Supply>({ section: SECTION, path: '/supplies/import', method: 'POST', form })
}

/** GET /api/warehouse/supplies/:id */
export function getSupply(id: number): Promise<Supply> {
  return apiRequest<Supply>({ section: SECTION, path: `/supplies/${id}` })
}

/** POST /api/warehouse/requests/:id/approve */
export function approveRequest(requestId: number): Promise<unknown> {
  return apiRequest({ section: SECTION, path: `/requests/${requestId}/approve`, method: 'POST' })
}

/** POST /api/warehouse/requests/:id/reject */
export function rejectRequest(requestId: number): Promise<unknown> {
  return apiRequest({ section: SECTION, path: `/requests/${requestId}/reject`, method: 'POST' })
}

// --- Документы операций склада и журнал (0088) ---

export interface OperationLineInput {
  warehouse_material_id: number
  quantity: number
}

export interface InventoryOperationInput {
  /** ISO-строка; не передана — «сейчас» на сервере. */
  occurred_at?: string
  note: string
  lines: OperationLineInput[]
}

/** POST /api/warehouse/operations/receipt | /operations/write-off */
export function createInventoryOperation(
  kind: 'receipt' | 'write_off',
  input: InventoryOperationInput,
): Promise<WarehouseOperation> {
  const path = kind === 'receipt' ? '/operations/receipt' : '/operations/write-off'
  return apiRequest<WarehouseOperation>({ section: SECTION, path, method: 'POST', body: input })
}

/** GET /api/warehouse/operations/:id */
export function getOperation(id: number): Promise<WarehouseOperation> {
  return apiRequest<WarehouseOperation>({ section: SECTION, path: `/operations/${id}` })
}

/** GET /api/warehouse/journal */
export function journal(filters: JournalFilters = {}): Promise<JournalEntry[]> {
  return apiRequest<JournalEntry[]>({ section: SECTION, path: '/journal', query: { ...filters } })
}

// --- Отпуск со склада (0088-d) ---

export interface ManualIssueInput {
  occurred_at?: string
  destination_kind: DestinationKind
  /** Для объекта / цеха / доработок — обязательно; для дома — подставит сервер. */
  destination?: string
  production_id?: number
  received_by: string
  note?: string
  lines: OperationLineInput[]
}

/** POST /api/warehouse/operations/issue */
export function createManualIssue(input: ManualIssueInput): Promise<WarehouseOperation> {
  return apiRequest<WarehouseOperation>({ section: SECTION, path: '/operations/issue', method: 'POST', body: input })
}

/** GET /api/warehouse/operations/destinations — подсказки «куда» и «кто получил». */
export function issueSuggestions(kind?: DestinationKind): Promise<IssueSuggestions> {
  return apiRequest<IssueSuggestions>({ section: SECTION, path: '/operations/destinations', query: { kind } })
}

/** GET /api/warehouse/techcard-issue/houses — `all` — все дома, иначе только с невыданным нормативом. */
export function techcardHouses(all = false): Promise<TechcardHouse[]> {
  return apiRequest<TechcardHouse[]>({ section: SECTION, path: '/techcard-issue/houses', query: { all: all || undefined } })
}

/** GET /api/warehouse/techcard-issue/:productionId/preview */
export function techcardPreview(productionId: number): Promise<TechcardPreview> {
  return apiRequest<TechcardPreview>({ section: SECTION, path: `/techcard-issue/${productionId}/preview` })
}

export interface TechcardIssueInput {
  occurred_at?: string
  received_by: string
  note?: string
  /** Не передано — весь остаток норматива дома. */
  lines?: OperationLineInput[]
}

/** POST /api/warehouse/techcard-issue/:productionId */
export function issueByTechcard(productionId: number, input: TechcardIssueInput): Promise<WarehouseOperation> {
  return apiRequest<WarehouseOperation>({
    section: SECTION,
    path: `/techcard-issue/${productionId}`,
    method: 'POST',
    body: input,
  })
}
