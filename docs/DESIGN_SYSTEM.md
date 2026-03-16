# Witylogix Design System

Comprehensive design system documentation for the Witylogix platform. Built with Tailwind CSS v3.4 and design tokens for consistent, scalable UI development.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Design Tokens](#design-tokens)
3. [Component Library](#component-library)
4. [Usage Guidelines](#usage-guidelines)
5. [Accessibility](#accessibility)
6. [Contributing](#contributing)

---

## Design Principles

### Industrial & Functional

The Witylogix design system prioritizes clarity and efficiency in logistics operations. Every component is designed to support rapid data processing, decision-making, and action execution.

### Dark-First Theme

All components are optimized for the dark theme (`#0a0a0c` background). The color palette uses carefully selected neutrals and semantic colors for readability in low-light environments.

- **Primary Color**: Amber (`#f5a623`) — represents warmth, energy, and logistics industry standards
- **Semantic Colors**: Green (success), Yellow (warning), Red (danger), Blue (info)

### Accessible by Default

Every component includes:
- Keyboard navigation support
- ARIA attributes for screen readers
- High contrast text (WCAG AA 4.5:1 minimum)
- Focus indicators on interactive elements
- Semantic HTML structure

### Density & Precision

Industrial interfaces require information density without visual clutter. The design system uses:
- Compact spacing (Tailwind spacing scale from 0 to 12)
- Precise typography hierarchy
- Clear visual separation through borders and backgrounds
- Careful use of color and shape to indicate state

---

## Design Tokens

All design tokens are defined as CSS custom properties (variables) and exposed through Tailwind CSS configuration.

### Color Tokens

#### Primary Colors (Amber)

The primary amber color represents the brand and is used for interactive elements, primary actions, and highlights.

```css
--wl-primary-50:   #fff9eb  /* Lightest */
--wl-primary-500:  #f5a623  /* Brand primary */
--wl-primary-900:  #6b4203  /* Darkest */
```

**Usage**: Buttons, links, active states, highlights, focus rings

#### Semantic Colors

Used consistently across the platform for status and feedback:

```css
--wl-success-400:  #34d399  /* Positive states, confirmations */
--wl-warning-400:  #fbbf24  /* Cautionary states, pending actions */
--wl-danger-400:   #f87171  /* Errors, destructive actions */
--wl-info-400:     #60a5fa  /* Information, notifications */
```

#### Background Colors

Layered backgrounds create visual hierarchy and functional separation:

```css
--wl-bg-root:      #0a0a0c  /* Page background */
--wl-bg-surface:   #111114  /* Card/container background */
--wl-bg-elevated:  #19191e  /* Modals, overlays, dropdowns */
--wl-bg-overlay:   #1f1f26  /* Hover states, temporary overlays */
--wl-bg-sidebar:   #0c0c10  /* Sidebar specific background */
--wl-bg-sunken:    #07070a  /* Inset/recessed areas */
```

#### Neutral Colors

Grayscale colors for text, borders, and secondary elements:

```css
--wl-neutral-50:   #f8f8fa  /* Lightest (almost white) */
--wl-neutral-500:  #62627e  /* Mid gray */
--wl-neutral-900:  #17172a  /* Darkest */
```

#### Text Colors

Organized by hierarchy and context:

```css
--wl-text-primary:    #f0f0f5  /* Main body text */
--wl-text-secondary:  #9494ac  /* Secondary text, labels */
--wl-text-tertiary:   #5e5e78  /* Subtle text, hints */
--wl-text-inverse:    #0a0a0c  /* Text on bright backgrounds */
```

#### Border Colors

For visual separation and definition:

```css
--wl-border-subtle:   rgba(255, 255, 255, 0.06)   /* Faint borders */
--wl-border-default:  rgba(255, 255, 255, 0.10)   /* Standard borders */
--wl-border-strong:   rgba(255, 255, 255, 0.16)   /* Emphasis borders */
--wl-border-focus:    var(--wl-primary-500)       /* Focus states */
```

### Typography Tokens

#### Font Families

```css
--wl-font-sans:  'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
--wl-font-mono:  'JetBrains Mono', 'SF Mono', 'Fira Code', monospace
```

#### Font Sizes

Precise sizing for visual hierarchy:

```
--wl-text-xs:    11px   (0.6875rem)
--wl-text-sm:    13px   (0.8125rem)
--wl-text-base:  14px   (0.875rem)   /* Body text */
--wl-text-md:    15px   (0.9375rem)
--wl-text-lg:    17px   (1.0625rem)
--wl-text-xl:    20px   (1.25rem)
--wl-text-2xl:   24px   (1.5rem)
--wl-text-3xl:   30px   (1.875rem)
```

#### Font Weights

```css
font-weight: 300  /* Light - not typically used */
font-weight: 400  /* Regular - body text, default */
font-weight: 500  /* Medium - secondary labels, slightly emphasized */
font-weight: 600  /* Semibold - labels, card titles */
font-weight: 700  /* Bold - headings, important text */
```

### Spacing Scale

Consistent spacing based on 4px base unit:

```css
--wl-space-0:   0      /* No spacing */
--wl-space-1:   4px    /* Extra tight */
--wl-space-2:   8px    /* Tight */
--wl-space-3:   12px   /* Small */
--wl-space-4:   16px   /* Base unit (default) */
--wl-space-5:   20px   /* Medium */
--wl-space-6:   24px   /* Large */
--wl-space-8:   32px   /* Extra large */
--wl-space-10:  40px   /* 2.5x */
--wl-space-12:  48px   /* 3x */
```

### Border Radius

Subtle rounding for industrial aesthetic:

```css
--wl-radius-sm:    4px      /* Minimal, subtle */
--wl-radius-md:    6px      /* Default, balanced */
--wl-radius-lg:    10px     /* Pronounced, friendly */
--wl-radius-xl:    14px     /* Extra rounded */
--wl-radius-full:  9999px   /* Fully rounded (pills) */
```

### Shadows

Layered shadows for depth perception:

```css
--wl-shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.3)
--wl-shadow-md:   0 2px 8px rgba(0, 0, 0, 0.4)
--wl-shadow-lg:   0 8px 24px rgba(0, 0, 0, 0.5)
--wl-shadow-glow: 0 0 20px rgba(245, 166, 35, 0.15)  /* Amber glow */
```

### Transitions

Timing and easing for animations:

```css
--wl-duration-fast:  120ms
--wl-duration-base:  200ms
--wl-duration-slow:  400ms

--wl-ease-default:  cubic-bezier(0.4, 0, 0.2, 1)     /* Standard */
--wl-ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1) /* Bouncy */
```

---

## Component Library

### Button

Primary interactive element for actions and navigation.

**Variants**:
- `primary` — Main actions, calls-to-action
- `secondary` — Alternative actions, less emphasis
- `ghost` — Minimal, often for secondary actions
- `danger` — Destructive actions (delete, remove, cancel important changes)

**Sizes**: `sm` (small), `md` (medium, default), `lg` (large)

**States**:
- Default
- Hover (enhanced shadow, color shift)
- Active (pressed state)
- Disabled (reduced opacity, no interaction)
- Focus (outline ring with --wl-primary-500)

**Usage**:
```tsx
<Button variant="primary" size="md">
  Submit Form
</Button>

<Button variant="secondary">
  Cancel
</Button>

<Button variant="danger">
  Delete Item
</Button>
```

**When to Use**:
- **Primary**: Main form submissions, confirmations, next step actions
- **Secondary**: Cancellations, alternatives, less critical actions
- **Ghost**: Navigation, quick actions, condensed layouts
- **Danger**: Destructive operations, require user confirmation

### Badge

Small visual indicators for status, tags, or metadata.

**Variants**:
- `default` — Neutral, no specific meaning
- `success` — Positive, completed, active
- `warning` — Cautionary, pending, in-progress
- `danger` — Error, failed, critical
- `info` — Informational, new, updated
- `primary` — Brand/featured, premium, special

**Features**:
- Optional dot indicator (`dot` prop)
- All caps, uppercase tracking
- Rounded pill shape
- Inline display

**Usage**:
```tsx
<Badge variant="success">Delivered</Badge>
<Badge variant="warning" dot>In Progress</Badge>
<Badge variant="danger">Failed</Badge>
```

**When to Use**:
- Status indication (shipped, pending, failed)
- Category tags
- Feature flags (new, updated, beta)
- Quick visual feedback on state

### Input

Text input field with comprehensive validation support.

**Features**:
- Label support (use always for accessibility)
- Error message display
- Helper/hint text
- Icon support (leading icon)
- Multiple sizes: `sm`, `md`, `lg`
- All standard HTML input types

**Properties**:
```tsx
<Input
  label="Email Address"
  placeholder="user@example.com"
  error="Invalid email format"
  hint="We'll never share your email"
  type="email"
  size="md"
/>
```

**When to Use**:
- Text entry: names, emails, searches
- Password input with `type="password"`
- Number input with `type="number"`
- Always pair with a descriptive label

### Textarea

Multi-line text input for longer content.

**Features**:
- Auto-resizable (minimum 80px height)
- Label support
- Error validation states
- Vertical resize only

**Usage**:
```tsx
<Textarea
  label="Message"
  placeholder="Enter your message..."
  error="Message is too short"
/>
```

### Select

Dropdown selection component.

**Features**:
- Label support
- Placeholder text
- Error states
- Disabled state
- Options array with value/label pairs

**Usage**:
```tsx
<Select
  label="Country"
  options={[
    { value: "us", label: "United States" },
    { value: "ca", label: "Canada" },
  ]}
  placeholder="Select a country"
  error="Country is required"
/>
```

### Card

Container component for grouping content.

**Composition**:
- `Card` — Main container
- `CardHeader` — Top section for title/metadata
- `CardTitle` — Section heading (uppercase, semibold)
- `CardContent` — Main content area
- `CardDescription` — Secondary text
- `CardFooter` — Bottom section for actions

**Features**:
- Hover effect (`hover` prop)
- Glow effect (`glow` prop)
- Subtle borders and elevation

**Usage**:
```tsx
<Card hover>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Main content here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Modal

Dialog component for focused interactions.

**Sizes**: `sm`, `md`, `lg`, `full`

**Features**:
- Backdrop blur for focus
- Close button (X icon)
- Title support
- Optional footer section
- Keyboard close (Escape key)
- Click outside to close

**Usage**:
```tsx
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Confirm Action"
  size="md"
  footer={<Button>Confirm</Button>}
>
  <p>Are you sure?</p>
</Modal>
```

### Table

Data display component for structured information.

**Features**:
- Header row styling
- Hover states on rows
- Badge integration for status
- Responsive scrolling

**Usage**:
```tsx
<Table>
  <thead>
    <tr>
      <th>Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data</td>
    </tr>
  </tbody>
</Table>
```

### Form Components

Checkbox and Switch for boolean input.

**Checkbox** — For multiple selections or single boolean input
**Switch** — For on/off toggle states

```tsx
<Checkbox
  name="agree"
  checked={checked}
  onChange={handleChange}
/>

<Switch
  checked={enabled}
  onChange={handleChange}
/>
```

---

## Usage Guidelines

### Typography Hierarchy

Create visual hierarchy with font sizing and weights:

```tsx
{/* Page/Section Title */}
<h1 className="text-3xl font-bold">Main Title</h1>

{/* Subsection */}
<h2 className="text-2xl font-semibold">Subsection</h2>

{/* Body text */}
<p className="text-base font-normal">Regular paragraph text</p>

{/* Secondary text, labels */}
<p className="text-sm font-medium text-wl-text-secondary">Label</p>

{/* Subtle, hint text */}
<p className="text-xs text-wl-text-tertiary">Helper text</p>
```

### Color Usage

**Semantic Color Rules**:
1. **Green (success)**: Positive actions, completed states, confirmations
2. **Yellow (warning)**: Pending actions, in-progress states, cautions
3. **Red (danger)**: Errors, failures, destructive actions requiring caution
4. **Blue (info)**: Informational messages, help text, new features
5. **Amber (primary)**: Brand elements, primary actions, highlights

**Never use color alone to convey information.** Always pair with text, icons, or other visual indicators.

### Spacing Patterns

```tsx
{/* Tight spacing for related items */}
<div className="gap-2">Item 1 Item 2</div>

{/* Standard spacing within sections */}
<div className="space-y-4">
  <div>Section 1</div>
  <div>Section 2</div>
</div>

{/* Large spacing between major sections */}
<div className="space-y-12">
  <section>Section A</section>
  <section>Section B</section>
</div>
```

### Button Patterns

```tsx
{/* Primary action */}
<Button variant="primary">Save Changes</Button>

{/* Action pair */}
<div className="flex gap-2">
  <Button variant="secondary">Cancel</Button>
  <Button variant="primary">Submit</Button>
</div>

{/* Destructive action with confirmation */}
<Button variant="danger">Delete</Button>

{/* Icon + text */}
<Button>
  <IconComponent /> Label
</Button>
```

### Form Patterns

Always include:
1. Descriptive labels
2. Placeholder text for guidance
3. Error messages for validation
4. Helper text for context
5. Required field indicators (asterisk)

```tsx
<div className="space-y-6">
  <Input
    label="Full Name *"
    placeholder="John Doe"
    error={errors.name}
    hint="Use your legal name"
  />

  <Select
    label="Country *"
    options={countries}
    placeholder="Select country"
    error={errors.country}
  />

  <div className="flex gap-2">
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Submit</Button>
  </div>
</div>
```

### Responsive Design

Use Tailwind's responsive prefixes:
```tsx
{/* Mobile-first approach */}
<div className="flex flex-col md:flex-row gap-4">
  {/* Single column on mobile, two columns on medium+ screens */}
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 1 column mobile, 2 medium, 4 large */}
</div>
```

---

## Accessibility

### WCAG 2.1 Compliance

All components meet WCAG 2.1 Level AA standards:

**Contrast**: Text has minimum 4.5:1 contrast ratio against backgrounds
**Keyboard Navigation**: All interactive elements accessible via Tab/Enter/Space
**Screen Readers**: Proper semantic HTML and ARIA attributes
**Focus Indicators**: Visible focus rings on all focusable elements
**Color**: Information not conveyed by color alone

### Keyboard Navigation

```
Tab                 → Move focus to next element
Shift + Tab         → Move focus to previous element
Enter / Space       → Activate buttons, checkboxes, switches
Escape              → Close modals, dropdowns, menus
Arrow Keys          → Navigate within dropdowns, select options
```

### ARIA Attributes

Used throughout components:
```tsx
aria-label         // Label for icon-only buttons
aria-hidden        // Hide decorative elements from screen readers
aria-expanded      // Indicate expanded/collapsed state
aria-disabled      // Communicate disabled state
aria-invalid       // Mark form fields with errors
aria-describedby   // Link error messages to inputs
```

### Focus Management

- Focus outlines use `--wl-primary-500` color
- 2px outline with 2px offset for visibility
- Never remove focus outlines; style them instead
- Tab order follows visual/logical structure

---

## Contributing

### Adding New Components

1. **Create component file** in `/src/components/ui/`
2. **Follow naming convention**: PascalCase for component names
3. **Use named exports**: `export { ComponentName }`
4. **Support theming**: Use CSS variables (--wl-*) not hardcoded colors
5. **Include types**: TypeScript interfaces for all props
6. **Forward refs**: Use `forwardRef` for compound components
7. **Accessibility first**: Include ARIA attributes, semantic HTML

### Component Structure

```tsx
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ComponentProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

const Component = forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "base-classes",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Component.displayName = "Component";

export { Component };
```

### Testing

- Unit tests for component logic
- Visual regression tests for styling
- Accessibility tests with axe/jest-axe
- Keyboard navigation tests

### Documentation

1. **Update `/src/app/(dashboard)/design-system/page.tsx`** with component examples
2. **Add token references** with CSS variables and Tailwind classes
3. **Include usage examples** showing common patterns
4. **Document states**: default, hover, active, disabled, focus

### Versioning

Use semantic versioning for design system releases:
- **Major**: Breaking changes to component APIs
- **Minor**: New components or non-breaking additions
- **Patch**: Bug fixes, documentation updates

### Design Tokens Changes

When updating design tokens:
1. Update CSS variables in `/src/styles/tokens.css`
2. Update Tailwind config in `tailwind.config.ts`
3. Update documentation in this file
4. Update component examples to use new tokens
5. Publish release notes with migration guide

---

## Resources

- **Component Catalog**: `/design-system` — Interactive showcase of all components
- **Token Reference**: `/design-system/tokens` — Complete token documentation
- **Form Examples**: `/design-system/forms` — Form patterns and best practices
- **Tailwind Config**: `/tailwind.config.ts` — Theme configuration
- **Global Styles**: `/src/styles/` — CSS variables and animations

---

**Last Updated**: March 2026
**Design System Version**: 1.0.0
**Tailwind CSS**: v3.4
