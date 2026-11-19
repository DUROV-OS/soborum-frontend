import { Link } from 'react-router-dom'
import { UsersRound } from 'lucide-react'
import { useCollaborationNavigation } from './navigation'

export function CollaborationMenu({ onNavigate }: { onNavigate: () => void }) {
  const { active, resume } = useCollaborationNavigation()
  return <li>
    <Link to={resume()} aria-current={active ? 'page' : undefined} onClick={onNavigate}
      className={'flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm ' +
        (active ? 'bg-sidebar-accent text-white' : 'text-white/75 hover:text-white')}>
      <UsersRound size={19} aria-hidden />
      <span>Совместная работа</span>
    </Link>
  </li>
}
