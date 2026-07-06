"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

export function AccessibilitySection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Accessibility Features
        </h2>
        <p className="text-wl-neutral-300 mb-8">
          All components follow WCAG 2.1 accessibility guidelines with proper
          ARIA attributes, semantic HTML, and keyboard navigation support.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Keyboard Navigation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-wl-neutral-300 space-y-2">
              <p>Tab: Move focus to the next interactive element</p>
              <p>Shift+Tab: Move focus to the previous interactive element</p>
              <p>Enter/Space: Activate buttons, checkboxes, and toggles</p>
              <p>Escape: Close modals and dropdowns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ARIA Attributes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-wl-neutral-300 space-y-2">
              <p>
                aria-label: Provides accessible names for unlabeled elements
              </p>
              <p>aria-hidden: Hides decorative elements from screen readers</p>
              <p>aria-expanded: Indicates expanded/collapsed state</p>
              <p>aria-disabled: Communicates disabled state</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Focus Management</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-wl-neutral-300 space-y-2">
              <p>All interactive elements have visible focus indicators</p>
              <p>Focus outlines use --blue-500 color</p>
              <p>Tab order follows logical visual structure</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color Contrast</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-wl-neutral-300 space-y-2">
              <p>All text meets WCAG AA contrast ratio requirements (4.5:1)</p>
              <p>Colors are not used as sole means of conveying information</p>
              <p>Icons are accompanied by text labels where necessary</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
