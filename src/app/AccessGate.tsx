import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { AccessLevel, accessLevelAtLeast } from '@/auth/types'
import { SectionId, sectionById } from '@/shared/sections'
import { EmptyState } from '@/shared/ui/EmptyState'

/** Уровень доступа пользователя к разделу (задача 0052) — для условного
 * рендера кнопок/форм внутри разделов (см. 0052-d), а не только для
 * AccessGate самого раздела. */
export function useAccessLevel(section: SectionId): AccessLevel {
  return useAuthStore((s) => s.accessLevel(section))
}

export function AccessGate({
  section,
  minLevel = 'view',
  children,
}: {
  section: SectionId
  /** Минимальный уровень, достаточный чтобы показать раздел. По умолчанию
   * `view` — раздел просто виден (текущее поведение AccessGate). */
  minLevel?: AccessLevel
  children: React.ReactNode
}) {
  const level = useAccessLevel(section)

  if (!accessLevelAtLeast(level, minLevel)) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title="Доступ ограничен"
        description={`У вашей учётной записи нет доступа к разделу «${sectionById(section).label}». Обратитесь к администратору, чтобы его открыли.`}
      />
    )
  }

  return <>{children}</>
}
