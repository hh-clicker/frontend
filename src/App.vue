<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppDialogHost from './components/ui/AppDialogHost.vue'
import { startNotificationMonitor } from './services/notificationMonitor'

let stopNotifications: (() => void) | undefined
onMounted(() => { stopNotifications = startNotificationMonitor() })
onUnmounted(() => stopNotifications?.())
</script>

<template>
  <RouterView />
  <AppDialogHost />
</template>
