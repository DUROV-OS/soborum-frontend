import { apiRequest } from '@/shared/lib/httpClient'
import { KrExtraction, ProductionStageTemplate } from './stageTemplateTypes'

const SECTION = 'production'

/** POST /api/production/stage-templates/generate?client_id= — генерация/переиспользование. */
export function generateStageTemplate(clientId: number): Promise<ProductionStageTemplate> {
  return apiRequest<ProductionStageTemplate>({
    section: SECTION,
    path: '/stage-templates/generate',
    method: 'POST',
    query: { client_id: clientId },
  })
}

/** GET /api/production/stage-templates/:id */
export function getStageTemplate(id: number): Promise<ProductionStageTemplate> {
  return apiRequest<ProductionStageTemplate>({ section: SECTION, path: `/stage-templates/${id}` })
}

export interface BlockPatch {
  name?: string
  description?: string
}

/** PATCH /api/production/stage-templates/:id/blocks/:blockId */
export function updateStageTemplateBlock(
  templateId: number, blockId: number, patch: BlockPatch
): Promise<ProductionStageTemplate> {
  return apiRequest<ProductionStageTemplate>({
    section: SECTION, path: `/stage-templates/${templateId}/blocks/${blockId}`, method: 'PATCH', body: patch,
  })
}

export interface TaskPatch {
  title?: string
  description?: string
}

/** PATCH /api/production/stage-templates/:id/blocks/:blockId/tasks/:taskId */
export function updateStageTemplateTask(
  templateId: number, blockId: number, taskId: number, patch: TaskPatch
): Promise<ProductionStageTemplate> {
  return apiRequest<ProductionStageTemplate>({
    section: SECTION,
    path: `/stage-templates/${templateId}/blocks/${blockId}/tasks/${taskId}`,
    method: 'PATCH',
    body: patch,
  })
}

export interface MaterialPatch {
  name?: string
  unit?: string
  warehouse_material_id?: number
}

/** PATCH /api/production/stage-templates/:id/blocks/:blockId/materials/:materialId */
export function updateStageTemplateMaterial(
  templateId: number, blockId: number, materialId: number, patch: MaterialPatch
): Promise<ProductionStageTemplate> {
  return apiRequest<ProductionStageTemplate>({
    section: SECTION,
    path: `/stage-templates/${templateId}/blocks/${blockId}/materials/${materialId}`,
    method: 'PATCH',
    body: patch,
  })
}

/** POST /api/production/stage-templates/:id/confirm */
export function confirmStageTemplate(id: number): Promise<ProductionStageTemplate> {
  return apiRequest<ProductionStageTemplate>({
    section: SECTION, path: `/stage-templates/${id}/confirm`, method: 'POST',
  })
}

/** GET /api/production/kr-extraction/:clientId — постраничные изображения для «чертежа». */
export function getKrExtraction(clientId: number): Promise<KrExtraction> {
  return apiRequest<KrExtraction>({ section: SECTION, path: `/kr-extraction/${clientId}` })
}
