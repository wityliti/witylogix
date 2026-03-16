# Accessibility (a11y) Development Guide

Comprehensive guide for building WCAG 2.1 AA compliant components in the Witylogix dashboard.

## WCAG 2.1 AA Requirements Summary

### Perceivable
- **1.4.3 Contrast**: Text and UI components must have 4.5:1 contrast (or 3:1 for large text)
- **1.4.11 Non-text Contrast**: Graphical elements need 3:1 contrast
- **2.4.7 Focus Visible**: Keyboard focus indicator must be visible

### Operable
- **2.1.1 Keyboard**: All functionality available via keyboard
- **2.1.2 No Keyboard Trap**: Focus must not be permanently trapped
- **2.4.3 Focus Order**: Focus order is logical and meaningful
- **2.4.4 Link Purpose**: Purpose of link is clear from text/context

### Understandable
- **3.2.4 Consistent Identification**: Components behave consistently
- **4.1.2 Name, Role, Value**: All UI components have accessible name, role, state

### Robust
- **4.1.2 Parsing**: HTML is valid and properly formed
- **4.1.3 Status Messages**: Status messages are announced to screen readers

## Component Checklist

### For All Components

- [ ] **Semantic HTML**: Use correct elements (button, a, input, etc.)
- [ ] **ARIA Labels**: Provide accessible name via label, aria-label, or aria-labelledby
- [ ] **Keyboard Support**: All interactive elements work with Tab, Enter, Space, Arrows
- [ ] **Focus Management**: Focus moves logically through components
- [ ] **Focus Indicator**: Visible outline on focus (use focus-visible)
- [ ] **Color Contrast**: Text and UI elements meet 4.5:1 or 3:1 contrast
- [ ] **Disabled State**: Proper aria-disabled or disabled attribute
- [ ] **Error Messages**: Associated with form field via aria-describedby
- [ ] **Live Regions**: Dynamic updates announced via aria-live

### Specific Component Patterns

#### Buttons
```tsx
// ✓ Good
<button onClick={handler} aria-label="Close menu">×</button>
<button aria-pressed={isActive}>{label}</button>

// ✗ Bad
<div onClick={handler} role="button">×</div>
<button aria-label="">Save</button>
```

#### Form Inputs
```tsx
// ✓ Good
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-describedby="email-error" />
<span id="email-error" role="alert">{error}</span>

// ✗ Bad
<input placeholder="Email" />
<span>{error}</span>
```

#### Dropdowns/Select
```tsx
// ✓ Good
<select aria-label="Choose option">
  <option>Option 1</option>
</select>

// Custom dropdown with roving tabindex pattern
<div role="listbox">
  <div role="option" tabIndex="0" aria-selected={selected}>Item</div>
</div>

// ✗ Bad
<div onClick={toggle}>Select</div>
```

#### Modals/Dialogs
```tsx
// ✓ Good
<div role="dialog" aria-modal="true" aria-labelledby="title">
  <h2 id="title">Modal Title</h2>
  {/* Content */}
</div>

// ✗ Bad
<div className="modal">{/* Content */}</div>
```

#### Lists
```tsx
// ✓ Good
<ul role="list">
  <li role="listitem">Item 1</li>
</ul>

// Navigation list
<nav>
  <ul role="list">
    <li><a href="/page">Link</a></li>
  </ul>
</nav>
```

#### Tables
```tsx
// ✓ Good
<table>
  <thead>
    <tr>
      <th scope="col">Column 1</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data</td>
    </tr>
  </tbody>
</table>

// ✗ Bad
<table>
  <tr><td>Column 1</td></tr>
</table>
```

## Testing Procedures

### Manual Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify focus order is logical
   - Test arrow keys in menus/lists
   - Test Escape to close modals

2. **Screen Reader Testing**
   - VoiceOver (Mac): Cmd+F5 to enable
   - NVDA (Windows): Download from nvaccess.org
   - JAWS (Windows): Commercial screen reader
   - Test with common tasks (navigation, form filling, etc.)

3. **Color Contrast**
   - Use WebAIM Contrast Checker or axe DevTools
   - Test both normal and dark themes
   - Verify large text (18pt+) or bold (14pt+) meets 3:1
   - Verify normal text meets 4.5:1

4. **Focus Indicators**
   - Verify visible outline on all focusable elements
   - Check outline is not obscured by other elements
   - Verify outline color meets contrast requirements

### Automated Testing

```bash
# Install axe DevTools
npm install --save-dev @axe-core/react

# Run axe checks
import { axe } from 'jest-axe';
const results = await axe(container);
expect(results).toHaveNoViolations();
```

## Common Patterns

### Skip Links
```tsx
<nav aria-label="Skip links">
  <a href="#main">Skip to main content</a>
</nav>
```

### Visually Hidden Text
```tsx
<span className="sr-only">Screen readers only</span>
```

### Focus Trap (Modal)
```tsx
import { useFocusTrap } from '@/lib/a11y/focus-manager';

export function Modal() {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return <div ref={ref} role="dialog">{/* ... */}</div>;
}
```

### Live Region Announcements
```tsx
import { announce } from '@/lib/a11y/announcer';

function handleDelete() {
  deleteItem();
  announce('Item deleted successfully', 'polite');
}
```

### Keyboard Shortcuts
```tsx
import { useKeyboardShortcut } from '@/lib/a11y/keyboard-navigation';

export function Component() {
  useKeyboardShortcut('/', () => {
    focusSearch();
  });
}
```

## Anti-Patterns to Avoid

- Using `<div>` and `<span>` for interactive elements
- Missing `<label>` elements for form inputs
- Images without alt text or empty alt for decorative images
- Using color alone to convey information
- Invisible focus indicators (outline: none)
- Poor focus order (jumping around the page)
- Automatic page refreshes or moving focus unexpectedly
- Keyboard shortcuts that override browser/screen reader shortcuts
- Using placeholder instead of label
- Insufficient color contrast (especially in dark mode)
- Not announcing dynamic content updates
- Using aria-label for content that should be visible text

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Articles](https://webaim.org/articles/)
- [Axe DevTools](https://www.deque.com/axe/devtools/)

## Questions?

Refer to the accessibility utilities in `/src/lib/a11y/` and components in `/src/components/a11y/`.
