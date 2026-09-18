import { FileAsset } from '@/clients/types'
import { HouseModelBrief } from '@/house_models/types'
import { WidgetTone } from '@/today/types'

export type MaterialRequestStatus = 'pending' | 'approved' | 'rejected'

export type ProductionCriticality = 'normal' | 'warning' | 'critical'

export interface MaterialRequest {
  id: number
  block_material_id: number
  warehouse_material_id: number
  quantity: number
  status: MaterialRequestStatus
  requested_by_id: number
  decided_by_id: number | null
  created_at: string
  decided_at: string | null
}

export interface BlockMaterial {
  id: number
  block_id: number
  warehouse_material_id: number
  inventory_number: string
  unit: string
  quantity_required: number
  quantity_requested: number
  quantity_provided: number
  requests: MaterialRequest[]
}

export interface Block {
  id: number
  production_id: number
  name: string
  description: string | null
  /** Порядок блока внутри производства — узел направленного графа этапов. */
  sequence: number
  /** id блоков, которые должны быть закрыты раньше этого. */
  depends_on_ids: number[]
  materials: BlockMaterial[]
}

export interface Production {
  id: number
  cycle_id: number
  /** Порядковый номер дома в цикле (1 для одиночного заказа). */
  house_index: number
  /** Название проекта дома, напр. «Дом 1». */
  name: string
  created_at: string
  blocks: Block[]
}

/** Строка списка /api/production/ — по одной на каждый дом (множественный
 * заказ даёт несколько строк на цикл). Данные клиента не отдаются: списку
 * достаточно права production. */
export interface ProductionListItem {
  id: number
  cycle_id: number
  /** Порядковый номер дома в цикле (1 для одиночного заказа). */
  house_index: number
  /** Название проекта дома, напр. «Дом 1». */
  name: string
  cycle_status: 'client' | 'production' | 'installation' | 'completed'
  created_at: string
  block_count: number
  /** Истина, если есть хотя бы один блок и ни у одного блока нет открытых задач. */
  is_completed: boolean
  /** Только для незавершённых — у завершённых всегда 'normal'. */
  criticality: ProductionCriticality
}

// ----------------------------------------------------------------- «Главная» --
// GET /api/production/:id/home (0065) — те же виджеты, что на «Пульсе»
// («Требует внимания», «Актуальное»), но по одному циклу/дому, плюс «Сроки»
// и урезанные документы клиента (без цены/контактов).

export interface ProductionAttention {
  id: string
  title: string
  description: string
  href: string
  tone: WidgetTone
}

export interface ProductionAktualnoe {
  stage: string
  percent: number
  phrase: string
}

export interface DeadlineInsight {
  title: string
  description: string
  impact: string
  source: 'ai' | 'fallback' | 'none'
}

export interface ProductionHomeDocuments {
  house_model: HouseModelBrief | null
  ar_file: FileAsset | null
  kr_file: FileAsset | null
  house_project_file: FileAsset | null
}

export interface ProductionHome {
  actions: ProductionAttention[]
  aktualnoe: ProductionAktualnoe | null
  deadlines: DeadlineInsight
  documents: ProductionHomeDocuments
}
