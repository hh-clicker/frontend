<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { IconBell, IconBrandTelegram, IconCheck, IconDeviceFloppy, IconExternalLink, IconPlayerPause, IconPlugConnected, IconSend, IconSettings, IconSparkles, IconTrash, IconVolume, IconX } from '@tabler/icons-vue'
import type { NotificationSettings, TelegramConnection } from '../../api/contracts/settings'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import AppSelect, { type AppSelectValue } from '../../components/ui/AppSelect.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { usePageData } from '../../composables/usePageData'
import { getMockScenario, isMockMode } from '../../app/runtime'
import { connectTelegram, disconnectTelegram, loadSettings, loadTelegramConnection, saveSettings, testTelegramConnection } from '../../services/settings'
import { notificationPermission, notificationIssue, soundReady, refreshNotificationPermission, requestNotificationPermission, prepareNotificationSound, deliverNotification } from '../../services/browserNotifications'

const { data, loading, error, refresh } = usePageData(loadSettings)
const form = reactive<NotificationSettings>({
  desktopEnabled: true, soundEnabled: true, notifyRunCompleted: true,
  notifyRunPaused: true, notifyAttentionRequired: true,
  notifyRelevanceCompleted: true,
  notifyMarketCompleted: true,
})
type EventKey = 'notifyRunCompleted' | 'notifyRunPaused' | 'notifyAttentionRequired' | 'notifyRelevanceCompleted' | 'notifyMarketCompleted'
const events = [
  { key: 'notifyRunCompleted' as const, title: 'Запуск завершён', icon: IconCheck, tone: 'green',
    description: 'Очередь откликов или холостой загрузки текстов обработана — можно посмотреть результаты.',
    sample: 'Обработано 12 вакансий: 10 успешных откликов, 2 требуют внимания.' },
  { key: 'notifyRunPaused' as const, title: 'Очередь остановлена', icon: IconPlayerPause, tone: 'orange',
    description: 'Капча, потеря входа, дневной лимит или технический сбой, в том числе при загрузке текстов.',
    sample: 'HH просит пройти капчу. Откройте браузер, чтобы продолжить обработку.' },
  { key: 'notifyAttentionRequired' as const, title: 'Новая задача внимания', icon: IconBell, tone: 'blue',
    description: 'Нужно заполнить анкету или проверить результат отклика и письмо.',
    sample: 'Для одной вакансии нужно заполнить анкету работодателя. Остальная очередь продолжает работу.' },
  { key: 'notifyRelevanceCompleted' as const, title: 'Оценка вакансий завершена', icon: IconSparkles, tone: 'green',
    description: 'Codex закончил оценку релевантности — список вакансий можно открыть и проверить.',
    sample: 'PHP-разработчик · Оценено 338 из 344 вакансий. Без оценки: 6.' },
  { key: 'notifyMarketCompleted' as const, title: 'Анализ рынка завершён', icon: IconSparkles, tone: 'green',
    description: 'Сообщить о завершении или ошибке анализа рынка, пока вкладка открыта.',
    sample: 'Java-разработчик · Обработано 240 из 240 вакансий. MD-отчёт готов.' },
]
const selectedEvent = ref<EventKey>('notifyRunCompleted')
const preview = computed(() => events.find(event => event.key === selectedEvent.value) ?? events[0]!)
const previewOptions = events.map(event => ({ value: event.key, label: event.title }))
const permission = isMockMode ? ref<NotificationPermission | 'unsupported'>(getMockScenario() === 'partial' ? 'denied' : 'default') : notificationPermission
const testing = ref(false)
const requestingPermission = ref(false)
const saving = ref(false)
const actionError = ref<string | null>(null)
const message = ref<string | null>(null)
const toast = ref<{ title: string; body: string; sound: boolean } | null>(null)
const telegram = ref<TelegramConnection | null>(null)
const telegramToken = ref('')
const telegramLoading = ref(false)
const telegramError = ref<string | null>(null)
const telegramMessage = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
let telegramTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (!isMockMode) { refreshNotificationPermission(); window.addEventListener('focus', refreshNotificationPermission) }
  void refreshTelegram()
  telegramTimer = setInterval(() => {
    if (telegram.value?.status === 'WAITING_FOR_START') void refreshTelegram(true)
  }, 2000)
})
onUnmounted(() => { clearTimeout(toastTimer); clearInterval(telegramTimer); window.removeEventListener('focus', refreshNotificationPermission) })

