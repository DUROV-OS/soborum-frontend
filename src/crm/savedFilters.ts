export type CrmFilterSnapshot = {
  view: 'board' | 'list'; pipeline: string; stage: string; archive: 'active' | 'archived' | 'all'
  query: string; owner: string; priority: '' | 'low' | 'medium' | 'high'
  dates: { from: string; to: string; unknown: boolean }
  spam: 'normal' | 'spam' | 'all'; temperature: '' | 'hot' | 'warm' | 'cold' | 'unknown'
}
export type SavedCrmFilter = { id: string; name: string; filters: CrmFilterSnapshot }
export type FilterStorage = Pick<Storage, 'getItem' | 'setItem'>
const LIMIT = 20
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Неверный формат сохранённых фильтров.')
  return value as Record<string, unknown>
}
const choice = <T extends string>(value: unknown, allowed: readonly T[]): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error('Сохранённый фильтр содержит неизвестное значение.')
  return value as T
}
const text = (value: unknown, max: number) => {
  if (typeof value !== 'string' || value.length > max) throw new Error('Неверное текстовое поле фильтра.')
  return value
}
const identifier = (value: unknown, zero = false) => {
  const result = text(value, 20)
  if (result !== '' && !(zero && result === '0') && !/^[1-9]\d*$/.test(result)) throw new Error('Неверный идентификатор в фильтре.')
  return result
}
function date(value: unknown) {
  const result = text(value, 10)
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result)) throw new Error('Некорректная дата фильтра.')
  return result
}
export function parseFilterSnapshot(value: unknown): CrmFilterSnapshot {
  const data = object(value), dates = object(data.dates)
  if (typeof dates.unknown !== 'boolean') throw new Error('Неверный фильтр исходной даты.')
  const from = date(dates.from), to = date(dates.to)
  if (from && to && from > to) throw new Error('Начало периода должно быть не позже его окончания.')
  return {
    view: choice(data.view, ['board', 'list']), pipeline: identifier(data.pipeline), stage: identifier(data.stage),
    archive: choice(data.archive, ['active', 'archived', 'all']), query: text(data.query, 1000), owner: identifier(data.owner, true),
    priority: choice(data.priority, ['', 'low', 'medium', 'high']), dates: { from, to, unknown: dates.unknown },
    spam: choice(data.spam, ['normal', 'spam', 'all']), temperature: choice(data.temperature, ['', 'hot', 'warm', 'cold', 'unknown']),
  }
}
export function filterStorageKey(accountId: number, kind: string) {
  if (!Number.isSafeInteger(accountId) || accountId < 1 || !['deal', 'contact', 'company', 'task', 'inquiry'].includes(kind)) throw new Error('Не удалось определить рабочую область фильтров.')
  return `durov.crm.filters.v1:${accountId}:${kind}`
}
export function readSavedFilters(storage: FilterStorage, key: string): SavedCrmFilter[] {
  const raw = storage.getItem(key)
  if (raw === null) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('Не удалось прочитать сохранённые наборы. Данные не изменены.') }
  const data = object(parsed)
  if (data.version !== 1 || !Array.isArray(data.items) || data.items.length > LIMIT) throw new Error('Неизвестная версия сохранённых фильтров. Данные не изменены.')
  const items = data.items.map(value => {
    const item = object(value), id = text(item.id, 100), name = text(item.name, 60).trim()
    if (!id || !name) throw new Error('Повреждено название сохранённого фильтра.')
    return { id, name, filters: parseFilterSnapshot(item.filters) }
  })
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Повторяющиеся идентификаторы фильтров.')
  return items
}
function persist(storage: FilterStorage, key: string, items: SavedCrmFilter[]) {
  storage.setItem(key, JSON.stringify({ version: 1, items }))
  return items
}
export function storeSavedFilter(storage: FilterStorage, key: string, item: SavedCrmFilter, update = false) {
  // Re-read before every write so another tab's additions are retained.
  const items = readSavedFilters(storage, key)
  const name = text(item.name, 60).trim(), filters = parseFilterSnapshot(item.filters)
  if (!name || !item.id) throw new Error('Укажите название фильтра.')
  const index = items.findIndex(saved => saved.id === item.id)
  if (update && index === -1) throw new Error('Этот фильтр уже удалён. Сохраните новый набор.')
  if (!update && index !== -1) throw new Error('Такой фильтр уже существует.')
  if (items.some(saved => saved.id !== item.id && saved.name.toLocaleLowerCase('ru-RU') === name.toLocaleLowerCase('ru-RU'))) throw new Error('Такое название уже есть. Укажите другое или обновите выбранный набор.')
  if (index === -1 && items.length >= LIMIT) throw new Error('Можно сохранить до 20 наборов в каждом разделе. Удалите ненужный набор.')
  const next = { id: item.id, name, filters }
  if (index === -1) items.push(next); else items[index] = next
  return persist(storage, key, items)
}
export function removeSavedFilter(storage: FilterStorage, key: string, id: string) {
  return persist(storage, key, readSavedFilters(storage, key).filter(item => item.id !== id))
}
