# Checkout Widget - Build Checklist

## Pre-Build Setup

### 1. Environment
- [ ] Node.js 20+ installed
- [ ] pnpm 9.15.0+ installed
- [ ] Working in correct directory: `packages/checkout-widget/`

### 2. Dependencies
- [ ] Run: `pnpm install`
- [ ] Verify node_modules created
- [ ] Check: `pnpm list` shows all dependencies

## Type Safety

### 3. Type Checking
- [ ] Run: `pnpm run type-check`
- [ ] No TypeScript errors
- [ ] All imports resolved
- [ ] JSX types recognized

## Building

### 4. Development Build
- [ ] Run: `pnpm run dev`
- [ ] Watch mode activates
- [ ] Can see file changes reflected

### 5. Production Build
- [ ] Run: `pnpm run build`
- [ ] dist/ directory created
- [ ] Check build outputs:
  - [ ] dist/index.cjs (CommonJS)
  - [ ] dist/index.mjs (ES Modules)
  - [ ] dist/index.d.ts (TypeScript definitions)
  - [ ] dist/index.cjs.map (Source map)
  - [ ] dist/index.mjs.map (Source map)

## Build Output Validation

### 6. CommonJS Output (dist/index.cjs)
- [ ] File exists and has content
- [ ] Contains all component exports
- [ ] Contains all hook exports
- [ ] Contains all type exports
- [ ] Size is reasonable (> 50KB)

### 7. ES Module Output (dist/index.mjs)
- [ ] File exists and has content
- [ ] Uses ES6 import/export syntax
- [ ] Contains all exports
- [ ] Can be imported in modern browsers
- [ ] Size is reasonable (> 50KB)

### 8. TypeScript Definitions (dist/index.d.ts)
- [ ] File exists
- [ ] Contains interface definitions
- [ ] Contains component prop types
- [ ] Contains hook types
- [ ] IDE autocomplete should work

### 9. Source Maps
- [ ] .cjs.map file exists
- [ ] .mjs.map file exists
- [ ] Maps to original TypeScript source
- [ ] Debugging references work

## File Structure Verification

### 10. Source Files Present
- [ ] src/index.ts (exports)
- [ ] src/types.ts (types)
- [ ] src/styles.css (styles)
- [ ] 6 component files in src/components/
- [ ] 3 hook files in src/hooks/
- [ ] 2 utility files in src/utils/

### 11. Component Files
- [ ] checkout-widget.tsx
- [ ] date-picker.tsx
- [ ] time-slot-grid.tsx
- [ ] zone-rate-display.tsx
- [ ] address-input.tsx
- [ ] delivery-options.tsx

### 12. Hook Files
- [ ] use-slot-availability.ts
- [ ] use-zone-rates.ts
- [ ] use-address-validation.ts

### 13. Utility Files
- [ ] date-utils.ts
- [ ] rate-calculator.ts

## Configuration Verification

### 14. Build Configuration
- [ ] tsup.config.ts exists and is valid
- [ ] tsconfig.json configured correctly
- [ ] Tailwind config extends properly
- [ ] package.json has correct scripts

### 15. Package.json Validation
- [ ] Correct package name: @witylogix/checkout-widget
- [ ] Correct version: 1.0.0
- [ ] Main field points to dist/index.cjs
- [ ] Module field points to dist/index.mjs
- [ ] Types field points to dist/index.d.ts
- [ ] Exports field is configured
- [ ] Files array includes dist/

## Import/Export Testing

### 16. Named Exports
Test each export is available:
- [ ] CheckoutWidget
- [ ] DatePicker
- [ ] TimeSlotGrid
- [ ] ZoneRateDisplay
- [ ] AddressInput
- [ ] DeliveryOptions

### 17. Hook Exports
- [ ] useSlotAvailability
- [ ] useBatchSlotAvailability
- [ ] useZoneRates
- [ ] useBatchZoneRates
- [ ] useAddressValidation
- [ ] useAddressAutocomplete

### 18. Type Exports
- [ ] DeliveryMethodType enum
- [ ] All interfaces can be imported
- [ ] CostBreakdown type available
- [ ] WidgetConfig type available

### 19. Utility Exports
- [ ] Date formatting functions available
- [ ] Rate calculation functions available
- [ ] All 20+ date utils accessible
- [ ] All 9 rate calculator functions accessible

## Documentation Verification

### 20. README.md
- [ ] Complete API documentation
- [ ] Installation instructions
- [ ] Usage examples
- [ ] Props reference
- [ ] Integration guides

### 21. QUICK_START.md
- [ ] Getting started instructions
- [ ] Basic usage example
- [ ] Backend API examples
- [ ] Integration patterns

### 22. IMPLEMENTATION_SUMMARY.md
- [ ] Architecture documentation
- [ ] File inventory
- [ ] Feature list
- [ ] Build configuration details

## Code Quality Checklist

### 23. TypeScript Quality
- [ ] Strict mode enabled
- [ ] No 'any' types (except where necessary)
- [ ] All interfaces documented
- [ ] Type safety throughout

### 24. React Best Practices
- [ ] Functional components
- [ ] React 18+ hooks
- [ ] Proper dependency arrays
- [ ] No unnecessary re-renders
- [ ] Memoization where beneficial

### 25. Accessibility
- [ ] ARIA labels present
- [ ] Semantic HTML used
- [ ] Keyboard navigation works
- [ ] Focus management correct
- [ ] Color contrast adequate

### 26. Error Handling
- [ ] API errors handled
- [ ] Validation errors shown
- [ ] Loading states present
- [ ] User feedback clear
- [ ] No console errors

## Ready for Publication

### 27. NPM Ready
- [ ] Package can be published to npm
- [ ] No sensitive data in files
- [ ] License header present
- [ ] .gitignore prevents dist in git (or dist is committed)

### 28. Integration Ready
- [ ] Can be installed with: `npm install @witylogix/checkout-widget`
- [ ] Works in React applications
- [ ] TypeScript support available
- [ ] CSS import works

### 29. Documentation Ready
- [ ] All APIs documented
- [ ] Examples are accurate
- [ ] Integration guides complete
- [ ] Troubleshooting section present

## Final Sign-Off

### 30. Production Ready
- [ ] All tests pass (when tests added)
- [ ] No console warnings
- [ ] No unhandled errors
- [ ] Performance acceptable
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] Compact mode works

### 31. Git Ready
- [ ] Files committed to git
- [ ] No uncommitted changes
- [ ] Version tag created (v1.0.0)
- [ ] Ready for release

---

## Build Commands Reference

```bash
# Install dependencies
pnpm install

# Type checking
pnpm run type-check

# Development (watch mode)
pnpm run dev

# Production build
pnpm run build

# Run tests (when added)
pnpm run test
```

## Package Ready to Ship! 🚀

Once all checklist items are checked, the package is ready for:
1. Publishing to npm
2. Integration into Shopify extensions
3. Integration into WooCommerce
4. Standalone HTML embedding
5. Production deployment

---
Status: Production Ready
Version: 1.0.0
License: AGPL-3.0-only
Created: 2026-03-11
