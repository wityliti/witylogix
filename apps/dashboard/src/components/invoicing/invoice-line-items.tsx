"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button, Input, Badge, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { BadgeVariant } from "@/components/ui/badge";
import type { LineItem, BillingRule } from "./types";

interface InvoiceLineItemsProps {
  items: LineItem[];
  onItemsChange?: (items: LineItem[]) => void;
  onSubtotalChange?: (subtotal: number) => void;
  onTaxChange?: (tax: number) => void;
  onTotalChange?: (total: number) => void;
  readOnly?: boolean;
}

const billingRuleColors: Record<BillingRule, BadgeVariant> = {
  flat: "primary",
  hourly: "info",
  tiered: "warning",
  usage: "default",
};

const billingRuleLabels: Record<BillingRule, string> = {
  flat: "Flat",
  hourly: "Hourly",
  tiered: "Tiered",
  usage: "Usage",
};

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function calculateAmount(quantity: number, unitPrice: number, taxRate: number): number {
  const subtotal = quantity * unitPrice;
  const tax = subtotal * (taxRate / 100);
  return subtotal + tax;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function InvoiceLineItems({
  items,
  onItemsChange,
  onSubtotalChange,
  onTaxChange,
  onTotalChange,
  readOnly = false,
}: InvoiceLineItemsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const updateItem = useCallback(
    (index: number, updates: Partial<LineItem>) => {
      if (readOnly) return;
      const updatedItems = [...items];
      updatedItems[index] = { ...updatedItems[index], ...updates };

      // Auto-calculate amount
      const item = updatedItems[index];
      item.amount = calculateAmount(item.quantity, item.unitPrice, item.taxRate);

      onItemsChange?.(updatedItems);

      // Recalculate totals
      const subtotal = updatedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const taxTotal = updatedItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice * (i.taxRate / 100)), 0);
      const total = subtotal + taxTotal;

      onSubtotalChange?.(subtotal);
      onTaxChange?.(taxTotal);
      onTotalChange?.(total);
    },
    [items, readOnly, onItemsChange, onSubtotalChange, onTaxChange, onTotalChange]
  );

  const removeItem = useCallback(
    (index: number) => {
      if (readOnly) return;
      const updatedItems = items.filter((_, i) => i !== index);
      onItemsChange?.(updatedItems);

      // Recalculate totals
      const subtotal = updatedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const taxTotal = updatedItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice * (i.taxRate / 100)), 0);
      const total = subtotal + taxTotal;

      onSubtotalChange?.(subtotal);
      onTaxChange?.(taxTotal);
      onTotalChange?.(total);
    },
    [items, readOnly, onItemsChange, onSubtotalChange, onTaxChange, onTotalChange]
  );

  const addItem = useCallback(() => {
    if (readOnly) return;
    const newItem: LineItem = {
      id: generateId(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      billingRule: "flat",
      amount: 0,
    };
    onItemsChange?.([...items, newItem]);
  }, [items, readOnly, onItemsChange]);

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (readOnly) return;
      const updatedItems = [...items];
      const [movedItem] = updatedItems.splice(fromIndex, 1);
      updatedItems.splice(toIndex, 0, movedItem);
      onItemsChange?.(updatedItems);
    },
    [items, readOnly, onItemsChange]
  );

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100), 0);
  const total = subtotal + taxTotal;

  return (
    <div className="space-y-4">
      <div className="border border-wl-border-subtle rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-wl-bg-surface border-b border-wl-border-subtle px-4 py-3 grid grid-cols-12 gap-3">
          <div className="col-span-4 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
            Description
          </div>
          <div className="col-span-1 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
            Qty
          </div>
          <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
            Unit Price
          </div>
          <div className="col-span-1 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
            Tax %
          </div>
          <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
            Amount
          </div>
          <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
            Actions
          </div>
        </div>

        {/* Line items */}
        {items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-wl-text-tertiary text-sm">No line items yet</p>
          </div>
        ) : (
          <div>
            {items.map((item, index) => (
              <div
                key={item.id}
                draggable={!readOnly}
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={(e) => {
                  if (draggedIndex !== null && draggedIndex !== index) {
                    moveItem(draggedIndex, index);
                    setDraggedIndex(index);
                  }
                }}
                onDragEnd={() => setDraggedIndex(null)}
                className={cn(
                  "border-b border-wl-border-subtle px-4 py-3 grid grid-cols-12 gap-3 items-center",
                  "transition-colors duration-fast",
                  draggedIndex === index && "bg-wl-primary-500/10",
                  !readOnly && "cursor-move hover:bg-wl-bg-surface"
                )}
              >
                {/* Drag handle */}
                {!readOnly && (
                  <div className="col-span-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-wl-text-tertiary flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 7h8M8 12h8M8 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <Input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="Line item description"
                      disabled={readOnly}
                      className="flex-1"
                    />
                  </div>
                )}
                {readOnly && (
                  <div className="col-span-4 text-sm text-wl-text-primary">{item.description}</div>
                )}

                {/* Quantity */}
                <div className="col-span-1">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    disabled={readOnly}
                    min="0"
                    step="0.01"
                    className="text-center"
                  />
                </div>

                {/* Unit Price */}
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    disabled={readOnly}
                    min="0"
                    step="0.01"
                    className="text-right"
                  />
                </div>

                {/* Tax Rate */}
                <div className="col-span-1">
                  <Input
                    type="number"
                    value={item.taxRate}
                    onChange={(e) => updateItem(index, { taxRate: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    disabled={readOnly}
                    min="0"
                    max="100"
                    step="0.1"
                    className="text-center"
                  />
                </div>

                {/* Amount (auto-calculated) */}
                <div className="col-span-2">
                  <div className="text-sm font-semibold text-wl-text-primary text-right">
                    {formatCurrency(item.amount || 0)}
                  </div>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center gap-2">
                  {item.billingRule && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={billingRuleColors[item.billingRule]}>
                          {billingRuleLabels[item.billingRule]}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Billing Rule: {billingRuleLabels[item.billingRule]}</TooltipContent>
                    </Tooltip>
                  )}
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(index)}
                      title="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add button */}
      {!readOnly && (
        <Button size="sm" variant="ghost" onClick={addItem}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Line Item
        </Button>
      )}

      {/* Totals */}
      <div className="space-y-2 pt-4 border-t border-wl-border-subtle">
        <div className="flex justify-end gap-8">
          <div>
            <p className="text-sm text-wl-text-secondary">Subtotal:</p>
            <p className="text-lg font-semibold text-wl-text-primary">{formatCurrency(subtotal)}</p>
          </div>
          <div>
            <p className="text-sm text-wl-text-secondary">Tax:</p>
            <p className="text-lg font-semibold text-wl-text-primary">{formatCurrency(taxTotal)}</p>
          </div>
          <div className="bg-wl-primary-500/10 rounded-lg px-4 py-2 min-w-[120px]">
            <p className="text-sm text-wl-text-secondary">Total:</p>
            <p className="text-lg font-bold text-wl-primary-400">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
