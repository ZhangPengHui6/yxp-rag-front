import { api } from '../client'
import type { PageResult, Question } from '@/types'

export interface QuestionQuery {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  difficulty?: string
  keyword?: string
}

export interface VariantDraft {
  id: string
  stem: string
  difficulty: Question['difficulty']
  status: 'draft'
  transform: string
}

export interface DuplicatePair {
  id: string
  score: number
  left: Question
  right: Question
  suggestion: string
}

export const questionApi = {
  list: (params: QuestionQuery) => api.get<PageResult<Question>>('/questions', params),
  detail: (id: string) => api.get<Question>(`/questions/${id}`),
  variants: (id: string) => api.get<VariantDraft[]>(`/questions/${id}/variants`),
  duplicates: () => api.get<DuplicatePair[]>('/questions/duplicates'),
  update: (id: string, payload: Partial<Question>) => api.patch<Question>(`/questions/${id}`, payload)
}
