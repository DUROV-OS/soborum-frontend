import { CalendarDays, UsersRound, CheckSquare, LockKeyhole, Cake } from 'lucide-react'

export function CalendarCategoryIcon({ category, color }: { category: string; color?: string }) {
  const Icon = ({ meeting: CalendarDays, briefing: UsersRound, work: CheckSquare, personal: LockKeyhole, anniversary: Cake })[category] || CalendarDays
  return <Icon data-calendar-category={category} aria-hidden="true" size={16} strokeWidth={2} style={{ color }} className="mr-1 inline-block shrink-0 align-text-bottom" />
}

export const CALENDAR_START = 8 * 60
export const CALENDAR_END = 21 * 60
