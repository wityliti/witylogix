'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { WizardStep } from './wizard';
import type { SyncConfig } from './types';

const SYNC_OPTIONS = [
  {
    value: 'in',
    label: 'Pull from CRM',
    desc: 'Sync data from your CRM to Witylogix',
  },
  {
    value: 'out',
    label: 'Push to CRM',
    desc: 'Sync data from Witylogix to your CRM',
  },
  {
    value: 'bidirectional',
    label: 'Bidirectional',
    desc: 'Keep data synchronized both ways',
  },
];

const OBJECT_TYPES = ['contacts', 'deals', 'companies'];

interface StepConfigureSyncProps {
  syncConfig: SyncConfig;
  onUpdateSyncConfig: (config: Partial<SyncConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepConfigureSync({
  syncConfig,
  onUpdateSyncConfig,
  onNext,
  onBack,
}: StepConfigureSyncProps) {
  return (
    <WizardStep stepId={3} title="Configure Sync Settings">
      <div className={cn('space-y-6 max-w-2xl')}>
        <Card>
          <CardHeader>
            <CardTitle>Sync Direction</CardTitle>
          </CardHeader>
          <CardContent className={cn('space-y-4')}>
            <div className={cn('space-y-3')}>
              {SYNC_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-md',
                    'border cursor-pointer transition-all duration-base',
                    syncConfig.direction === option.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-wl-border-default hover:border-wl-border-default'
                  )}
                >
                  <input
                    type="radio"
                    name="direction"
                    value={option.value}
                    checked={syncConfig.direction === option.value}
                    onChange={(e) =>
                      onUpdateSyncConfig({
                        direction: e.target.value as 'in' | 'out' | 'bidirectional',
                      })
                    }
                    className={cn('mt-1')}
                  />
                  <div>
                    <p className={cn('font-semibold text-white', 'm-0')}>
                      {option.label}
                    </p>
                    <p className={cn('text-sm text-gray-400', 'mt-0.5')}>
                      {option.desc}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Objects to Sync</CardTitle>
          </CardHeader>
          <CardContent className={cn('space-y-3')}>
            {OBJECT_TYPES.map((obj) => (
              <label
                key={obj}
                className={cn('flex items-center gap-3 cursor-pointer')}
              >
                <input
                  type="checkbox"
                  checked={syncConfig.objectTypes.includes(obj)}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...syncConfig.objectTypes, obj]
                      : syncConfig.objectTypes.filter((t) => t !== obj);
                    onUpdateSyncConfig({ objectTypes: newTypes });
                  }}
                  className={cn('rounded')}
                />
                <span className={cn('capitalize text-white', 'font-medium')}>
                  {obj}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className={cn('flex justify-between gap-3 pt-6')}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>
            Next
          </Button>
        </div>
      </div>
    </WizardStep>
  );
}
