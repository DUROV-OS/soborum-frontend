import { orderTypeLabel, paymentPlanLabel, OrderType, PaymentPlan } from '@/clients/types'
import { CONTENT_STAGES } from '@/marketing/types'

/**
 * Подписи полей в карточке предложенного ИИ изменения (`PendingActionCard`).
 * Ключи — имена параметров инструментов Марины (`app/ai/tools.py`, `register`).
 * Для ключа без подписи карточка показывает исходное имя — не выдумываем
 * формулировку, пока смысл поля не ясен (0049).
 */
export const TOOL_FIELD_LABEL: Record<string, string> = {
  advance_amount: 'Аванс',
  assignee_ids: 'Исполнители (id)',
  balance_paid: 'Остаток оплачен',
  block_id: 'Блок (id)',
  block_material_id: 'Материал блока (id)',
  client_id: 'Клиент (id)',
  content: 'Содержимое',
  content_id: 'Материал контента (id)',
  deadline: 'Срок',
  depends_on_ids: 'Зависит от задач (id)',
  description: 'Описание',
  document_type: 'Тип документа',
  filename: 'Имя файла',
  final_price: 'Стоимость',
  house_model_key: 'Модель дома',
  houses_count: 'Количество домов',
  installation_address: 'Адрес монтажа',
  inventory_number: 'Инвентарный номер',
  is_paid: 'Оплата получена',
  lines: 'Позиции',
  material_id: 'Материал (id)',
  name: 'Название',
  notes: 'Заметки',
  order_type: 'Тип проекта',
  payment_plan: 'Формат расчёта',
  planned_release_date: 'Плановая дата выхода',
  platforms: 'Площадки',
  production_id: 'Производство (id)',
  quantity: 'Количество',
  quantity_required: 'Необходимое количество',
  reach: 'Охваты по площадкам',
  request_id: 'Заявка (id)',
  reviewer_ids: 'Проверяющие (id)',
  stage: 'Этап',
  supplier_name: 'Поставщик',
  task_id: 'Задача (id)',
  text: 'Текст',
  threshold: 'Порог пополнения',
  title: 'Название',
  unit: 'Единица измерения',
  warehouse_material_id: 'Материал склада (id)',
}

export function toolFieldLabel(key: string): string {
  return TOOL_FIELD_LABEL[key] ?? key
}

const STAGE_LABEL = Object.fromEntries(CONTENT_STAGES.map((s) => [s.key, s.label]))

/**
 * Значение поля по-человечески: да/нет вместо `true`/`false`, названия
 * перечислений (формат расчёта, тип проекта, этап) вместо их внутренних
 * ключей. Остальное — как пришло.
 */
export function toolFieldValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (typeof value === 'string') {
    if (key === 'payment_plan') {
      const label = paymentPlanLabel(value as PaymentPlan)
      return label === '—' ? value : label
    }
    if (key === 'order_type') {
      const label = orderTypeLabel(value as OrderType)
      return label === '—' ? value : label
    }
    if (key === 'stage') return STAGE_LABEL[value] ?? value
    return value
  }
  return JSON.stringify(value, null, 2)
}
