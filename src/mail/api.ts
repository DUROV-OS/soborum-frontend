import { API_BASE, apiRequest, getToken } from '@/shared/lib/httpClient'

export type MailStatus = { address: string; configured: boolean; mode: 'read_only' }
export type MailHeader = { uid: number; subject: string; sender: string; to: string; cc: string; date: string; unread: boolean; size: number | null }
export type MailList = { items: MailHeader[]; uidvalidity: string; next_before: number | null }
export type MailMessage = MailHeader & { text: string; attachments: { part: number; filename: string; size: number }[] }

export const mailStatus = () => apiRequest<MailStatus>({ section: 'mail', path: '/status' })
export const listMail = (before?: number) => apiRequest<MailList>({ section: 'mail', path: '/messages', query: { before }, timeoutMs: 45000 })
export const readMail = (uid: number, uidvalidity: string) => apiRequest<MailMessage>({ section: 'mail', path: `/messages/${uid}`, query: { uidvalidity }, timeoutMs: 45000 })

export async function downloadMailAttachment(uid: number, uidvalidity: string, part: number, filename: string) {
  const response = await fetch(`${API_BASE}/mail/messages/${uid}/attachments/${part}?uidvalidity=${encodeURIComponent(uidvalidity)}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` }, cache: 'no-store', signal: AbortSignal.timeout(45000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Не удалось скачать вложение')
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename.replace(/[\\/]/g, '_')
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
