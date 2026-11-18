export const chatFilters = [['all', 'Все'], ['group', 'Группы'], ['direct', 'Личные чаты']] as const

/** Unknown types and channels remain in All; never infer privacy from a title. */
export function chatKind(type?: string): 'direct' | 'group' | 'other' {
  if (type?.toUpperCase() === 'DIALOG') return 'direct'
  if (['CHAT', 'GROUP', 'GROUP_CHAT'].includes(type?.toUpperCase() ?? '')) return 'group'
  return 'other'
}
