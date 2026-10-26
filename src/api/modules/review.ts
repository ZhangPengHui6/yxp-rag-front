import { api } from '../client'
import type { PageResult, ReviewTask } from '@/types'

export interface ReviewQuery {
  page?: number
  pageSize?: number
  kind?: string
}

export interface DecisionPayload {
  decision: 'approve' | 'reject'
  comment?: string
}

export const reviewApi = {
  list: (params: ReviewQuery) => api.get<PageResult<ReviewTask>>('/review/tasks', params),
  decide: (id: string, payload: DecisionPayload) =>
    api.post<{ id: string; decision: string; comment: string }>(
      `/review/tasks/${id}/decision`,
      payload
    )
}
