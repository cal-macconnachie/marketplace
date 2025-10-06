<template>
  <div :class="['product-price', `product-price--${size}`]">
    <span :class="`price-amount price-${size}`"> {{ formattedPrice }} </span>
    <span class="price-interval" :class="{ 'is-empty': !recurring }">
      {{
        recurring
          ? usage_type === 'metered'
            ? `/${unit} billed ${interval_count > 1 ? 'every' : ''} ${intervalDisplay}`
            : `/${intervalDisplay}`
          : ''
      }}
    </span>
  </div>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'

type UsageType = 'licensed' | 'metered'
type IntervalType = 'day' | 'week' | 'month' | 'year'
type Sizes = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const props = defineProps({
  usage_type: {
    type: String as PropType<UsageType>,
    default: 'licensed',
  },
  unit: {
    type: String,
    default: 'unit',
  },
  recurring: {
    type: Boolean,
    default: false,
  },
  interval: {
    type: String as PropType<IntervalType>,
    default: 'month',
  },
  interval_count: {
    type: Number,
    default: 1,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  size: {
    type: String as PropType<Sizes>,
    default: 'md',
  },
})

const formattedPrice = computed(() => {
  return formatMoneyInt(props.amount, props.currency)
})

const intervalDisplay = computed(() => {
  if (props.interval_count === 1) {
    return props.usage_type === 'metered'
      ? `${props.interval === 'day' ? 'daily' : props.interval + 'ly'}`
      : props.interval
  }

  const pluralInterval =
    props.interval === 'day'
      ? 'days'
      : props.interval === 'week'
        ? 'weeks'
        : props.interval === 'month'
          ? 'months'
          : props.interval === 'year'
            ? 'years'
            : props.interval

  return props.usage_type === 'metered'
    ? `${props.interval_count} ${pluralInterval}`
    : `${props.interval_count} ${pluralInterval}`
})

function formatMoneyInt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}
</script>

<style scoped>
.product-price {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  white-space: nowrap;
}

/* Reserve consistent height so price aligns across cards */
.product-price--xs {
  min-height: calc(var(--font-size-xs) + var(--space-1) + var(--font-size-xs));
}
.product-price--sm {
  min-height: calc(var(--font-size-sm) + var(--space-1) + var(--font-size-xs));
}
.product-price--md {
  min-height: calc(var(--font-size-md) + var(--space-1) + var(--font-size-xs));
}
.product-price--lg {
  min-height: calc(var(--font-size-lg) + var(--space-1) + var(--font-size-xs));
}
.product-price--xl {
  min-height: calc(var(--font-size-xl) + var(--space-1) + var(--font-size-xs));
}

.price-amount {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  line-height: 1;
}

.price-xl {
  font-size: var(--font-size-xl);
}

.price-lg {
  font-size: var(--font-size-lg);
}

.price-md {
  font-size: var(--font-size-md);
}

.price-sm {
  font-size: var(--font-size-sm);
}

.price-xs {
  font-size: var(--font-size-xs);
}

.price-interval {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  display: block;
  margin-top: var(--space-1);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.price-interval.is-empty {
  visibility: hidden;
}
</style>
