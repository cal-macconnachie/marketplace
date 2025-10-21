<template>
  <div class="loading-container"><LoadingSpinner :loading="true" :size="100" /></div>
</template>
<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingSpinner from './ui/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

onMounted(async () => {
  const orgId = Array.isArray(route.params.orgId) ? route.params.orgId[0] : route.params.orgId
  const link = await app.refreshStripeAccount({
    organizationId: orgId,
    refreshUrl: `${window.location.origin}/refresh-stripe-account/${orgId}`,
    returnUrl: `${window.location.origin}`,
  })
  await Promise.all([app.fetchCurrentUser(), app.fetchOrganization()])
  // redirect to link
  if (link) {
    window.location.href = link
  } else {
    router.push({ name: 'Dashboard' })
  }
})
</script>
<style scoped>
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
}
</style>
