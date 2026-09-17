import { useEffect } from 'react'
import { ScreenEntity, useScreenContextStore } from '@/shared/screenContextStore'

/**
 * Страница с открытой конкретной сущностью (карточка клиента, сотрудника,
 * задачи…) вызывает этот хук с уже загруженными для рендера данными — без
 * отдельного запроса ради этой задачи (0051-c). Регистрирует сущность в
 * общем сторе на время жизни страницы и снимает регистрацию при уходе с
 * неё, чтобы предыдущая карточка не «протекала» в контекст следующего
 * экрана.
 */
export function useRegisterScreenEntity(entity: ScreenEntity | null) {
  const setEntity = useScreenContextStore((s) => s.setEntity)
  const type = entity?.type
  const id = entity?.id
  const label = entity?.label

  useEffect(() => {
    setEntity(type !== undefined && id !== undefined && label !== undefined ? { type, id, label } : null)
    return () => setEntity(null)
  }, [type, id, label, setEntity])
}
