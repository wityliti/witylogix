# Witylogix Onboarding Wizard - Sprint 6.0

Production-quality onboarding wizard inspired by Fleetbase's flow, built with Next.js, TypeScript, and Tailwind CSS.

## Architecture

### State Machine
```
VERIFY_EMAIL
    ↓ (emailVerified=true)
CHOOSE_DEPLOYMENT
    ↓ (deploymentType selected)
CONFIGURE_WORKSPACE
    ├─ COMPANY_INFO (companyName, companySize)
    ├─ INDUSTRY (industry selection)
    ├─ GOALS (multi-select goals)
    ├─ INTEGRATIONS (placeholder)
    ├─ DASHBOARD_LAYOUT (placeholder)
    ├─ DATA_IMPORT (placeholder)
    └─ REVIEW (confirmation)
```

### File Structure
```
apps/dashboard/src/app/onboarding/
├── layout.tsx              # Full-screen layout with left illustration + right form
├── page.tsx                # Main orchestrator (state machine, routing)
├── types.ts                # Enums and interfaces
├── steps/
│   ├── verify-email.tsx    # Email OTP verification
│   ├── choose-deployment.tsx # Cloud vs Self-Managed
│   ├── company-info.tsx    # Company details + logo upload
│   ├── industry-select.tsx # Industry grid selection
│   ├── goals-select.tsx    # Multi-select goals
│   ├── integrations-select.tsx  # Coming soon (placeholder)
│   └── dashboard-layout.tsx     # Coming soon (placeholder)
└── README.md               # This file
```

## Components

### 1. Layout (`layout.tsx`)
**Responsive two-panel design:**
- **Left Panel** (hidden on mobile):
  - Witylogix branding with gradient logo
  - Animated SVG illustration (route animation, moving truck, pulsing dots)
  - Benefits description
  - Smooth fade-in staggered animations

- **Right Panel**:
  - Form content area
  - Responsive padding and widths
  - Full-width on mobile, side-by-side on desktop

**Key Features:**
- Dark theme with amber gradients
- Animated route visualization with moving truck
- Backdrop gradient effects
- Mobile-responsive (stacks vertically on small screens)

### 2. Page (`page.tsx`)
**Main orchestrator component:**
- State machine managing main steps and sub-steps
- URL query parameter persistence (`?step=...&sub=...`)
- Progress calculation and display
- Navigation logic (Next, Back, Skip, Launch)
- Auto-scroll on step changes
- Smooth fade-in transitions

**Key Methods:**
- `handleNext()` - Move to next step with validation
- `handleBack()` - Return to previous step
- `handleSkip()` - Skip optional sub-steps
- `handleComplete()` - Finalize onboarding and redirect

### 3. Step Components

#### VerifyEmail (`verify-email.tsx`)
**6-digit OTP verification:**
```
Features:
- Individual digit input boxes (auto-focus, backspace handling)
- Email display: "We've sent a code to {email}"
- Resend button with 60-second countdown
- Loading state during verification
- Success animation with checkmark and pulsing circle
- Error state with inline error message
- Demo code: "123456" for testing
```

#### ChooseDeployment (`choose-deployment.tsx`)
**Deployment model selection:**
```
Cloud (SaaS)
├─ Features: Instant setup, Auto updates, 99.9% SLA, Built-in security
└─ Color: Green highlight (success)

Self-Managed
├─ Features: Full control, Deploy anywhere, On-premise option, Custom config
└─ Color: Blue highlight (primary)

Additional:
- Security & Scale comparison boxes
- Feature lists per option
- Dynamic info box for selected deployment
- Selected state with checkmark
```

#### CompanyInfo (`company-info.tsx`)
**Company details collection:**
```
Fields:
- Company Name (required, text input)
- Company Website (optional, URL input)
- Logo Upload (optional, drag & drop + click)
- Company Size (required, 5 pill buttons: 1-10, 11-50, 51-200, 201-1k, 1000+)
- Phone Number (optional, tel input)

Features:
- Logo preview with delete button
- Drag & drop upload area
- File type validation (images only)
- DataURL conversion for preview
- Helpful info box
```

#### IndustrySelect (`industry-select.tsx`)
**Industry selection with custom option:**
```
Industries (3-column grid):
- E-Commerce & Retail (shopping bag)
- Food & Beverage (utensils)
- Healthcare & Pharma (heart)
- Logistics & 3PL (truck)
- Field Service (wrench)
- Manufacturing (factory)
- Courier & Last-Mile (package)
- Grocery & Fresh (leaf)
- Custom/Other (plus icon) → expands text input

Features:
- Single select (radio button behavior)
- Custom text input for "Other"
- Colored icons per industry
- Selected display box
- Highlight animation on select
```

#### GoalsSelect (`goals-select.tsx`)
**Multi-select goals:**
```
Goals (2-column grid, 10 options):
- Route Optimization
- Fleet Tracking & Telematics
- Last-Mile Delivery Management
- Multi-Carrier Shipping
- Order Management & Fulfillment
- Customer Notifications & Tracking
- Analytics & Reporting
- ERP & Accounting Integration
- Driver Management
- Compliance & ELD

Features:
- Multi-select with checkmarks
- Selected count badge
- Each card: icon + title + description
- Selected goals display with badges
- "UP NEXT: Integrations" breadcrumb
- Icon variety (map, satellite, package, ship, etc.)
```

