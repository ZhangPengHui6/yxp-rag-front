import type { Directive, DirectiveBinding } from 'vue'
import { useAuthStore } from '@/stores/auth'

type PermissionValue = string | string[]

/**
 * v-permission="'publish.commit'"        无权限时移除元素
 * v-permission="['a','b']"               任一权限满足即可
 * v-permission.disable="'publish.commit'" 无权限时禁用（保留布局占位）
 */
function apply(el: HTMLElement, binding: DirectiveBinding<PermissionValue>) {
  const auth = useAuthStore()
  const allowed = auth.has(binding.value)
  if (allowed) return
  if (binding.modifiers.disable) {
    el.setAttribute('disabled', 'disabled')
    el.classList.add('is-disabled')
    el.style.pointerEvents = 'none'
    el.style.opacity = '0.5'
    return
  }
  el.parentNode?.removeChild(el)
}

export const permission: Directive<HTMLElement, PermissionValue> = {
  mounted: apply,
  updated: apply
}
