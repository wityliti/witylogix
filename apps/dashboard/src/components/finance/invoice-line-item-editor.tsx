"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

interface LineItem {
  id: string;
  item: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

interface InvoiceLineItemEditorProps {
  items: LineItem[];
  currency?: "USD" | "EUR" | "GBP" | "CAD";
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  onItemsChange?: (items: LineItem[]) => void;
  onSubtotalChange?: (subtotal: number) => void;
  onTaxChange?: (tax: number) => void;
  onTotalChange?: (total: number) => void;
  onDiscountChange?: (type: "percentage" | "fixed", value: number) => void;
  readOnly?: boolean;
}

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function calculateAmount(quantity: number, unitPrice: number, taxRate: number): number {
  const subtotal = quantity * unitPrice;
  const tax = subtotal * (taxRate / 100);
  return subtotal + tax;
}

function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

const InvoiceLineItemInput = memo(
  ({
    item,
    onUpdate,
    onRemove,
    currency,
    readOnly,
    onKeyDown,
  }: {
    item: LineItem;
    onUpdate: (updates: Partial<LineItem>) => void;
    onRemove: () => void;
    currency: string;
    readOnly?: boolean;
    onKeyDown?: (field: string, e: React.KeyboardEvent) => void;
  }) => {
    return (
      <tr className="border-b border-wl-border-subtle hover:bg-wl-bg-overlay/50 transition-colors">
        {/* Item Name */}
        <td className="p-2">
          <input
            type="text"
            value={item.item}
            onChange={(e) => onUpdate({ item: e.target.value })}
            onKeyDown={(e) => onKeyDown?.("item", e)}
            readOnly={readOnly}
            placeholder="Item name"
            className={cn(
              "w-full px-2 py-1 rounded text-sm bg-wl-bg-elevated border border-wl-border-subtle",
              "text-wl-text-primary placeholder:text-wl-text-tertiary",
              "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50",
              readOnly && "bg-wl-bg-overlay cursor-not-allowed opacity-70"
            )}
          />
        </td>

        {/* Description */}
        <td className="p-2">
          <input
            type="text"
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            onKeyDown={(e) => onKeyDown?.("description", e)}
            readOnly={readOnly}
            placeholder="Description"
            className={cn(
              "w-full px-2 py-1 rounded text-sm bg-wl-bg-elevated border border-wl-border-subtle",
              "text-wl-text-primary placeholder:text-wl-text-tertiary",
              "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50",
              readOnly && "bg-wl-bg-overlay cursor-not-allowed opacity-70"
            )}
          />
        </td>

        {/* Quantity */}
        <td className="p-2 w-20">
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
            onKeyDown={(e) => onKeyDown?.("quantity", e)}
            readOnly={readOnly}
            className={cn(
              "w-full px-2 py-1 rounded text-sm text-right bg-wl-bg-elevated border border-wl-border-subtle",
              "text-wl-text-primary placeholder:text-wl-text-tertiary",
              "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50",
              readOnly && "bg-wl-bg-overlay cursor-not-allowed opacity-70"
            )}
          />
        </td>

        {/* Unit Price */}
        <td className="p-2 w-28">
          <div className="flex items-center">
            <span className="text-xs text-wl-text-tertiary mr-1">{currency}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => onUpdate({ unitPrice: parseFloat(e.target.value) || 0 })}
              onKeyDown={(e) => onKeyDown?.("unitPrice", e)}
              readOnly={readOnly}
              className={cn(
                "w-full px-2 py-1 rounded text-sm text-right bg-wl-bg-elevated border border-wl-border-subtle",
                "text-wl-text-primary placeholder:text-wl-text-tertiary",
                "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50",
                readOnly && "bg-wl-bg-overlay cursor-not-allowed opacity-70"
              )}
            />
          </div>
        </td>

        {/* Tax Rate */}
        <td className="p-2 w-20">
          <div className="flex items-center">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={item.taxRate}
              onChange={(e) => onUpdate({ taxRate: parseFloat(e.target.value) || 0 })}
              onKeyDown={(e) => onKeyDown?.("taxRate", e)}
              readOnly={readOnly}
              className={cn(
                "w-full px-2 py-1 rounded text-sm text-right bg-wl-bg-elevated border border-wl-border-subtle",
                "text-wl-text-primary placeholder:text-wl-text-tertiary",
                "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50",
                readOnly && "bg-wl-bg-overlay cursor-not-allowed opacity-70"
              )}
            />
            <span className="text-xs text-wl-text-tertiary ml-1">%</span>
          </div>
        </td>

        {/* Amount (Read-only) */}
        <td className="p-2 w-28 text-right">
          <span className="text-sm font-semibold text-wl-success-400">
            {formatCurrency(item.amount, currency)}
          </span>
        </td>

        {/* Remove Button */}
        <td className="p-2 w-12">
          {!readOnly && (
            <button
              onClick={onRemove}
              aria-label="Remove item"
              className="p-1 text-wl-danger-400 hover:bg-wl-danger-400/10 rounded transition-colors"
            >
              ✕
            </button>
          )}
        </td>
      </tr>
    );
  }
);

