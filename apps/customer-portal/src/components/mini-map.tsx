'use client';

import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Address } from '@/types';

interface MiniMapProps {
  address: Address;
  className?: string;
}

export function MiniMap({ address, className }: MiniMapProps) {
  // In a real application, this would render an actual map
  // For now, we'll show a placeholder with address information
  return (
    <div
      className={cn(
        'relative w-full h-64 rounded-lg overflow-hidden',
        'bg-gradient-to-br from-wl-neutral-800 to-wl-neutral-900',
        'border border-wl-border-subtle',
        'flex items-center justify-center',
        className
      )}
    >
      {/* Map background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Pin Icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={cn(
          'relative z-10',
          'animate-bounce'
        )}>
          <MapPin
            size={32}
            className="text-wl-primary-400"
            fill="currentColor"
          />
        </div>
      </div>

      {/* Address Info Overlay */}
      <div className={cn(
        'absolute bottom-0 left-0 right-0',
        'bg-gradient-to-t from-black/80 to-transparent',
        'p-4 text-white'
      )}>
        <p className="text-sm font-medium">{address.street}</p>
        <p className="text-xs text-gray-300">
          {address.city}, {address.state} {address.zipCode}
        </p>
      </div>

      {/* Note about actual map */}
      <div className={cn(
        'absolute top-2 right-2 z-20',
        'text-xs text-gray-400 bg-black/50 px-2 py-1 rounded'
      )}>
        Map view
      </div>
    </div>
  );
}
