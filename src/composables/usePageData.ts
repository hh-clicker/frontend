import { onMounted, ref, shallowRef } from 'vue'

export function usePageData<T>(loader: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let requestVersion = 0

  async function refresh(): Promise<void> {
    const version = ++requestVersion
    loading.value = true
    error.value = null
    try {
      const result = await loader()
      if (version === requestVersion) data.value = result
    } catch (cause) {
      if (version === requestVersion) error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить данные'
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  onMounted(() => void refresh())

  return { data, loading, error, refresh }
}
