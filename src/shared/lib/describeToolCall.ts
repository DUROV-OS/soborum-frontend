import { MessageContentBlock } from '@/ai/types'

/**
 * Человеко-понятная подпись для уже выполненного (read-only, автономного)
 * вызова инструмента — используется вместо сырого имени инструмента и его
 * JSON-аргументов в ленте сообщений (0051-e). Покрывает частые инструменты
 * консультации/Jarvis; для остального — имя инструмента как раньше, ничего
 * не ломает.
 */
const TOOL_LABELS: Record<string, string> = {
  get_client: 'Смотрю карточку клиента',
  list_clients: 'Смотрю список клиентов',
  get_client_context: 'Смотрю контекст клиента',
  get_production: 'Смотрю карточку производства',
  get_block: 'Смотрю блок производства',
  get_cycle: 'Смотрю цикл клиента',
  list_cycles: 'Смотрю список циклов',
  get_material: 'Смотрю материал на складе',
  list_materials: 'Смотрю склад',
  list_pending_requests: 'Смотрю заявки на склад',
  get_task: 'Смотрю задачу',
  list_tasks: 'Смотрю список задач',
  get_user_workload: 'Смотрю загруженность сотрудника',
  get_content: 'Смотрю карточку контента',
  list_content: 'Смотрю контент-план',
  read_attached_file: 'Читаю прикреплённый файл',
}

interface ToolResolution {
  content?: { found?: boolean; label?: string; reason?: string }
}

function navigateToLabel(input: Record<string, unknown>, resolution: ToolResolution | undefined): string {
  const content = resolution?.content
  if (content?.found && content.label) return `Открыл «${content.label}»`
  const query = typeof input.query === 'string' ? input.query : ''
  return query ? `Искал «${query}» — не нашёл` : 'Искал раздел — не нашёл'
}

export function describeToolCall(block: MessageContentBlock, resolution?: unknown): string {
  const name = block.name ?? ''
  const input = block.input ?? {}
  if (name === 'navigate_to') return navigateToLabel(input, resolution as ToolResolution | undefined)
  return TOOL_LABELS[name] ?? name
}
