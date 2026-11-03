<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconBan, IconLink } from '@tabler/icons-vue'
import type { CompanyBan, SaveCompanyBanRequest } from '../../api/contracts/bans'
import type { CompanyBanScope } from '../../api/contracts/vacancies'
import AppButton from '../ui/AppButton.vue'
import AppDialog from '../ui/AppDialog.vue'
import AppSelect, { type AppSelectOption, type AppSelectValue } from '../ui/AppSelect.vue'
import { parseHhEmployerUrl } from '../../utils/hhEmployerUrl'

const props = defineProps<{
  ban?: CompanyBan | null
  resumeId: string
  resumeName: string
}>()
const emit = defineEmits<{ close: []; save: [request: SaveCompanyBanRequest] }>()
const employerUrl = ref(props.ban?.employerUrl ?? '')
const scope = ref<AppSelectValue | null>(props.ban?.scope ?? 'RESUME')
const scopeOptions: AppSelectOption[] = [
  { value: 'RESUME', label: 'Только для текущего резюме' },
  { value: 'GLOBAL', label: 'Глобально — для всех аккаунтов и резюме' },
]
const parsedEmployer = computed(() => parseHhEmployerUrl(employerUrl.value))
const error = computed(() => {
  if (!employerUrl.value.trim()) return 'Вставьте ссылку на работодателя HH.'
  if (!parsedEmployer.value) return 'Нужна ссылка вида https://hh.ru/employer/3529.'
  return null
})

function save(): void {
  if (error.value) return
  emit('save', {
    employerUrl: parsedEmployer.value!.canonicalUrl,
    ...(props.ban ? { companyName: props.ban.companyName } : {}),
    scope: scope.value as CompanyBanScope,
    resumeId: scope.value === 'RESUME' ? props.resumeId : null,
    resumeName: scope.value === 'RESUME' ? props.resumeName : null,
  })
}

</script>

<template>
  <AppDialog :title="ban ? 'Изменить блокировку' : 'Добавить компанию'" :description="ban ? 'Компания останется в стоп-листе с новой областью.' : 'Вакансии компании не будут предлагаться к отклику.'" tone="primary" @close="$emit('close')">
    <template #icon><IconBan :size="21" /></template>
    <div class="ban-editor-dialog__content">
          <label class="form-field"><span class="form-label">Ссылка на работодателя HH</span><span class="ban-employer-url"><IconLink :size="18" /><input v-model="employerUrl" class="form-control" type="url" :disabled="!!ban" placeholder="https://hh.ru/employer/3529" /></span><small v-if="ban">Ссылка работодателя не меняется после добавления.</small><small v-else>Название будет получено со страницы работодателя.</small></label>
          <div v-if="parsedEmployer" class="ban-employer-preview"><span>Работодатель найден</span><strong>{{ ban?.companyName ?? `Employer ID ${parsedEmployer.employerId}` }}</strong><small>{{ parsedEmployer.canonicalUrl }}</small></div>
          <label class="form-field"><span class="form-label">Область блокировки</span><AppSelect v-model="scope" :options="scopeOptions" /></label>
          <div v-if="scope === 'RESUME'" class="ban-editor-resume"><span>Резюме</span><strong>{{ resumeName }}</strong></div>
          <p v-if="error" class="ban-editor-dialog__error">{{ error }}</p>
    </div>
    <template #footer><AppButton @click="$emit('close')">Отмена</AppButton><AppButton variant="primary" :disabled="!!error" @click="save">{{ ban ? 'Сохранить' : 'Добавить в стоп-лист' }}</AppButton></template>
  </AppDialog>
</template>
