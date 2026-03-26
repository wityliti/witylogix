'use client';

import { Badge } from '@/components/ui';
import { PreviewSection } from './preview-section';

export function BadgesSection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Badges
        </h2>
        <p className="text-gray-300 mb-8">
          Badge component with 6 variants: default, success, warning, danger, info,
          and primary. Optional dot indicator.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PreviewSection
            title="Default Badge"
            description="Standard badge styling"
            preview={<Badge>Default</Badge>}
            code={`<Badge>Default</Badge>`}
          />

          <PreviewSection
            title="Success Badge"
            description="Used for positive states"
            preview={<Badge variant="success">Active</Badge>}
            code={`<Badge variant="success">Active</Badge>`}
          />

          <PreviewSection
            title="Warning Badge"
            description="Used for cautionary states"
            preview={<Badge variant="warning">Pending</Badge>}
            code={`<Badge variant="warning">Pending</Badge>`}
          />

          <PreviewSection
            title="Danger Badge"
            description="Used for error/critical states"
            preview={<Badge variant="danger">Failed</Badge>}
            code={`<Badge variant="danger">Failed</Badge>`}
          />

          <PreviewSection
            title="Info Badge"
            description="Used for informational content"
            preview={<Badge variant="info">Update</Badge>}
            code={`<Badge variant="info">Update</Badge>`}
          />

          <PreviewSection
            title="Primary Badge"
            description="Brand-colored badge"
            preview={<Badge variant="primary">Premium</Badge>}
            code={`<Badge variant="primary">Premium</Badge>`}
          />

          <PreviewSection
            title="Badge with Dot"
            description="Optional indicator dot"
            preview={
              <div className="flex gap-3">
                <Badge dot variant="success">
                  Online
                </Badge>
                <Badge dot variant="danger">
                  Offline
                </Badge>
              </div>
            }
            code={`<Badge dot variant="success">Online</Badge>
<Badge dot variant="danger">Offline</Badge>`}
          />

          <PreviewSection
            title="Badge Combinations"
            description="Multiple badges together"
            preview={
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Delivered</Badge>
                <Badge variant="primary">Expedited</Badge>
                <Badge variant="info">Tracked</Badge>
              </div>
            }
            code={`<Badge variant="success">Delivered</Badge>
<Badge variant="primary">Expedited</Badge>
<Badge variant="info">Tracked</Badge>`}
          />
        </div>
      </div>
    </div>
  );
}
