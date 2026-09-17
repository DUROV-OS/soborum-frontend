import { create } from 'zustand'

/** Сущность, открытая прямо сейчас на экране (карточка клиента/сотрудника/
 * задачи и т. п.) — используется Jarvis-оверлеем (0051-c), чтобы «он»/«ему»
 * в голосовой команде понимался без повторного называния имени. */
export interface ScreenEntity {
  type: string
  id: number
  label: string
}

interface ScreenContextState {
  entity: ScreenEntity | null
  setEntity: (entity: ScreenEntity | null) => void
}

export const useScreenContextStore = create<ScreenContextState>((set) => ({
  entity: null,
  setEntity: (entity) => set({ entity }),
}))