watch(() => data.value?.settings.notifications, settings => {
  if (settings) Object.assign(form, settings)
}, { immediate: true })

const hasChanges = computed(() => !!data.value && JSON.stringify(form) !== JSON.stringify(data.value.settings.notifications))
const channelsEnabled = computed(() => form.desktopEnabled || form.soundEnabled)
const eventsEnabled = computed(() => events.some(event => form[event.key]))
const testDisabledReason = computed(() => {
  if (!channelsEnabled.value) return 'Включите системные уведомления или звук.'
  if (!form[selectedEvent.value]) return 'Выбранное событие выключено.'
  if (form.desktopEnabled && permission.value !== 'granted' && !form.soundEnabled) return 'Сначала разрешите системные уведомления или включите звук.'
  return null
})

const permissionHint = computed(() => {
  if (permission.value === 'unsupported') return 'Системные уведомления недоступны. Используйте поддерживаемый браузер и HTTPS или localhost.'
  if (permission.value === 'denied') return 'Уведомления заблокированы. Разрешите их в настройках сайта в адресной строке браузера.'
  if (permission.value === 'granted') return isMockMode ? 'В макете уведомления разрешены для этого браузера.' : 'Уведомления разрешены для этого браузера. Показ также зависит от настроек уведомлений и режима «Не беспокоить» в ОС.'
  return 'Браузеру понадобится ваше разрешение на показ уведомлений.'
})

async function allowNotifications(): Promise<void> {
  if (isMockMode) { permission.value = 'granted'; return }
  requestingPermission.value = true
  try { await requestNotificationPermission() }
  finally { requestingPermission.value = false }
}

function selectEvent(value: AppSelectValue | null): void {
  const event = events.find(event => event.key === value)
  if (event) selectedEvent.value = event.key
}

async function save(): Promise<void> {
  if (saving.value || !hasChanges.value) return
  saving.value = true
  if (!isMockMode && form.soundEnabled) void prepareNotificationSound()
  actionError.value = null
  message.value = null
  try {
    data.value = await saveSettings({ notifications: { ...form } })
    message.value = isMockMode ? 'Настройки сохранены в макете. После перезагрузки страницы они сбросятся.' : 'Настройки уведомлений сохранены.'
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Не удалось сохранить настройки'
  } finally {
    saving.value = false
  }
}

function reset(): void {
  if (data.value) Object.assign(form, data.value.settings.notifications)
  actionError.value = null
  message.value = null
}

async function refreshTelegram(silent = false): Promise<void> {
  if (!silent) telegramLoading.value = true
  try {
    const previous = telegram.value?.status
    telegram.value = await loadTelegramConnection()
    if (previous === 'WAITING_FOR_START' && telegram.value.status === 'CONNECTED') {
      telegramMessage.value = 'Telegram-бот подключён к личному чату.'
    }
    telegramError.value = telegram.value.lastError
  } catch (cause) {
    if (!silent) telegramError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить подключение Telegram'
  } finally {
    if (!silent) telegramLoading.value = false
  }
}

async function beginTelegramPairing(): Promise<void> {
  if (!telegramToken.value.trim() || telegramLoading.value) return
  telegramLoading.value = true
  telegramError.value = null
  telegramMessage.value = null
  try {
    telegram.value = await connectTelegram(telegramToken.value)
    telegramToken.value = ''
  } catch (cause) {
    telegramError.value = cause instanceof Error ? cause.message : 'Не удалось подключить Telegram-бота'
  } finally { telegramLoading.value = false }
}

function openTelegramBot(): void {
  if (telegram.value?.pairingUrl) window.open(telegram.value.pairingUrl, '_blank', 'noopener,noreferrer')
}

async function sendTelegramTest(): Promise<void> {
  telegramLoading.value = true
  telegramError.value = null
  telegramMessage.value = null
  try {
    telegram.value = await testTelegramConnection()
    telegramMessage.value = isMockMode ? 'В макете отправка тестового сообщения имитируется.' : 'Тестовое сообщение отправлено в Telegram.'
  } catch (cause) {
    telegramError.value = cause instanceof Error ? cause.message : 'Не удалось отправить тестовое сообщение'
  } finally { telegramLoading.value = false }
}

