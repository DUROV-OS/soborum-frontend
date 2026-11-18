import { API_BASE, apiRequest, getToken } from '@/shared/lib/httpClient'

export type MailStatus = { address: string; configured: boolean; can_access: boolean; mode: 'shared' }
export type MailFolder = { id: string; name: string; inbox: boolean; total: number | null; unread: number | null }
export type MailHeader = { uid: number; subject: string; sender: string; to: string; cc: string; date: string; unread: boolean; size: number | null }
export type MailList = { items: MailHeader[]; uidvalidity: string; next_before: number | null }
export type MailMessage = MailHeader & { text: string; attachments: { part: number; filename: string; size: number }[] }

export const mailStatus = () => apiRequest<MailStatus>({ section: 'mail', path: '/status' })
export const listFolders = () => apiRequest<MailFolder[]>({ section: 'mail', path: '/folders', timeoutMs: 45000 })
export const listMail = (folder_id: string, q = '', before?: number) => apiRequest<MailList>({ section: 'mail', path: '/messages', query: { before, folder_id, q }, timeoutMs: 45000 })
export const readMail = (uid: number, uidvalidity: string, folder_id: string) => apiRequest<MailMessage>({ section: 'mail', path: `/messages/${uid}`, query: { uidvalidity, folder_id }, timeoutMs: 45000 })
export const markMailRead = (uid: number, uidvalidity: string, folder_id: string, read: boolean) => apiRequest<{ uid: number; unread: boolean }>({ section: 'mail', path: `/messages/${uid}/flags`, method: 'PATCH', query: { uidvalidity, folder_id }, body: { read }, timeoutMs: 45000 })

export async function downloadMailAttachment(uid: number, uidvalidity: string, part: number, filename: string, folder_id: string) {
  const response = await fetch(`${API_BASE}/mail/messages/${uid}/attachments/${part}?uidvalidity=${encodeURIComponent(uidvalidity)}&folder_id=${encodeURIComponent(folder_id)}`, {
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
