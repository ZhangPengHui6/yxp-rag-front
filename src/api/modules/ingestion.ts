import { api } from '../client'
import type { IngestionJob, PageResult, Stage } from '@/types'

export interface JobQuery {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}

export interface PresignResult {
  uploadUrl: string
  objectKey: string
  expiresIn: number
}

export interface CreateJobPayload {
  filename: string
  objectKey: string
  sourceType: IngestionJob['sourceType']
  subject: string
  stage: Stage
  pages?: number
  sizeMb?: number
}

export const ingestionApi = {
  listJobs: (params: JobQuery) => api.get<PageResult<IngestionJob>>('/ingestion/jobs', params),
  getJob: (id: string) => api.get<IngestionJob>(`/ingestion/jobs/${id}`),
  presign: (filename: string) => api.post<PresignResult>('/ingestion/uploads', { filename }),
  createJob: (payload: CreateJobPayload) => api.post<IngestionJob>('/ingestion/jobs', payload),
  retry: (id: string) => api.post<IngestionJob>(`/ingestion/jobs/${id}/retry`),
  cancel: (id: string) => api.post<IngestionJob>(`/ingestion/jobs/${id}/cancel`)
}
