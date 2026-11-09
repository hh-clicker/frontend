<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { IconArrowRight } from '@tabler/icons-vue'
import AppAlert from '../ui/AppAlert.vue'
import AppButton from '../ui/AppButton.vue'
import { loadRuntimeSelectorIssues, diagnosticIssueRoute, type RuntimeSelectorIssue } from '../../services/runtimeSelectorIssues'
import { useSelectorRepairReadiness } from '../../composables/useSelectorRepairReadiness'

const props = defineProps<{ accountId: string; searchId?: string; applications?: { id: string; vacancyTitle: string }[]; accountOnly?: boolean; resumeHash?: string }>()
const emit = defineEmits<{ resolved: [value: boolean] }>()
const issues = ref<RuntimeSelectorIssue[]>([])
const expanded = ref(false)
const { ready, explanation } = useSelectorRepairReadiness()
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | null = null
let disposed = false
let revision = 0
async function read() {
  if (timer) clearTimeout(timer)
  controller?.abort()
  const version = ++revision
  const account = props.accountId
  const active = new AbortController(); controller = active
  const timeout = setTimeout(() => active.abort(), 8000)
  try {
    const result = await loadRuntimeSelectorIssues(account, active.signal)
    if (!disposed && version === revision) issues.value = result
  } catch { if (version === revision) issues.value = [] }
  finally { clearTimeout(timeout); if (!disposed && version === revision) timer = setTimeout(() => void read(), 5000) }
}
const matching = computed(() => issues.value.filter(issue => props.accountOnly ? !issue.searchId && !issue.applicationId
  : props.resumeHash ? !issue.searchId && !issue.applicationId && (issue.hhResumeId === props.resumeHash || !issue.hhResumeId && issue.report.pageType === 'PROFILE')
    : props.searchId ? issue.searchId === props.searchId
    : props.applications?.some(item => item.id === issue.applicationId)))
const visible = computed(() => matching.value.filter(issue => !issue.resolved))
watch(matching, value => emit('resolved', value.length > 0 && value.every(issue => issue.resolved === true)), { immediate: true })
const shown = computed(() => expanded.value ? visible.value : visible.value.slice(0, 3))
function label(issue: RuntimeSelectorIssue) {
  return props.applications?.find(item => item.id === issue.applicationId)?.vacancyTitle ??
    ({ PROFILE: 'Профиль HH', RESUME: 'Текст резюме', SEARCH: 'Выдача поиска', VACANCY: 'Страница вакансии' } as Record<string, string>)[issue.report.pageType] ?? 'Страница HH'
}
watch(() => props.accountId, () => { issues.value = []; void read() })
onMounted(() => void read())
onUnmounted(() => { disposed = true; revision++; if (timer) clearTimeout(timer); controller?.abort() })
</script>

<template>
  <div v-if="visible.length" class="runtime-selector-notices">
    <AppAlert v-for="issue in shown" :key="issue.commandId" tone="warning">
      <strong>{{ label(issue) }}: требуется проверить чтение страницы.</strong>
      <p>{{ issue.report.message }}</p>
      <p>Поля: {{ issue.report.rows.filter(row => row.status === 'FAIL').map(row => row.purpose).join(', ') }}.</p>
      <RouterLink class="app-button app-button--secondary app-button--small runtime-selector-notices__action" :to="diagnosticIssueRoute(issue, accountId)">Открыть диагностику<IconArrowRight :size="16" aria-hidden="true" /></RouterLink>
      <p v-if="!ready">{{ explanation }}</p>
    </AppAlert>
    <AppButton v-if="visible.length > 3" variant="ghost" size="small" @click="expanded = !expanded">{{ expanded ? 'Свернуть список' : `Показать ещё ${visible.length - 3}` }}</AppButton>
  </div>
</template>

<style scoped>
.runtime-selector-notices { display: grid; gap: var(--space-3); margin-block: var(--space-4); }
.runtime-selector-notices p { margin-block: var(--space-2); }
.runtime-selector-notices__action { width: fit-content; margin-top: var(--space-2); text-decoration: none; }
</style>
