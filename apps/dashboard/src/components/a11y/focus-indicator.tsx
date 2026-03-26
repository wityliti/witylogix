/**
 * Focus Indicator Styles
 * Global focus-visible styles and focus ring component
 */

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Global focus indicator styles (add to root CSS)
 * Provides visible focus indicators for keyboard navigation
 */
export const focusIndicatorStyles = `
  /* Visible focus for keyboard navigation */
  *:focus-visible {
    outline: 2px solid var(--color-primary, #3b82f6);
    outline-offset: 2px;
  }

  /* Remove outline for mouse users using :focus-visible selector */
  button:focus:not(:focus-visible),
  a:focus:not(:focus-visible),
  input:focus:not(:focus-visible),
  select:focus:not(:focus-visible),
  textarea:focus:not(:focus-visible),
  [tabindex]:focus:not(:focus-visible) {
    outline: none;
    box-shadow: none;
  }

  /* High contrast mode support */
  @media (prefers-contrast: more) {
    *:focus-visible {
      outline: 3px solid;
      outline-offset: 3px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *:focus-visible {
      animation: none;
      transition: none;
    }
  }
`;

interface FocusRingProps {
  children: ReactNode;
  className?: string;
  offset?: 'none' | 'small' | 'default' | 'large';
  width?: 'thin' | 'default' | 'thick';
}

/**
 * Custom focus ring component with Tailwind styling
 */
export function FocusRing({
  children,
  className,
  offset = 'default',
  width = 'default',
}: FocusRingProps): React.ReactElement {
  const offsetClasses = {
    none: '',
    small: 'focus-visible:outline-offset-1',
    default: 'focus-visible:outline-offset-2',
    large: 'focus-visible:outline-offset-4',
  };

  const widthClasses = {
    thin: 'focus-visible:outline-1',
    default: 'focus-visible:outline-2',
    thick: 'focus-visible:outline-4',
  };

  return (
    <div
      className={cn(
        'focus-visible:outline-wl-primary-600',
        offsetClasses[offset],
        widthClasses[width],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Hook to apply focus ring styles to an element
 */
export function useFocusRing(
  ref: React.RefObject<HTMLElement>,
  options: {
    offset?: 'none' | 'small' | 'default' | 'large';
    width?: 'thin' | 'default' | 'thick';
  } = {}
): void {
  const { offset = 'default', width = 'default' } = options;

  React.useEffect(() => {
    if (!ref.current) return;

    const offsetClasses = {
      none: '',
      small: 'focus-visible:outline-offset-1',
      default: 'focus-visible:outline-offset-2',
      large: 'focus-visible:outline-offset-4',
    };

    const widthClasses = {
      thin: 'focus-visible:outline-1',
      default: 'focus-visible:outline-2',
      thick: 'focus-visible:outline-4',
    };

    ref.current.classList.add(
      'focus-visible:outline-wl-primary-600',
      offsetClasses[offset],
      widthClasses[width]
    );

    return () => {
      ref.current?.classList.remove(
        'focus-visible:outline-wl-primary-600',
        offsetClasses[offset],
        widthClasses[width]
      );
    };
  }, [ref, offset, width]);
}

/**
 * Inject global focus indicator styles into document
 */
export function injectFocusIndicatorStyles(): void {
  if (typeof document === 'undefined') return;

  // Check if styles already injected
  if (document.getElementById('a11y-focus-indicator-styles')) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'a11y-focus-indicator-styles';
  styleElement.textContent = focusIndicatorStyles;
  document.head.appendChild(styleElement);
}

export default FocusRing;
