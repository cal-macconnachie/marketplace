import { useAppStore } from '@/stores/app'
import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router'

const routes = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/components/DashboardPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/auth',
    name: 'SignIn',
    component: () => import('@/components/SignIn.vue'),
  },
  {
    path: '/',
    name: 'Marketplace',
    component: () => import('@/components/MarketplacePage.vue'),
  },
  {
    path: '/auth/callback',
    name: 'OAuthCallback',
    component: () => import('@/components/OAuthCallbackPage.vue'),
  },
  {
    path: '/refresh-stripe-account/:orgId',
    name: 'RefreshStripeAccount',
    component: () => import('@/components/RefreshStripePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/public/:group_id/:id',
    name: 'EmbeddableProduct',
    component: () => import('@/components/EmbeddableProductPage.vue'),
  },
  {
    path: '/cart',
    name: 'Cart',
    component: () => import('@/components/CartPage.vue'),
  },
  {
    path: '/receipts/:cartId/:userId',
    name: 'Receipt',
    component: () => import('@/components/ReceiptPage.vue'),
    meta: { requiresAuth: true },
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
  const app = useAppStore()
  // If route requires auth and user is not authenticated, redirect to /auth
  if (to.meta.requiresAuth && !app.isAuthenticated) {
    next({ path: '/auth' })
  } else {
    next()
  }
})

export default router
