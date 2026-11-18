import { API_BASE, apiRequest, getToken } from '@/shared/lib/httpClient'
export type Scope = 'personal' | 'company'
export type Folder = { id: string; name: string; scope: Scope; version: number; can_edit: boolean }
export type Revision = { id: string; number: number; filename: string; size: number; sha256: string; media_type: string; author: string; created_at: string }
export type DriveFile = { id: string; name: string; scope: Scope; folder_id: string | null; folder_name: string | null; owner: string; version: number; deleted: boolean; can_edit: boolean; updated_at: string; revision: Revision }
export type FileList = { items: DriveFile[]; total: number; offset: number; limit: number }
export type History = { file: DriveFile; versions: Revision[]; history_verified: boolean; changes: { id: number; action: string; actor: string; at: string; details: Record<string, unknown> }[] }
const call = <T,>(path: string, extra: Partial<Parameters<typeof apiRequest>[0]> = {}) => apiRequest<T>({ section: 'drive', path, timeoutMs: 60000, ...extra })
export const listFolders = (scope: Scope) => call<Folder[]>('/folders', { query: { scope } })
export const listFiles = (scope: Scope, folder_id: string, q: string, trash: boolean, offset = 0) => call<FileList>('/files', { query: { scope, folder_id: folder_id || undefined, q, trash, offset, limit: 50 } })
export const createFolder = (scope: Scope, name: string) => call<Folder>('/folders', { method: 'POST', body: { request_id: crypto.randomUUID(), scope, name } })
export const fileHistory = (id: string) => call<History>(`/files/${id}/history`)
export const mutateFile = (file: DriveFile, action: 'name' | 'folder' | 'trash' | 'restore', extra = {}) => call<DriveFile>(`/files/${file.id}/${action}`, { method: action === 'name' || action === 'folder' ? 'PATCH' : 'POST', body: { request_id: crypto.randomUUID(), version: file.version, ...extra } })
export async function uploadFile(file: File, scope: Scope, folder: string, previous?: DriveFile) {
  const form = new FormData()
  form.append('request_id', crypto.randomUUID()); form.append('scope', scope); form.append('file', file)
  if (folder) form.append('folder_id', folder)
  if (previous) { form.append('file_id', previous.id); form.append('version', String(previous.version)) }
  return call<DriveFile>('/files', { method: 'POST', form, timeoutMs: 180000 })
}
export async function downloadFile(file: DriveFile, revision?: Revision) {
  const query = revision ? `?revision_id=${encodeURIComponent(revision.id)}` : ''
  const response = await fetch(`${API_BASE}/drive/files/${file.id}/download${query}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` }, cache: 'no-store', signal: AbortSignal.timeout(180000) })
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === 'string' ? body.detail : 'Не удалось скачать файл') }
  const url = URL.createObjectURL(await response.blob()), link = document.createElement('a')
  link.href = url; link.download = (revision?.filename || file.name).replace(/[\\/]/g, '_')
  document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
