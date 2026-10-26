import { api } from '../client'
import type { Chapter, PageResult, Textbook } from '@/types'

export interface TextbookQuery {
  page?: number
  pageSize?: number
  status?: string
  subject?: string
  keyword?: string
}

export interface LicensePayload {
  holder: string
  scope: string
  expiresAt: string
}

export const textbookApi = {
  list: (params: TextbookQuery) => api.get<PageResult<Textbook>>('/textbooks', params),
  detail: (id: string) => api.get<Textbook>(`/textbooks/${id}`),
  chapters: (id: string) => api.get<Chapter[]>(`/textbooks/${id}/chapters`),
  updateLicense: (id: string, payload: LicensePayload) =>
    api.patch<Textbook['license']>(`/textbooks/${id}/license`, payload)
}
