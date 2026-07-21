'use client';

import { useState } from 'react';
import { Switch, Checkbox, Input, Select, Button } from '@/components/ui';
import { PreviewSection } from './preview-section';

export function FormsSection() {
  const [switchEnabled, setSwitchEnabled] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
          Form Components
        </h2>
        <p className="text-wl-neutral-300 mb-8">
          Collections of form-related components: switches, checkboxes, and their
          combinations.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
          <PreviewSection
            title="Switch Toggle"
            description="Boolean toggle switch"
            preview={
              <div className="flex items-center gap-3">
                <Switch
                  checked={switchEnabled}
                  onChange={(checked) => setSwitchEnabled(checked)}
                />
                <span className="text-sm text-wl-neutral-300">
                  {switchEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            }
            code={`<Switch checked={enabled} onChange={handleChange} />`}
          />

          <PreviewSection
            title="Checkbox"
            description="Checkbox input element"
            preview={
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={checkboxChecked}
                  onChange={(e) => setCheckboxChecked(e.target.checked)}
                />
                <span className="text-sm text-wl-neutral-300">
                  I agree to the terms
                </span>
              </div>
            }
            code={`<Checkbox checked={checked} onChange={handleChange} />`}
          />

          <PreviewSection
            title="Form Layout"
            description="Typical form with multiple inputs"
            preview={
              <div className="w-full max-w-sm space-y-4">
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="john@example.com"
                />
                <Select
                  label="Country"
                  placeholder="Select country"
                  options={[
                    { value: "us", label: "United States" },
                    { value: "ca", label: "Canada" },
                  ]}
                />
                <Button variant="primary" className="w-full">
                  Submit
                </Button>
              </div>
            }
            code={`<form>
  <Input label="Full Name" placeholder="John Doe" />
  <Input label="Email" type="email" />
  <Select label="Country" options={...} />
  <Button>Submit</Button>
</form>`}
          />
        </div>
      </div>
    </div>
  );
}
