import { sectionById, SectionId } from '@/shared/sections'

/**
 * `object_type` в уведомлении — слаг раздела фронта (`SectionId`, см.
 * комментарий к `Notification.object_type` в `app/notifications/models.py`),
 * `object_id` — id объекта в разделе. Детальный маршрут с `:id` есть не у
 * каждого раздела — для них переход ведёт на обзорную страницу раздела
 * (существующий маршрут), а не на выдуманный путь.
 */
const DETAIL_ROUTE: Partial<Record<SectionId, (id: number) => string>> = {
  clients: (id) => `/clients/${id}`,
  partners: (id) => `/partners/${id}`,
  production: (id) => `/production/${id}`,
  installation: (id) => `/montage/${id}`,
  cycle: (id) => `/cycles/${id}`,
  chats: (id) => `/chats/${id}`,
  ai: (id) => `/ai/${id}`,
  meetings: (id) => `/meetings/${id}`,
}

/**
 * Путь перехода по клику на уведомление: детальный маршрут с id, если он
 * есть у раздела, иначе обзорная страница раздела, иначе `null` (раздел
 * фронту неизвестен — клик только отмечает уведомление прочитанным).
 */
export function notificationTargetPath(objectType: string | null, objectId: number | null): string | null {
  if (!objectType) return null
  const detail = DETAIL_ROUTE[objectType as SectionId]
  if (detail && objectId !== null) return detail(objectId)
  try {
    return sectionById(objectType as SectionId).path
  } catch {
    return null
  }
}
