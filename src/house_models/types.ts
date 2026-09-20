export type HouseModelKind = 'catalog' | 'individual'
export type HouseModelConfirmation = 'confirmed' | 'partial' | 'none'

export interface HouseModelBrief {
  key: string
  title: string
  kind: HouseModelKind
  series: string | null
  area_footprint_m2: number | null
  area_total_m2: number | null
  price_site_rub: number | null
  deal_amount_rub: number | null
  client_name: string | null
  confirmation: HouseModelConfirmation
  confirmation_label: string
}

export interface HouseModelSeriesGroup {
  series: string
  models: HouseModelBrief[]
}

export interface HouseModelCatalog {
  series: HouseModelSeriesGroup[]
  individual: HouseModelBrief[]
}

export interface HouseModelDetail extends HouseModelBrief {
  source_note_path: string
  planning_image_id: number | null
  characteristics_md: string | null
  planning_md: string | null
  configurations_md: string | null
  modules_md: string | null
  economics_md: string | null
  production_experience_md: string | null
  deals_without_pz_md: string | null
  files_md: string | null
  open_questions_md: string | null
  notes_md: string | null
}

/** Строка GET /catalog/:key/productions (0073-b) — реальный дом этой модели в
 * производстве. Как и список /api/production/, не отдаёт цену/контакты
 * клиента — только то же, что уже видно в разделе «Производство». */
export interface HouseModelProduction {
  production_id: number
  cycle_id: number
  house_index: number
  client_display_name: string
}
