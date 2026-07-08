'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { WizardStep } from './wizard';
import type { SyncConfig, CRMPlatform } from './types';

interface StepReviewActivateProps {
  platforms: CRMPlatform[];
  selectedPlatform: string | null;
  syncConfig: SyncConfig;
  isEnabled: boolean;
  syncSchedule: string;
  onSetIsEnabled: (enabled: boolean) => void;
  onSetSyncSchedule: (schedule: string) => void;
  onActivate: () => void;
  onBack: () => void;
}

export function StepReviewActivate({
  platforms,
  selectedPlatform,
  syncConfig,
  isEnabled,
  syncSchedule,
  onSetIsEnabled,
  onSetSyncSchedule,
  onActivate,
  onBack,
}: StepReviewActivateProps) {
  if (!selectedPlatform) return null;

  const platformName = platforms.find((p) => p.id === selectedPlatform)?.name || '';

  return (
    <WizardStep stepId={5} title="Review & Activate">
      <div className={cn('space-y-6 max-w-2xl')}>
        <Card>
          <CardHeader>
            <CardTitle>Connection Summary</CardTitle>
          </CardHeader>
          <CardContent className={cn('space-y-4')}>
            <div className={cn('grid grid-cols-2 gap-4')}>
              <div>
                <p className={cn('text-sm text-wl-text-secondary', 'mb-1')}>
                  Platform
                </p>
                <p className={cn('font-semibold text-white')}>
                  {platformName}
                </p>
              </div>
              <div>
                <p className={cn('text-sm text-wl-text-secondary', 'mb-1')}>
                  Sync Direction
                </p>
                <Badge variant="primary" className="capitalize">
                  {syncConfig.direction}
                </Badge>
              </div>
            </div>

            <div>
              <p className={cn('text-sm text-wl-text-secondary', 'mb-2')}>
                Objects
              </p>
              <div className={cn('flex gap-2 flex-wrap')}>
                {syncConfig.objectTypes.map((obj) => (
                  <Badge key={obj} variant="info" className="capitalize">
                    {obj}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activation Settings</CardTitle>
          </CardHeader>
          <CardContent className={cn('space-y-4')}>
            <label className={cn('flex items-center gap-3 cursor-pointer')}>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => onSetIsEnabled(e.target.checked)}
              />
              <span className={cn('text-white', 'font-medium')}>
                Enable this integration
              </span>
            </label>

            {isEnabled && (
              <div>
                <label className={cn('block text-sm text-wl-text-secondary mb-2')}>
                  Sync Schedule
                </label>
                <select
                  value={syncSchedule}
                  onChange={(e) => onSetSyncSchedule(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-md',
                    'bg-wl-bg-surface border border-wl-border-default',
                    'text-white',
                    'focus:outline-none focus:border-blue-500'
                  )}
                >
                  <option value="hourly">Every hour</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        <div className={cn('flex justify-between gap-3 pt-6')}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button
            disabled={!isEnabled}
            onClick={onActivate}
          >
            Activate Connection
          </Button>
        </div>
      </div>
    </WizardStep>
  );
}
