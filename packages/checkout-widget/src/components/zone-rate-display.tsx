/**
 * ZoneRateDisplay Component
 * Shows delivery rates and pricing breakdown
 */

import React from 'react';
import { TrendingDown, Info } from 'lucide-react';
import { getCostBreakdown, formatPrice, getFreeDeliveryMessage } from '../utils/rate-calculator';
import type { ZoneRate } from '../types';
import clsx from 'clsx';

interface ZoneRateDisplayProps {
  zoneRate: ZoneRate;
  orderValue: number;
  distanceKm?: number;
  weightKg?: number;
  compact?: boolean;
  showBreakdown?: boolean;
}

export const ZoneRateDisplay: React.FC<ZoneRateDisplayProps> = ({
  zoneRate,
  orderValue,
  distanceKm = 0,
  weightKg = 0,
  compact = false,
  showBreakdown = true,
}) => {
  const breakdown = getCostBreakdown(orderValue, zoneRate, distanceKm, weightKg);
  const qualifiesForFreeDelivery = orderValue >= zoneRate.freeDeliveryThreshold;

  return (
    <div className={clsx('wl-w-full wl-space-y-4', { 'wl-max-w-md': compact })}>
      {/* Zone info */}
      <div className="wl-flex wl-items-center wl-justify-between wl-p-4 wl-bg-wl-muted/30 wl-rounded-lg">
        <div>
          <h3 className="wl-font-semibold wl-text-wl-foreground">{zoneRate.zoneName}</h3>
          <p className="wl-text-sm wl-text-wl-muted-foreground">Delivery zone</p>
        </div>
        {zoneRate.enabled && (
          <div className="wl-text-right">
            <p className="wl-text-xs wl-text-wl-muted-foreground">Available</p>
            <div className="wl-w-3 wl-h-3 wl-rounded-full wl-bg-wl-success wl-mt-1" />
          </div>
        )}
      </div>

      {showBreakdown && (
        <div className="wl-space-y-3">
          {/* Base rate */}
          <div className="wl-flex wl-items-center wl-justify-between wl-text-sm">
            <span className="wl-text-wl-muted-foreground">Base delivery rate</span>
            <span className="wl-font-medium wl-text-wl-foreground">
              {formatPrice(breakdown.baseRate, breakdown.currency)}
            </span>
          </div>

          {/* Distance fee */}
          {distanceKm > 0 && breakdown.distanceFee > 0 && (
            <div className="wl-flex wl-items-center wl-justify-between wl-text-sm">
              <span className="wl-text-wl-muted-foreground">
                Distance fee ({distanceKm.toFixed(1)} km)
              </span>
              <span className="wl-font-medium wl-text-wl-foreground">
                {formatPrice(breakdown.distanceFee, breakdown.currency)}
              </span>
            </div>
          )}

          {/* Weight surcharge */}
          {weightKg > 0 && breakdown.weightSurcharge > 0 && (
            <div className="wl-flex wl-items-center wl-justify-between wl-text-sm">
              <span className="wl-text-wl-muted-foreground">
                Weight surcharge ({weightKg.toFixed(1)} kg)
              </span>
              <span className="wl-font-medium wl-text-wl-foreground">
                {formatPrice(breakdown.weightSurcharge, breakdown.currency)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="wl-border-t wl-border-wl-border" />

          {/* Subtotal */}
          <div className="wl-flex wl-items-center wl-justify-between wl-text-sm">
            <span className="wl-text-wl-muted-foreground">Order subtotal</span>
            <span className="wl-font-medium wl-text-wl-foreground">
              {formatPrice(breakdown.subtotal, breakdown.currency)}
            </span>
          </div>

          {/* Delivery fee with free delivery highlight */}
          <div className="wl-flex wl-items-center wl-justify-between">
            <span className={clsx('wl-text-sm wl-font-medium', {
              'wl-text-wl-success': qualifiesForFreeDelivery,
              'wl-text-wl-foreground': !qualifiesForFreeDelivery,
            })}>
              Delivery fee
            </span>
            {qualifiesForFreeDelivery ? (
              <div className="wl-flex wl-items-center wl-gap-1">
                <TrendingDown className="wl-w-4 wl-h-4 wl-text-wl-success" />
                <span className="wl-font-semibold wl-text-wl-success">FREE</span>
              </div>
            ) : (
              <span className="wl-font-semibold wl-text-wl-foreground">
                {formatPrice(breakdown.deliveryFee, breakdown.currency)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Total */}
      <div className="wl-p-4 wl-bg-wl-accent/10 wl-rounded-lg wl-border wl-border-wl-accent/30">
        <div className="wl-flex wl-items-center wl-justify-between">
          <span className="wl-font-semibold wl-text-wl-foreground">Total estimate</span>
          <span className="wl-text-2xl wl-font-bold wl-text-wl-accent">
            {formatPrice(breakdown.total, breakdown.currency)}
          </span>
        </div>
      </div>

      {/* Free delivery threshold message */}
      {!qualifiesForFreeDelivery && (
        <div className="wl-p-3 wl-bg-wl-warning/10 wl-rounded-lg wl-border wl-border-wl-warning/30">
          <div className="wl-flex wl-items-start wl-gap-2">
            <Info className="wl-w-4 wl-h-4 wl-text-wl-warning wl-flex-shrink-0 wl-mt-0.5" />
            <p className="wl-text-sm wl-text-wl-warning">
              {getFreeDeliveryMessage(zoneRate, orderValue)}
            </p>
          </div>
        </div>
      )}

      {/* Free delivery threshold info */}
      <div className="wl-p-3 wl-bg-wl-muted/30 wl-rounded-lg">
        <div className="wl-flex wl-items-center wl-gap-2 wl-mb-2">
          <TrendingDown className="wl-w-4 wl-h-4 wl-text-wl-muted-foreground" />
          <p className="wl-text-xs wl-font-semibold wl-text-wl-foreground">Free delivery threshold</p>
        </div>
        <p className="wl-text-sm wl-text-wl-muted-foreground">
          Orders above {formatPrice(zoneRate.freeDeliveryThreshold, breakdown.currency)} qualify for free delivery
        </p>
      </div>

      {/* Rate details */}
      <div className="wl-text-xs wl-text-wl-muted-foreground wl-space-y-1">
        <p>Distance rate: {formatPrice(zoneRate.distanceFeePerKm, breakdown.currency)}/km</p>
        <p>Weight surcharge: {formatPrice(zoneRate.weightSurchargePerKg, breakdown.currency)}/kg</p>
      </div>
    </div>
  );
};
