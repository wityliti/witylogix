// @ts-nocheck
import { h } from 'preact';
import { extend, BlockStack, InlineStack, Text, useApi } from '@shopify/ui-extensions/checkout';
import { DeliveryDatePicker } from './DeliveryDatePicker';

/**
 * Shopify Checkout UI Extension Entry Point
 * Registers the delivery date/time picker with Shopify's checkout system
 *
 * Features:
 * - Error boundary wrapper with fallback UI
 * - Analytics event tracking
 * - Extension metadata reporting
 */

/**
 * Error boundary wrapper for graceful error handling
 */
class ErrorBoundary {
  static render(root, component, fallback) {
    try {
      root.appendChild(component);
    } catch (error) {
      console.error('Extension render error:', error);
      root.appendChild(fallback);
    }
  }
}

/**
 * Fallback UI when extension fails
 */
function createFallbackUI() {
  return h(
    'div',
    {
      style: {
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: '#fef3f2',
        color: '#d02c2c',
        border: '1px solid #d02c2c'
      }
    },
    h(
      'p',
      { style: { margin: '0' } },
      'Delivery date picker temporarily unavailable. Please refresh the page.'
    )
  );
}

/**
 * Analytics event tracker
 */
const analytics = {
  track: (eventName: string, properties: Record<string, unknown> = {}) => {
    try {
      // Send analytics events
      const event = {
        name: eventName,
        timestamp: new Date().toISOString(),
        properties: {
          ...properties,
          extensionVersion: '1.0.0',
          locale: Intl.DateTimeFormat().resolvedOptions().locale,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
      };

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics]', event);
      }

      // Send to backend analytics service
      if (typeof window !== 'undefined' && (window as any).__WITYLOGIX_ANALYTICS__) {
        (window as any).__WITYLOGIX_ANALYTICS__.track(event);
      }
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }
};

/**
 * Report extension metadata and capabilities
 */
function reportExtensionMetadata(api: any) {
  try {
    const metadata = {
      extensionId: 'checkout-delivery-picker',
      version: '1.0.0',
      apiVersion: api?.checkout?.apiVersion || 'unknown',
      capabilities: {
        setCheckoutAttributes: !!api?.checkout?.setAttributes,
        cartAccess: !!api?.cart,
        shippingAddressAccess: !!api?.shippingAddress,
      },
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    console.log('[Extension Metadata]', metadata);

    // Report to analytics
    analytics.track('extension:loaded', metadata);
  } catch (error) {
    console.error('Failed to report extension metadata:', error);
  }
}

/**
 * Main extension registration
 */
extend(
  'purchase.checkout.block.render',
  (root, api) => {
    try {
      // Report extension metadata
      reportExtensionMetadata(api);

      // Track extension load
      analytics.track('extension:mounted', {
        shopId: api.shop?.id
      });

      // Get shop ID from API
      const shopId = api.shop?.id || 'unknown';

      // Create main component
      const component = h(
        BlockStack,
        { spacing: 'base' },
        h(
          'div',
          {
            style: {
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              marginBottom: '16px'
            }
          },
          h(DeliveryDatePicker, {
            shopId,
            cartItems: [],
            onSelectionChange: (selection) => {
              // Track date selection
              analytics.track('delivery:date_selected', {
                date: selection.date,
                slotId: selection.slotId,
                fee: selection.deliveryFee
              });

              // Store selection in checkout attributes
              if (api.checkout && api.checkout.setAttributes) {
                try {
                  api.checkout.setAttributes({
                    'witylogix_delivery_date': selection.date,
                    'witylogix_delivery_slot': selection.slotId,
                    'witylogix_time_label': selection.timeLabel,
                    'witylogix_delivery_fee': selection.deliveryFee.toString()
                  });

                  // Track successful save
                  analytics.track('delivery:selection_saved', {
                    date: selection.date,
                    slotId: selection.slotId
                  });
                } catch (error) {
                  console.error('Failed to set checkout attributes:', error);
                  analytics.track('delivery:save_failed', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                  });
                }
              }
            }
          })
        )
      );

      // Create fallback UI
      const fallback = createFallbackUI();

      // Render with error boundary
      ErrorBoundary.render(root, component, fallback);

      // Track successful render
      analytics.track('extension:rendered', {
        shopId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Extension Error]', error);

      // Track error
      analytics.track('extension:error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Show fallback
      root.appendChild(createFallbackUI());
    }
  }
);
