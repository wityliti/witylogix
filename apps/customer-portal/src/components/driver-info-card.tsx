'use client';

import { Phone, Star, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Driver } from '@/types';

interface DriverInfoCardProps {
  driver: Driver | null;
  isConnected: boolean;
}

/**
 * Driver information card with contact options
 */
export function DriverInfoCard({ driver, isConnected }: DriverInfoCardProps) {
  if (!driver) {
    return (
      <div className={cn(
        'rounded-lg border border-wl-border-subtle',
        'bg-wl-bg-surface p-6 text-center'
      )}>
        <p className="text-sm text-wl-text-secondary">Loading driver information...</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border border-wl-border-subtle',
      'bg-wl-bg-surface overflow-hidden'
    )}>
      {/* Header with Driver Photo */}
      <div className="relative h-32 bg-gradient-to-r from-wl-primary-600 to-wl-primary-500">
        {driver.photo && (
          <img
            src={driver.photo}
            alt={driver.name}
            className="w-full h-full object-cover"
          />
        )}
        {!driver.photo && (
          <div className="w-full h-full bg-gradient-to-br from-wl-primary-600 to-wl-primary-700 flex items-center justify-center">
            <span className="text-4xl">👤</span>
          </div>
        )}

        {/* Connection Status Badge */}
        <div className="absolute top-3 right-3">
          <div className={cn(
            'w-3 h-3 rounded-full',
            isConnected ? 'bg-wl-success-500' : 'bg-wl-danger-500',
            'animate-pulse'
          )} />
        </div>
      </div>

      {/* Driver Info */}
      <div className="p-6 space-y-4">
        {/* Name and Rating */}
        <div>
          <h2 className="text-xl font-bold text-wl-text-primary">
            {driver.name}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'w-4 h-4',
                    i < Math.floor(driver.rating) ? 'fill-wl-warning-500 text-wl-warning-500' : 'text-wl-neutral-700'
                  )}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-wl-text-secondary">
              {driver.rating.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className={cn(
          'rounded-md p-3',
          'bg-wl-bg-elevated border border-wl-border-subtle'
        )}>
          <p className="text-xs text-wl-text-secondary font-medium uppercase tracking-wide">
            Vehicle
          </p>
          <p className="text-sm text-wl-text-primary font-semibold mt-1">
            {driver.vehicle.color} {driver.vehicle.type}
          </p>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Plate: {driver.vehicle.plate}
          </p>
        </div>

        {/* Contact Options */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => window.location.href = `tel:${driver.phone}`}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-md',
              'bg-wl-primary-500 text-white font-medium text-sm',
              'hover:bg-wl-primary-600 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={!isConnected}
          >
            <Phone className="w-4 h-4" />
            Call
          </button>

          <button
            onClick={() => window.location.href = `sms:${driver.phone}`}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-md',
              'bg-wl-bg-elevated border border-wl-border-subtle',
              'text-wl-text-primary font-medium text-sm',
              'hover:bg-wl-bg-sunken transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={!isConnected}
          >
            <MessageCircle className="w-4 h-4" />
            Text
          </button>
        </div>

        {/* Connection Status Message */}
        {!isConnected && (
          <div className={cn(
            'rounded-md p-3 text-sm',
            'bg-wl-warning-bg border border-wl-warning-500 text-wl-warning-500'
          )}>
            Driver temporarily unavailable
          </div>
        )}
      </div>
    </div>
  );
}
