/**
 * Extends Vitest's Assertion interface with jest-dom matchers.
 * This is a module file (has export) so `declare module 'vitest'` here
 * is treated as module augmentation, not a full module replacement.
 */
export {};

declare module "vitest" {
  interface Assertion<R = unknown> {
    toBeInTheDocument(): R;
    toBeVisible(): R;
    toBeEnabled(): R;
    toBeDisabled(): R;
    toBeChecked(): R;
    toBePartiallyChecked(): R;
    toHaveValue(value?: string | string[] | number): R;
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
    toHaveAttribute(attr: string, value?: string | RegExp): R;
    toHaveClass(...classNames: string[]): R;
    toHaveStyle(css: string | Record<string, unknown>): R;
    toHaveTextContent(
      text: string | RegExp,
      options?: { normalizeWhitespace?: boolean },
    ): R;
    toHaveFormValues(values: Record<string, unknown>): R;
    toHaveFocus(): R;
    toBeEmptyDOMElement(): R;
    toContainElement(element: HTMLElement | null): R;
    toContainHTML(html: string): R;
    toHaveAccessibleDescription(description?: string | RegExp): R;
    toHaveAccessibleName(name?: string | RegExp): R;
    toHaveErrorMessage(message?: string | RegExp): R;
    toBeRequired(): R;
    toBeInvalid(): R;
    toBeValid(): R;
  }
}
