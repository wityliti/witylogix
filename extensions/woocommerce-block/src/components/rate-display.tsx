/**
 * Rate Display Component
 * Shows zone-based delivery rates for WooCommerce checkout
 */

import type { ZoneRate } from "../api/witylogix-api";

interface RateDisplayProps {
  rate?: ZoneRate;
  isLoading?: boolean;
  error?: string;
}

/**
 * Format cents to currency string
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Rate Display Component
 */
export function RateDisplay({
  rate,
  isLoading = false,
  error,
}: RateDisplayProps) {
  if (error) {
    return (
      <div className="witylogix-rate-display witylogix-rate-display--error">
        <div className="rate-error-icon">⚠️</div>
        <div className="rate-error-message">
          <p className="rate-error-title">Unable to load rates</p>
          <p className="rate-error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="witylogix-rate-display witylogix-rate-display--loading">
        <div className="rate-loading-skeleton">
          <div className="skeleton-bar" />
          <div className="skeleton-bar" />
        </div>
      </div>
    );
  }

  if (!rate) {
    return (
      <div className="witylogix-rate-display witylogix-rate-display--empty">
        <p className="rate-empty-message">
          Enter shipping address to see rates
        </p>
      </div>
    );
  }

  return (
    <div className="witylogix-rate-display witylogix-rate-display--loaded">
      <div className="rate-header">
        <h4 className="rate-title">Delivery Rates</h4>
        <span className="rate-zone-badge">{rate.zone}</span>
      </div>

      <div className="rate-content">
        <div className="rate-row">
          <span className="rate-label">Base Fee</span>
          <span className="rate-value">{formatCurrency(rate.baseFee)}</span>
        </div>

        <div className="rate-row">
          <span className="rate-label">Per Mile</span>
          <span className="rate-value">{formatCurrency(rate.perMile)}</span>
        </div>

        <div className="rate-divider" />

        <div className="rate-row rate-row--highlight">
          <span className="rate-label">Est. Delivery</span>
          <span className="rate-value rate-value--delivery">
            {rate.estimatedDelivery}
          </span>
        </div>
      </div>

      <p className="rate-disclaimer">
        Final delivery fee calculated at checkout based on delivery address
      </p>
    </div>
  );
}
