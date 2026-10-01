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

export interface StockMovement {
  id: number
  warehouse_material_id: number
  delta: number
  reason: MovementReason
  reference_id: number | null
  note: string | null
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
}
