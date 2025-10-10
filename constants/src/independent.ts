import type { SelectOption } from '@marketplace/types'
/**
 * Environment-independent constants
 * These values remain the same across all environments
 */

/**
 * Stripe tax codes for products
 */
export const taxCodes: SelectOption[] = [
  { value: 'txcd_10103001', label: 'SaaS - Business Use' },
  { value: 'txcd_10103000', label: 'SaaS - Personal Use' },
  { value: 'txcd_10202003', label: 'Downloadable Software - Business' },
  { value: 'txcd_10202000', label: 'Downloadable Software - Personal' },
  { value: 'txcd_10101000', label: 'Infrastructure as a Service (IaaS) - Business' },
  { value: 'txcd_10010001', label: 'Infrastructure as a Service (IaaS) - Personal' },
  { value: 'txcd_10701100', label: 'Website Hosting' },
  { value: 'txcd_10701300', label: 'Website Data Processing' },
  { value: 'txcd_10701400', label: 'Website Information Services - Business' },
  { value: 'txcd_10701401', label: 'Website Information Services - Personal' },
  { value: 'txcd_20060048', label: 'Consulting Services' },
  { value: 'txcd_20060058', label: 'Training Services - Web-based' },
  { value: 'txcd_20060158', label: 'Online Courses - Streamed' },
  { value: 'txcd_10000000', label: 'General Digital Services' },
  { value: 'txcd_10301000', label: 'Digital Content - Entertainment' },
  { value: 'txcd_10401000', label: 'Digital Marketing Services' },
  { value: 'txcd_10501000', label: 'API Access & Integration' },
  { value: 'txcd_99999999', label: 'Other Digital Products' },
];

export const domain = 'marketplace.csm.codes'

export const emailStringsToIgnore = [
  'privaterelay.appleid.com',
  'noreply'
]
