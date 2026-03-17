"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import {
  Printer,
  RotateCcw,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku?: string;
}

interface POSReceiptProps extends HTMLAttributes<HTMLDivElement> {
  receiptNumber: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  cashierName?: string;
  terminalId?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "mobile" | "check";
  transactionId: string;
  timestamp: string; // ISO string
  refundBadge?: boolean;
  voidBadge?: boolean;
  onPrint?: () => void;
  onRefund?: () => void;
  onVoid?: () => void;
  cardLastFour?: string;
  cardBrand?: string;
}

const paymentMethodLabels = {
  cash: "Cash",
  card: "Card",
  mobile: "Mobile Payment",
  check: "Check",
};

const POSReceipt = forwardRef<HTMLDivElement, POSReceiptProps>(
  (
    {
      receiptNumber,
      storeName,
      storeAddress,
      storePhone,
      cashierName,
      terminalId,
      items,
      subtotal,
      tax,
      total,
      paymentMethod,
      transactionId,
      timestamp,
      refundBadge = false,
      voidBadge = false,
      onPrint,
      onRefund,
      onVoid,
      cardLastFour,
      cardBrand,
      className,
      ...props
    },
    ref
  ) => {
    const [showOverlay, setShowOverlay] = useState(refundBadge || voidBadge);

    const receiptTime = new Date(timestamp);
    const formattedTime = receiptTime.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Calculate discounts if any items have reduced prices
    const totalRegular = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discount = Math.max(0, totalRegular - subtotal);

    const paymentLabel = paymentMethodLabels[paymentMethod];

    return (
      <Card
        ref={ref}
        className={cn(
          "relative max-w-sm mx-auto p-6 space-y-4 font-mono text-sm bg-white dark:bg-wl-bg-elevated",
          "border-2 border-dashed border-wl-border-subtle",
          className
        )}
        {...props}
      >
        {/* Receipt Overlay Badge */}
        {showOverlay && (refundBadge || voidBadge) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 z-20">
            <div className="relative">
              <div
                className={cn(
                  "px-4 py-2 rounded-lg font-semibold text-lg text-white transform -rotate-12 shadow-lg",
                  refundBadge ? "bg-wl-danger-500" : "bg-wl-text-secondary"
                )}
              >
                {refundBadge ? "REFUNDED" : "VOID"}
              </div>
              <button
                onClick={() => setShowOverlay(false)}
                className="absolute -top-2 -right-2 p-1 bg-wl-bg-elevated rounded-full hover:bg-wl-bg-surface transition-colors"
              >
                <X className="w-3 h-3 text-wl-text-primary" />
              </button>
            </div>
          </div>
        )}

        {/* Receipt Badges */}
        {(refundBadge || voidBadge) && (
          <div className="flex gap-2 justify-end">
            {refundBadge && (
              <Badge variant="danger" className="text-xs">
                REFUNDED
              </Badge>
            )}
            {voidBadge && (
              <Badge variant="default" className="text-xs">
                VOID
              </Badge>
            )}
          </div>
        )}

        {/* Header - Store Info */}
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold text-wl-text-primary">{storeName}</h2>
          {storeAddress && (
            <p className="text-xs text-wl-text-secondary">{storeAddress}</p>
          )}
          {storePhone && (
            <p className="text-xs text-wl-text-secondary">{storePhone}</p>
          )}
        </div>

        <div className="border-t border-b border-dashed border-wl-border-subtle py-2 text-center text-xs text-wl-text-secondary">
          <p>Receipt #{receiptNumber}</p>
          <p>{formattedTime}</p>
        </div>

        {/* Terminal & Cashier Info */}
        <div className="text-xs text-wl-text-secondary space-y-1">
          {terminalId && <p>Terminal: {terminalId}</p>}
          {cashierName && <p>Cashier: {cashierName}</p>}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-wl-border-subtle" />

        {/* Items */}
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-wl-text-primary font-medium">{item.name}</p>
                  {item.sku && (
                    <p className="text-xs text-wl-text-secondary">SKU: {item.sku}</p>
                  )}
                </div>
                <p className="text-wl-text-primary ml-2">
                  ${item.totalPrice.toFixed(2)}
                </p>
              </div>
              <p className="text-xs text-wl-text-secondary">
                {item.quantity} x ${item.unitPrice.toFixed(2)} @ ${item.totalPrice.toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-wl-border-subtle" />

        {/* Pricing Summary */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Subtotal:</span>
            <span className="text-wl-text-primary">${subtotal.toFixed(2)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-wl-success-400">
              <span>Discount:</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Tax:</span>
            <span className="text-wl-text-primary">${tax.toFixed(2)}</span>
          </div>

          <div className="border-t border-dashed border-wl-border-subtle pt-2 flex justify-between font-bold text-sm">
            <span className="text-wl-text-primary">Total:</span>
            <span className="text-wl-text-primary">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-wl-border-subtle" />

        {/* Payment Method */}
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Payment Method:</span>
            <span className="text-wl-text-primary font-medium">{paymentLabel}</span>
          </div>

          {paymentMethod === "card" && cardLastFour && (
            <div className="flex justify-between">
              <span className="text-wl-text-secondary">
                {cardBrand || "Card"}:
              </span>
              <span className="text-wl-text-primary font-medium">
                ****{cardLastFour}
              </span>
            </div>
          )}

          <div className="flex justify-between text-wl-text-secondary">
            <span>Transaction ID:</span>
            <span className="font-mono text-xs">{transactionId}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-wl-border-subtle" />

        {/* Footer Message */}
        <div className="text-center text-xs text-wl-text-secondary py-2">
          <p>Thank you for your purchase!</p>
          <p>Please retain receipt for returns/exchanges</p>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-wl-border-subtle" />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrint}
            className="flex-1 text-xs"
          >
            <Printer className="w-3 h-3 mr-1" />
            Print
          </Button>

          {!voidBadge && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefund}
              className="flex-1 text-xs"
              disabled={refundBadge}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Refund
            </Button>
          )}

          {!refundBadge && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onVoid}
              className="flex-1 text-xs"
              disabled={voidBadge}
            >
              <X className="w-3 h-3 mr-1" />
              Void
            </Button>
          )}
        </div>
      </Card>
    );
  }
);

POSReceipt.displayName = "POSReceipt";

export { POSReceipt };
export type { POSReceiptProps, ReceiptItem };
