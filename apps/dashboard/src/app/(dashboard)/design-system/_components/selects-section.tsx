'use client';

import { Select } from '@/components/ui';
import { PreviewSection } from './preview-section';

export function SelectsSection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Select Dropdown
        </h2>
        <p className="text-wl-neutral-300 mb-8">
          Dropdown select component with label, error states, and size variants.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
          <PreviewSection
            title="Basic Select"
            description="Standard select dropdown"
            preview={
              <Select
                placeholder="Choose an option"
                options={[
                  { value: "opt1", label: "Option 1" },
                  { value: "opt2", label: "Option 2" },
                  { value: "opt3", label: "Option 3" },
                ]}
                className="w-full"
              />
            }
            code={`<Select
  placeholder="Choose an option"
  options={[
    { value: "opt1", label: "Option 1" },
    { value: "opt2", label: "Option 2" },
  ]}
/>`}
          />

          <PreviewSection
            title="Select with Label"
            description="Select with associated label"
            preview={
              <Select
                label="Status"
                placeholder="Select status"
                options={[
                  { value: "active", label: "Active" },
                  { value: "pending", label: "Pending" },
                  { value: "inactive", label: "Inactive" },
                ]}
                className="w-full"
              />
            }
            code={`<Select label="Status" placeholder="Select status" options={...} />`}
          />

          <PreviewSection
            title="Select with Error"
            description="Error state indication"
            preview={
              <Select
                label="Region"
                error="Please select a region"
                placeholder="Select region"
                options={[
                  { value: "north", label: "North" },
                  { value: "south", label: "South" },
                ]}
                className="w-full"
              />
            }
            code={`<Select label="Region" error="Please select a region" options={...} />`}
          />

          <PreviewSection
            title="Disabled Select"
            description="Select in disabled state"
            preview={
              <Select
                label="Type"
                disabled
                placeholder="Select type"
                options={[
                  { value: "a", label: "Type A" },
                  { value: "b", label: "Type B" },
                ]}
                className="w-full"
              />
            }
            code={`<Select label="Type" disabled options={...} />`}
          />
        </div>
      </div>
    </div>
  );
}
