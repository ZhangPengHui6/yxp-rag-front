import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

export interface Envelope<T> {
  code: number
  message: string
  data: T
  request_id: string
}

export class ApiError extends Error {
  code: number
  requestId: string
  httpStatus?: number

  constructor(message: string, code: number, requestId: string, httpStatus?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.requestId = requestId
    this.httpStatus = httpStatus
  }
}

export const TOKEN_KEY = 'yxp_admin_token'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/admin/v1',
  timeout: 20000
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function unauthorized() {
  localStorage.removeItem(TOKEN_KEY)
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

http.interceptors.response.use(
  (response) => {
    const envelope = response.data as Envelope<unknown>
    if (!envelope || typeof envelope.code !== 'number') return response
    if (envelope.code !== 0) {
      if (envelope.code === 40101 && !response.config.url?.includes('/auth/login')) unauthorized()
      throw new ApiError(envelope.message, envelope.code, envelope.request_id, response.status)
    }
    return response
  },
  (error) => {
    const status = error?.response?.status
    const envelope = error?.response?.data as Envelope<unknown> | undefined
    if (status === 401) unauthorized()
    const message =
      envelope?.message ||
      (status ? `请求失败（HTTP ${status}）` : '网络异常，请检查后端服务是否可用')
    throw new ApiError(message, envelope?.code ?? status ?? -1, envelope?.request_id ?? '-', status)
  }
)

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<Envelope<T>>(config)
  return response.data.data
}

export const api = {
  get: <T>(url: string, params?: object) => request<T>({ url, method: 'get', params }),
  post: <T>(url: string, data?: unknown) => request<T>({ url, method: 'post', data }),
  patch: <T>(url: string, data?: unknown) => request<T>({ url, method: 'patch', data }),
  put: <T>(url: string, data?: unknown) => request<T>({ url, method: 'put', data }),
  delete: <T>(url: string, params?: object) =>
    request<T>({ url, method: 'delete', params })
}
