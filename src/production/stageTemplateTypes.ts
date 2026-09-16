export type TemplateStatus = 'draft' | 'reviewed' | 'confirmed'

export interface KrPageRef {
  page_number: number
  note: string | null
}

export interface TemplateBlockTask {
  id: number
  title: string
  description: string | null
  kr_page_ref: KrPageRef | null
}

export interface TemplateBlockMaterial {
  id: number
  name: string
  unit: string
  kr_page_ref: KrPageRef | null
  warehouse_material_id: number | null
}

export interface StageTemplateBlock {
  id: number
  name: string
  description: string | null
  sequence: number
  depends_on_ids: number[]
  kr_page_refs: KrPageRef[]
  tasks: TemplateBlockTask[]
  materials: TemplateBlockMaterial[]
}

export interface ProductionStageTemplate {
  id: number
  house_model_key: string | null
  status: TemplateStatus
  source_client_id: number
  created_at: string
  confirmed_at: string | null
  confirmed_by_id: number | null
  blocks: StageTemplateBlock[]
}

export interface KrPage {
  page_number: number
  text: string
  image_file_id: number
}

export interface KrExtraction {
  client_id: number
  pages: KrPage[]
  extracted_at: string
}
