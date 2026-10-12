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
 * Бэкенд кладёт в `object_type` не слаг раздела, а имя объекта в единственном
 * числе (`client`, `task`, `money_movement`, …) — см. вызовы `notify(...)` в
 * сервисах. Приводим к разделу фронта; у объектов без детальной страницы
 * переход ведёт на раздел.
 */
const OBJECT_TYPE_SECTION: Record<string, SectionId> = {
  client: 'clients',
  installation: 'installation',
  task: 'tasks',
  money_movement: 'accounting',
  content_item: 'marketing',
  material_request: 'warehouse',
  production: 'production',
  feedback_request: 'feedback_my',
}

/** Раздел фронта по `object_type` уведомления (слаг раздела или имя объекта с бэка). */
export function notificationSection(objectType: string): SectionId {
  return OBJECT_TYPE_SECTION[objectType] ?? (objectType as SectionId)
}

/**
 * Путь перехода по клику на уведомление: детальный маршрут с id, если он
 * есть у раздела, иначе обзорная страница раздела, иначе `null` (раздел
 * фронту неизвестен — клик только отмечает уведомление прочитанным).
 */
export function notificationTargetPath(objectType: string | null, objectId: number | null): string | null {
  if (!objectType) return null
  const section = notificationSection(objectType)
  const detail = DETAIL_ROUTE[section]
  if (detail && objectId !== null) return detail(objectId)
  try {
    return sectionById(section).path
  } catch {
    return null
  }
}
