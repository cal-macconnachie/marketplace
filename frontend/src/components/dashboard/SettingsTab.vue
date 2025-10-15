<template>
  <div class="settings-tab">
    <div class="tab-grid">
      <!-- Account Settings Card -->
      <BaseCard title="Account Settings" :min-height="240">
        <div class="settings-section">
          <div class="setting-item">
            <div class="setting-info">
              <h4 class="setting-title">Theme</h4>
              <p class="setting-description">Choose your preferred color theme</p>
            </div>
            <div class="setting-control">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
</script>

<style scoped>
.settings-tab {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.tab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: var(--space-6);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.setting-info {
  flex: 1;
}

.setting-title {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.setting-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.setting-control {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .tab-grid {
    grid-template-columns: 1fr;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
}
</style>
