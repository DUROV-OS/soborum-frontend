import { apiRequest } from '@/shared/lib/httpClient'
import { Task, TaskLinkType, TaskStatus } from './types'

const SECTION = 'tasks'

export type TaskScope = 'mine' | 'claimable' | 'all'

export interface TaskFilters {
  scope?: TaskScope
  assignee_id?: number
  reviewer_id?: number
  block_id?: number
  link_type?: TaskLinkType
  status?: TaskStatus
  overdue?: boolean
  [key: string]: string | number | boolean | undefined
}

/** GET /api/tasks/ */
export function listTasks(filters: TaskFilters = {}): Promise<Task[]> {
  return apiRequest<Task[]>({ section: SECTION, path: '/', query: filters })
}

/** GET /api/tasks/:id */
export function getTask(id: number): Promise<Task> {
  return apiRequest<Task>({ section: SECTION, path: `/${id}` })
}

export interface CreateTaskInput {
  title: string
  description?: string
  deadline?: string
  assignee_ids: number[]
  reviewer_ids: number[]
  responsible_id?: number
  depends_on_ids: number[]
  image_ids?: number[]
  block_id?: number
}

/** POST /api/tasks/ */
export function createTask(input: CreateTaskInput): Promise<Task> {
  return apiRequest<Task>({ section: SECTION, path: '/', method: 'POST', body: input })
}

/** PATCH /api/tasks/:id/status */
export function setStatus(id: number, status: TaskStatus): Promise<Task> {
  return apiRequest<Task>({ section: SECTION, path: `/${id}/status`, method: 'PATCH', body: { status } })
}

/** DELETE /api/tasks/:id */
export function deleteTask(id: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/${id}`, method: 'DELETE' })
}

/** POST /api/tasks/:id/claim */
export function claimTask(id: number): Promise<Task> {
  return apiRequest<Task>({ section: SECTION, path: `/${id}/claim`, method: 'POST' })
}
