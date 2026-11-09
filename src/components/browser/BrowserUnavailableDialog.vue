<script setup lang="ts">
import { ref, watch } from 'vue'
import { IconBrowser, IconCheck, IconCopy } from '@tabler/icons-vue'
import { RouterLink } from 'vue-router'
import { closeBrowserReminder, hhBrowserNavigationState } from '../../services/hhBrowserNavigation'
import AppButton from '../ui/AppButton.vue'
import AppDialog from '../ui/AppDialog.vue'

const copied = ref(false)
const urlInput = ref<HTMLInputElement | null>(null)

watch(() => hhBrowserNavigationState.unavailableUrl, () => { copied.value = false })

async function copyUrl(): Promise<void> {
  const url = hhBrowserNavigationState.unavailableUrl
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
  } catch {
    urlInput.value?.select()
  }
}

function selectUrl(): void { urlInput.value?.select() }
</script>

<template>
  <AppDialog
    v-if="hhBrowserNavigationState.unavailableUrl"
    title="Открыть ссылку на HH"
    description="Ссылка должна открыться в постоянном профиле HH Clicker."
    tone="warning"
    @close="closeBrowserReminder"
  >
    <template #icon><IconBrowser :size="28" /></template>
    <div class="browser-unavailable-dialog__url">
      <span>Ссылка на HH</span>
      <div>
        <input ref="urlInput" class="form-control" type="text" readonly :value="hhBrowserNavigationState.unavailableUrl" @focus="selectUrl" />
        <AppButton :title="copied ? 'Скопировано' : 'Копировать ссылку'" @click="copyUrl">
          <IconCheck v-if="copied" :size="18" />
          <IconCopy v-else :size="18" />
        </AppButton>
      </div>
      <small>{{ hhBrowserNavigationState.message ?? 'Проверьте Browser Agent и повторите переход.' }}</small>
    </div>
    <template #footer>
      <AppButton @click="closeBrowserReminder">Закрыть</AppButton>
      <RouterLink class="app-button app-button--primary app-button--medium" to="/browser" @click="closeBrowserReminder">
        Перейти к браузеру
      </RouterLink>
    </template>
  </AppDialog>
</template>

<style scoped>
.browser-unavailable-dialog__url { display: grid; gap: var(--space-2); }
.browser-unavailable-dialog__url > span { color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
.browser-unavailable-dialog__url > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2); }
.browser-unavailable-dialog__url small { color: var(--color-muted); font-size: 11px; }
</style>
