import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as tasksApi from './api'
import { Task, TaskStatus } from './types'

export interface ActionResult {
  ok: boolean
  reason?: string
}

interface TasksState {
  tasks: Task[]
  loading: boolean
  load: (filters?: tasksApi.TaskFilters) => Promise<void>
  create: (input: tasksApi.CreateTaskInput) => Promise<ActionResult>
  setStatus: (id: number, status: TaskStatus) => Promise<ActionResult>
  submitReport: (id: number, comment: string, files: File[]) => Promise<ActionResult>
  claim: (id: number) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: true,

  load: async (filters) => {
    const tasks = await tasksApi.listTasks(filters)
    set({ tasks, loading: false })
  },

  create: async (input) => {
    try {
      const task = await tasksApi.createTask(input)
      set({ tasks: [task, ...get().tasks] })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  setStatus: async (id, status) => {
    try {
      const updated = await tasksApi.setStatus(id, status)
      set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  submitReport: async (id, comment, files) => {
    try {
      const updated = await tasksApi.submitReport(id, comment, files)
      set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  claim: async (id) => {
    try {
      const updated = await tasksApi.claimTask(id)
      set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },
}))
