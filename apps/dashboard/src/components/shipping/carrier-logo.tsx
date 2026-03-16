'use client';

import { forwardRef, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type CarrierCode =
  | 'USPS'
  | 'UPS'
  | 'FedEx'
  | 'DHL'
  | 'EasyPost'
  | 'Shippo'
  | 'DoorDash'
  | 'Uber'
  | 'ShipStation';

type CarrierSize = 'sm' | 'md' | 'lg' | 'xl';

interface CarrierLogoProps extends ImgHTMLAttributes<HTMLDivElement> {
  /** Carrier code or acronym */
  carrier: CarrierCode;
  /** Logo size */
  size?: CarrierSize;
  /** Show initials fallback if logo unavailable */
  showFallback?: boolean;
}

const carrierConfig: Record<
  CarrierCode,
  {
    name: string;
    initials: string;
    bgColor: string;
    textColor: string;
    logo?: string;
  }
> = {
  USPS: {
    name: 'USPS',
    initials: 'USPS',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    logo: '📬',
  },
  UPS: {
    name: 'United Parcel Service',
    initials: 'UPS',
    bgColor: 'bg-amber-700',
    textColor: 'text-white',
    logo: '📦',
  },
  FedEx: {
    name: 'FedEx',
    initials: 'FDX',
    bgColor: 'bg-purple-600',
    textColor: 'text-white',
    logo: '✈️',
  },
  DHL: {
    name: 'DHL',
    initials: 'DHL',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
    logo: '🌍',
  },
  EasyPost: {
    name: 'EasyPost',
    initials: 'EP',
    bgColor: 'bg-indigo-500',
    textColor: 'text-white',
    logo: '📮',
  },
  Shippo: {
    name: 'Shippo',
    initials: 'SP',
    bgColor: 'bg-teal-500',
    textColor: 'text-white',
    logo: '🚚',
  },
  DoorDash: {
    name: 'DoorDash',
    initials: 'DD',
    bgColor: 'bg-red-500',
    textColor: 'text-white',
    logo: '🍕',
  },
  Uber: {
    name: 'Uber',
    initials: 'UB',
    bgColor: 'bg-black',
    textColor: 'text-white',
    logo: '🚗',
  },
  ShipStation: {
    name: 'ShipStation',
    initials: 'SS',
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
    logo: '📋',
  },
};

const sizeClasses: Record<CarrierSize, string> = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

/**
 * Carrier logo component that displays carrier branding with initials fallback
 *
 * @example
 * ```tsx
 * <CarrierLogo carrier="UPS" size="md" />
 * <CarrierLogo carrier="FedEx" size="lg" showFallback />
 * ```
 */
const CarrierLogo = forwardRef<HTMLDivElement, CarrierLogoProps>(
  (
    {
      carrier,
      size = 'md',
      showFallback = true,
      className,
      ...props
    },
    ref
  ) => {
    const config = carrierConfig[carrier];

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center',
          'rounded-lg font-semibold',
          sizeClasses[size],
          config.bgColor,
          config.textColor,
          'transition-all duration-200 ease-default',
          className
        )}
        title={config.name}
        aria-label={`${carrier} logo`}
        {...props}
      >
        {showFallback ? (
          <span className="flex items-center justify-center font-mono">
            {config.initials}
          </span>
        ) : (
          <span className="text-2xl">{config.logo}</span>
        )}
      </div>
    );
  }
);

CarrierLogo.displayName = 'CarrierLogo';

export { CarrierLogo };
export type { CarrierCode, CarrierSize };
