'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WizardStep } from './wizard';

interface TestResults {
  success: boolean;
  message: string;
}

interface StepTestConnectionProps {
  testResults: TestResults | null;
  onTestConnection: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepTestConnection({
  testResults,
  onTestConnection,
  onNext,
  onBack,
}: StepTestConnectionProps) {
  return (
    <WizardStep stepId={4} title="Test Connection">
      <div className={cn('space-y-6 max-w-2xl')}>
        <p className={cn('text-wl-text-secondary')}>
          Verify your connection and pull sample data from your CRM.
        </p>

        {testResults && (
          <Card
            className={cn(
              testResults.success && 'border-emerald-500 bg-emerald-500/5'
            )}
          >
            <CardContent className={cn('pt-5')}>
              <div className={cn('flex items-start gap-3')}>
                {testResults.success ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-wl-success-400 mt-0.5 flex-shrink-0"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-wl-danger-400 mt-0.5 flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                )}
                <p
                  className={cn(
                    'm-0',
                    testResults.success
                      ? 'text-wl-success-400'
                      : 'text-wl-danger-400'
                  )}
                >
                  {testResults.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className={cn('flex justify-between gap-3 pt-6')}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className={cn('flex gap-3')}>
            <Button variant="secondary" onClick={onTestConnection}>
              Test Connection
            </Button>
            <Button disabled={!testResults?.success} onClick={onNext}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </WizardStep>
  );
}