### 4. Types (`types.ts`)
**TypeScript enums and interfaces:**
```typescript
enum OnboardingStep { VERIFY_EMAIL, CHOOSE_DEPLOYMENT, CONFIGURE_WORKSPACE }
enum OnboardingSubStep { COMPANY_INFO, INDUSTRY, GOALS, ... }
enum Industry { ECOMMERCE, FOOD_BEVERAGE, ... }
enum Goal { ROUTE_OPTIMIZATION, FLEET_TRACKING, ... }
enum DeploymentType { CLOUD, SELF_MANAGED }
enum CompanySize { SMALL, SMALL_MEDIUM, MEDIUM, MEDIUM_LARGE, LARGE }

interface OnboardingData {
  // Email verification
  email: string
  verificationCode: string
  emailVerified: boolean

  // Deployment
  deploymentType: DeploymentType | null

  // Company info
  companyName: string
  companyWebsite: string
  companyLogo: string | null
  companySize: CompanySize | null
  phoneNumber: string

  // Industry & Goals
  industry: Industry | null
  industryCustom: string
  goals: Goal[]

  // Future steps
  integrations: string[]
  dashboardLayout: string
  dataImport: string
}
```

## Design System Integration

### Tailwind + CSS Variables
- **Primary Color**: `--wl-primary-500` (Amber #f5a623)
- **Backgrounds**: `--wl-bg-surface`, `--wl-bg-overlay`, `--wl-bg-elevated`
- **Text Colors**: Primary, Secondary, Tertiary levels
- **Borders**: `--wl-border-subtle`, `--wl-border-default`, `--wl-border-strong`

### Components Used
- `Button` (variants: primary, secondary, ghost, danger)
- `Badge` (variants: default, success, warning, danger, info, primary)
- `Input` (text, URL, tel types)
- Custom styled elements with Tailwind classes

### Icons
- Lucide React icons throughout
- Consistent icon sizing (w-4 h-4 for small, w-5 h-5 for medium, w-6 h-6 for large)
- Color-coordinated with content

## Navigation & URL Structure

### Query Parameters
```
/onboarding
  ?step=verify-email
  ?step=choose-deployment
  ?step=configure-workspace&sub=company-info
  ?step=configure-workspace&sub=industry
  ?step=configure-workspace&sub=goals
  ?step=configure-workspace&sub=integrations
  ?step=configure-workspace&sub=dashboard-layout
  ?step=configure-workspace&sub=data-import
  ?step=configure-workspace&sub=review
```

### Navigation Flow
```
Back button (disabled on first step)
Next button (enabled when step valid)
Skip button (optional sub-steps only)
Launch Dashboard (final step, redirects to /)
```

## Validation Logic

### Email Verification
- Step validates: `emailVerified === true`
- Demo code: `123456`
- API call simulated (1.5s delay)

### Deployment
- Step validates: `deploymentType !== null`
- Two options available

### Company Info
- Required: `companyName` and `companySize`
- Optional: website, logo, phone

### Industry
- Required: `industry !== null`
- Custom text input available

### Goals
- Required: `goals.length > 0`
- Multi-select minimum 1

### Subsequent Steps
- Marked optional (can skip)
- Validate to `true` (no blocking)

## Animations

### Fade-in Stagger
```css
@keyframes wl-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Route Animation
```css
@keyframes dash {
  0% { stroke-dashoffset: 500; }
  50% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -500; }
}

@keyframes moveRoute {
  /* Truck moves along route */
  0% { transform: translate(-150px, -100px); }
  ...
  100% { transform: translate(160px, -120px); }
}

@keyframes pulse {
  0%, 100% { r: 8; opacity: 1; }
  50% { r: 14; opacity: 0.5; }
}
```

## Future Steps (Placeholders)

### Integrations (`integrations-select.tsx`)
- Coming soon screen
- Integration catalog (Shopify, WooCommerce, etc.)
- API key configuration
- Test connection button

### Dashboard Layout (`dashboard-layout.tsx`)
- Coming soon screen
- Preset dashboard layouts
- Widget selection
- Customization options

### Data Import
- Coming soon screen
- CSV/Excel upload
- Legacy system migration
- Data mapping interface

### Review
- Confirmation screen
- Summary of all selections
- Edit buttons per section
- Final launch confirmation

## Testing

### Demo Credentials
- Email: `demo@witylogix.com`
- Verification code: `123456`
- No real email verification (simulated)

### Test Scenarios
1. **Happy Path**: Complete all steps in order
2. **Validation**: Try advancing without required fields
3. **Back Navigation**: Verify back button persists data
4. **Skip**: Skip optional sub-steps
5. **URL Direct**: Navigate via URL params directly

## Performance Considerations

- **Client Component**: All step components use `"use client"` for interactivity
- **No External Dependencies**: Only Lucide icons + Tailwind
- **Minimal Bundle**: No animation libraries (CSS animations only)
- **Responsive**: Mobile-first approach
- **Accessibility**: Semantic HTML, focus management in OTP input

## Future Enhancements

- [ ] Backend API integration for email verification
- [ ] Logo compression and optimization
- [ ] Real integration APIs (Shopify, etc.)
- [ ] Data persistence (localStorage/DB)
- [ ] Analytics tracking (step completion rates)
- [ ] A/B testing variations
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Error boundary for API failures
- [ ] Loading skeleton states
- [ ] Progressive form saving
