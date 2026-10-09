import { SectionId } from '@/shared/sections'

/** Повод уведомления — зеркало `NotificationKind` на бэкенде (0080-b/0080-c). */
export type NotificationKind =
  | 'task_due'
  | 'task_overdue'
  | 'client_update'
  | 'production_update'
  | 'installation_update'
  | 'material_request_update'
  | 'money_movement_update'
  | 'content_update'
  | 'max_message'
  | 'feedback_update'

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  task_due: 'Скоро срок задачи',
  task_overdue: 'Просрочена задача',
  client_update: 'Обновление по клиенту',
  production_update: 'Обновление по производству',
  installation_update: 'Обновление по монтажу',
  material_request_update: 'Обновление заявки на материал',
  money_movement_update: 'Обновление проводки',
  content_update: 'Обновление по посту',
  max_message: 'Сообщение в MAX',
  feedback_update: 'Обновление заявки «Пожелания»',
}

export interface Notification {
  id: number
  kind: NotificationKind
  title: string
  body: string | null
  /** Слаг раздела фронта (`SectionId`) — куда ведёт карточка; незнакомое значение показываем как есть. */
  object_type: SectionId | string | null
  object_id: number | null
  created_at: string
  read_at: string | null
}

export interface UnreadCount {
  unread_count: number
}

/** `Module` на бэкенде (`app/common/module_access.py`) — те же строки, что в матрице доступа. */
export type NotificationModule =
  | 'clients'
  | 'production'
  | 'installation'
  | 'cycle'
  | 'warehouse'
  | 'marketing'
  | 'house_models'
  | 'tasks'
  | 'ai'
  | 'board'
  | 'accounting'

/** Разделы, которыми можно мьютить уведомления целиком — реальные `Module`,
 * без псевдо-разделов фронта (`tasks_all`, `admin`, `today` и т.д.). */
export const MUTABLE_MODULES: { id: NotificationModule; label: string }[] = [
  { id: 'clients', label: 'Клиенты' },
  { id: 'production', label: 'Производство' },
  { id: 'installation', label: 'Монтаж' },
  { id: 'cycle', label: 'Цикл клиента' },
  { id: 'warehouse', label: 'Склад' },
  { id: 'marketing', label: 'Маркетинг' },
  { id: 'house_models', label: 'Типовые проекты домов' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'ai', label: 'Марина' },
  { id: 'board', label: 'Совет директоров' },
  { id: 'accounting', label: 'Бухгалтерия' },
]

export function moduleLabel(module: string): string {
  return MUTABLE_MODULES.find((m) => m.id === module)?.label ?? module
}

export interface NotificationMute {
  id: number
  module: NotificationModule | string
  /** `null` — замьючен весь раздел, иначе конкретный объект в нём. */
  object_id: number | null
  created_at: string
}
