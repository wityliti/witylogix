# Code Style Guide

This document defines code style conventions for Witylogix. Consistency across the codebase improves readability and maintainability.

## TypeScript Conventions

### Strict Mode Enforced

All TypeScript files use strict compiler options:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**This means**:

- No `any` types (use proper typing instead)
- Explicit return types on functions
- Unused variables not allowed
- Null/undefined must be handled

### Using `any` (Avoid!)

The only acceptable use of `any` is for Prisma's dynamic query API:

```typescript
// Good: Prisma exception
const result = await prisma.users.findMany({
  where: {
    [filterField]: filterValue, // Dynamic field - ok to use any
  } as any,
});

// Bad: Never do this
const name: any = "John"; // ✗ Use string instead
function process(data: any) {} // ✗ Use proper typing
```

### Named Exports Over Default Exports

Prefer named exports for better discoverability:

```typescript
// Good
export const calculateDistance = (from: Location, to: Location): number => {
  // ...
};

export const formatAddress = (address: Address): string => {
  // ...
};

// Bad (default export)
export default function calculateDistance() {
  // ...
}
```

**Exception**: React page components in Next.js can use default exports for routing.

### Interface vs Type

Use `interface` for object shapes, `type` for unions and primitives:

```typescript
// Good: Interface for object shapes
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

interface UserCreateInput extends Omit<User, "id" | "createdAt"> {}

// Good: Type for unions
type UserRole = "admin" | "manager" | "user";
type Result<T> = T | Error;

// Bad: Type for object shapes (use interface instead)
type User = {
  id: string;
  email: string;
};
```

### Nullable Types

Be explicit about nullable values:

```typescript
// Good
interface User {
  id: string;
  email: string;
  middleName: string | null;
  lastLogin: Date | null;
}

function getUserEmail(user: User): string | null {
  return user.email ?? null;
}

// Bad
interface User {
  id: string;
  email?: string; // Optional is different from nullable
  middleName?: string;
}
```

### Async/Await Over Promises

Always use async/await for better readability:

```typescript
// Good
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  } catch (error) {
    throw new Error(`Failed to fetch user: ${error}`);
  }
}

// Avoid: Chained promises
function fetchUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`)
    .then((res) => res.json())
    .catch((err) => {
      throw new Error(`Failed to fetch user: ${err}`);
    });
}
```

## React Patterns

### Server Components by Default

In Next.js apps, use Server Components by default:

```typescript
// Good: Default is server component
export default async function OrdersPage() {
  const orders = await getOrders();
  return <OrdersList orders={orders} />;
}
```

### Client Components Only When Needed

Use `'use client'` only for interactivity:

```typescript
// Good: Client component for interactivity
'use client';

import { useState } from 'react';
import { Button } from '@/components/button';

export function OrderFilter() {
  const [filters, setFilters] = useState({});
  return (
    <div>
      <Button onClick={() => setFilters({})}>Clear Filters</Button>
    </div>
  );
}

// Bad: Using 'use client' unnecessarily
'use client';

export function OrdersList({ orders }) {
  return (
    <div>
      {orders.map(order => (
        <div key={order.id}>{order.id}</div>
      ))}
    </div>
  );
}
```

### Component Patterns

Keep components focused and composable:

```typescript
// Good: Small, focused components
interface BadgeProps {
  variant: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant, children }) => {
  const baseStyles = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium';
  const variantStyles = {
    primary: 'bg-blue-100 text-blue-900',
    secondary: 'bg-gray-100 text-gray-900',
    danger: 'bg-red-100 text-red-900'
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]}`}>
      {children}
    </span>
  );
};

// Bad: Large, doing too much
export function ComplexComponent({ data, onFilter, onSort }) {
  // 200+ lines of logic, styling, filtering, sorting, etc.
}
```

### Props Typing

Always define explicit prop types:

```typescript
// Good
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={isLoading}
        className={cn('px-4 py-2', variant === 'primary' && 'bg-blue-600')}
        {...props}
      >
        {isLoading ? 'Loading...' : children}
      </button>
    );
  }
);

// Bad
export const Button = ({ variant, isLoading, children, ...props }) => {
  // No type safety
};
```

## Tailwind CSS (v3.4)

### Use Utility Classes

Always prefer Tailwind utilities over inline styles:

```typescript
// Good
<div className="flex items-center justify-between p-4 rounded-lg bg-white shadow">
  <h1 className="text-lg font-semibold text-gray-900">Title</h1>
  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Action
  </button>
</div>

// Bad: Inline styles
<div style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }}>
  <h1 style={{ fontSize: 18, fontWeight: 600 }}>Title</h1>
</div>
```

### Custom CSS Variables

Use `--wl-*` prefixed CSS variables for theme values:

```css
/* In Tailwind config or global styles */
:root {
  --wl-primary: #2563eb;
  --wl-secondary: #64748b;
  --wl-success: #10b981;
  --wl-danger: #ef4444;
  --wl-border-light: #e2e8f0;
  --wl-border-dark: #1e293b;
}

.dark {
  --wl-primary: #3b82f6;
  --wl-secondary: #94a3b8;
  --wl-border-light: #334155;
  --wl-border-dark: #0f172a;
}
```

Use in components:

```tsx
<div className="border border-[var(--wl-border-light)] dark:border-[var(--wl-border-dark)]">
  Content
</div>
```

### Dark Mode Support

All components must support dark mode:

```typescript
// Good: Explicit dark mode
<div className="bg-white dark:bg-gray-900">
  <h1 className="text-gray-900 dark:text-white">Title</h1>
  <p className="text-gray-600 dark:text-gray-400">Subtitle</p>
</div>

// Bad: Light mode only
<div className="bg-white">
  <h1 className="text-gray-900">Title</h1>
</div>
```

