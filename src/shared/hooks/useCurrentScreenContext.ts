import { useLocation } from 'react-router-dom'
import { SECTIONS } from '@/shared/sections'
import { useScreenContextStore } from '@/shared/screenContextStore'

/**
 * Минимальный набор данных о текущем экране, надёжно доступный из любого
 * места приложения (0051-c): раздел — по роуту, как уже делает `Topbar`, и,
 * где применимо, открытая сущность — из `screenContextStore`, куда её
 * регистрирует сама страница через `useRegisterScreenEntity` (уже
 * загруженными для рендера данными, без отдельного запроса). Реактивен к
 * роуту, поэтому переход по команде навигации (0051-d) сам обновляет то,
 * что отправится со следующей фразой.
 */
export function useCurrentScreenContext(): { sectionLabel: string; contextNote: string } {
  const location = useLocation()
  const entity = useScreenContextStore((s) => s.entity)
  const section = SECTIONS.find((s) => location.pathname.startsWith(s.path))
  const sectionLabel = section?.label ?? 'Durov OS'

  const contextNote = entity
    ? `[${entity.type}_id=${entity.id}, ${entity.label}] Открыт раздел «${sectionLabel}».`
    : `Открыт раздел «${sectionLabel}», без выбранной карточки — не выдумывай, к кому относится «он»/«она», если это не ясно из вопроса.`

  return { sectionLabel, contextNote }
}