async function removeTelegramConnection(): Promise<void> {
  telegramLoading.value = true
  telegramError.value = null
  telegramMessage.value = null
  try {
    telegram.value = await disconnectTelegram()
    telegramMessage.value = 'Telegram-бот отключён.'
  } catch (cause) {
    telegramError.value = cause instanceof Error ? cause.message : 'Не удалось отключить Telegram-бота'
  } finally { telegramLoading.value = false }
}

async function testNotification(): Promise<void> {
  if (testDisabledReason.value || testing.value) return
  if (!isMockMode) {
    testing.value = true
    const settings = { ...form }
    const event = { ...preview.value }
    try {
      if (settings.soundEnabled) await prepareNotificationSound()
      deliverNotification(event.title, event.sample, settings, 'hh-clicker-test')
      message.value = notificationIssue.value ? null : settings.desktopEnabled
        ? 'Тест выполнен. Если сообщение не появилось, проверьте центр уведомлений и настройки ОС.'
        : 'Звуковой сигнал воспроизведён. Если его не слышно, проверьте громкость браузера и ОС.'
    } finally { testing.value = false }
    return
  }
  clearTimeout(toastTimer)
  toast.value = {
    title: form.desktopEnabled ? preview.value.title : 'Тест звукового сигнала',
    body: form.desktopEnabled ? preview.value.sample : 'В рабочей версии здесь прозвучит сигнал. Системное уведомление выключено.',
    sound: form.soundEnabled,
  }
  toastTimer = setTimeout(() => { toast.value = null }, 7000)
}
</script>

