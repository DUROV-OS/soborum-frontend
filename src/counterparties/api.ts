import { API_BASE, apiRequest, getToken } from '@/shared/lib/httpClient'
export type Bank = { id: string; account_number: string; bik: string; bank_name: string; correspondent_account: string; bank_address: string; primary: boolean; archived: boolean }
export type Person = { id: string; name: string; phone: string; email: string; primary: boolean; archived: boolean }
export type Card = { name: string; inn: string; legal_type: string; kpp: string; ogrn: string; legal_address: string; actual_address: string; addresses_same: boolean; director: string; accounts: Bank[]; contacts: Person[] }
export type Row = { id: number; supplier_id: number | null; client_id: number | null; kind: string; active: boolean; version: number; etag: string; card: Card; complete: boolean; can_edit: boolean; bank_verification: { verified: boolean; can_verify: boolean; reviewer: string | null } }
export type Preview = { id: string; source: { kind: string; fetched_at: string }; changes: { key: string; old: string; value: string; fill_empty: boolean }[]; warnings: string[] }
export type Doc = { key: string; type: string; type_label: string; number: string; date: string; amount: string | null; currency: string; status: string; url: string; source: string }
export const blank = (): Card => ({ name: '', inn: '', legal_type: '', kpp: '', ogrn: '', legal_address: '', actual_address: '', addresses_same: false, director: '', accounts: [], contacts: [] })
export const types: Record<string,string> = { legal_entity: 'Юридическое лицо', sole_proprietor: 'Индивидуальный предприниматель', individual: 'Физическое лицо' }
export const labels: Record<string,string> = { name: 'Наименование', inn: 'ИНН', legal_type: 'Тип контрагента', kpp: 'КПП', ogrn: 'ОГРН', legal_address: 'Юридический адрес', actual_address: 'Фактический адрес', director: 'Директор (ФИО)', account_number: 'Расчётный счёт', bik: 'БИК банка', bank_name: 'Наименование банка', correspondent_account: 'Корреспондентский счёт', bank_address: 'Адрес банка', phone: 'Телефон', email: 'Email' }
export function call<T>(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown, query?: Record<string,string | number | undefined>): Promise<T> { return apiRequest({ section: 'counterparties', path, method, body, query }) }
export const message = (e: unknown) => e instanceof Error ? e.message : 'Не удалось выполнить действие'
export async function download(id: number, format: string, filters: Record<string,string>) {
  const params = new URLSearchParams({ ...filters, format })
  const response = await fetch(`${API_BASE}/counterparties/${id}/documents/export?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!response.ok) throw new Error('Не удалось выгрузить документы. Проверьте доступ и повторите.')
  const url = URL.createObjectURL(await response.blob()), a = document.createElement('a')
  a.href = url; a.download = `Контрагент-${id}.${format}`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
