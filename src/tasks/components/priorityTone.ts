import { ChipTone } from '@/shared/ui/Chip'
import { TaskPriority } from '../types'

export function priorityTone(priority: TaskPriority): ChipTone {
  switch (priority) {
    case 'low':
      return 'success'
    case 'medium':
      return 'warning'
    case 'high':
      return 'danger'
  }
}
