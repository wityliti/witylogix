'use client';

import { Input } from '@/components/ui';
import { PreviewSection } from './preview-section';

export function InputsSection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Input Fields
        </h2>
        <p className="text-wl-text-secondary mb-8">
          Text input component with support for labels, errors, hints, and icons.
          Available in small, medium, and large sizes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
          <PreviewSection
            title="Basic Input"
            description="Default input with placeholder"
            preview={
              <Input placeholder="Enter text here..." className="w-full" />
            }
            code={`<Input placeholder="Enter text here..." />`}
          />

          <PreviewSection
            title="Input with Label"
            description="Input with associated label"
            preview={
              <Input
                label="Email Address"
                placeholder="user@example.com"
                className="w-full"
              />
            }
            code={`<Input label="Email Address" placeholder="user@example.com" />`}
          />

          <PreviewSection
            title="Input with Error"
            description="Shows validation error state"
            preview={
              <Input
                label="Username"
                error="Username already taken"
                placeholder="username"
                className="w-full"
              />
            }
            code={`<Input label="Username" error="Username already taken" />`}
          />

          <PreviewSection
            title="Input with Hint"
            description="Helper text below input"
            preview={
              <Input
                label="Password"
                hint="Minimum 8 characters"
                type="password"
                className="w-full"
              />
            }
            code={`<Input label="Password" hint="Minimum 8 characters" type="password" />`}
          />

          <PreviewSection
            title="Disabled Input"
            description="Input in disabled state"
            preview={
              <Input
                label="Fixed Value"
                value="Cannot edit"
                disabled
                className="w-full"
              />
            }
            code={`<Input label="Fixed Value" value="Cannot edit" disabled />`}
          />

          <PreviewSection
            title="Input Sizes"
            description="Small, medium (default), and large"
            preview={
              <div className="w-full space-y-3">
                <Input size="sm" placeholder="Small" />
                <Input size="md" placeholder="Medium" />
                <Input size="lg" placeholder="Large" />
              </div>
            }
            code={`<Input size="sm" placeholder="Small" />
<Input size="md" placeholder="Medium" />
<Input size="lg" placeholder="Large" />`}
          />
        </div>
      </div>
    </div>
  );
}
