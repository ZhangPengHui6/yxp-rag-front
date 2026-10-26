import { api } from '../client'
import type { KnowledgeDetail, KnowledgeNode } from '@/types'

export interface CoverageReport {
  total: number
  covered: number
  rate: number
  gaps: { module: string; rate: number; missing: number }[]
  bySubject: { subject: string; total: number; covered: number; rate: number }[]
}

export const knowledgeApi = {
  tree: () => api.get<KnowledgeNode[]>('/knowledge-points/tree'),
  detail: (id: string) => api.get<KnowledgeDetail>(`/knowledge-points/${id}`),
  coverage: () => api.get<CoverageReport>('/knowledge-points/coverage'),
  merge: (id: string, targetId: string) =>
    api.post<{ source: string; target: string; movedQuestions: number }>(
      `/knowledge-points/${id}/merge`,
      { targetId }
    )
}
