"use client";

import { useEffect, useRef } from "react";

interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const SWIPE_THRESHOLD = 50; // minimum distance for swipe detection

/**
 * Hook to detect swipe gestures on a DOM element
 * Supports swipe left, right, up, and down
 * Uses passive event listeners for better scroll performance
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * useSwipe(ref, {
 *   onSwipeLeft: () => console.log('swiped left'),
 *   onSwipeRight: () => console.log('swiped right'),
 * });
 *
 * @param ref - React ref to the element to attach swipe listeners to
 * @param callbacks - Object with swipe direction callbacks
 */
export function useSwipe(
  ref: React.RefObject<HTMLElement>,
  callbacks: SwipeCallbacks
): void {
  const swipeState = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      swipeState.current.startX = touch.clientX;
      swipeState.current.startY = touch.clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      swipeState.current.endX = touch.clientX;
      swipeState.current.endY = touch.clientY;

      const deltaX = swipeState.current.endX - swipeState.current.startX;
      const deltaY = swipeState.current.endY - swipeState.current.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine dominant direction
      if (absDeltaX > absDeltaY && absDeltaX > SWIPE_THRESHOLD) {
        if (deltaX > 0) {
          callbacks.onSwipeRight?.();
        } else {
          callbacks.onSwipeLeft?.();
        }
      } else if (absDeltaY > absDeltaX && absDeltaY > SWIPE_THRESHOLD) {
        if (deltaY > 0) {
          callbacks.onSwipeDown?.();
        } else {
          callbacks.onSwipeUp?.();
        }
      }
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [callbacks]);
}

interface LongPressOptions {
  delay?: number;
}

/**
 * Hook to detect long press gesture
 * Fires callback after specified delay (default 500ms)
 *
 * @example
 * const ref = useRef<HTMLButtonElement>(null);
 * useLongPress(ref, () => {
 *   console.log('long pressed');
 * }, { delay: 800 });
 *
 * @param ref - React ref to the element
 * @param callback - Function to call when long press is detected
 * @param options - Configuration options
 */
export function useLongPress(
  ref: React.RefObject<HTMLElement>,
  callback: () => void,
  options: LongPressOptions = {}
): void {
  const { delay = 500 } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isLongPressRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = () => {
      isLongPressRef.current = false;
      timeoutRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        callback();
      }, delay);
    };

    const handleTouchEnd = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };

    const handleTouchMove = () => {
      // Cancel long press if user moves during touch
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        isLongPressRef.current = false;
      }
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });

    // Also support mouse long press
    element.addEventListener("mousedown", handleTouchStart, { passive: true });
    element.addEventListener("mouseup", handleTouchEnd, { passive: true });
    element.addEventListener("mousemove", handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("mousedown", handleTouchStart);
      element.removeEventListener("mouseup", handleTouchEnd);
      element.removeEventListener("mousemove", handleTouchMove);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [callback, delay]);
}

interface PinchZoomState {
  scale: number;
  lastDistance: number;
}

/**
 * Hook to detect pinch zoom gesture
 * Returns current scale value (1 = no zoom, > 1 = zoomed in)
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * const scale = usePinchZoom(ref);
 *
 * @param ref - React ref to the element
 * @returns Current scale value
 */
export function usePinchZoom(ref: React.RefObject<HTMLElement>): number {
  const scaleRef = useRef<number>(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const getDistance = (touches: TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        scaleRef.current = 1;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;

      const currentDistance = getDistance(e.touches);
      if (scaleRef.current !== 1) {
        const newScale = currentDistance / 100; // Normalize to reasonable scale
        scaleRef.current = Math.max(0.5, Math.min(3, newScale)); // Clamp between 0.5 and 3
      }
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return scaleRef.current;
}

/**
 * Hook to detect if current input is from touch or mouse
 * Useful for adapting UI behavior (e.g., showing/hiding hover states)
 *
 * @example
 * const isTouchDevice = useTouchDetect();
 *
 * @returns True if touch input is detected
 */
export function useTouchDetect(): boolean {
  const isTouchRef = useRef(false);

  useEffect(() => {
    const handleTouchStart = () => {
      isTouchRef.current = true;
    };

    const handleMouseMove = () => {
      isTouchRef.current = false;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Initial detection
    isTouchRef.current =
      typeof window !== "undefined" &&
      ("ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return isTouchRef.current;
}
