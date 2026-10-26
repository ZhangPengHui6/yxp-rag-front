import { api } from '../client'
import type { AnnotationTask, PageResult } from '@/types'

export interface AnnotationTaskRow {
  id: string
  book: string
  chapter: string
  page: number
  pending: number
  total: number
}

export interface ResolvePayload {
  blockId: string
  action: 'resolve' | 'flag'
  content?: string
}

export const annotationApi = {
  list: (params: {
    page?: number
    pageSize?: number
  }) => api.get<PageResult<AnnotationTaskRow>>('/annotation/tasks', params),
  detail: (id: string) => api.get<AnnotationTask>(`/annotation/tasks/${id}`),
  resolve: (id: string, payload: ResolvePayload) =>
    api.post<{ resolved: number; total: number }>(`/annotation/tasks/${id}/resolve`, payload)
}
