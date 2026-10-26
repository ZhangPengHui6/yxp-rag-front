import { ref } from 'vue'
import { defineStore } from 'pinia'
import { iamApi } from '@/api'

export const useAppStore = defineStore('app', () => {
  const dicts = ref<Record<string, string[]>>({})
  const dictLoading = ref(false)
  const sidebarCollapsed = ref(false)

  async function loadDicts() {
    if (dictLoading.value) return
    if (Object.keys(dicts.value).length > 0) return
    dictLoading.value = true
    try {
      dicts.value = await iamApi.dicts()
    } finally {
      dictLoading.value = false
    }
  }

  function options(type: string): string[] {
    return dicts.value[type] ?? []
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return { dicts, dictLoading, sidebarCollapsed, loadDicts, options, toggleSidebar }
})
