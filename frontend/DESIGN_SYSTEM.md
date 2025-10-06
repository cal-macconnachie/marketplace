# Design System & Reusable Patterns

This document outlines the user-centric design system and reusable patterns established for the payment authentication frontend.

## Design Principles

### 1. User-Centric Design
- **Progressive Disclosure**: Show only what users need when they need it
- **Clear Visual Hierarchy**: Guide users through actions with proper typography and spacing
- **Consistent Patterns**: Reduce cognitive load with predictable interactions
- **Accessible Design**: Support all users with proper ARIA labels and keyboard navigation
- **Loading States**: Always provide feedback during async operations
- **Error Handling**: Clear, actionable error messages

### 2. Performance & Developer Experience
- **Reusable Components**: DRY principle with flexible, composable components
- **Design Tokens**: Centralized styling system for consistency
- **Type Safety**: Full TypeScript support with proper interfaces
- **Form Validation**: Comprehensive validation with user feedback

## File Structure

```
src/
├── components/
│   ├── ui/                    # Reusable UI components
│   │   ├── BaseButton.vue
│   │   ├── BaseInput.vue
│   │   ├── BaseCard.vue
│   │   └── BaseAlert.vue
│   ├── SignIn.vue             # Feature components
│   └── Dashboard.vue
├── styles/
│   └── tokens.css             # Design tokens (colors, spacing, typography)
├── utils/
│   └── validation.ts          # Form validation utilities
└── stores/
    └── app.ts                 # Global app state
```

## Design Tokens (`src/styles/tokens.css`)

### Color System
- **Primary**: `--color-primary` - Main brand color for primary actions
- **Secondary**: `--color-secondary` - Secondary actions and content
- **Semantic Colors**: Success, warning, error, info variants
- **Text Colors**: Primary, secondary, muted, inverse hierarchy
- **Background Colors**: Primary, secondary, muted for layering

### Typography Scale
- **Font Families**: Sans-serif system stack, monospace for code
- **Font Sizes**: XS (0.75rem) to 3XL (1.875rem) with consistent scale
- **Font Weights**: Normal (400) to Bold (700)
- **Line Heights**: Tight (1.25) to Relaxed (1.625)

### Spacing System
- **Consistent Scale**: 1 (0.25rem) to 24 (6rem) using 4px base unit
- **Semantic Usage**: Apply consistent spacing between elements

### Component Tokens
- **Border Radius**: Small to full (rounded buttons/avatars)
- **Shadows**: Subtle elevation system from XS to XL
- **Z-Index**: Layering system for modals, dropdowns, tooltips

## Reusable Components

### BaseButton (`src/components/ui/BaseButton.vue`)

**Purpose**: Consistent button styling and behavior across the app.

**Props**:
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
- `size`: 'sm' | 'md' | 'lg'
- `loading`: boolean - Shows spinner and disables interaction
- `disabled`: boolean
- `fullWidth`: boolean
- `type`: 'button' | 'submit' | 'reset'

**Usage**:
```vue
<BaseButton 
  variant="primary" 
  size="lg" 
  :loading="isLoading" 
  @click="handleClick"
>
  Submit
</BaseButton>
```

**Features**:
- Loading states with spinner
- Focus management for accessibility
- Consistent hover/active states
- Full keyboard navigation support

### BaseInput (`src/components/ui/BaseInput.vue`)

**Purpose**: Consistent form input styling and validation display.

**Props**:
- `modelValue`: string - v-model support
- `label`: string - Input label
- `placeholder`: string
- `type`: 'text' | 'email' | 'password' | 'tel' | 'url'
- `required`: boolean
- `disabled`: boolean
- `error`: string - Validation error message
- `hint`: string - Helper text
- `autocomplete`: string
- `size`: 'sm' | 'md' | 'lg'

**Usage**:
```vue
<BaseInput
  v-model="email"
  type="email"
  label="Email Address"
  placeholder="Enter your email"
  required
  :error="emailError"
  @blur="validateEmail"
/>
```

**Features**:
- Built-in validation state display
- ARIA labels and descriptions
- Focus management
- Consistent sizing and spacing

### BaseCard (`src/components/ui/BaseCard.vue`)

**Purpose**: Consistent container component for grouping content.

