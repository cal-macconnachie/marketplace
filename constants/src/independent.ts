import type { SelectOption } from '@marketplace/types'
/**
 * Environment-independent constants
 * These values remain the same across all environments
 */

/**
 * Stripe tax codes for products
 */
export const taxCodes: SelectOption[] = [
  // Cloud Services & SaaS (Subscription-based)
  { value: 'txcd_10103001', label: 'SaaS - Business Use' },
  { value: 'txcd_10103000', label: 'SaaS - Personal Use' },
  { value: 'txcd_10103101', label: 'SaaS - Electronic Download - Business Use' },
  { value: 'txcd_10103100', label: 'SaaS - Electronic Download - Personal Use' },
  { value: 'txcd_10101000', label: 'Infrastructure as a Service (IaaS) - Business' },
  { value: 'txcd_10010001', label: 'Infrastructure as a Service (IaaS) - Personal' },
  { value: 'txcd_10102000', label: 'Platform as a Service (PaaS) - Business Use' },
  { value: 'txcd_10102001', label: 'Platform as a Service (PaaS) - Personal Use' },
  { value: 'txcd_10104001', label: 'Cloud-based Business Process as a Service' },

  // Usage-based Digital Services (Metered)
  { value: 'txcd_10701300', label: 'Website Data Processing' },
  { value: 'txcd_20060009', label: 'Data Processing Services' },
  { value: 'txcd_20060051', label: 'Credit Card Processing Services' },

  // Software & Downloads
  { value: 'txcd_10202003', label: 'Downloadable Software - Business' },
  { value: 'txcd_10202000', label: 'Downloadable Software - Personal' },
  { value: 'txcd_10203001', label: 'Downloadable Software - Custom - Business Use' },
  { value: 'txcd_10203000', label: 'Downloadable Software - Custom - Personal Use' },
  { value: 'txcd_37070001', label: 'Canned Software - Tangible Medium' },

  // Website Services
  { value: 'txcd_10701100', label: 'Website Hosting' },
  { value: 'txcd_10701200', label: 'Website Design' },
  { value: 'txcd_10701000', label: 'Website Advertising' },
  { value: 'txcd_10701400', label: 'Website Information Services - Business' },
  { value: 'txcd_10701401', label: 'Website Information Services - Personal' },
  { value: 'txcd_10701410', label: 'Electronically Delivered Information Services - Business' },
  { value: 'txcd_10701411', label: 'Electronically Delivered Information Services - Personal' },

  // Professional Services (One-time or Recurring)
  { value: 'txcd_20060048', label: 'Consulting Services' },
  { value: 'txcd_20060055', label: 'Marketing Services' },
  { value: 'txcd_20060002', label: 'Advertising Services' },
  { value: 'txcd_20060001', label: 'Accounting Services' },
  { value: 'txcd_20060054', label: 'Legal Services' },
  { value: 'txcd_20060013', label: 'Engineering Services' },
  { value: 'txcd_20060047', label: 'Architectural Services' },
  { value: 'txcd_20060017', label: 'Technical Support Services' },
  { value: 'txcd_20030000', label: 'General - Services' },

  // Training & Education (Subscription or One-time)
  { value: 'txcd_20060058', label: 'Training Services - Web-based' },
  { value: 'txcd_20060044', label: 'Training - In-person' },
  { value: 'txcd_20060045', label: 'Training Services - Live Virtual' },
  { value: 'txcd_20060158', label: 'Online Courses - Streamed' },
  { value: 'txcd_20060258', label: 'Online Courses - Streamed and Downloadable' },
  { value: 'txcd_20060358', label: 'Online Courses - Written Material' },
  { value: 'txcd_20060052', label: 'Educational Services' },

  // Digital Content (Subscription-based)
  { value: 'txcd_10301000', label: 'Audiobook' },
  { value: 'txcd_10302002', label: 'Digital Books - Subscription' },
  { value: 'txcd_10303000', label: 'Digital Magazines - Subscription' },
  { value: 'txcd_10304100', label: 'Digital Newspapers - Subscription' },
  { value: 'txcd_10401200', label: 'Digital Audio Works - Streaming Subscription' },
  { value: 'txcd_10402200', label: 'Digital Video - Streaming Subscription' },
  { value: 'txcd_10402300', label: 'Digital Video Streaming - Live Events' },

  // API & Integration Services (Metered)
  { value: 'txcd_10501000', label: 'Digital Photographs/Images - Downloaded' },

  // Membership & Subscription Services
  { value: 'txcd_50021001', label: 'Fitness Centers - Membership Fees' },
  { value: 'txcd_50021002', label: 'Fitness Centers - Initiation Fees' },
  { value: 'txcd_10702000', label: 'Online Dating Services' },

  // Maintenance & Support Agreements (Recurring)
  { value: 'txcd_37071001', label: 'Software Maintenance - Optional - Electronic Delivery' },
  { value: 'txcd_37071101', label: 'Software Maintenance - Mandatory - Electronic Delivery' },
  { value: 'txcd_20090015', label: 'Warranty - Mandatory' },
  { value: 'txcd_20090018', label: 'Warranty - Optional' },

  // Gift Cards & Credits
  { value: 'txcd_10502000', label: 'Gift Card' },

  // General Categories
  { value: 'txcd_10000000', label: 'General - Electronically Supplied Services' },

  // Physical Products - General
  { value: 'txcd_99999999', label: 'General' },
  { value: 'txcd_00000000', label: 'Nontaxable' },

  // Clothing & Accessories
  { value: 'txcd_30011000', label: 'Clothing & Footwear' },
  { value: 'txcd_30060007', label: 'Jewelry' },
  { value: 'txcd_30060016', label: 'Watches' },
  { value: 'txcd_30060001', label: 'Purses and Handbags' },
  { value: 'txcd_30060015', label: 'Luggage' },

  // Electronics & Computers
  { value: 'txcd_34020027', label: 'Consumer Electronics' },
  { value: 'txcd_37010000', label: 'Personal Computers' },
  { value: 'txcd_34021000', label: 'Mobile Phones' },
  { value: 'txcd_34020006', label: 'Televisions' },
  { value: 'txcd_34020004', label: 'Headphones/Earbuds' },
  { value: 'txcd_34020003', label: 'E-Book Readers' },
  { value: 'txcd_34040008', label: 'Computer Printer' },
  { value: 'txcd_34040006', label: 'Computer Monitor/Displays' },

  // Appliances & Home
  { value: 'txcd_33020009', label: 'Refrigerators - Energy Star' },
  { value: 'txcd_33020010', label: 'Dishwashers - Energy Star' },
  { value: 'txcd_33020012', label: 'Clothes Washing Machine - Energy Star' },
  { value: 'txcd_33020013', label: 'Clothes Drying Machine - Energy Star' },

  // Books & Media
  { value: 'txcd_35010000', label: 'Books' },
  { value: 'txcd_35020200', label: 'Periodicals/Magazines' },
  { value: 'txcd_35020100', label: 'Newspapers' },

  // Sports & Fitness
  { value: 'txcd_30021000', label: 'Athletic Activity Clothing' },
  { value: 'txcd_30070022', label: 'Sport Uniforms' },
  { value: 'txcd_30070001', label: 'Bicycle Helmets - Adult' },

  // Toys & Games
  { value: 'txcd_34022000', label: 'Video Gaming Console - Fixed' },
  { value: 'txcd_34022001', label: 'Video Gaming Console - Portable' },

  // Personal Care & Health
  { value: 'txcd_32050006', label: 'Grooming and Hygiene Products' },
  { value: 'txcd_32050040', label: 'Sunscreen' },
  { value: 'txcd_40090001', label: 'Dietary Supplements' },

  // Food & Beverage
  { value: 'txcd_40040000', label: 'Food for Non-Immediate Consumption' },
  { value: 'txcd_41030001', label: 'Bottled Water' },
  { value: 'txcd_36010004', label: 'Pet Food' },
];

export const domain = 'marketplace.csm.codes'

export const emailStringsToIgnore = [
  'privaterelay.appleid.com',
  'noreply'
]
