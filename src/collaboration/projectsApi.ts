import { apiRequest, downloadFile, type RequestOptions } from '@/shared/lib/httpClient'
import type { Task } from '@/tasks/types'
export type Person = { id: number; name: string; active: boolean; can_task?: boolean }
export type ProjectFile = { id: number; filename: string; size: number; sha256: string; uploaded_by: Person; created_at: string }
export type ProjectMessage = { id: number; body: string; author: Person; created_at: string; reply_to_id: number | null; mentions: Person[]; files: ProjectFile[] }
export type Project = {
  id: number; name: string; description: string; owner_id: number; owner: Person; status: 'active' | 'completed' | 'archived'; deadline: string | null; version: number; created_at: string; unread: number
  can_manage: boolean; can_write: boolean; can_create_task: boolean
  links: {kind: string; id: number; label: string; path: string}[]
  members: Person[]; files: ProjectFile[]; task_count: number
  events: {id: number; kind: string; actor: Person; created_at: string; details: Record<string, unknown>}[]
}
export type ProjectOptions = {people: Person[]; clients: {id:number;name:string}[]; productions: {id:number;name:string}[]; deals: {id:number;name:string}[]; can_create: boolean; can_link_clients: boolean; can_link_production: boolean}
export const request = <T>(path: string, method: RequestOptions['method'] = 'GET', body?: unknown) => apiRequest<T>({section:'projects',path,method,body})
export const listProjects = (query: string, status: string, offset: number) => apiRequest<{items:Project[];total:number;can_create:boolean}>({section:'projects',path:'/',query:{query,status,offset}})
export const projectOptions = (query = '') => apiRequest<ProjectOptions>({section:'projects',path:'/options',query:{query}})
export const getProject = (id: number) => request<Project>(`/${id}`)
export const getMessages = (id: number, query = '', before = 0, after = 0) => apiRequest<{items:ProjectMessage[];has_more:boolean}>({section:'projects',path:`/${id}/messages`,query:{query,before,after}})
export const getProjectTasks = (id: number) => request<{task:Task;source_message_id:number|null}[]>(`/${id}/tasks`)
export function uploadProjectFile(id: number, file: File, key: string) { const form=new FormData();form.append('file',file);form.append('request_id',key);return apiRequest<ProjectFile>({section:'projects',path:`/${id}/files`,method:'POST',form}) }
export const downloadProjectFile = (id: number, file: ProjectFile) => downloadFile('projects',`/${id}/files/${file.id}`,file.filename)
export const projectError = (err: unknown) => err instanceof Error ? err.message : 'Не удалось выполнить действие'
export const projectStatus = {active:'В работе', completed:'Завершён', archived:'В архиве'}
