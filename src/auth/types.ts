import { SectionId } from '@/shared/sections'

export type Role = 'admin' | 'worker'

/** 4 уровня доступа к разделу (задача 0052). Порядок значим — `LEVEL_ORDER`
 * ниже используется для сравнения «достаточно ли уровня». */
export type AccessLevel = 'none' | 'view' | 'edit' | 'full'

const LEVEL_ORDER: AccessLevel[] = ['none', 'view', 'edit', 'full']

/** true, если `level` не ниже `min` (например `accessLevelAtLeast('edit', 'view') === true`). */
export function accessLevelAtLeast(level: AccessLevel, min: AccessLevel): boolean {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min)
}

export interface Account {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
  /** Только разделы, поддержанные бэком (`Module`) — не весь `SectionId`
   * (фронтовые псевдо-разделы вроде 'today'/'agents' сюда не попадают). */
  module_access: Partial<Record<SectionId, AccessLevel>>
}
