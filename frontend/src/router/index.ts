import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    // ── 에러 페이지 ──
    {
      path: '/403',
      name: 'forbidden',
      component: () => import('@/views/errors/ForbiddenView.vue'),
    },
    {
      path: '/500',
      name: 'serverError',
      component: () => import('@/views/errors/ServerErrorView.vue'),
    },
    {
      path: '/network-error',
      name: 'networkError',
      component: () => import('@/views/errors/NetworkErrorView.vue'),
    },
    // 정의되지 않은 모든 경로 → 404
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: () => import('@/views/errors/NotFoundView.vue'),
    },
  ],
})

export default router
