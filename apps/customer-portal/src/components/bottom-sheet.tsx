'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[]; // Array of snap point heights in pixels
  title?: string;
}

/**
 * Mobile-friendly bottom sheet with drag handle and snap points
 * Snap points: [peek (120px), half (50%), full (90%)]
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  snapPoints = [120, 200, 500],
  title,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  const currentHeight = snapPoints[currentSnapIndex];

  // Handle drag start
  const handleDragStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    dragStartYRef.current = e.touches[0].clientY;
    dragStartHeightRef.current = currentHeight;
  };

  // Handle drag move
  const handleDragMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaY = dragStartYRef.current - e.touches[0].clientY;
    const newHeight = dragStartHeightRef.current + deltaY;

    if (sheetRef.current) {
      sheetRef.current.style.height = `${Math.max(snapPoints[0], Math.min(newHeight, snapPoints[snapPoints.length - 1]))}px`;
    }
  };

  // Handle drag end - snap to nearest point
  const handleDragEnd = () => {
    setIsDragging(false);

    if (!sheetRef.current) return;

    const currentHeightValue = parseFloat(sheetRef.current.style.height || `${currentHeight}`);

    let nearestSnapIndex = 0;
    let minDistance = Math.abs(snapPoints[0] - currentHeightValue);

    snapPoints.forEach((point, index) => {
      const distance = Math.abs(point - currentHeightValue);
      if (distance < minDistance) {
        minDistance = distance;
        nearestSnapIndex = index;
      }
    });

    setCurrentSnapIndex(nearestSnapIndex);

    if (nearestSnapIndex === 0) {
      // If snapped to peek, close after a delay
      setTimeout(() => {
        if (currentSnapIndex === 0) {
          onClose();
        }
      }, 300);
    }
  };

  // Handle swipe down to dismiss
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = dragStartYRef.current - e.changedTouches[0].clientY;
    if (deltaY < -50) { // Swiped down
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setCurrentSnapIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-wl-bg-surface rounded-t-2xl',
          'border-t border-wl-border-subtle',
          'shadow-lg',
          'transition-all duration-300 ease-out',
          isDragging && 'transition-none'
        )}
        style={{
          height: `${currentHeight}px`,
          maxHeight: '90vh',
        }}
      >
        {/* Drag Handle */}
        <div
          ref={handleRef}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={(e) => {
            handleDragEnd();
            handleTouchEnd(e);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-3',
            'py-3 cursor-grab active:cursor-grabbing',
            'select-none'
          )}
        >
          {/* Handle Bar */}
          <div className={cn(
            'w-12 h-1 rounded-full',
            'bg-wl-neutral-700'
          )} />

          {/* Title */}
          {title && (
            <div className="flex items-center justify-between w-full px-6">
              <h2 className="text-lg font-bold text-wl-text-primary">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-wl-bg-elevated rounded-md transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-wl-text-secondary" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn(
          'flex-1 overflow-y-auto',
          'px-6 pb-6',
          title ? 'pt-3' : 'pt-6'
        )}>
          {children}
        </div>
      </div>
    </>
  );
}
