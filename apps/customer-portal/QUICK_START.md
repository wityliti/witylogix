# Quick Start Guide - Customer Portal

## Installation

```bash
cd apps/customer-portal
pnpm install
```

## Development

```bash
pnpm dev
```

Server runs at: `http://localhost:3004`

## Build

```bash
pnpm build
pnpm start
```

## Linting & Type Checking

```bash
pnpm lint
pnpm typecheck
```

## Project Structure at a Glance

```
src/
├── app/                    # Pages (App Router)
│   ├── page.tsx           # Dashboard
│   ├── orders/            # Order management
│   ├── track/             # Live tracking
│   ├── preferences/       # User preferences
│   └── support/           # Support center
├── components/            # Reusable UI components
├── lib/                   # Utilities
├── styles/                # Global CSS
└── types/                 # TypeScript definitions
```

## Key Pages

| Route                     | Component              | Purpose                         |
| ------------------------- | ---------------------- | ------------------------------- |
| `/`                       | `page.tsx`             | Dashboard with stats & overview |
| `/orders`                 | `orders/page.tsx`      | Order list with filters         |
| `/orders/[id]`            | `orders/[id]/page.tsx` | Order details & timeline        |
| `/orders/[id]/reschedule` | `reschedule/page.tsx`  | Reschedule delivery flow        |
| `/orders/[id]/rate`       | `rate/page.tsx`        | Rate delivery                   |
| `/track`                  | `track/page.tsx`       | Real-time tracking              |
| `/preferences`            | `preferences/page.tsx` | Delivery preferences            |
| `/support`                | `support/page.tsx`     | FAQ & support                   |

## Key Components

```typescript
// Shared Components
import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { DeliveryTimeline } from "@/components/delivery-timeline";
import { OrderCard } from "@/components/order-card";
import { MiniMap } from "@/components/mini-map";
import { RatingStars } from "@/components/rating-stars";
```

## Styling

### Using Tailwind Classes

```tsx
import { cn } from "@/lib/utils";

<div
  className={cn(
    "bg-wl-bg-surface border border-wl-border-subtle rounded-lg",
    "p-4 sm:p-6",
    "hover:shadow-md transition-shadow duration-fast",
  )}
>
  Content
</div>;
```

### CSS Variables Available

```css
/* Background Colors */
--wl-bg-root
--wl-bg-surface
--wl-bg-elevated
--wl-bg-overlay
--wl-bg-sidebar

/* Text Colors */
--wl-text-primary
--wl-text-secondary
--wl-text-tertiary
--wl-text-inverse

/* Primary Colors */
--wl-primary-50 through --wl-primary-900

/* Status Colors */
--wl-success-*, --wl-warning-*, --wl-danger-*, --wl-info-*

/* Spacing */
--wl-space-0 through --wl-space-12

/* And more... see tailwind.config.ts */
```

## Mock Data Usage

Mock data is included in page files for demonstration. Replace with API calls:

```typescript
// Before: Using mock data
const orders = mockOrders;

// After: Using API
const response = await fetch("/api/orders");
const orders = await response.json();
```

## Type Definitions

```typescript
import type {
  Order,
  OrderStatus,
  DeliveryTimestep,
  Driver,
  LiveTracking,
  CustomerPreferences,
  RatingStars,
} from "@/types";
```

## Common Patterns

### Form Submission

```tsx
const [isSaving, setIsSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);

const handleSave = async () => {
  setIsSaving(true);
  try {
    // API call
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  } finally {
    setIsSaving(false);
  }
};
```

### Conditional Rendering

```tsx
{
  filteredOrders.length > 0 ? (
    <div className="grid gap-4">
      {filteredOrders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  ) : (
    <div>No orders found</div>
  );
}
```

### Navigation Links

```tsx
import Link from 'next/link';

<Link
  href={`/orders/${orderId}`}
  className={cn('px-4 py-2 rounded-lg', ...)}
>
  View Order
</Link>
```

## Responsive Design

Breakpoints:

- `sm`: 640px (small devices)
- `lg`: 1024px (large devices)

Example:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id} item={item} />
  ))}
</div>
```

## Accessibility Tips

Always include:

- ARIA labels: `aria-label="Description"`
- Form labels: `<label htmlFor="inputId">`
- Focus states: `:focus-visible`
- Semantic HTML: `<button>`, `<a>`, `<form>`

## Dark Theme

The portal automatically inherits dark theme from CSS variables.
To toggle theme (when implemented):

```tsx
<button onClick={() => toggleTheme()}>Toggle Dark Mode</button>
```

## Performance

- Images: Use Next.js Image component when needed
- Lazy Loading: Built-in with dynamic imports
- Code Splitting: Automatic with Next.js App Router
- Bundle Size: Monitor with `next build`

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Port Already in Use

```bash
# Use different port
pnpm dev -- --port 3005
```

### TypeScript Errors

```bash
pnpm typecheck
```

### Build Issues

```bash
# Clean and rebuild
rm -rf .next
pnpm build
```

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Witylogix Customer Portal
```

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Docker

```bash
docker build -t witylogix-customer-portal .
docker run -p 3004:3004 witylogix-customer-portal
```

### Manual

```bash
pnpm build
pnpm start
```

## Documentation

- Full implementation details: `IMPLEMENTATION_SUMMARY.md`
- Build checklist: `BUILD_CHECKLIST.md`
- This file: `QUICK_START.md`

## Support

For questions or issues, refer to:

1. This quick start guide
2. `IMPLEMENTATION_SUMMARY.md` for architecture
3. Component source files for implementation details
4. `BUILD_CHECKLIST.md` for requirements verification

## Next Steps

1. **Install & Run:** `pnpm install && pnpm dev`
2. **Browse:** Open http://localhost:3004
3. **Explore:** Navigate through all pages
4. **Integrate:** Connect to real API endpoints
5. **Test:** Write unit & E2E tests
6. **Deploy:** Push to production

---

Happy coding! 🚀

Questions? Check the implementation summary or review component source code.
