import {
  Activity,
  Boxes,
  Briefcase,
  Calculator,
  ClipboardList,
  Factory,
  Handshake,
  Home,
  Landmark,
  Layers,
  Network,
  Megaphone,
  MessagesSquare,
  Mic,
  Repeat,
  Inbox,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Единый реестр разделов системы — используется матрицей доступа (auth/)
 * и боковым меню (app/Sidebar). Значения (кроме 'admin' и 'today') совпадают
 * буква в букву с enum Module на бэкенде — это то, что реально приходит в
 * module_access и в Task.link_type, так что переименовывать их нельзя.
 * 'admin' — чисто фронтовое значение для пункта меню «Доступ», бэкенд его
 * не знает: администраторская страница гейтится по role==='admin'.
 * 'feedback_admin' — тоже фронтовое: раздел «Заявки» (пожелания и предложения
 * сотрудников, 0075). Гейтится ролью так же, как «Доступ»; на бэкенде это
 * /api/feedback, у которого нет своего Module.
 * 'agents' — тоже фронтовое: операционная команда из восьми ролей, не Module
 * на бэкенде. Доступен каждому вошедшему, как «Пульс».
 * 'chats' — фронтовое: все чаты мессенджера MAX (oneme). Данные MAX общие
 * для организации, бэкенд отдаёт их любому авторизованному — доступен каждому
 * вошедшему, как «Агенты». В меню называется «MAX».
 * 'work' — фронтовое: раздел-хаб «Работа», сводит операционные разделы. Не
 * Module, в матрице доступа не назначается; доступ выводится из вложенных
 * разделов (см. Sidebar).
 * 'meetings' — фронтовое: режим «Совещание». На бэкенде это часть Module.AI,
 * отдельного гранта нет — пункт виден тем, у кого есть доступ к «Марине».
 * 'today' (в меню «Пульс») доступен каждому вошедшему сотруднику; сервер
 * отдаёт только показатели разрешённых ему разделов. AI-доступ не требуется.
 * 'tasks_all' — псевдо-раздел: не открывает свою страницу и не появляется в
 * меню, это только флаг доступа к под-вкладке «Все задачи» внутри «Задачи»
 * (см. TasksPage) — назначается в матрице доступа наравне с разделами.
 */
export type SectionId =
  | 'clients'
  | 'production'
  | 'installation'
  | 'cycle'
  | 'warehouse'
  | 'marketing'
  | 'house_models'
  | 'tasks'
  | 'tasks_all'
  | 'admin'
  | 'ai'
  | 'today'
  | 'work'
  | 'board'
  | 'agents'
  | 'chats'
  | 'meetings'
  | 'accounting'
  | 'suppliers'
  | 'feedback_admin'

export interface SectionMeta {
  id: SectionId
  label: string
  path: string
  icon: LucideIcon
  /** Разделы, которые не входят в матрицу доступа рабочих (управляются только ролью) */
  adminOnly?: boolean
  /** Разделы, которыми нельзя управлять по отдельности в матрице доступа (доступ выводится из другого раздела) */
  notAssignable?: boolean
}

export const SECTIONS: SectionMeta[] = [
  { id: 'today', label: 'Пульс', path: '/today', icon: Activity, notAssignable: true },
  { id: 'work', label: 'Работа', path: '/work', icon: Briefcase, notAssignable: true },
  { id: 'cycle', label: 'Цикл клиента', path: '/cycles', icon: Repeat },
  { id: 'clients', label: 'Клиенты', path: '/clients', icon: Users },
  { id: 'production', label: 'Производство', path: '/production', icon: Factory },
  { id: 'installation', label: 'Монтаж', path: '/montage', icon: Truck },
  { id: 'warehouse', label: 'Склад', path: '/warehouse', icon: Boxes },
  { id: 'marketing', label: 'Маркетинг', path: '/marketing', icon: Megaphone },
  { id: 'house_models', label: 'Типовые проекты домов', path: '/house-models', icon: Home },
  { id: 'tasks', label: 'Задачи', path: '/tasks', icon: ClipboardList },
  { id: 'tasks_all', label: 'Все задачи', path: '/tasks', icon: Layers },
  { id: 'board', label: 'Совет директоров', path: '/board', icon: Landmark },
  { id: 'agents', label: 'Агенты', path: '/agents', icon: Network, notAssignable: true },
  { id: 'chats', label: 'MAX', path: '/chats', icon: MessagesSquare, notAssignable: true },
  { id: 'ai', label: 'Марина', path: '/ai', icon: Sparkles },
  { id: 'meetings', label: 'Совещание', path: '/meetings', icon: Mic, notAssignable: true },
  { id: 'accounting', label: 'Бухгалтерия', path: '/accounting', icon: Calculator },
  { id: 'suppliers', label: 'Поставщики', path: '/suppliers', icon: Handshake, notAssignable: true },
  { id: 'feedback_admin', label: 'Заявки', path: '/feedback/all', icon: Inbox, adminOnly: true },
  { id: 'admin', label: 'Доступ', path: '/admin', icon: ShieldCheck, adminOnly: true },
]

/**
 * Разделы, сведённые под пункт меню «Работа» (хаб). Операционные разделы +
 * MAX, «Совещание» и мок-разделы «Бухгалтерия»/«Поставщики». Порядок плиток
 * на странице «Работа» задаётся отдельно (WorkPage).
 */
export const WORK_SECTION_IDS: SectionId[] = [
  'cycle',
  'clients',
  'production',
  'warehouse',
  'installation',
  'marketing',
  'house_models',
  'meetings',
  'chats',
  'accounting',
  'suppliers',
]

export const ASSIGNABLE_SECTIONS = SECTIONS.filter((s) => !s.adminOnly && !s.notAssignable)

export function sectionById(id: SectionId): SectionMeta {
  const section = SECTIONS.find((s) => s.id === id)
  if (!section) throw new Error(`Unknown section: ${id}`)
  return section
}
