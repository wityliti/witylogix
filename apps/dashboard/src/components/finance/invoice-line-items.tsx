/**
 * Invoice Line Items Display — Expandable view with quantity, price, tax breakdown
 *
 * Features:
 * - Expandable/collapsible line items
 * - Quantity, unit price, tax calculation
 * - Total amount with tax included
 * - Dark theme with CSS vars
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { LineItem } from '@/components/invoicing/types';

interface InvoiceLineItemsDisplayProps {
  items: LineItem[];
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function InvoiceLineItemsDisplay({
  items,
  isExpanded: initialExpanded = false,
  onExpandChange,
  className,
}: InvoiceLineItemsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onExpandChange?.(newState);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100),
    0
  );
  const total = subtotal + taxTotal;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full px-4 py-3',
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg',
          'flex items-center justify-between',
          'hover:bg-wl-bg-overlay transition-colors duration-fast',
          'text-left'
        )}
      >
        <div className="flex items-center gap-3">
          <svg
            className={cn(
              'w-5 h-5 text-wl-text-secondary transition-transform duration-fast',
              isExpanded && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <div>
            <p className="text-sm font-medium text-wl-text-primary">{items.length} Line Items</p>
            <p className="text-xs text-wl-text-tertiary">Total: {formatCurrency(total)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-wl-text-primary">{formatCurrency(total)}</p>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border border-wl-border-subtle rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-wl-bg-surface border-b border-wl-border-subtle px-4 py-3 grid grid-cols-12 gap-3">
            <div className="col-span-5 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
              Description
            </div>
            <div className="col-span-1 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary text-center">
              Qty
            </div>
            <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary text-right">
              Unit Price
            </div>
            <div className="col-span-1 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary text-center">
              Tax
            </div>
            <div className="col-span-3 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary text-right">
              Amount
            </div>
          </div>

          {/* Line Items */}
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-wl-text-tertiary">No line items</p>
            </div>
          ) : (
            <div>
              {items.map((item, index) => {
                const itemTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'border-b border-wl-border-subtle px-4 py-3',
                      'grid grid-cols-12 gap-3 items-center',
                      'hover:bg-wl-bg-overlay transition-colors duration-fast',
                      index === items.length - 1 && 'border-b-0'
                    )}
                  >
                    <div className="col-span-5 text-sm text-wl-text-primary">{item.description}</div>
                    <div className="col-span-1 text-sm text-wl-text-primary text-center">{item.quantity}</div>
                    <div className="col-span-2 text-sm text-wl-text-primary text-right">
                      {formatCurrency(item.unitPrice)}
                    </div>
                    <div className="col-span-1 text-sm text-wl-text-primary text-center">{item.taxRate}%</div>
                    <div className="col-span-3 text-sm font-semibold text-wl-text-primary text-right">
                      {formatCurrency(itemTotal)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Totals */}
          <div className="bg-wl-bg-surface border-t border-wl-border-subtle px-4 py-3 space-y-2">
            <div className="flex justify-end gap-8 text-sm">
              <div>
                <span className="text-wl-text-secondary">Subtotal: </span>
                <span className="font-medium text-wl-text-primary">{formatCurrency(subtotal)}</span>
              </div>
              <div>
                <span className="text-wl-text-secondary">Tax: </span>
                <span className="font-medium text-wl-text-primary">{formatCurrency(taxTotal)}</span>
              </div>
              <div className="bg-wl-primary-500/10 px-3 py-1 rounded">
                <span className="text-wl-text-secondary">Total: </span>
                <span className="font-bold text-wl-primary-400">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

InvoiceLineItemsDisplay.displayName = 'InvoiceLineItemsDisplay';
