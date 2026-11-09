import { call } from './api'

export type Stage = 'production' | 'accounting' | 'director'
export const stages: Stage[] = ['production', 'accounting', 'director']
export const stageLabels = { production: 'Состав и работы', accounting: 'Расходы и документы', director: 'Цена и маржа', complete: 'Всё согласовано' }
export type ReviewState = { production_approved: boolean; accounting_approved: boolean; director_approved: boolean; issues?: string[]; next_stage: Stage | 'complete' }
export type ReviewAccess = { financial: boolean; edit: boolean; stages: Stage[]; responsible: Record<Stage, { id: number; name: string } | null> }
export type Fact = { key: string; label: string; value: string | null; unit: string }
export type Document = { id: number; title: string; filename?: string; sha256: string; size_bytes: number }
export type Proof = { key: string; value: string; document_id: number; locator: string }
export type ReviewHistory = { id: number; stage: Stage; version: number; actor: string; created_at: string; reason: string; work_scope?: string; evidence?: (Proof & { title: string; sha256: string })[] }
export type Material = { material_id: number; name: string; unit: string; quantity: string }
export type Basis = { title: string; note?: string; source_recipe_id?: number; source_recipe_version?: number; lines: Material[]; replacements: Material[]; members?: Basis[] }
export type ReviewItem = { id: number; version: number; title: string; production_approved: boolean; basis: Basis }
export type Plan = { id: number; version: number; month: string; content: { planned_units: number; factory: string; warehouse: string; staff: string; other: string; note: string }; total: string; per_unit: string; approved: boolean; current: boolean; accounting_approved: boolean; director_approved: boolean; facts: Fact[]; documents: Document[]; history?: ReviewHistory[] }
export type ProjectReview = { id: number; version: number; title: string; number: string; quantity: string; note: string; bom: Material[]; technical_basis?: { parts: { item: Basis; quantity: string }[] }; state: ReviewState; facts?: Fact[]; documents?: Document[]; history: ReviewHistory[]; overhead_plan?: Plan | null; result?: { price: string | null; cost: string | null; profit: string | null; margin_percent: string | null; minimum_price: string | null; status: string } }
export type ReviewQueue = { items: Omit<ReviewItem, 'basis'>[]; estimates: { id: number; version: number; title: string; number: string; state: ReviewState }[] }
export const governance = <T>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: unknown) => call<T>('/governance' + path, method, body)
