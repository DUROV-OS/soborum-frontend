import { apiRequest } from '@/shared/lib/httpClient'

export type ConnectionState = 'not_configured' | 'unchecked' | 'connected' | 'unavailable' | 'reauth_required'
export type ConnectionStatus = {
  megafon: { configured: boolean; webhook_configured: boolean; state: ConnectionState; can_call: boolean; extension: string | null; checked_at: string | null }
  max: { configured: boolean; state: ConnectionState; checked_at: string | null }
}
export const connectionLabels: Record<ConnectionState, string> = {
  not_configured: 'Не подключён', unchecked: 'Настроен, связь ещё не проверена',
  connected: 'Связь проверена', unavailable: 'Подключение недоступно', reauth_required: 'Нужен повторный вход владельца',
}
export const connectionStatus = () => apiRequest<ConnectionStatus>({ section: 'crm', path: '/communications/status' })
export const dial = (phone: string, requestId: string) => apiRequest<{ state: 'pending' | 'requested' | 'unknown' | 'rejected'; request_id: string }>({
  section: 'crm', path: '/calls/dial', method: 'POST', body: { phone, request_id: requestId }, timeoutMs: 25000,
})
