// @ts-nocheck

import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useTheme, useAsync, useDebounce } from '@witylogix/extension-core/hooks';
import { searchOrders, getOrder, formatCurrency } from './api';
import { createStyles } from './styles';
import type { POSSearchResult, POSOrder } from './types';

interface OrderLookupProps {
  onOrderSelected: (order: POSOrder) => void;
}

/**
 * Order Lookup Component
 *
 * Allows POS user to search for orders by:
 * - Order ID
 * - Customer phone number
 * - Customer name
 *
 * Displays results with status badge, items count, delivery address
 * Tap to select order for fulfillment/delivery assignment
 */
export function OrderLookup({ onOrderSelected }: OrderLookupProps) {
  const tokens = useTheme();
  const styles = createStyles(tokens);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<POSSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<POSSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<Error | null>(null);

  // Debounce search query
  const debouncedQuery = useDebounce(query, 300);

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length === 0) {
      setResults([]);
      setSelectedResult(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    searchOrders(debouncedQuery)
      .then((data) => {
        setResults(data);
        setIsSearching(false);
      })
      .catch((error) => {
        setSearchError(error instanceof Error ? error : new Error(String(error)));
        setResults([]);
        setIsSearching(false);
      });
  }, [debouncedQuery]);

  // Fetch full order details when result selected
  const handleSelectResult = async (result: POSSearchResult) => {
    setSelectedResult(result);
    try {
      const fullOrder = await getOrder(result.id);
      onOrderSelected(fullOrder);
    } catch (error) {
      setSearchError(error instanceof Error ? error : new Error('Failed to load order'));
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const baseStyle = styles.statusBadge;
    const statusStyle = styles[`statusBadge${status.charAt(0).toUpperCase() + status.slice(1)}`] || {};
    return { ...baseStyle, ...statusStyle };
  };

  return h(
    'div',
    { style: styles.section },
    h('h2', { style: styles.sectionTitle }, 'Search Orders'),

    // Search input
    h(
      'div',
      { style: styles.formGroup },
      h('label', { style: styles.label }, 'Order ID, Phone, or Name'),
      h('input', {
        type: 'text',
        placeholder: 'Enter order ID, phone number, or customer name...',
        value: query,
        onInput: (e) => setQuery((e.target as HTMLInputElement).value),
        style: styles.searchInput,
        autoFocus: true
      })
    ),

    // Loading state
    isSearching && h(
      'div',
      { style: styles.loadingContainer },
      h('div', { style: styles.spinner }),
      h('p', null, 'Searching...')
    ),

    // Error state
    searchError && h(
      'div',
      { style: styles.errorMessage },
      `Search failed: ${searchError.message}`
    ),

    // Results list
    !isSearching && results.length > 0 && h(
      'div',
      { style: styles.resultsList },
      results.map((result) =>
        h(
          'div',
          {
            key: result.id,
            style: { ...styles.resultItem, opacity: selectedResult?.id === result.id ? 0.6 : 1 },
            onClick: () => handleSelectResult(result)
          },
          h(
            'div',
            { style: styles.resultItemHeader },
            h('span', { style: styles.orderNumber }, `Order ${result.orderNumber}`),
            h('span', { style: getStatusBadgeStyle(result.status) }, result.status)
          ),
          h(
            'div',
            { style: styles.orderDetails },
            h('p', { style: { margin: 0 } }, result.customerName),
            h('p', { style: { margin: 0 } }, result.customerPhone),
            h('p', { style: { margin: 0 } }, `${result.itemCount} item(s)`)
          ),
          h(
            'div',
            { style: styles.orderDetails },
            h('p', { style: { margin: '4px 0' } }, result.address)
          ),
          h('div', { style: styles.totalPrice }, formatCurrency(result.total))
        )
      )
    ),

    // No results state
    !isSearching && query.length > 0 && results.length === 0 && !searchError && h(
      'div',
      { style: styles.emptyState },
      'No orders found'
    ),

    // Empty state (no query)
    query.length === 0 && h(
      'div',
      { style: styles.emptyState },
      'Enter an order ID, phone number, or customer name to search'
    )
  );
}
