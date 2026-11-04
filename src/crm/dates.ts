import type { Entry } from './api'

export function crmDateQuery(dateFrom = '', dateTo = '', dateUnknown = false): Record<string, string | undefined> {
  return { date_from: dateFrom || undefined, date_to: dateTo || undefined, date_unknown: dateUnknown ? 'true' : undefined }
}

export function crmSourceDateLabel(entry: Pick<Entry, 'source_created_at'>): string {
  const timestamp = entry.source_created_at ? Date.parse(entry.source_created_at) : NaN
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(timestamp)
    : 'Исходная дата неизвестна'
}

export function compareCrmSourceDates(a: Entry, b: Entry): number {
  const left = a.source_created_at ? Date.parse(a.source_created_at) : NaN
  const right = b.source_created_at ? Date.parse(b.source_created_at) : NaN
  if (Number.isFinite(left) && Number.isFinite(right)) return right - left || b.id - a.id
  if (Number.isFinite(left)) return -1
  if (Number.isFinite(right)) return 1
  return b.id - a.id
}
