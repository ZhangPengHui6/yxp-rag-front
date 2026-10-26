import { api } from '../client'
import type { User } from '@/types'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
  expiresIn: number
}

export const authApi = {
  login: (payload: LoginPayload) => api.post<LoginResult>('/auth/login', payload),
  logout: () => api.post<null>('/auth/logout'),
  profile: () => api.get<User>('/auth/profile')
}