### cn() Utility for Conditional Classes

Use `cn()` from `@/lib/utils` to combine classes safely:

```typescript
import { cn } from '@/lib/utils';

interface CardProps {
  variant?: 'default' | 'highlight' | 'muted';
  isSelected?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  isSelected,
  className,
  children
}) => {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        'transition-colors duration-200',
        variant === 'default' && 'bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700',
        variant === 'highlight' && 'bg-blue-50 border-blue-200 dark:bg-blue-900 dark:border-blue-700',
        variant === 'muted' && 'bg-gray-50 border-gray-100 dark:bg-gray-800 dark:border-gray-700',
        isSelected && 'ring-2 ring-blue-500',
        className
      )}
    >
      {children}
    </div>
  );
};
```

## Component Patterns

### Button Component Variants

Define variant rules clearly:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-white',
  ghost: 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700'
};

const BUTTON_SIZES = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', disabled, className, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'rounded font-medium transition-colors',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
);
```

### Badge Component Pattern

```typescript
interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  children: React.ReactNode;
}

const BADGE_VARIANTS = {
  primary: 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
  secondary: 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
  success: 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100',
  danger: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100',
  warning: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100'
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'primary', children }) => (
  <span className={cn(
    'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
    BADGE_VARIANTS[variant]
  )}>
    {children}
  </span>
);
```

## Backend Patterns

### Zod Validation

Always validate inputs with Zod:

```typescript
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "manager", "user"]).default("user"),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

async function createUser(input: unknown): Promise<User> {
  const data = createUserSchema.parse(input);
  // data is now typed as CreateUserInput
  return db.users.create({ data });
}
```

### Error Handling

Use structured error handling:

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = "NotFoundError";
  }
}

async function getUserOrThrow(id: string): Promise<User> {
  const user = await db.users.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User", id);
  }
  return user;
}
```

### Prisma Access Patterns

Use Prisma middleware for consistent patterns:

```typescript
// Good: Single database call
const user = await prisma.users.findUnique({
  where: { id: userId },
  include: { orders: true, profile: true },
});

// Bad: N+1 queries
const user = await prisma.users.findUnique({ where: { id: userId } });
const orders = await prisma.orders.findMany({ where: { userId } });
const profile = await prisma.profiles.findUnique({ where: { userId } });
```

## File Naming Conventions

### Component Files

PascalCase for React components:

- `UserCard.tsx` - Component file
- `UserCard.test.tsx` - Test file
- `useUserQuery.ts` - Custom hook

### Utility Functions

camelCase for utilities:

- `formatDate.ts`
- `calculateDistance.ts`
- `validateEmail.ts`

### Constants

UPPER_SNAKE_CASE for constants:

- `MAX_RETRY_ATTEMPTS.ts`
- `DEFAULT_PAGE_SIZE.ts`
- `API_TIMEOUT_MS.ts`

### Type Definitions

PascalCase for types/interfaces:

- `User.ts`
- `OrderStatus.ts`
- `ApiResponse.ts`

### Index Files

Use index files to organize exports:

```typescript
// lib/index.ts
export { cn } from "./cn";
export { formatDate } from "./formatDate";
export { calculateDistance } from "./calculateDistance";

// In components
import { cn, formatDate } from "@/lib";
```

## Import Ordering

Group imports in this order:

1. External packages (React, Next.js, npm libraries)
2. Internal absolute imports (@/ paths)
3. Relative imports (./, ../)
4. Side effects (last)

```typescript
import React, { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/button";
import { formatDate } from "@/lib/formatDate";
import { useAuth } from "./useAuth";
import { handleError } from "../utils";
import "./styles.css";
```

## Comments & Documentation

### Comment Guidelines

- Use comments to explain "why", not "what" (code shows what)
- Keep comments up-to-date with code changes
- Use JSDoc for public functions and types

```typescript
// Good: Explains the reasoning
// We use exponential backoff here because the service rate-limits at 100 req/sec.
// Linear backoff was causing cascading failures during peak hours.
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let delay = 100;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`);
}

// Bad: Obvious from reading code
// Fetch URL
const result = await fetch(url);
// If error, wait and retry
if (!result.ok) {
  await delay(100);
}
```

### JSDoc Examples

```typescript
/**
 * Calculate the distance between two geographic coordinates.
 *
 * @param from - Starting coordinate with latitude and longitude
 * @param to - Ending coordinate with latitude and longitude
 * @returns Distance in kilometers using the Haversine formula
 *
 * @example
 * const distance = calculateDistance(
 *   { lat: 40.7128, lon: -74.006 },
 *   { lat: 34.0522, lon: -118.2437 }
 * );
 * console.log(distance); // ~3944 km
 */
export function calculateDistance(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  // Implementation
}

/**
 * User account information
 */
interface User {
  /** Unique identifier */
  id: string;
  /** Email address (must be unique) */
  email: string;
  /** Full name of the user */
  name: string;
  /** When the account was created */
  createdAt: Date;
}
```

## Linting & Formatting

### Run Checks Locally

```bash
# Format code
pnpm format

# Lint for style issues
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix

# Type check
pnpm typecheck
```

### Pre-commit Hooks

Husky automatically runs checks before commit:

- Prettier formatting
- ESLint validation
- Commit message validation

## Summary

Follow these principles:

1. **Type safety**: Strict TypeScript, no `any`
2. **Clarity**: Code should be easy to understand
3. **Consistency**: Follow conventions throughout
4. **Testing**: Write tests alongside code
5. **Documentation**: Comments explain why, not what
6. **Performance**: Optimize for reading comprehension first
