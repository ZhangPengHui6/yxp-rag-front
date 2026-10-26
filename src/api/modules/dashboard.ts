import { api } from '../client'
import type { DashboardSummary, TodoItem } from '@/types'

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  todos: () => api.get<TodoItem[]>('/dashboard/todos')
}
