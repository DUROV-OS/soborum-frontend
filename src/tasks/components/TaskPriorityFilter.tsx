import { Select } from '@/shared/ui/Field'
import { TASK_PRIORITIES, TaskPriority } from '../types'

export function TaskPriorityFilter({ value, onChange, ariaLabel = 'Фильтр по приоритету', className = '' }: {
  value: TaskPriority | ''
  onChange: (value: TaskPriority | '') => void
  ariaLabel?: string
  className?: string
}) {
  return <Select aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value as TaskPriority | '')} className={`w-full sm:max-w-48 ${className}`}>
    <option value="">Все приоритеты</option>
    {TASK_PRIORITIES.map(priority => <option key={priority.key} value={priority.key}>{priority.label}</option>)}
  </Select>
}
