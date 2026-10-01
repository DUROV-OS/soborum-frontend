import { AUTOMATIC_STAGES, Client, ClientStage, CLIENT_STAGES, PaymentPlan } from './types'

const STAGE_ORDER = CLIENT_STAGES.map((s) => s.key)

export function stageIndex(stage: ClientStage): number {
  return STAGE_ORDER.indexOf(stage)
}

export function stageLabel(stage: ClientStage): string {
  return CLIENT_STAGES.find((s) => s.key === stage)?.label ?? stage
}

export function nextStageOf(stage: ClientStage): ClientStage | null {
  const index = stageIndex(stage)
  return index < STAGE_ORDER.length - 1 ? STAGE_ORDER[index + 1] : null
}

/** Переводит ли клиента с этой стадии человек кнопкой. На автоматических
 * стадиях (0079) кнопки нет — там клиента двигает раздел «Монтаж». */
export function isStageManual(stage: ClientStage): boolean {
  return !AUTOMATIC_STAGES.includes(stage)
}

export type ClientFieldGroup = 'documents' | 'payment'

const GROUP_APPEARS_AT: Record<ClientFieldGroup, ClientStage> = {
  documents: 'approval',
  payment: 'payment',
}

/**
 * Валидность переходов и блокировку полей проверяет бэкенд (см. *_locked_at
 * и текст ошибки на transition). Здесь — только то, что решает, какие
 * панели показывать и когда включать поля ввода, для самого интерфейса.
 */
export function isGroupVisible(client: Client, group: ClientFieldGroup): boolean {
  return stageIndex(client.stage) >= stageIndex(GROUP_APPEARS_AT[group])
}

export function isGroupEditable(client: Client, group: ClientFieldGroup): boolean {
  if (group === 'documents') return client.documents_locked_at === null
  return client.payment_locked_at === null || client.payment_edit_unlocked
}

/**
 * Что подтверждают на стадии «Оплата» — зависит от формата расчёта:
 * полная предоплата — вся сумма, аванс+остаток — только аванс, оплата после
 * получения — подтверждать нечего, переход доступен сразу. Итог всё равно
 * проверяет бэкенд на transition; здесь — только подписи и признак,
 * нужна ли отметка «оплата поступила».
 */
export interface PaymentStageRule {
  /** Нужна ли отметка is_paid перед переходом дальше. */
  requiresConfirmation: boolean
  /** Подпись «оплата поступила» для текущего формата расчёта. */
  paidLabel: string
  /** Подпись «оплата не поступила». */
  unpaidLabel: string
  /** Пояснение под панелью оплаты. */
  note: string
}

export function paymentStageRule(plan: PaymentPlan | null): PaymentStageRule {
  if (plan === 'advance_then_balance') {
    return {
      requiresConfirmation: true,
      paidLabel: 'Аванс поступил',
      unpaidLabel: 'Аванс не поступил',
      note: 'Формат «аванс + оплата после получения»: на этой стадии подтверждается поступление аванса. Остаток принимается на стадии «Дом в производстве».',
    }
  }
  if (plan === 'post_payment') {
    return {
      requiresConfirmation: false,
      paidLabel: 'Оплата после получения',
      unpaidLabel: 'Оплата после получения',
      note: 'Формат «оплата после получения»: предоплата не вносится — подтверждение не требуется, переход на следующую стадию доступен сразу.',
    }
  }
  return {
    requiresConfirmation: true,
    paidLabel: 'Вся сумма поступила',
    unpaidLabel: 'Вся сумма не поступила',
    note: 'Формат «полная предоплата»: перед переходом подтверждается поступление всей суммы.',
  }
}
