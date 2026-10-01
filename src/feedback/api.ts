import { API_BASE, ApiError, apiRequest, getToken } from '@/shared/lib/httpClient'
import { FeedbackRequest, FeedbackStatus } from './types'

const SECTION = 'feedback'

/** GET /api/feedback/requests — свои заявки, администратору все. */
export function listRequests(): Promise<FeedbackRequest[]> {
  return apiRequest<FeedbackRequest[]>({ section: SECTION, path: '/requests' })
}

/** POST /api/feedback/requests (multipart). */
export function createRequest(input: {
  text: string
  section: string
  screenshots: File[]
  clientLog: string
}): Promise<FeedbackRequest> {
  const form = new FormData()
  form.append('text', input.text)
  form.append('section', input.section)
  form.append('client_log', input.clientLog)
  for (const file of input.screenshots) form.append('screenshots', file)
  return apiRequest<FeedbackRequest>({ section: SECTION, path: '/requests', method: 'POST', form })
}

/** PATCH /api/feedback/requests/:id — смена статуса, только админ. */
export function updateStatus(id: number, status: FeedbackStatus): Promise<FeedbackRequest> {
  return apiRequest<FeedbackRequest>({
    section: SECTION,
    path: `/requests/${id}`,
    method: 'PATCH',
    body: { status },
  })
}

/**
 * Скачивание вложения заявки. Эндпоинт требует токен в заголовке, поэтому
 * тянем файл через fetch и отдаём как Blob — и для показа картинки, и для
 * кнопки «Скачать».
 */
export async function fetchAttachment(requestId: number, fileId: number): Promise<Blob> {
  const token = getToken()
  const response = await fetch(`${API_BASE}/${SECTION}/requests/${requestId}/files/${fileId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new ApiError(response.status, 'Не удалось получить файл заявки')
  return response.blob()
}