**Props**:
- `title`: string - Optional card title
- `variant`: 'default' | 'outlined' | 'elevated'
- `padding`: 'none' | 'sm' | 'md' | 'lg'
- `hoverable`: boolean - Adds hover effects

**Slots**:
- `header` - Custom header content
- `default` - Main content
- `footer` - Footer actions or content

**Usage**:
```vue
<BaseCard title="User Profile" variant="elevated">
  <p>Card content goes here</p>
  <template #footer>
    <BaseButton>Edit Profile</BaseButton>
  </template>
</BaseCard>
```

### BaseAlert (`src/components/ui/BaseAlert.vue`)

**Purpose**: Consistent feedback messages and notifications.

**Props**:
- `variant`: 'info' | 'success' | 'warning' | 'error'
- `title`: string - Optional alert title
- `message`: string - Alert message
- `show`: boolean - Visibility control
- `dismissible`: boolean - Shows close button

**Usage**:
```vue
<BaseAlert
  variant="error"
  title="Validation Error"
  :message="errorMessage"
  :show="!!errorMessage"
  dismissible
  @dismiss="clearError"
/>
```

## Form Validation System (`src/utils/validation.ts`)

### Validation Rules
Pre-built validation rules for common use cases:

```typescript
import { validationRules } from '@/utils/validation'

// Common rules
validationRules.required('This field is required')
validationRules.email()
validationRules.minLength(8)
validationRules.strongPassword()
validationRules.name()
```

### Form Validation Composable

```typescript
import { useFormValidation } from '@/utils/validation'

const {
  formData,           // Reactive form data
  validation,         // Validation state
  errors,            // Array of current errors
  isValid,           // Form validity state
  hasErrors,         // Boolean if any errors exist
  isSubmitting,      // Loading state
  setFieldValidation, // Set up field rules
  validateField,     // Validate single field
  validateAllFields, // Validate entire form
  getFieldError,     // Get field error for display
} = useFormValidation({
  email: '',
  password: ''
})
```

## Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 768px
- **Desktop**: > 768px

### Mobile-First Approach
All components are designed mobile-first with progressive enhancement:

```css
/* Mobile styles (default) */
.component {
  padding: var(--space-4);
}

/* Tablet and up */
@media (min-width: 640px) {
  .component {
    padding: var(--space-6);
  }
}
```

## Accessibility Guidelines

### ARIA Implementation
- All form inputs have proper labels and descriptions
- Error messages are announced to screen readers
- Interactive elements have appropriate ARIA roles
- Focus management for keyboard navigation

### Color Contrast
- All color combinations meet WCAG AA standards
- Interactive elements have sufficient contrast ratios
- Focus indicators are clearly visible

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Logical tab order throughout the application
- Skip links for screen reader users

## Animation & Transitions

### Micro-Interactions
- Subtle hover effects on interactive elements
- Loading spinners for async operations
- Smooth transitions for state changes

### Performance Considerations
- Use CSS transforms for better performance
- Respect `prefers-reduced-motion` for accessibility
- Optimize animations for 60fps

## Error Handling Patterns

### User-Friendly Messages
- Clear, actionable error descriptions
- Contextual help for resolving issues
- Consistent error styling across the app

### Loading States
- Immediate feedback for user actions
- Skeleton screens for data loading
- Progress indicators for multi-step processes

## Future Enhancements

### Planned Components
- `BaseModal` - Modal dialog component
- `BaseTooltip` - Contextual help tooltips
- `BaseTable` - Data display tables
- `BaseSelect` - Dropdown select component
- `BaseTabs` - Tabbed content navigation

### Advanced Features
- Dark mode support
- Theme customization
- Component composition patterns
- Advanced form controls

## Usage Guidelines

### When to Create New Components
1. **Reusability**: Component will be used in 3+ places
2. **Complexity**: Component has significant logic or styling
3. **Consistency**: Need to enforce design standards

### Component Naming
- Use `Base` prefix for foundational UI components
- Use descriptive names for feature components
- Follow Vue.js naming conventions (PascalCase)

### Props Design
- Keep props minimal and focused
- Use TypeScript interfaces for complex prop types
- Provide sensible defaults
- Use composition over configuration

### Styling Guidelines
- Use design tokens for all styling values
- Avoid magic numbers in CSS
- Follow mobile-first responsive design
- Use semantic class names

This design system provides a solid foundation for building consistent, user-centric interfaces while maintaining developer productivity and code quality.