import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi, TOKEN_KEY } from '@/api'
import type { LoginPayload } from '@/api'
import type { User } from '@/types'

const USER_KEY = 'yxp_admin_user'

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref<User | null>(readUser())
  const loading = ref(false)

  const isLoggedIn = computed(() => Boolean(token.value))
  const permissions = computed(() => user.value?.permissions ?? [])
  const roleName = computed(() => user.value?.roleName ?? '未登录')
  const displayName = computed(() => user.value?.name ?? '未登录')

  /** 支持单个/多个权限码（多个为“任一满足”），`*` 代表全部权限 */
  function has(required?: string | string[]): boolean {
    if (!required || (Array.isArray(required) && required.length === 0)) return true
    if (permissions.value.includes('*')) return true
    const list = Array.isArray(required) ? required : [required]
    return list.some((code) => permissions.value.includes(code))
  }

  function persist() {
    localStorage.setItem(TOKEN_KEY, token.value)
    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  function clear() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  async function login(payload: LoginPayload) {
    loading.value = true
    try {
      const result = await authApi.login(payload)
      token.value = result.token
      user.value = result.user
      persist()
      return result.user
    } finally {
      loading.value = false
    }
  }

  async function fetchProfile() {
    if (!token.value) return null
    const profile = await authApi.profile()
    user.value = profile
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
    return profile
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      /* 退出接口失败不阻塞本地清理 */
    } finally {
      clear()
    }
  }

  return {
    token,
    user,
    loading,
    isLoggedIn,
    permissions,
    roleName,
    displayName,
    has,
    login,
    fetchProfile,
    logout,
    clear
  }
})