<template>
  <PageSkeleton v-if="loading && !data" />
  <section v-else-if="error && !data" class="page-error">
    <IconSettings :size="36" /><h1>Не удалось загрузить настройки</h1><p>{{ error }}</p>
    <AppButton variant="primary" @click="refresh">Повторить</AppButton>
  </section>
  <div v-else class="settings-page">
    <header class="page-header">
      <div><h1>Настройки</h1><p>Выберите, о каких событиях HH Clicker будет вас уведомлять.</p></div>
      <div class="settings-page-actions">
        <AppButton :disabled="!hasChanges || saving" @click="reset">Отменить изменения</AppButton>
        <AppButton variant="primary" :disabled="!hasChanges" :loading="saving" @click="save">
          <IconDeviceFloppy v-if="!saving" :size="18" /> Сохранить
        </AppButton>
      </div>
    </header>
    <AppAlert v-if="isMockMode" tone="info"><strong>Предпросмотр на моках.</strong> Разрешение браузера, сохранение и отправка имитируются; настоящих уведомлений и звука пока нет.</AppAlert>
    <AppAlert v-else tone="info">Уведомления работают, пока открыта вкладка HH Clicker, для всех аккаунтов и резюме. Закрытая или приостановленная браузером вкладка не сможет сообщить о событии вовремя.</AppAlert>
    <AppAlert v-if="!isMockMode && notificationIssue" tone="warning" dismissible @dismiss="notificationIssue = null">{{ notificationIssue }}</AppAlert>
    <AppAlert v-if="actionError" tone="warning" dismissible @dismiss="actionError = null">{{ actionError }}</AppAlert>
    <AppAlert v-if="message" tone="info" dismissible @dismiss="message = null">{{ message }}</AppAlert>

    <div class="settings-layout">
      <div class="settings-sections">
        <section class="settings-card">
          <header><span class="settings-card__icon settings-card__icon--orange"><IconBell :size="22" /></span><div><h2>Как уведомлять</h2><p>Общие настройки для всех аккаунтов и резюме.</p></div></header>
          <div class="settings-card__body">
            <div class="notification-setting">
              <label for="notification-desktop"><strong>Системные уведомления</strong><small>Показывать сообщение поверх других окон, когда открыта вкладка HH Clicker.</small></label>
              <input id="notification-desktop" v-model="form.desktopEnabled" class="notification-switch" type="checkbox" role="switch" :disabled="saving" />
            </div>
            <div v-if="form.desktopEnabled" class="notification-permission">
              <div>
                <StatusBadge :label="permission === 'granted' ? 'РАЗРЕШЕНО' : permission === 'unsupported' ? 'НЕДОСТУПНО' : permission === 'denied' ? 'ЗАБЛОКИРОВАНО' : 'НУЖНО РАЗРЕШЕНИЕ'" :tone="permission === 'granted' ? 'green' : 'orange'" />
                <p>{{ permissionHint }}</p>
              </div>
              <AppButton v-if="permission === 'default' || (isMockMode && permission === 'denied')" size="small" :loading="requestingPermission" @click="allowNotifications">{{ isMockMode ? 'Разрешить в макете' : 'Разрешить уведомления' }}</AppButton>
            </div>
            <div class="notification-setting">
              <label for="notification-sound"><strong>Звуковой сигнал</strong><small>Короткий звук при выбранных событиях. Можно включить отдельно от системных уведомлений.</small><small v-if="!isMockMode && form.soundEnabled && !soundReady">Для включения звука взаимодействуйте со страницей или нажмите «Проверить уведомление».</small></label>
              <input id="notification-sound" v-model="form.soundEnabled" class="notification-switch" type="checkbox" role="switch" :disabled="saving" />
            </div>
          </div>
        </section>

        <section class="settings-card">
          <header><span class="settings-card__icon settings-card__icon--blue"><IconCheck :size="22" /></span><div><h2>О каких событиях сообщать</h2><p>Только важное — без уведомлений о каждом успешном отклике.</p></div></header>
          <div class="settings-card__body">
            <div v-for="event in events" :key="event.key" class="notification-setting">
              <span class="notification-event-icon" :class="'settings-card__icon--' + event.tone"><component :is="event.icon" :size="20" /></span>
              <label :for="event.key"><strong>{{ event.title }}</strong><small>{{ event.description }}</small></label>
              <input :id="event.key" v-model="form[event.key]" class="notification-switch" type="checkbox" role="switch" :disabled="saving" />
            </div>
          </div>
          <p class="notification-footnote">{{ !channelsEnabled ? 'Уведомления выключены. Включите хотя бы один способ выше.' : !eventsEnabled ? 'Все события выключены — уведомления приходить не будут.' : 'Настройки уведомлений не влияют на работу и остановки очереди.' }}</p>
        </section>
      </div>

      <aside class="settings-card notification-preview">
        <header><span class="settings-card__icon settings-card__icon--orange"><IconBell :size="22" /></span><div><h2>Как это выглядит</h2><p>Пример уведомления, не реальное событие.</p></div></header>
        <div class="notification-preview__body">
          <div class="form-field"><span class="form-label">Событие для проверки</span><AppSelect :model-value="selectedEvent" :options="previewOptions" aria-label="Событие для проверки" @update:model-value="selectEvent" /></div>
          <div class="notification-preview__surface">
            <div class="notification-example">
              <div class="notification-brand"><IconBell :size="17" /><strong>HH Clicker</strong><span>сейчас</span></div>
              <h3>{{ preview.title }}</h3><p>{{ preview.sample }}</p>
            </div>
          </div>
          <div class="notification-delivery"><IconVolume :size="18" /><span>{{ form.soundEnabled ? 'Со звуковым сигналом' : 'Без звука' }}<small v-if="!form.desktopEnabled">Системные уведомления выключены</small></span></div>
          <AppButton :disabled="!!testDisabledReason" :loading="testing" @click="testNotification"><IconBell v-if="!testing" :size="18" /> Проверить уведомление</AppButton>
          <p class="notification-test-hint">{{ testDisabledReason ?? (isMockMode ? 'Тест покажет пример внутри страницы с текущими настройками, даже если они ещё не сохранены.' : 'Тест использует текущие переключатели без сохранения. Реальные события используют сохранённые настройки.') }}</p>
        </div>
      </aside>
    </div>

    <section class="settings-card telegram-settings">
      <header><span class="settings-card__icon settings-card__icon--blue"><IconBrandTelegram :size="23" /></span><div><h2>Telegram-бот</h2><p>Получайте сообщения, даже когда вкладка HH Clicker закрыта.</p></div></header>
      <div class="telegram-settings__body">
        <AppAlert v-if="telegramError" tone="warning" dismissible @dismiss="telegramError = null">{{ telegramError }}</AppAlert>
        <AppAlert v-if="telegramMessage" tone="info" dismissible @dismiss="telegramMessage = null">{{ telegramMessage }}</AppAlert>

        <template v-if="!telegram">
          <p class="telegram-settings__loading">Проверяем подключение Telegram…</p>
        </template>

        <template v-else-if="telegram.status === 'DISCONNECTED'">
          <div class="telegram-settings__intro">
            <div><strong>Подключите собственного бота</strong><p>Создайте его через @BotFather и вставьте токен. Токен сохраняется только в локальной базе HH Clicker и не отображается после подключения.</p></div>
            <label class="form-field"><span class="form-label">Токен бота</span><input v-model="telegramToken" class="form-control" type="password" autocomplete="off" placeholder="123456789:AA…" :disabled="telegramLoading" /><small class="form-help">Не отправляйте этот токен другим людям: он даёт полный доступ к боту.</small></label>
            <AppButton variant="primary" :disabled="!telegramToken.trim()" :loading="telegramLoading" @click="beginTelegramPairing"><IconPlugConnected v-if="!telegramLoading" :size="18" /> Подключить</AppButton>
          </div>
        </template>

        <template v-else-if="telegram.status === 'WAITING_FOR_START'">
          <div class="telegram-settings__status">
            <div class="telegram-settings__status-line"><strong>@{{ telegram.botUsername }}</strong><StatusBadge label="ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ" tone="orange" /></div>
            <p>Откройте бота и нажмите Start. Страница сама увидит подключение.</p>
          </div>
          <div class="telegram-settings__actions">
            <AppButton variant="primary" @click="openTelegramBot"><IconExternalLink :size="18" /> Открыть бота</AppButton>
            <AppButton :loading="telegramLoading" @click="refreshTelegram()"><IconCheck v-if="!telegramLoading" :size="18" /> Проверить</AppButton>
            <AppButton variant="danger" :disabled="telegramLoading" @click="removeTelegramConnection"><IconTrash :size="18" /> Отключить</AppButton>
          </div>
        </template>

        <template v-else-if="telegram.status === 'CONNECTED'">
          <div class="telegram-settings__status">
            <div class="telegram-settings__status-line"><strong>@{{ telegram.botUsername }}</strong><StatusBadge label="ПОДКЛЮЧЁН" tone="green" /></div>
            <p>Бот привязан к вашему личному чату и готов принимать уведомления.</p>
          </div>
          <div class="telegram-settings__actions">
            <AppButton :loading="telegramLoading" @click="sendTelegramTest"><IconSend v-if="!telegramLoading" :size="18" /> Отправить тест</AppButton>
            <AppButton variant="danger" :disabled="telegramLoading" @click="removeTelegramConnection"><IconTrash :size="18" /> Отключить</AppButton>
          </div>
        </template>

        <template v-else>
          <div class="telegram-settings__status">
            <div class="telegram-settings__status-line"><strong>@{{ telegram.botUsername }}</strong><StatusBadge label="ССЫЛКА УСТАРЕЛА" tone="orange" /></div>
            <p>Введите токен ещё раз, чтобы создать новую одноразовую ссылку.</p>
          </div>
          <label class="form-field telegram-settings__token"><span class="form-label">Токен бота</span><input v-model="telegramToken" class="form-control" type="password" autocomplete="off" placeholder="123456789:AA…" :disabled="telegramLoading" /></label>
          <div class="telegram-settings__actions">
            <AppButton variant="primary" :disabled="!telegramToken.trim()" :loading="telegramLoading" @click="beginTelegramPairing"><IconPlugConnected v-if="!telegramLoading" :size="18" /> Создать новую ссылку</AppButton>
            <AppButton variant="danger" :disabled="telegramLoading" @click="removeTelegramConnection"><IconTrash :size="18" /> Отключить</AppButton>
          </div>
        </template>
      </div>
    </section>

    <div aria-live="polite" aria-atomic="true">
      <div v-if="toast" class="notification-demo-toast">
        <div class="notification-brand"><IconBell :size="18" /><strong>HH Clicker · тест</strong><button type="button" aria-label="Закрыть тестовое уведомление" @click="toast = null"><IconX :size="18" /></button></div>
        <h3>{{ toast.title }}</h3><p>{{ toast.body }}</p>
        <small>{{ toast.sound ? 'Звуковой сигнал включён; в макете не воспроизводится.' : 'Без звука' }}</small>
      </div>
    </div>
  </div>
</template>
