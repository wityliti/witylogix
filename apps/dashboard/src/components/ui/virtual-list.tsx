"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "./loading-spinner";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  onScrollToIndex?: (index: number) => void;
  className?: string;
  height?: number;
  width?: string | number;
}

interface ScrollState {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  onLoadMore,
  isLoadingMore = false,
  onScrollToIndex,
  className,
  height = 600,
  width = "100%",
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(height);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  const getItemHeight = useCallback(
    (index: number) => {
      if (typeof itemHeight === "number") return itemHeight;
      return itemHeight(index, items[index]);
    },
    [itemHeight, items]
  );

  const cumulativeHeights = useMemo(() => {
    const heights = [0];
    for (let i = 0; i < items.length; i++) {
      heights.push(heights[heights.length - 1] + getItemHeight(i));
    }
    return heights;
  }, [items, getItemHeight]);

  const totalHeight = cumulativeHeights[cumulativeHeights.length - 1] || 0;

  const getVisibleRange = useCallback(() => {
    const scrollPixels = scrollTop;
    const endPixels = scrollPixels + containerHeight;

    let startIdx = 0;
    let endIdx = items.length - 1;

    for (let i = 0; i < cumulativeHeights.length; i++) {
      if (cumulativeHeights[i] >= scrollPixels) {
        startIdx = Math.max(0, i - 1);
        break;
      }
    }

    for (let i = startIdx; i < cumulativeHeights.length; i++) {
      if (cumulativeHeights[i] >= endPixels) {
        endIdx = i;
        break;
      }
    }

    return {
      startIdx: Math.max(0, startIdx - overscan),
      endIdx: Math.min(items.length - 1, endIdx + overscan),
    };
  }, [scrollTop, containerHeight, items.length, cumulativeHeights, overscan]);

  const { startIdx, endIdx } = useMemo(
    () => getVisibleRange(),
    [getVisibleRange]
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
    scrollPositionRef.current = target.scrollTop;

    // Infinite scroll check
    if (
      target.scrollTop + target.clientHeight >=
      target.scrollHeight - 200
    ) {
      onLoadMore?.();
    }
  }, [onLoadMore]);

  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current && index < items.length) {
      const targetScroll = cumulativeHeights[index];
      containerRef.current.scrollTop = targetScroll;
      scrollPositionRef.current = targetScroll;
      onScrollToIndex?.(index);
    }
  }, [items.length, cumulativeHeights, onScrollToIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      setContainerHeight(container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const visibleItems = items.slice(startIdx, endIdx + 1);
  const offsetY = cumulativeHeights[startIdx] || 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-y-auto overflow-x-hidden border border-wl-border-subtle rounded-lg",
        "bg-wl-bg-elevated",
        className
      )}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: `${totalHeight}px`, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            willChange: "transform",
          }}
        >
          {visibleItems.map((item, idx) => (
            <div
              key={startIdx + idx}
              style={{
                height: `${getItemHeight(startIdx + idx)}px`,
              }}
            >
              {renderItem(item, startIdx + idx)}
            </div>
          ))}
        </div>
      </div>

      {isLoadingMore && (
        <div className="flex items-center justify-center py-4 border-t border-wl-border-subtle bg-wl-bg-surface">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-xs text-wl-text-secondary">
            Loading more...
          </span>
        </div>
      )}
    </div>
  );
}
