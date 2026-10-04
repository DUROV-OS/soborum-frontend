export interface RequestBreakdownItem {
  module_id: number
  module_name: string
  production_id: number
  quantity_requested: number
}

// Соответствует WarehouseMaterialOut на бэкенде. `warehouse` и `category` —
// строковые enum'ы (русские подписи), приходят как есть.
export interface Material {
  id: number
  warehouse: string
  category: string
  title: string
  code: string
  unit: string
  is_fractional: boolean
  quantity_in_stock: number
  purchase_price: number
  threshold: number
  /** Характеристики (0078) — все необязательные, у старых материалов пустые. */
  kind: string | null
  size: string | null
  diameter: string | null
  serial_number: string | null
  pack_quantity: number | null
  supplier_id: number | null
  /** Имя поставщика из справочника снабжения; null — поставщик не выбран. */
  supplier_name: string | null
  total_requested: number
  needs_supply: boolean
  request_breakdown: RequestBreakdownItem[]
  created_at: string
}

export type MovementReason =
  | 'supply'
  | 'issued'
  | 'required_adjusted_up'
  | 'request_rejected_return'
  | 'manual_adjust'
  | 'write_off'
  | 'receipt'
  | 'issued_techcard'
  | 'issued_manual'

export interface StockMovement {
  id: number
  warehouse_material_id: number
  delta: number
  reason: MovementReason
  reference_id: number | null
  note: string | null
  operation_id: number | null
  balance_after: number | null
  created_by_id: number
  created_at: string
}

export interface SupplyLine {
  id: number
  warehouse_material_id: number
  quantity: number
}

export interface Supply {
  id: number
  supplier_name: string | null
  created_by_id: number
  created_at: string
  lines: SupplyLine[]
}

export const MOVEMENT_REASON_LABEL: Record<MovementReason, string> = {
  supply: 'Поставка',
  issued: 'Выдано на модуль',
  required_adjusted_up: 'Увеличена потребность',
  request_rejected_return: 'Возврат по отклонённой заявке',
  manual_adjust: 'Ручная корректировка',
  write_off: 'Списание',
  receipt: 'Оприходование',
  issued_techcard: 'Отпуск по техкарте',
  issued_manual: 'Отпуск на объект / в цех',
}

// --- Документы операций склада и журнал (0088) ---

export type OperationKind = 'receipt' | 'write_off' | 'issue_techcard' | 'issue_manual'

export type DestinationKind = 'house' | 'object' | 'workshop' | 'rework'

export const DESTINATION_KIND_LABEL: Record<DestinationKind, string> = {
  house: 'Дом',
  object: 'Объект',
  workshop: 'Цех',
  rework: 'На доработки',
}

/** Причины, которые попадают в журнал (меняют остаток), — для фильтра. */
export const JOURNAL_REASONS: MovementReason[] = [
  'supply',
  'receipt',
  'issued',
  'issued_techcard',
  'issued_manual',
  'write_off',
]

export interface OperationLine {
  movement_id: number
  warehouse_material_id: number
  material_title: string
  material_code: string
  unit: string
  delta: number
  balance_after: number | null
}

export interface WarehouseOperation {
  id: number
  kind: OperationKind
  occurred_at: string
  destination_kind: DestinationKind | null
  destination: string | null
  production_id: number | null
  received_by: string | null
  note: string | null
  created_by_id: number
  created_by_name: string
  created_at: string
  lines: OperationLine[]
}

export interface JournalEntry {
  movement_id: number
  operation_id: number | null
  occurred_at: string
  reason: MovementReason
  warehouse_material_id: number
  material_title: string
  material_code: string
  unit: string
  delta: number
  /** null — движение до 0088, остаток тогда не фиксировался. */
  balance_after: number | null
  destination_kind: DestinationKind | null
  destination: string | null
  production_id: number | null
  received_by: string | null
  note: string | null
  created_by_name: string
}

export interface JournalFilters {
  direction?: 'in' | 'out'
  reason?: MovementReason
  material_id?: number
  production_id?: number
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}
