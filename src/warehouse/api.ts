import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { Material, MovementReason, StockMovement, Supply } from './types'

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

/** GET /api/warehouse/materials/:id */
export function getMaterial(id: number): Promise<Material> {
  return apiRequest<Material>({ section: SECTION, path: `/materials/${id}` })
}

/** Характеристики материала (0078) — общая часть create/update. */
export interface MaterialCharacteristicsInput {
  kind?: string
  size?: string
  diameter?: string
  serial_number?: string
  pack_quantity?: number
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

/** GET /api/warehouse/history */
export function history(filters: { material_id?: number; reason?: MovementReason } = {}): Promise<StockMovement[]> {
  return apiRequest<StockMovement[]>({ section: SECTION, path: '/history', query: filters })
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
