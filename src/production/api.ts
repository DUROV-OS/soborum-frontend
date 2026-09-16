import { apiRequest } from '@/shared/lib/httpClient'
import { ProductionHome, ProductionListItem, MaterialRequest, Module, ModuleMaterial, Production } from './types'

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

/** POST /api/production/:id/modules */
export function createModule(productionId: number, name: string, description?: string): Promise<Module> {
  return apiRequest<Module>({
    section: SECTION,
    path: `/${productionId}/modules`,
    method: 'POST',
    body: { name, description },
  })
}

/** GET /api/production/modules/:id */
export function getModule(id: number): Promise<Module> {
  return apiRequest<Module>({ section: SECTION, path: `/modules/${id}` })
}

/** PATCH /api/production/modules/:id */
export function updateModule(id: number, patch: { name?: string; description?: string }): Promise<Module> {
  return apiRequest<Module>({ section: SECTION, path: `/modules/${id}`, method: 'PATCH', body: patch })
}

/** DELETE /api/production/modules/:id — только администратор */
export function deleteModule(id: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/modules/${id}`, method: 'DELETE' })
}

export interface AddModuleMaterialInput {
  warehouse_material_id: number
  inventory_number: string
  unit: string
  quantity_required: number
}

/** POST /api/production/modules/:id/materials */
export function addModuleMaterial(moduleId: number, input: AddModuleMaterialInput): Promise<ModuleMaterial> {
  return apiRequest<ModuleMaterial>({
    section: SECTION,
    path: `/modules/${moduleId}/materials`,
    method: 'POST',
    body: input,
  })
}

/** PATCH /api/production/module-materials/:id */
export function updateModuleMaterial(id: number, quantityRequired: number): Promise<ModuleMaterial> {
  return apiRequest<ModuleMaterial>({
    section: SECTION,
    path: `/module-materials/${id}`,
    method: 'PATCH',
    body: { quantity_required: quantityRequired },
  })
}

/** POST /api/production/module-materials/:id/request */
export function requestMaterial(moduleMaterialId: number, quantity: number): Promise<MaterialRequest> {
  return apiRequest<MaterialRequest>({
    section: SECTION,
    path: `/module-materials/${moduleMaterialId}/request`,
    method: 'POST',
    body: { quantity },
  })
}
