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
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isCompleted = step.status === 'completed';
        const isLast = index === steps.length - 1;

        return (
          <div key={step.step} className="flex gap-3">
            {/* Marker column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  isCompleted
                    ? 'bg-wl-success-500'
                    : 'bg-wl-neutral-800 border border-wl-border-default'
                )}
              >
                {isCompleted ? (
                  <Check size={14} className="text-white" />
                ) : (
                  <Clock size={14} className="text-wl-text-tertiary" />
                )}
              </div>
              {!isLast && (
                <div className={cn(
                  'w-px flex-1 min-h-[2rem]',
                  isCompleted ? 'bg-wl-success-500/40' : 'bg-wl-border-subtle'
                )} />
              )}
            </div>

            {/* Content */}
            <div className="pb-6 pt-1">
              <p className={cn(
                'text-sm font-medium',
                isCompleted ? 'text-wl-text-primary' : 'text-wl-text-tertiary'
              )}>
                {stepLabels[step.step]}
              </p>
              {step.timestamp && (
                <p className="text-xs text-wl-text-tertiary mt-0.5">
                  {format(step.timestamp, 'MMM d, h:mm a')}
                </p>
              )}
              {step.details && (
                <p className="text-xs text-wl-text-secondary mt-1">
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
