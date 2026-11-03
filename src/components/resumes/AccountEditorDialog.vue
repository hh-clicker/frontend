<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconUserPlus } from '@tabler/icons-vue'
import type { HhAccount } from '../../api/contracts/accounts'
import AppButton from '../ui/AppButton.vue'
import AppDialog from '../ui/AppDialog.vue'
import { createAccount } from '../../services/accounts'

const emit = defineEmits<{
  close: []
  created: [account: HhAccount]
}>()

const name = ref('Основной HH')
const submitting = ref(false)
const error = ref<string | null>(null)
const canSubmit = computed(() => name.value.trim().length >= 2 && !submitting.value)

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = null
  try {
    const account = await createAccount({ name: name.value.trim(), hhUserId: null })
    emit('created', account)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось создать HH-аккаунт'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppDialog
    title="Новый HH-аккаунт"
    description="После создания откроем настройку браузера: войдите в HH и выберите резюме для добавления."
    tone="primary"
    size="small"
    @close="emit('close')"
  >
    <template #icon><IconUserPlus :size="22" /></template>

    <form id="create-account-form" class="resume-dialog-form" @submit.prevent="submit">
      <label class="form-field">
        <span class="form-label">Название аккаунта</span>
        <input v-model="name" class="form-control" type="text" maxlength="120" autofocus placeholder="Например, Основной HH" />
        <small class="form-help">Название используется только внутри HH Clicker.</small>
      </label>
      <p v-if="error" class="form-error">{{ error }}</p>
    </form>

    <template #footer>
      <AppButton @click="emit('close')">Отмена</AppButton>
      <AppButton variant="primary" type="submit" form="create-account-form" :disabled="!canSubmit" :loading="submitting">
        Создать и продолжить
      </AppButton>
    </template>
  </AppDialog>
</template>