InvoiceLineItemInput.displayName = "InvoiceLineItemInput";

export const InvoiceLineItemEditor = memo(function InvoiceLineItemEditor({
  items: initialItems,
  currency = "USD",
  discountType = "percentage",
  discountValue = 0,
  onItemsChange,
  onSubtotalChange,
  onTaxChange,
  onTotalChange,
  onDiscountChange,
  readOnly = false,
}: InvoiceLineItemEditorProps) {
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [discount, setDiscount] = useState({ type: discountType, value: discountValue });

  const updateItem = useCallback(
    (index: number, updates: Partial<LineItem>) => {
      if (readOnly) return;

      const updatedItems = [...items];
      updatedItems[index] = { ...updatedItems[index], ...updates };

      // Auto-calculate amount
      const item = updatedItems[index];
      item.amount = calculateAmount(item.quantity, item.unitPrice, item.taxRate);

      setItems(updatedItems);
      onItemsChange?.(updatedItems);

      // Recalculate totals
      calculateTotals(updatedItems);
    },
    [items, readOnly, onItemsChange]
  );

  const calculateTotals = useCallback(
    (itemsToCalc: LineItem[]) => {
      const subtotal = itemsToCalc.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const taxTotal = itemsToCalc.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice * (i.taxRate / 100),
        0
      );

      let discountAmount = 0;
      if (discount.value > 0) {
        if (discount.type === "percentage") {
          discountAmount = (subtotal * discount.value) / 100;
        } else {
          discountAmount = discount.value;
        }
      }

      const total = subtotal + taxTotal - discountAmount;

      onSubtotalChange?.(subtotal);
      onTaxChange?.(taxTotal);
      onTotalChange?.(Math.max(0, total));
    },
    [discount, onSubtotalChange, onTaxChange, onTotalChange]
  );

  const removeItem = useCallback(
    (index: number) => {
      if (readOnly) return;
      const updatedItems = items.filter((_, i) => i !== index);
      setItems(updatedItems);
      onItemsChange?.(updatedItems);
      calculateTotals(updatedItems);
    },
    [items, readOnly, onItemsChange, calculateTotals]
  );

  const addItem = useCallback(() => {
    if (readOnly) return;
    const newItem: LineItem = {
      id: generateId(),
      item: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      amount: 0,
    };
    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    onItemsChange?.(updatedItems);
  }, [items, readOnly, onItemsChange]);

  const handleKeyDown = useCallback(
    (rowIndex: number, field: string, e: React.KeyboardEvent) => {
      // Tab key navigation
      if (e.key === "Tab") {
        const fields = ["item", "description", "quantity", "unitPrice", "taxRate"];
        const currentFieldIdx = fields.indexOf(field);

        if (e.shiftKey) {
          // Shift+Tab: move to previous field or previous row
          if (currentFieldIdx > 0) {
            e.preventDefault();
          }
        } else {
          // Tab: move to next field or next row
          if (currentFieldIdx === fields.length - 1 && rowIndex === items.length - 1) {
            e.preventDefault();
            addItem();
          }
        }
      }
    },
    [items.length, addItem]
  );

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const taxTotal = items.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice * (i.taxRate / 100),
      0
    );

    let discountAmount = 0;
    if (discount.value > 0) {
      if (discount.type === "percentage") {
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = discount.value;
      }
    }

    const total = subtotal + taxTotal - discountAmount;

    return {
      subtotal,
      taxTotal,
      discountAmount,
      total: Math.max(0, total),
    };
  }, [items, discount]);

  const handleDiscountChange = useCallback(
    (newType: "percentage" | "fixed", newValue: number) => {
      setDiscount({ type: newType, value: newValue });
      onDiscountChange?.(newType, newValue);
    },
    [onDiscountChange]
  );

  return (
    <div className="space-y-4">
      {/* Table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-wl-border-default bg-wl-bg-overlay">
            <tr>
              <th className="p-3 text-left font-semibold text-wl-text-primary">Item</th>
              <th className="p-3 text-left font-semibold text-wl-text-primary">Description</th>
              <th className="p-3 text-right font-semibold text-wl-text-primary w-20">Qty</th>
              <th className="p-3 text-right font-semibold text-wl-text-primary w-28">
                Unit Price
              </th>
              <th className="p-3 text-right font-semibold text-wl-text-primary w-20">Tax %</th>
              <th className="p-3 text-right font-semibold text-wl-text-primary w-28">Amount</th>
              <th className="p-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <InvoiceLineItemInput
                key={item.id}
                item={item}
                onUpdate={(updates) => updateItem(index, updates)}
                onRemove={() => removeItem(index)}
                currency={currency}
                readOnly={readOnly}
                onKeyDown={(field, e) => handleKeyDown(index, field, e)}
              />
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add Item Button */}
      {!readOnly && (
        <div className="flex justify-between items-center">
          <Button onClick={addItem} variant="secondary" size="sm">
            + Add Item
          </Button>
          <select
            value={currency}
            className={cn(
              "px-3 py-2 rounded text-sm bg-wl-bg-elevated border border-wl-border-subtle",
              "text-wl-text-primary",
              "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50"
            )}
            aria-label="Currency selector"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
      )}

      {/* Discount Section */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-wl-text-primary mb-2">
              Discount Type
            </label>
            <select
              value={discount.type}
              onChange={(e) =>
                handleDiscountChange(e.target.value as "percentage" | "fixed", discount.value)
              }
              disabled={readOnly}
              className={cn(
                "w-full px-3 py-2 rounded text-sm bg-wl-bg-elevated border border-wl-border-subtle",
                "text-wl-text-primary",
                "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50",
                readOnly && "opacity-70 cursor-not-allowed"
              )}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-wl-text-primary mb-2">
              Discount Value
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step={discount.type === "percentage" ? "0.1" : "0.01"}
                value={discount.value}
                onChange={(e) =>
                  handleDiscountChange(discount.type, parseFloat(e.target.value) || 0)
                }
                readOnly={readOnly}
                className={cn(
                  "flex-1 px-3 py-2 rounded text-sm text-right bg-wl-bg-elevated border border-wl-border-subtle",
                  "text-wl-text-primary",
                  "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/50",
                  readOnly && "opacity-70 cursor-not-allowed"
                )}
              />
              <span className="text-sm text-wl-text-secondary w-8">
                {discount.type === "percentage" ? "%" : currency}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs text-wl-text-secondary mb-1">Discount Amount</p>
            <p className="text-lg font-semibold text-wl-danger-400">
              -{formatCurrency(totals.discountAmount, currency)}
            </p>
          </div>
        </div>
      </Card>

      {/* Totals Section */}
      <Card>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-wl-text-secondary">Subtotal</span>
            <span className="font-semibold text-wl-text-primary">
              {formatCurrency(totals.subtotal, currency)}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-wl-text-secondary">Tax</span>
            <span className="font-semibold text-wl-text-primary">
              {formatCurrency(totals.taxTotal, currency)}
            </span>
          </div>

          {totals.discountAmount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-wl-text-secondary">Discount</span>
              <span className="font-semibold text-wl-danger-400">
                -{formatCurrency(totals.discountAmount, currency)}
              </span>
            </div>
          )}

          <div className="border-t border-wl-border-subtle pt-3 flex justify-between items-center">
            <span className="font-semibold text-wl-text-primary">Total</span>
            <span className="text-2xl font-bold text-wl-success-400">
              {formatCurrency(totals.total, currency)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
});

InvoiceLineItemEditor.displayName = "InvoiceLineItemEditor";
