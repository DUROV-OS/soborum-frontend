import type { QueueHouse } from './controlApi'

export function queueState(house: QueueHouse) {
  const hasNorm = house.control.norm.lines.some(line => Number(line.quantity) > 0)
  if (!hasNorm) return 'missing_norm'
  if (!house.control.approved) return 'approval'
  if (house.remaining_positions > 0) return 'issuing'
  // Zero demand alone is not evidence that materials have been issued.
  return house.provided_positions > 0 ? 'completed' : 'check'
}

export function stockQuantities(stock: number, balance: number) {
  return { reserved: Math.max(0, stock - balance), issuable: Math.max(0, balance) }
}

export const formatQuantity = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 6 })
