'use client';

import { forwardRef, useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  available: number;
  reserved: number;
  total: number;
}

interface InventoryLevelIndicatorProps
  extends HTMLAttributes<HTMLDivElement> {
  /** Stock level (0-100) or absolute quantity */
  level: number;
  /** Max stock level (for percentage calculation if needed) */
  maxLevel?: number;
  /** Available quantity */
  available: number;
  /** Reserved quantity */
  reserved?: number;
  /** Show as compact (true) or expanded (false) */
  compact?: boolean;
  /** Per-warehouse breakdown data */
  warehouses?: WarehouseStock[];
  /** Show low stock alert */
  showAlert?: boolean;
  /** Custom threshold for low stock (default: 10) */
  lowStockThreshold?: number;
}

const getStockColor = (percentage: number): string => {
  if (percentage > 50) return 'bg-green-500 dark:bg-green-600';
  if (percentage >= 10) return 'bg-yellow-500 dark:bg-yellow-600';
  if (percentage > 0) return 'bg-red-500 dark:bg-red-600';
  return 'bg-gray-300 dark:bg-wl-bg-overlay';
};

const getStockLabel = (percentage: number): string => {
  if (percentage > 50) return 'In Stock';
  if (percentage >= 10) return 'Low Stock';
  if (percentage > 0) return 'Critical';
  return 'Out of Stock';
};

/**
 * Inventory level indicator showing stock status with warehouse breakdown
 *
 * @example
 * ```tsx
 * <InventoryLevelIndicator
 *   level={45}
 *   maxLevel={100}
 *   available={45}
 *   reserved={10}
 *   compact
 * />
 * <InventoryLevelIndicator
 *   level={75}
 *   maxLevel={100}
 *   available={75}
 *   warehouses={[...]}
 * />
 * ```
 */
const InventoryLevelIndicator = forwardRef<
  HTMLDivElement,
  InventoryLevelIndicatorProps
>(
  (
    {
      level,
      maxLevel = 100,
      available,
      reserved = 0,
      compact = true,
      warehouses,
      showAlert = true,
      lowStockThreshold = 10,
      className,
      ...props
    },
    ref
  ) => {
    const [showWarehouseDetail, setShowWarehouseDetail] = useState(false);
    const percentage = maxLevel > 0 ? (level / maxLevel) * 100 : 0;
    const isLowStock = percentage > 0 && percentage < lowStockThreshold;
    const isOutOfStock = percentage === 0;

    if (compact) {
      return (
        <div
          ref={ref}
          className={cn(
            'inline-flex items-center gap-2',
            className
          )}
          {...props}
        >
          {/* Compact bar */}
          <div className="w-24 h-2 bg-wl-bg-surface dark:bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 ease-default rounded-full',
                getStockColor(percentage)
              )}
              style={{ width: `${Math.max(2, percentage)}%` }}
              aria-valuenow={level}
              aria-valuemin={0}
              aria-valuemax={maxLevel}
              role="progressbar"
              aria-label="Stock level"
            />
          </div>

          {/* Stock text */}
          <span
            className={cn(
              'text-xs font-semibold whitespace-nowrap',
              isOutOfStock && 'text-wl-text-tertiary dark:text-wl-text-secondary',
              isLowStock && 'text-yellow-600 dark:text-yellow-400',
              !isLowStock && !isOutOfStock && 'text-green-600 dark:text-green-400'
            )}
          >
            {available}/{maxLevel}
          </span>

          {/* Low stock alert */}
          {showAlert && isLowStock && (
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          )}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-3',
          'p-3 rounded-lg',
          'bg-wl-bg-surface dark:bg-wl-bg-root/30',
          'border border-gray-200 dark:border-gray-800',
          className
        )}
        {...props}
      >
        {/* Header with title and alert */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-wl-text-tertiary dark:text-wl-text-secondary">
              Stock Level
            </span>
            {showAlert && isLowStock && (
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            )}
          </div>
          <span
            className={cn(
              'text-xs font-semibold px-2 py-1 rounded',
              isOutOfStock && 'bg-wl-bg-surface dark:bg-wl-bg-elevated text-wl-text-tertiary dark:text-wl-text-secondary',
              isLowStock && 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
              !isLowStock && !isOutOfStock && 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
            )}
          >
            {getStockLabel(percentage)}
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="w-full h-3 bg-wl-bg-surface dark:bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 ease-default rounded-full',
                getStockColor(percentage)
              )}
              style={{ width: `${Math.max(2, percentage)}%` }}
              role="progressbar"
              aria-valuenow={level}
              aria-valuemin={0}
              aria-valuemax={maxLevel}
              aria-label="Stock level indicator"
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-wl-text-tertiary dark:text-wl-text-secondary">
            <span>0</span>
            <span className="font-semibold text-wl-text-tertiary dark:text-wl-text-secondary">
              {level} / {maxLevel}
            </span>
            <span>{maxLevel}</span>
          </div>
        </div>

        {/* Available and Reserved breakdown */}
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-wl-text-tertiary dark:text-wl-text-secondary">Available:</span>
            <span className="ml-1 font-semibold text-gray-900 dark:text-wl-text-primary">
              {available}
            </span>
          </div>
          {reserved > 0 && (
            <div>
              <span className="text-wl-text-tertiary dark:text-wl-text-secondary">Reserved:</span>
              <span className="ml-1 font-semibold text-yellow-600 dark:text-yellow-400">
                {reserved}
              </span>
            </div>
          )}
        </div>

        {/* Warehouse breakdown toggle */}
        {warehouses && warehouses.length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setShowWarehouseDetail(!showWarehouseDetail)}
              className={cn(
                'text-xs font-semibold text-blue-600 dark:text-blue-400',
                'hover:underline transition-colors'
              )}
              aria-expanded={showWarehouseDetail}
            >
              {showWarehouseDetail
                ? 'Hide warehouse details'
                : `View ${warehouses.length} warehouse${warehouses.length > 1 ? 's' : ''}`}
            </button>

            {showWarehouseDetail && (
              <div className="mt-2 space-y-2">
                {warehouses.map((wh) => (
                  <div
                    key={wh.warehouseId}
                    className="text-xs p-2 bg-white dark:bg-wl-bg-elevated rounded border border-gray-200 dark:border-wl-border-default"
                  >
                    <div className="font-semibold text-wl-text-tertiary dark:text-wl-text-secondary mb-1">
                      {wh.warehouseName}
                    </div>
                    <div className="h-1.5 bg-wl-bg-surface dark:bg-wl-bg-overlay rounded-full overflow-hidden mb-1">
                      <div
                        className={cn(
                          'h-full transition-all duration-200',
                          getStockColor(
                            wh.total > 0 ? (wh.available / wh.total) * 100 : 0
                          )
                        )}
                        style={{
                          width: `${wh.total > 0 ? (wh.available / wh.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-wl-text-tertiary dark:text-wl-text-secondary">
                      <span>{wh.available} avail</span>
                      <span>{wh.reserved} reserved</span>
                      <span className="font-semibold text-wl-text-tertiary dark:text-wl-text-secondary">
                        {wh.total} total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

InventoryLevelIndicator.displayName = 'InventoryLevelIndicator';

export { InventoryLevelIndicator };
export type { WarehouseStock };
