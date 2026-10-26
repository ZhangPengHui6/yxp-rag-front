import { api } from '../client'
import type { PageResult, PublishOrder } from '@/types'

export interface PublishQuery {
  page?: number
  pageSize?: number
  status?: string
}

export const publishApi = {
  list: (params: PublishQuery) => api.get<PageResult<PublishOrder>>('/publish/orders', params),
  detail: (id: string) => api.get<PublishOrder>(`/publish/orders/${id}`),
  create: (payload: { target?: string; createdBy?: string }) =>
    api.post<PublishOrder>('/publish/orders', payload),
  stage: (id: string) => api.post<PublishOrder>(`/publish/orders/${id}/stage`),
  commit: (id: string) => api.post<PublishOrder>(`/publish/orders/${id}/commit`),
  rollback: (id: string) => api.post<PublishOrder>(`/publish/orders/${id}/rollback`)
}
