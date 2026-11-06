import { API_BASE, ApiError, apiRequest, getToken } from '@/shared/lib/httpClient'
import type { Entry } from './api'

export type AgencyLogo = { content_type: 'image/png'; width: number; height: number; byte_size: number; sha256: string; updated_at: string }
export type LogoStatus = { agency_id: number; version: number; logo: AgencyLogo | null }
export type LogoUpdate = { entry: Entry; logo: AgencyLogo | null }

const path = (agencyId: number) => `/agencies/${agencyId}/logo`
export const logoStatus = (agencyId: number) => apiRequest<LogoStatus>({ section: 'crm', path: path(agencyId) })

async function request(agencyId: number, suffix: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}/crm${path(agencyId)}${suffix}`, { ...options, headers, cache: 'no-store' })
  if (!response.ok) {
    let message = 'Не удалось выполнить действие с логотипом. Повторите попытку.'
    try { const body = await response.json(); if (typeof body.detail === 'string') message = body.detail } catch { /* retain a safe message */ }
    throw new ApiError(response.status, message)
  }
  return response
}

export async function logoContent(agencyId: number, digest: string, signal: AbortSignal): Promise<Blob> {
  const response = await request(agencyId, '/content', { signal, headers: { 'If-Match': `"${digest}"` } })
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'image/png') throw new Error('Сервер вернул неподдерживаемое изображение')
  return response.blob()
}

export async function saveLogo(entry: Entry, file: File): Promise<LogoUpdate> {
  const response = await request(entry.id, '', { method: 'PUT', body: file, signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'If-Match': `"${entry.version}"` } })
  return response.json() as Promise<LogoUpdate>
}

export const removeLogo = (entry: Entry) => apiRequest<LogoUpdate>({ section: 'crm', path: path(entry.id),
  method: 'DELETE', body: { version: entry.version } })
