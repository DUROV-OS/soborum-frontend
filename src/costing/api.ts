import { apiRequest, downloadFile, RequestOptions } from '@/shared/lib/httpClient'

export type Amount = string | null
export type Material = { id: number; version: number; warehouse_material_id: number | null; name: string; category: string; unit: string; price: Amount; price_source: string; effective_on: string; archived: boolean }
export type Profile = { name: string; margin: string; labor: string; management: string; tax: string }
export type Expenses = Record<'labor' | 'transport' | 'subcontract' | 'overhead' | 'commercial' | 'advertising' | 'taxes' | 'reserve', Amount> & { evidence: string }
export type MaterialLine = { material_id: number; quantity: string }
export type Settings = { version: number; content: { company: string; logo: string; profiles: Profile[]; labor_label: string; management_label: string; tax_label: string; rate_step: string; total_step: string; addon_step: string; mode: 'area' | 'unit' } }
export type ItemData = { code: string; category: string; model: string; profile: string; mode: 'area' | 'unit'; unit: string; area: Amount; length: Amount; width: Amount; modules: { length: string; width: string; count: number }[]; image: string; note: string; lines: MaterialLine[]; replacements: MaterialLine[]; expenses: Expenses; margin: Amount; retail_price: Amount; retail_rate: Amount; addons: { addon_id: number; quantity: string }[]; package_prices: Record<string, string>; discount: string }
export type Calculation = { price: Amount; recommended?: Amount; recommended_rate?: Amount; cost: Amount; profit: Amount; margin_percent: Amount; missing: string[]; below_target?: boolean; revenue_expenses?: { label: string; amount: string }[]; area?: Amount; materials?: Amount; fixed?: Amount; profile?: Profile }
export type Item = { id: number; version: number; title: string; kind: 'template' | 'addon' | 'package'; archived: boolean; content: ItemData; calculation: Calculation }
export type CatalogItem = { id: number; version: number; title: string; kind: Item['kind']; code: string; category: string; model: string; mode: 'area' | 'unit'; unit: string; area: Amount; image: string; price: Amount; available: boolean }
export type CommercialLine = { item_id: number; kind: string; title: string; package: string; quantity: string; unit_price: Amount; amount: Amount }
export type EstimateInput = { request_id: string; version?: number; title: string; number: string; client_id: number | null; template_id: number; quantity: string; selections: { item_id: number; quantity: string }[]; discount: string; sale_price: Amount; note: string; reason: string; lines?: MaterialLine[] | null; profile?: Profile | null; expenses?: Expenses | null; image?: string | null }
export type Estimate = { id: number; version: number; revision: number; title: string; number: string; client_id: number | null; actor_id: number; status: 'draft' | 'approved'; archived: boolean; created_at: string; revision_at: string; company: string; logo: string; image: string; commercial: CommercialLine[]; price: Amount; list_price: Amount; discount_amount: Amount; note: string; input: Omit<EstimateInput, 'request_id' | 'version' | 'reason'>; result?: Calculation & { status: string; minimum_price: Amount; rate_cost: Amount; base_cost: Amount }; bom?: (MaterialLine & { name: string; category: string; unit: string; price: Amount; amount: Amount })[]; profile?: Profile; expenses?: Expenses }
export type Access = { internal: boolean; edit: boolean; full: boolean; estimate_edit: boolean }
export type History = { revision: number; created_at: string; actor_id: number; price: Amount; reason?: string; cost?: Amount; margin_percent?: Amount }
export type Signal = { kind: string; title: string; entity: string; id: number; message: string }
export type JournalEntry = { id: number; entity: string; entity_id: number; action: string; actor_id: number; created_at: string; before: unknown; after: unknown }
export type PriceVersion = { id: number; title: string; actor_id: number; created_at: string; items?: Item[] }

export function call<T>(path: string, method: RequestOptions['method'] = 'GET', body?: unknown, query?: RequestOptions['query']) {
  return apiRequest<T>({ section: 'costing', path, method, body, query })
}
export function exportFile(path: string, name: string) { return downloadFile('costing', path, name) }
export const expenseLabels: [keyof Omit<Expenses, 'evidence'>, string][] = [
  ['labor', 'Работы фиксированно'], ['transport', 'Транспорт'], ['subcontract', 'Подряд'], ['overhead', 'Накладные на изделие'],
  ['commercial', 'Коммерческие расходы'], ['advertising', 'Реклама'], ['taxes', 'Налоги фиксированно'], ['reserve', 'Резерв'],
]
export const emptyExpenses = (): Expenses => ({ labor: null, transport: null, subcontract: null, overhead: null, commercial: null, advertising: null, taxes: null, reserve: null, evidence: '' })
export const money = (value: Amount | undefined) => value == null ? '—' : `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
export const dateLabel = (value: string) => new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
export function newData(): ItemData { return { code: '', category: '', model: '', profile: 'Базовый', mode: 'unit', unit: 'шт', area: null, length: null, width: null, modules: [], image: '', note: '', lines: [], replacements: [], expenses: emptyExpenses(), margin: null, retail_price: null, retail_rate: null, addons: [], package_prices: {}, discount: '0' } }
export async function readImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Изображение должно быть не больше 5 МБ')
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать изображение')); reader.readAsDataURL(file) })
}
