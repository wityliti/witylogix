// @ts-nocheck

import { h, render, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { preloadThemeTokens } from '@witylogix/extension-core/theme-bridge';
import { OrderLookup } from './OrderLookup';
import { DeliveryAssignment } from './DeliveryAssignment';
import { createStyles, globalStyles } from './styles';
import { useTheme } from '@witylogix/extension-core/hooks';
import type { POSOrder } from './types';

/**
 * POS UI Extension Entry Point
 *
 * Mounts Preact app into POS extension point (pos.home.tile.render)
 * Provides order lookup and delivery assignment workflow
 * Handles extension lifecycle and theme initialization
 */

// Inject global styles
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

/**
 * Main App Component
 */
function POSUIApp() {
  const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);
  const tokens = useTheme();
  const styles = createStyles(tokens);

  const handleBack = () => {
    setSelectedOrder(null);
  };

  const handleAssignmentComplete = () => {
    setSelectedOrder(null);
  };

  return h(
    'div',
    { style: styles.container },
    !selectedOrder
      ? h(OrderLookup, { onOrderSelected: setSelectedOrder })
      : h(
        Fragment,
        null,
        h(
          'div',
          { style: { marginBottom: tokens.spacing[4] } },
          h(
            'button',
            {
              onClick: handleBack,
              style: {
                ...styles.button,
                ...styles.buttonSecondary,
                marginBottom: tokens.spacing[4]
              }
            },
            '← Back to Search'
          )
        ),
        h(DeliveryAssignment, {
          order: selectedOrder,
          onAssignmentComplete: handleAssignmentComplete
        })
      )
  );
}

/**
 * Initialize the extension
 *
 * 1. Preload theme tokens from parent frame
 * 2. Find mount point (from Shopify POS extension API)
 * 3. Render Preact app
 * 4. Handle extension unmount cleanup
 */
async function initializeExtension() {
  try {
    // Preload theme tokens for immediate availability
    await preloadThemeTokens();

    // Check if running in Shopify POS environment
    if (typeof window !== 'undefined' && (window as any).__POS_EXTENSION_API__) {
      const posApi = (window as any).__POS_EXTENSION_API__;

      // Register extension mounted handler
      if (typeof posApi.onExtensionMounted === 'function') {
        posApi.onExtensionMounted({
          extensionId: (window as any).__EXTENSION_CONFIG__?.extensionId || 'witylogix-pos-delivery',
          type: 'pos_ui_extension'
        });
      }
    }

    // Find mount point or create one
    let rootElement = document.getElementById('wl-pos-ui-root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'wl-pos-ui-root';
      document.body.appendChild(rootElement);
    }

    // Render the app
    render(h(POSUIApp), rootElement);

    console.log('[POS UI Extension] Initialized successfully');

    // Handle unmount
    return () => {
      render(null, rootElement);
      console.log('[POS UI Extension] Unmounted');
    };
  } catch (error) {
    console.error('[POS UI Extension] Failed to initialize:', error);

    // Render error message
    const errorElement = document.createElement('div');
    errorElement.style.padding = '20px';
    errorElement.style.color = 'red';
    errorElement.style.fontSize = '14px';
    errorElement.innerHTML = `<strong>Error:</strong> Failed to initialize POS extension: ${error instanceof Error ? error.message : String(error)}`;
    document.body.appendChild(errorElement);

    // Report error to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'wl:extension-error',
        error: error instanceof Error ? error.message : String(error),
        extensionId: (window as any).__EXTENSION_CONFIG__?.extensionId
      }, '*');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Export for testing
export { POSUIApp };
