import { useAuthStore } from '@/auth/store'
import { visibleCollaborationTools } from './catalog'

export function useCollaborationTools() {
  const current = useAuthStore(state => state.current)
  const hasAccess = useAuthStore(state => state.hasAccess)
  return current ? visibleCollaborationTools(hasAccess) : []
}
