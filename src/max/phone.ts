/** `+79001234567` → `+7 900 123-45-67`. Не российский формат (не 11 цифр
 * на 7) — как пришёл. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length !== 11 || !d.startsWith('7')) return phone
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`
}

/** Номер совпадает с запросом поиска: сравниваем только цифры, так что
 * `900 12`, `+7900` и `8 900` находят один номер. */
export function phoneMatches(phone: string | null, query: string): boolean {
  if (!phone) return false
  let q = query.replace(/\D/g, '')
  if (q.length < 3) return false
  if (q.length === 11 && q.startsWith('8')) q = `7${q.slice(1)}`
  return phone.replace(/\D/g, '').includes(q)
}
