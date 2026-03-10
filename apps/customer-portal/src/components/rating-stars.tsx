'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RatingStars({
  value,
  onChange,
  readonly = false,
  size = 'md',
  className,
}: RatingStarsProps) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  const iconSize = sizeMap[size];

  return (
    <div className={cn('flex gap-1', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          className={cn(
            'transition-colors duration-fast',
            !readonly && 'cursor-pointer hover:scale-110 active:scale-95'
          )}
          aria-label={`Rate ${star} stars`}
        >
          <Star
            size={iconSize}
            className={cn(
              'transition-colors duration-fast',
              star <= value
                ? 'fill-wl-warning-500 text-wl-warning-500'
                : 'text-wl-neutral-500'
            )}
          />
        </button>
      ))}
    </div>
  );
}
