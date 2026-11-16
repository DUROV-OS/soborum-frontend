import type { SectionId } from '@/shared/sections'

export const collaborationTools = [
  { id: 'messenger', label: 'Мессенджер', section: 'chats', to: '/chats', description: 'Рабочие чаты MAX, сообщения, вложения и связь с клиентами.', accent: 'blue' },
  { id: 'gpt', label: 'Durov GPT', section: 'ai', to: '/ai', description: 'Марина — ваш ИИ-помощник: обсуждение вопросов и работа с доступными данными.', accent: 'violet' },
  { id: 'feed', label: 'Лента', description: 'Новости команды, объявления, обсуждения и ознакомление.' },
  { id: 'calendar', label: 'Календарь', to: '/calendar', description: 'Встречи, повторения и занятость коллег.', accent: 'blue' },
  { id: 'documents', label: 'Документы', description: 'Шаблоны, совместное редактирование, версии и согласование.' },
  { id: 'boards', label: 'Доски', description: 'Схемы, идеи и визуальное обсуждение проектов.' },
  { id: 'drive', label: 'Диск', description: 'Общие файлы компании и папки проектов с правами доступа.' },
  { id: 'mail', label: 'Почта', description: 'Рабочие ящики и переписка, связанная с клиентами и проектами.' },
  { id: 'projects', label: 'Проекты', section: 'projects', to: '/projects', accent: 'blue', description: 'Команда, задачи, обсуждения и документы по каждому проекту.' },
  { id: 'tasks', label: 'Задачи', section: 'tasks', to: '/tasks', description: 'Исполнители, сроки, отчёты и проверка результата.', accent: 'green' },
  { id: 'meetings', label: 'Совещания', section: 'meetings', to: '/meetings', description: 'Записи встреч, протоколы и принятые решения.', accent: 'orange' },
] satisfies CollaborationTool[]

export type CollaborationTool = {
  id: string; label: string; description: string; section?: SectionId; to?: string; accent?: string
}

export function visibleCollaborationTools(hasAccess: (section: SectionId) => boolean): CollaborationTool[] {
  return collaborationTools.filter(tool => !('section' in tool) || !tool.section || hasAccess(tool.section))
}

export function isCollaborationRoute(pathname: string, tools: CollaborationTool[]) {
  return pathname === '/collaboration' || tools.some(tool => tool.to && (pathname === tool.to || pathname.startsWith(tool.to + '/')))
}
