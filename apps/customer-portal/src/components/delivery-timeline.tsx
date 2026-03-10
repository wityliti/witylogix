'use client';

import { Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DeliveryTimestep } from '@/types';

interface DeliveryTimelineProps {
  steps: DeliveryTimestep[];
}

const stepLabels: Record<DeliveryTimestep['step'], string> = {
  ordered: 'Order Placed',
  confirmed: 'Confirmed',
  'out-for-delivery': 'Out for Delivery',
  delivered: 'Delivered',
};

export function DeliveryTimeline({ steps }: DeliveryTimelineProps) {
  return (
    <div className="space-y-6">
      {steps.map((step, index) => {
        const isCompleted = step.status === 'completed';
        const isLast = index === steps.length - 1;

        return (
          <div key={step.step} className="flex gap-4">
            {/* Timeline Marker */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-10 h-10 rounded-full',
                  'flex items-center justify-center',
                  'transition-colors duration-fast',
                  isCompleted
                    ? 'bg-wl-success-500 text-wl-text-inverse'
                    : 'bg-wl-neutral-700 text-wl-text-tertiary'
                )}
              >
                {isCompleted ? (
                  <Check size={20} />
                ) : (
                  <Clock size={20} />
                )}
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-1 flex-1 min-h-16',
                    isCompleted
                      ? 'bg-wl-success-500'
                      : 'bg-wl-neutral-700'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-2">
              <h3 className={cn(
                'text-sm font-medium',
                isCompleted
                  ? 'text-wl-text-primary'
                  : 'text-wl-text-secondary'
              )}>
                {stepLabels[step.step]}
              </h3>

              {step.timestamp && (
                <p className="text-xs text-wl-text-tertiary mt-1">
                  {format(step.timestamp, 'PPP p')}
                </p>
              )}

              {step.details && (
                <p className="text-sm text-wl-text-secondary mt-2">
                  {step.details}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
