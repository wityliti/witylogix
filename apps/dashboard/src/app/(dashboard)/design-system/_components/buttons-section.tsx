'use client';

import { Button } from '@/components/ui';
import { PreviewSection } from './preview-section';

export function ButtonsSection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Buttons
        </h2>
        <p className="text-gray-300 mb-8">
          Button component with 4 variants: primary, secondary, ghost, and danger.
          Supports small, medium, and large sizes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PreviewSection
            title="Primary Button"
            description="Main action button with gradient background"
            preview={<Button variant="primary">Primary Action</Button>}
            code={`<Button variant="primary">Primary Action</Button>`}
          />

          <PreviewSection
            title="Secondary Button"
            description="Secondary action button with border"
            preview={<Button variant="secondary">Secondary Action</Button>}
            code={`<Button variant="secondary">Secondary Action</Button>`}
          />

          <PreviewSection
            title="Ghost Button"
            description="Subtle button with transparent background"
            preview={<Button variant="ghost">Ghost Action</Button>}
            code={`<Button variant="ghost">Ghost Action</Button>`}
          />

          <PreviewSection
            title="Danger Button"
            description="Destructive action button"
            preview={<Button variant="danger">Delete</Button>}
            code={`<Button variant="danger">Delete</Button>`}
          />

          <PreviewSection
            title="Button Sizes"
            description="Small, medium (default), and large sizes"
            preview={
              <div className="flex items-center gap-3">
                <Button size="sm" variant="primary">
                  Small
                </Button>
                <Button size="md" variant="primary">
                  Medium
                </Button>
                <Button size="lg" variant="primary">
                  Large
                </Button>
              </div>
            }
            code={`<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`}
          />

          <PreviewSection
            title="Disabled Button"
            description="Buttons in disabled state"
            preview={
              <div className="flex items-center gap-3">
                <Button disabled variant="primary">
                  Disabled Primary
                </Button>
                <Button disabled variant="secondary">
                  Disabled Secondary
                </Button>
              </div>
            }
            code={`<Button disabled variant="primary">Disabled</Button>`}
          />
        </div>
      </div>
    </div>
  );
}
