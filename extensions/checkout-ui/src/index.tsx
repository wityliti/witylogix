// @ts-nocheck
import { h } from 'preact';
import { extend, BlockStack, InlineStack, Text, useApi } from '@shopify/ui-extensions/checkout';
import { DeliveryDatePicker } from './DeliveryDatePicker';

/**
 * Shopify Checkout UI Extension Entry Point
 * Registers the delivery date/time picker with Shopify's checkout system
 */
extend(
  'purchase.checkout.block.render',
  (root, api) => {
    // Get shop ID from API
    const shopId = api.shop?.id || 'unknown';

    // Render the extension
    root.appendChild(
      h(
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
              // Store selection in checkout attributes
              if (api.checkout && api.checkout.setAttributes) {
                api.checkout.setAttributes({
                  'witylogix_delivery_date': selection.date,
                  'witylogix_delivery_slot': selection.slotId,
                  'witylogix_time_label': selection.timeLabel,
                  'witylogix_delivery_fee': selection.deliveryFee.toString()
                });
              }
            }
          })
        )
      )
    );
  }
);
