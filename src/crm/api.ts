import { apiRequest } from '@/shared/lib/httpClient'
export type Kind = 'deal' | 'contact' | 'company' | 'task' | 'pipeline' | 'stage' | 'inquiry'
export type Entry = {
  board_task_id?: number | null
  id: number
  kind: Kind
  name: string
  archived: boolean
  data: Record<string, unknown>
  version: number
  source_id?: string
  updated_at: string
}
export type Catalog = {
  pipelines: Entry[]
  stages: Entry[]
  users: { id: number; name: string }[]
  counts: Record<string, number>
}
export type History = {
  total: number
  items: { id: string; created_at: string; text: string; source: string; details: Record<string, unknown> }[]
}
export const catalog = () => apiRequest<Catalog>({ section: 'crm', path: '/catalog' })
export const list = (kind: Kind, query: Record<string, string | number | undefined> = {}) =>
  apiRequest<{ total: number; items: Entry[] }>({
    section: 'crm',
    path: '/entries',
    query: { kind, ...query },
  })
export const create = (kind: Kind, name: string, data: Record<string, unknown>) =>
  apiRequest<Entry>({ section: 'crm', path: `/entries/${kind}`, method: 'POST', body: { name, data } })
export const patch = (
  entry: Entry,
  fields: { name?: string; data?: Record<string, unknown>; archived?: boolean },
) =>
  apiRequest<Entry>({
    section: 'crm',
    path: `/entries/${entry.id}`,
    method: 'PATCH',
    body: { version: entry.version, ...fields },
  })
export const history = (id: number, offset = 0) =>
  apiRequest<History>({ section: 'crm', path: `/entries/${id}/history`, query: { offset } })
export const note = (id: number, text: string) =>
  apiRequest({ section: 'crm', path: `/entries/${id}/notes`, method: 'POST', body: { text } })

export const accept = (id: number, name: string, data: Record<string, unknown>) =>
  apiRequest<Entry>({ section: 'crm', path: `/entries/${id}/accept`, method: 'POST', body: { name, data } })
