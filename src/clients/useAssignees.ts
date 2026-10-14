import { useEffect, useState } from 'react'
import { listAssignees } from './api'
import { ClientAssignee } from './types'

/** Сотрудники для выбора исполнителя задачи по клиенту (0111-c). Список
 * общий на вкладку: грузится один раз при первом использовании. */
let cached: ClientAssignee[] | null = null
let inflight: Promise<ClientAssignee[]> | null = null

function fetchOnce(): Promise<ClientAssignee[]> {
  if (cached) return Promise.resolve(cached)
  inflight ??= listAssignees()
    .then((list) => {
      cached = list
      return list
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useAssignees(): { assignees: ClientAssignee[]; loaded: boolean } {
  const [assignees, setAssignees] = useState<ClientAssignee[]>(cached ?? [])
  const [loaded, setLoaded] = useState(cached !== null)

  useEffect(() => {
    let cancelled = false
    fetchOnce()
      .then((list) => {
        if (cancelled) return
        setAssignees(list)
        setLoaded(true)
      })
      .catch(() => {
        // Нет права на список — форма остаётся без выбора, задача ставится на себя.
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { assignees, loaded }
}
