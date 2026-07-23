'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CrmPlatformCard } from '@/components/crm/crm-platform-card';
import { WizardStep } from './wizard';
import type { CRMPlatform } from './types';

interface StepSelectPlatformProps {
  platforms: CRMPlatform[];
  selectedPlatform: string | null;
  onSelectPlatform: (platformId: string) => void;
  onNext: () => void;
  onCancel: () => void;
}

export function StepSelectPlatform({
  platforms,
  selectedPlatform,
  onSelectPlatform,
  onNext,
  onCancel,
}: StepSelectPlatformProps) {
  return (
    <WizardStep stepId={1} title="Select CRM Platform">
      <div className={cn('space-y-6')}>
        <p className={cn('text-wl-text-secondary', 'leading-relaxed')}>
          Choose which CRM platform you want to connect to Witylogix.
        </p>

        <div
          className={cn(
            'grid grid-cols-1 md:grid-cols-2 gap-4',
            'auto-rows-max'
          )}
        >
          {platforms.map((platform) => (
            <CrmPlatformCard
              key={platform.id}
              platform={platform}
              onSelect={onSelectPlatform}
              isSelected={selectedPlatform === platform.id}
            />
          ))}
        </div>

        <div className={cn('flex justify-end gap-3 pt-6')}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!selectedPlatform}
            onClick={onNext}
          >
            Next
          </Button>
        </div>
      </div>
    </WizardStep>
  );
}
