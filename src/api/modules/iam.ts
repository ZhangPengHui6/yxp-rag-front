import { api } from '../client'
import type { AuditLog, PageResult, RoleRow, Tenant, User } from '@/types'

export const iamApi = {
  users: (params: { page?: number; pageSize?: number }) =>
    api.get<PageResult<User>>('/iam/users', params),
  roles: () => api.get<RoleRow[]>('/iam/roles'),
  dicts: () => api.get<Record<string, string[]>>('/iam/dicts'),
  tenants: (params: { page?: number; pageSize?: number }) =>
    api.get<PageResult<Tenant>>('/iam/tenants', params),
  audit: (params: { page?: number; pageSize?: number; actor?: string; action?: string }) =>
    api.get<PageResult<AuditLog>>('/iam/audit', params)
}
