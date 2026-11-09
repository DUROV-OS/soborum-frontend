import { apiRequest } from '@/shared/lib/httpClient'

export const evidenceApi = <T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown, query?: Record<string, string | number | undefined>) => apiRequest<T>({ section: 'accounting', path: '/evidence' + path, method, body, query })
export const reviewLabels: Record<string, string> = { no_document: 'Нет документа', unclassified: 'Не разнесено', pending: 'На проверке', stale: 'Нужна повторная проверка', verified: 'Документы проверены', cancelled: 'Платёж отменён' }
export const natureLabels: Record<string, string> = { expense: 'Оплата расхода', advance: 'Аванс', refund: 'Возврат денег', transfer: 'Перевод, не расход' }
export type ReviewStatus = { state: string; version: number; issues: string[]; checked_by?: string; checked_at?: string }
export type EvidenceRow = { id: number; date: string; amount: string; currency: string; status: string; purpose: string; counterparty: string | null; account: string | null; review: ReviewStatus }
export type EvidenceOverview = { as_of: string; counts: Record<string, number>; totals: { currency: string; income: string; expense: string; net: string; unverified_expense: string }[]; items: EvidenceRow[]; total: number; responsible: { id: number; name: string } | null; bank_reconciled: boolean; actual_profit_available: boolean }
export type Citation = { file_id: number; locator: string }
export type Allocation = { amount: string; category: string; scope: 'month' | 'project'; project_id: number | null; month: string | null; evidence: Citation; note: string }
export type EvidenceDraft = { nature: string; payment_evidence: Citation; allocations: Allocation[]; reason: string }
export type EvidenceDetail = {
  movement: { id: number; amount: string; tax: string; currency: string; payment_purpose: string | null; external_number: string | null; doc_date: string | null }; source_hash: string; status: string; counterparty: string | null; account: string | null; review: ReviewStatus;
  responsible: { id: number; name: string } | null; can_edit: boolean; can_check: boolean;
  documents: { id: number; filename: string; sha256: string | null; size_bytes: number | null; integrity: string; created_at: string }[];
  versions: { version: number; actor: string; created_at: string; data: EvidenceDraft; check: { actor: string; created_at: string; reason: string } | null; proofs: Record<string, { filename: string; sha256: string }> }[];
}
export type EvidenceOptions = { categories: Record<string, string>; projects: { id: number; title: string; number: string }[] }
export const cash = (value: string, currency = 'RUB') => new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
