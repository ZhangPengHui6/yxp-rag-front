import { api } from '../client'
import type { EvalReport, EvalRun, PageResult } from '@/types'

export interface EvalDataset {
  id: string
  name: string
  questionCount: number
  updatedAt: string
}

export const evaluationApi = {
  datasets: () => api.get<EvalDataset[]>('/evaluation/datasets'),
  runs: (params: { page?: number; pageSize?: number }) =>
    api.get<PageResult<EvalRun>>('/evaluation/runs', params),
  report: (id: string) => api.get<EvalReport>(`/evaluation/runs/${id}`),
  run: (payload: { dataset?: string; model?: string }) =>
    api.post<EvalRun>('/evaluation/runs', payload)
}
