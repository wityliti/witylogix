# A11y Quick Reference Card

## Import Paths

```typescript
// Utilities
import {
  getFocusableElements,
  useFocusTrap,
  useKeyboardNavigation,
  announce,
  generateId,
  calculateContrastRatio,
  useReducedMotion,
} from '@/lib/a11y';

// Components
import {
  SkipLinks,
  VisuallyHidden,
  FocusRing,
  injectFocusIndicatorStyles,
} from '@/components/a11y';
```

## Common Recipes

### Modal with Focus Trap
```tsx
import { useFocusTrap } from '@/lib/a11y';

export function Modal({ onClose }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">Dialog Title</h2>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

### Menu with Arrow Key Navigation
```tsx
import { useKeyboardNavigation } from '@/lib/a11y';

export function Menu({ items, onSelect }) {
  const { selectedIndex, handlers } = useKeyboardNavigation(items, {
    orientation: 'vertical',
    onSelect,
  });

  return (
    <div role="menu" {...handlers}>
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          className={i === selectedIndex ? 'bg-blue-500' : ''}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
```

### Form Input with Error
```tsx
import { generateId, VisuallyHidden } from '@/lib/a11y';

export function FormInput({ label, error, value, onChange }) {
  const inputId = generateId('input');
  const errorId = generateId('error');

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        value={value}
        onChange={onChange}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span id={errorId} role="alert" className="text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
```

### Announce Action
```tsx
import { announceAction } from '@/lib/a11y';

function handleSave() {
  save();
  announceAction('Changes saved successfully');
}
```

### Check Color Contrast
```tsx
import { analyzeContrast } from '@/lib/a11y';

const result = analyzeContrast('#333', '#fff');
console.log(result.aa); // true (meets WCAG AA)
```

### Skip Links
```tsx
import { SkipLinks } from '@/components/a11y';

export function Layout() {
  return (
    <>
      <SkipLinks mainId="main-content" navId="main-nav" />
      <nav id="main-nav">{/* Navigation */}</nav>
      <main id="main-content">{/* Content */}</main>
    </>
  );
}
```

### Focus Indicators
```tsx
import { injectFocusIndicatorStyles, FocusRing } from '@/components/a11y';

// In app root useEffect:
injectFocusIndicatorStyles();

// In components:
<FocusRing offset="default" width="default">
  <button>Click me</button>
</FocusRing>
```

### Respect Motion Preferences
```tsx
import { useReducedMotion, MotionSafe } from '@/lib/a11y';

export function Animation() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <MotionSafe fallback={<div>Static content</div>}>
      <div className="animate-bounce">Bouncing content</div>
    </MotionSafe>
  );
}
```

### Screen Reader Only Text
```tsx
import { VisuallyHidden } from '@/components/a11y';

<button>
  <VisuallyHidden>Close menu</VisuallyHidden>
  ✕
</button>
```

## ARIA Patterns

### Button with Icon
```tsx
<button aria-label="Close">×</button>
```

### Toggle Button
```tsx
<button
  aria-pressed={isActive}
  onClick={toggle}
>
  {isActive ? 'Enabled' : 'Disabled'}
</button>
```

### Expandable Section
```tsx
import { useAriaExpanded } from '@/lib/a11y';

const { ariaExpanded, setAriaExpanded } = useAriaExpanded(isOpen);

<button
  aria-expanded={ariaExpanded}
  aria-controls="section-content"
  onClick={() => setAriaExpanded(!ariaExpanded)}
>
  Show/Hide
</button>
<div id="section-content">{isOpen && content}</div>
```

### Combobox
```tsx
<div role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
  <input aria-autocomplete="list" />
  {isOpen && (
    <ul role="listbox">
      <li role="option" aria-selected={selected}>Item</li>
    </ul>
  )}
</div>
```

### Table
```tsx
<table>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Email</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>John</td>
      <td>john@example.com</td>
    </tr>
  </tbody>
</table>
```

## Keyboard Shortcuts

```tsx
import { useKeyboardShortcut } from '@/lib/a11y';

// Cmd+/ or Ctrl+/ to focus search
useKeyboardShortcut('/', () => {
  searchInputRef.current?.focus();
}, []);

// Escape to close
useKeyboardShortcut('Escape', () => {
  close();
}, ['escape']);
```

## Testing

```typescript
import {
  testFocusTrap,
  testAriaAttributes,
  testKeyboardNavigation,
  testColorContrast,
} from '@/lib/a11y';

describe('MyComponent', () => {
  it('should trap focus', () => {
    const container = render(<MyComponent />).container;
    testFocusTrap(container);
  });

  it('should have proper ARIA', () => {
    const element = screen.getByRole('dialog');
    testAriaAttributes(element, {
      'aria-modal': 'true',
      'aria-labelledby': 'title',
    });
  });
});
```

## Colors & Contrast

```typescript
import { parseColor, analyzeContrast, suggestAccessibleColor } from '@/lib/a11y';

// Parse any color format
const rgb = parseColor('#fff');
const rgb2 = parseColor('rgb(255, 255, 255)');
const rgb3 = parseColor('hsl(0, 0%, 100%)');

// Check contrast
const analysis = analyzeContrast('#333', '#fff');
// {
//   ratio: 12.63,
//   aa: true,        // meets AA
//   aaa: true,       // meets AAA
//   aaLarge: true,   // meets AA for large text
//   aaaLarge: true   // meets AAA for large text
// }

// Get accessible alternative
const accessible = suggestAccessibleColor('#666', '#fff', 4.5);
```

## Debugging

### Check Focusable Elements
```tsx
import { getFocusableElements } from '@/lib/a11y';

const focusables = getFocusableElements(container);
console.log('Focusable elements:', focusables);
```

### Check ARIA Attributes
```tsx
const expanded = element.getAttribute('aria-expanded');
const label = element.getAttribute('aria-label');
const describedBy = element.getAttribute('aria-describedby');
```

### Test with Keyboard Only
- Tab/Shift+Tab to navigate
- Enter/Space to activate
- Arrow keys for lists/menus
- Escape to close modals

### Test with Screen Reader
- **Mac**: Cmd+F5 (VoiceOver)
- **Windows**: Download NVDA (free) or use JAWS
- Common commands:
  - Screen reader key + arrow down: read next item
  - Screen reader key + down arrow: navigate to next heading
  - Screen reader key + Up arrow: read previous item

## Common Mistakes to Avoid

```tsx
// ✗ Bad: div instead of button
<div onClick={handler} role="button">Click</div>

// ✓ Good: semantic button
<button onClick={handler}>Click</button>

// ✗ Bad: no label
<input placeholder="Email" />

// ✓ Good: proper label
<label htmlFor="email">Email</label>
<input id="email" />

// ✗ Bad: no aria-label on icon button
<button>✕</button>

// ✓ Good: accessible icon button
<button aria-label="Close">✕</button>

// ✗ Bad: hidden focus indicator
button { outline: none; }

// ✓ Good: visible focus indicator
button:focus-visible { outline: 2px solid blue; }

// ✗ Bad: color only to show state
<span style={{ color: 'red' }}>Error</span>

// ✓ Good: explicit role and styling
<span role="alert" className="text-red-500">Error</span>
```

## Resources

- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **WAI-ARIA**: https://www.w3.org/WAI/ARIA/apg/
- **MDN**: https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **WebAIM**: https://webaim.org/
- **axe DevTools**: https://www.deque.com/axe/devtools/

## File Locations

- **Utilities**: `/apps/dashboard/src/lib/a11y/`
- **Components**: `/apps/dashboard/src/components/a11y/`
- **Tests**: `/apps/dashboard/src/__tests__/a11y-component.test.ts`
- **Guides**: `/docs/a11y/`
