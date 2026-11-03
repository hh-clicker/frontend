<template>
  <div class="page-skeleton" aria-label="Загрузка данных" aria-busy="true">
    <div class="skeleton-line skeleton-line--title" />
    <div class="skeleton-grid">
      <div v-for="index in 5" :key="index" class="skeleton-card" />
    </div>
    <div class="skeleton-panels">
      <div class="skeleton-panel" />
      <div class="skeleton-panel" />
    </div>
  </div>
</template>
