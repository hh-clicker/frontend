import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '../components/navigation/AppShell.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: [
        {
          path: '',
          name: 'overview',
          component: () => import('../pages/overview/OverviewPage.vue'),
        },
        {
          path: 'searches',
          name: 'searches',
          component: () => import('../pages/searches/SearchesPage.vue'),
        },
        {
          path: 'searches/new',
          name: 'search-create',
          component: () => import('../pages/searches/CreateSearchPage.vue'),
        },
        {
          path: 'searches/:searchId/edit',
          name: 'search-edit',
          component: () => import('../pages/searches/CreateSearchPage.vue'),
        },
        {
          path: 'vacancies',
          name: 'vacancies',
          component: () => import('../pages/vacancies/VacanciesPage.vue'),
        },
        {
          path: 'applications',
          name: 'applications',
          component: () => import('../pages/applications/ApplicationsPage.vue'),
        },
        {
          path: 'market-analysis',
          name: 'market-analysis',
          component: () => import('../pages/market-analysis/MarketAnalysisPage.vue'),
        },
        {
          path: 'attention',
          redirect: { name: 'applications' },
        },
        {
          path: 'bans',
          name: 'bans',
          component: () => import('../pages/bans/BansPage.vue'),
        },
        {
          path: 'resumes',
          name: 'resumes',
          component: () => import('../pages/resumes/ResumesPage.vue'),
        },
        {
          path: 'browser',
          name: 'browser',
          component: () => import('../pages/browser/BrowserPage.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../pages/settings/SettingsPage.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
