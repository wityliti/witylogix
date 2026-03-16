'use client';

import { cn } from '../../lib/utils';

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
type SpinnerVariant = 'spinner' | 'dots' | 'pulse' | 'bars';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  color?: 'primary' | 'secondary' | 'white';
  overlay?: boolean;
  label?: string;
  className?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const colorMap: Record<string, string> = {
  primary: 'text-wl-primary-500',
  secondary: 'text-wl-text-secondary',
  white: 'text-white',
};

/**
 * Rotating spinner variant
 */
function SpinnerVariantSpinner({
  size,
  color,
}: {
  size: string;
  color: string;
}) {
  return (
    <div className={cn('animate-spin', size, color)}>
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

/**
 * Bouncing dots variant
 */
function SpinnerVariantDots({
  size,
  color,
}: {
  size: string;
  color: string;
}) {
  const dotSize = size === 'w-4 h-4' ? 'w-1 h-1' : 'w-2 h-2';

  return (
    <div className={cn('flex gap-1 items-center', size, color)}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            dotSize,
            'rounded-full bg-current',
            'animate-bounce'
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Pulsing variant
 */
function SpinnerVariantPulse({
  size,
  color,
}: {
  size: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        'rounded-full animate-pulse',
        size,
        color,
        'bg-current/20 border-2 border-current'
      )}
    />
  );
}

/**
 * Animated bars variant
 */
function SpinnerVariantBars({
  size,
  color,
}: {
  size: string;
  color: string;
}) {
  const barCount = size === 'w-4 h-4' ? 4 : size === 'w-8 h-8' ? 5 : 6;

  return (
    <div className={cn('flex gap-1 items-center justify-center', size, color)}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 bg-current rounded-sm',
            size === 'w-4 h-4' ? 'h-2' : size === 'w-8 h-8' ? 'h-4' : 'h-6'
          )}
          style={{
            animation: `grow ${1}s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes grow {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/**
 * Loading spinner component with multiple variants
 * Displays a loading indicator with optional overlay
 *
 * @example
 * // Basic usage
 * <LoadingSpinner />
 *
 * @example
 * // With overlay
 * <LoadingSpinner overlay label="Loading..." />
 *
 * @example
 * // Different variants
 * <LoadingSpinner variant="dots" size="lg" />
 */
export function LoadingSpinner({
  size = 'md',
  variant = 'spinner',
  color = 'primary',
  overlay = false,
  label,
  className,
}: LoadingSpinnerProps) {
  const sizeClass = sizeMap[size];
  const colorClass = colorMap[color];

  const spinner = (() => {
    switch (variant) {
      case 'dots':
        return <SpinnerVariantDots size={sizeClass} color={colorClass} />;
      case 'pulse':
        return <SpinnerVariantPulse size={sizeClass} color={colorClass} />;
      case 'bars':
        return <SpinnerVariantBars size={sizeClass} color={colorClass} />;
      case 'spinner':
      default:
        return <SpinnerVariantSpinner size={sizeClass} color={colorClass} />;
    }
  })();

  if (overlay) {
    return (
      <div className={cn(
        'fixed inset-0 flex items-center justify-center',
        'bg-black/50 backdrop-blur-sm z-50',
        className
      )}>
        <div className="flex flex-col items-center gap-4">
          {spinner}
          {label && (
            <p className="text-sm font-medium text-white">
              {label}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {spinner}
      {label && (
        <p className="text-xs font-medium text-wl-text-secondary">
          {label}
        </p>
      )}
    </div>
  );
}
