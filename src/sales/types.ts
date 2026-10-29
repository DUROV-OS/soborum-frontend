export type Line = {
  material_id: number | null
  title: string
  unit: string
  stock_tracked: boolean
  quantity: string
  unit_price: string
  line_total: string
  order_line: number
  shipped_quantity: number
  remaining_quantity: number
  reserved_quantity: number
}
export type SalesEvent = {
  id: number
  kind: string
  actor_id: number
  actor_name?: string
  created_at: string
  data: Record<string, unknown>
}
export type Order = {
  id: number
  number: string
  counterparty_id: number
  counterparty_name: string
  organization_id: number
  organization_name: string
  status: string
  fulfillment: string
  version: number
  total: number
  currency: string
  opening_paid: number
  source_id: string | null
  source_state: string | null
  archived: boolean
  financial_fields_locked: boolean
  expected_at: string | null
  address: string
  note: string
  lines: Line[]
  events?: SalesEvent[]
  shipments?: Shipment[]
}
export type Shipment = {
  id: number
  number: string
  order_id: number | null
  order_version: number | null
  counterparty_name: string
  organization_name: string
  status: string
  version: number
  total: number
  currency: string
  historical: boolean
  archived: boolean
  occurred_at: string
  received_by: string
  address: string
  note: string
  lines: Line[]
  operation_id: number | null
  cancel_operation_id: number | null
  cancellation_note: string | null
  events?: SalesEvent[]
}
export type Catalog = {
  counterparties: { id: number; name: string; inn: string | null; active: boolean }[]
  organizations: { id: number; name: string }[]
  materials: {
    id: number
    title: string
    code: string
    warehouse: string
    unit: string
    is_fractional: boolean
    available_quantity: number
  }[]
}
