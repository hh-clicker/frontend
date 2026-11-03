<script setup lang="ts">
import { ref, watch } from 'vue'
import { IconAlertTriangle, IconInfoCircle, IconUser, IconWorld } from '@tabler/icons-vue'
import type { CompanyBanScope } from '../../api/contracts/vacancies'
import { activeDialog, resolveDialog } from '../../services/dialogs'
import AppButton from './AppButton.vue'
import AppDialog from './AppDialog.vue'

const selectedScope = ref<CompanyBanScope>('RESUME')
watch(() => activeDialog.value?.id, () => { selectedScope.value = 'RESUME' })

function close(): void { resolveDialog(activeDialog.value?.kind === 'scope' ? null : false) }
function confirm(): void { resolveDialog(activeDialog.value?.kind === 'scope' ? selectedScope.value : true) }
</script>

<template>
  <AppDialog v-if="activeDialog" :title="activeDialog.title" :description="activeDialog.description" :tone="activeDialog.tone" :size="activeDialog.kind === 'scope' ? 'medium' : 'small'" :hide-body="activeDialog.kind !== 'scope'" layout="centered" @close="close">
    <template #icon><IconInfoCircle v-if="activeDialog.tone === 'info'" :size="40" /><IconAlertTriangle v-else :size="40" /></template>
    <div v-if="activeDialog.kind === 'scope'" class="dialog-scope-options" role="radiogroup" aria-label="Область блокировки">
      <label class="dialog-scope-option" :class="{ 'dialog-scope-option--selected': selectedScope === 'RESUME' }">
        <input v-model="selectedScope" type="radio" value="RESUME" /><span class="dialog-scope-option__radio" aria-hidden="true"><span /></span><span class="dialog-scope-option__icon" aria-hidden="true"><IconUser :size="23" /></span><span>Только для текущего резюме</span>
      </label>
      <label class="dialog-scope-option" :class="{ 'dialog-scope-option--selected': selectedScope === 'GLOBAL' }">
        <input v-model="selectedScope" type="radio" value="GLOBAL" /><span class="dialog-scope-option__radio" aria-hidden="true"><span /></span><span class="dialog-scope-option__icon" aria-hidden="true"><IconWorld :size="23" /></span><span>Глобально — для всех аккаунтов и резюме</span>
      </label>
    </div>
    <template #footer><AppButton :variant="activeDialog.confirmVariant" @click="confirm">{{ activeDialog.confirmText }}</AppButton><AppButton v-if="activeDialog.cancelText" @click="close">{{ activeDialog.cancelText }}</AppButton></template>
  </AppDialog>
</template>
