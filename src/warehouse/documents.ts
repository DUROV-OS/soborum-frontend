import { apiRequest } from '@/shared/lib/httpClient'

export type StockDocumentKind = 'transfer' | 'inventory'
export interface StockDocumentLine {
  material_id: number | null
  target_material_id?: number | null
  title: string
  code: string
  unit: string
  is_fractional: boolean
  expected_quantity: string | null
  quantity: string | null
  delta?: string | null
  unit_price?: string
  source_balance_after?: string
  target_balance_after?: string
}
export interface StockDocument {
  id: number
  kind: StockDocumentKind
  status: 'draft' | 'posted' | 'historical'
  number: string
  warehouse: string
  target_warehouse: string | null
  occurred_at: string
  note: string
  lines: StockDocumentLine[]
  operation_ids: number[]
  source_id: string | null
  source_state: string | null
  archived: boolean
  version: number
  actor_id: number
  posted_by_id: number | null
  posted_at: string | null
}
export const KIND_LABEL: Record<StockDocumentKind, string> = {
  transfer: 'Перемещение',
  inventory: 'Инвентаризация',
}
export const STATUS_LABEL: Record<StockDocument['status'], string> = {
  draft: 'Черновик',
  posted: 'Проведён',
  historical: 'История МойСклад',
}
export interface DocumentInput {
  request_id: string
  kind: StockDocumentKind
  warehouse: string
  target_warehouse?: string
  occurred_at: string
  note: string
  lines: { material_id: number; quantity: string | null }[]
}
export const listStockDocuments = (query: { kind?: StockDocumentKind; archive: string; offset: number }) =>
  apiRequest<{ total: number; items: StockDocument[] }>({ section: 'warehouse', path: '/documents', query })
export const getStockDocument = (id: number) =>
  apiRequest<StockDocument>({ section: 'warehouse', path: `/documents/${id}` })
export const createStockDocument = (body: DocumentInput) =>
  apiRequest<StockDocument>({ section: 'warehouse', path: '/documents', method: 'POST', body })
export const updateStockDocument = (row: StockDocument, note: string, lines: DocumentInput['lines']) =>
  apiRequest<StockDocument>({
    section: 'warehouse',
    path: `/documents/${row.id}`,
    method: 'PATCH',
    body: { version: row.version, note, lines },
  })
export const postStockDocument = (row: StockDocument, request_id: string) =>
  apiRequest<StockDocument>({
    section: 'warehouse',
    path: `/documents/${row.id}/post`,
    method: 'POST',
    body: { version: row.version, request_id },
  })
export const recountStockDocument = (row: StockDocument) =>
  apiRequest<StockDocument>({
    section: 'warehouse',
    path: `/documents/${row.id}/recount`,
    method: 'POST',
    body: { version: row.version },
  })
export const archiveStockDocument = (row: StockDocument) =>
  apiRequest<StockDocument>({
    section: 'warehouse',
    path: `/documents/${row.id}/archive`,
    method: 'POST',
    body: { version: row.version, archived: !row.archived },
  })
