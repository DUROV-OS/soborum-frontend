import { apiRequest } from '@/shared/lib/httpClient'
import { ProductionHome, ProductionListItem, MaterialRequest, Block, BlockMaterial, Production } from './types'

const SECTION = 'production'

/** Собственный список: достаточно права production, данные клиентов не запрашиваются. */
export function listProductions(): Promise<ProductionListItem[]> {
  return apiRequest<ProductionListItem[]>({ section: SECTION, path: '/' })
}

/** GET /api/production/:id */
export function getProduction(id: number): Promise<Production> {
  return apiRequest<Production>({ section: SECTION, path: `/${id}` })
}

/** GET /api/production/:id/home — виджеты вкладки «Главная» этого производства. */
export function getProductionHome(id: number): Promise<ProductionHome> {
  return apiRequest<ProductionHome>({ section: SECTION, path: `/${id}/home` })
}

/** DELETE /api/production/:id — только администратор */
export function deleteProduction(id: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/${id}`, method: 'DELETE' })
}

/** POST /api/production/:id/blocks */
export function createBlock(productionId: number, name: string, description?: string): Promise<Block> {
  return apiRequest<Block>({
    section: SECTION,
    path: `/${productionId}/blocks`,
    method: 'POST',
    body: { name, description },
  })
}

/** GET /api/production/blocks/:id */
export function getBlock(id: number): Promise<Block> {
  return apiRequest<Block>({ section: SECTION, path: `/blocks/${id}` })
}

/** PATCH /api/production/blocks/:id */
export function updateBlock(id: number, patch: { name?: string; description?: string }): Promise<Block> {
  return apiRequest<Block>({ section: SECTION, path: `/blocks/${id}`, method: 'PATCH', body: patch })
}

/** DELETE /api/production/blocks/:id — только администратор */
export function deleteBlock(id: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/blocks/${id}`, method: 'DELETE' })
}

/** POST /api/production/blocks/:id/dependencies */
export function addBlockDependency(blockId: number, dependsOnId: number): Promise<Block> {
  return apiRequest<Block>({
    section: SECTION,
    path: `/blocks/${blockId}/dependencies`,
    method: 'POST',
    body: { depends_on_id: dependsOnId },
  })
}

/** DELETE /api/production/blocks/:id/dependencies/:dependsOnId */
export function removeBlockDependency(blockId: number, dependsOnId: number): Promise<Block> {
  return apiRequest<Block>({
    section: SECTION,
    path: `/blocks/${blockId}/dependencies/${dependsOnId}`,
    method: 'DELETE',
  })
}

export interface AddBlockMaterialInput {
  warehouse_material_id: number
  inventory_number: string
  unit: string
  quantity_required: number
}

/** POST /api/production/blocks/:id/materials */
export function addBlockMaterial(blockId: number, input: AddBlockMaterialInput): Promise<BlockMaterial> {
  return apiRequest<BlockMaterial>({
    section: SECTION,
    path: `/blocks/${blockId}/materials`,
    method: 'POST',
    body: input,
  })
}

/** PATCH /api/production/block-materials/:id */
export function updateBlockMaterial(id: number, quantityRequired: number): Promise<BlockMaterial> {
  return apiRequest<BlockMaterial>({
    section: SECTION,
    path: `/block-materials/${id}`,
    method: 'PATCH',
    body: { quantity_required: quantityRequired },
  })
}

/** POST /api/production/block-materials/:id/request */
export function requestMaterial(blockMaterialId: number, quantity: number): Promise<MaterialRequest> {
  return apiRequest<MaterialRequest>({
    section: SECTION,
    path: `/block-materials/${blockMaterialId}/request`,
    method: 'POST',
    body: { quantity },
  })
}
