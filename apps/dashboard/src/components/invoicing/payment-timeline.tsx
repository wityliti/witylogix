"use client";

import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import type { Payment } from "./types";

interface PaymentTimelineProps extends HTMLAttributes<HTMLDivElement> {
  payments: Payment[];
  startingBalance?: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMethodIcon(method: string) {
  switch (method) {
    case "card":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2H3V4zm0 5v9a1 1 0 001 1h16a1 1 0 001-1V9H3zm8 4h2v2h-2v-2z" />
        </svg>
      );
    case "bank":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 6h18M3 10v6h18v-6M5 16h2v2H5v-2zm6 0h2v2h-2v-2zm6 0h2v2h-2v-2zm6 0h2v2h-2v-2zM2 6h20L12 2 2 6z" />
        </svg>
      );
    case "cash":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
        </svg>
      );
    case "check":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 9l-4-4-1.4 1.4L14 15l8-8-1.4-1.4z" />
        </svg>
      );
    default:
      return null;
  }
}

export const PaymentTimeline = forwardRef<HTMLDivElement, PaymentTimelineProps>(
  ({ payments, startingBalance = 0, className, ...props }, ref) => {
    if (payments.length === 0) {
      return (
        <div ref={ref} className={cn("px-8 py-12 text-center", className)} {...props}>
          <p className="text-wl-text-tertiary text-sm">No payment history yet</p>
        </div>
      );
    }

    // Calculate running balance
    const paymentWithBalance = payments.map((payment, index) => {
      const previousBalance = index === 0 ? startingBalance : paymentWithBalance[index - 1].balance;
      const newBalance = previousBalance - (payment.status === "completed" ? payment.amount : 0);
      return { ...payment, balance: newBalance };
    });

    return (
      <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {/* Timeline */}
        <div className="relative">
          {paymentWithBalance.map((payment, index) => {
            const isCompleted = payment.status === "completed";
            const isFailed = payment.status === "failed";
            const isRefunded = payment.status === "refunded";
            const isLast = index === paymentWithBalance.length - 1;

            return (
              <div key={payment.id} className="flex gap-4 pb-6 relative">
                {/* Timeline dot and line */}
                <div className="absolute left-5 top-10 w-0.5 h-[calc(100%-40px)] bg-wl-border-subtle" />

                {/* Dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      isCompleted && "bg-wl-success-500 border-wl-success-600",
                      isFailed && "bg-wl-danger-500 border-wl-danger-600",
                      isRefunded && "bg-wl-neutral-400 border-wl-neutral-500",
                      !isCompleted && !isFailed && !isRefunded && "bg-wl-primary-500 border-wl-primary-600"
                    )}
                  >
                    {isCompleted && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                    {isFailed && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-wl-text-primary">
                          {formatCurrency(payment.amount)}
                        </span>
                        <Badge
                          variant={
                            isCompleted
                              ? "success"
                              : isFailed
                                ? "danger"
                                : isRefunded
                                  ? "default"
                                  : "info"
                          }
                          className="text-xs"
                        >
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-wl-text-secondary">
                        {formatDate(payment.processedAt)}
                      </p>
                    </div>

                    {/* Payment method icon */}
                    <div className="flex-shrink-0 text-wl-text-tertiary">
                      {getMethodIcon(payment.method)}
                    </div>
                  </div>

                  {/* Reference and details */}
                  <div className="bg-wl-bg-surface border border-wl-border-subtle rounded p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Reference:</span>
                      <span className="font-mono text-wl-text-primary">{payment.referenceNumber}</span>
                    </div>

                    {payment.completedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-wl-text-secondary">Completed:</span>
                        <span className="text-wl-text-secondary">{formatDate(payment.completedAt)}</span>
                      </div>
                    )}

                    {/* Running balance */}
                    <div className="flex items-center justify-between pt-1 border-t border-wl-border-subtle">
                      <span className="text-wl-text-secondary">Running Balance:</span>
                      <span className="font-semibold text-wl-text-primary">
                        {formatCurrency(payment.balance)}
                      </span>
                    </div>
                  </div>

                  {/* Partial payment indicator */}
                  {payment.amount < 100 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-wl-warning-400">
                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                      </svg>
                      <span>Partial payment</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-wl-border-subtle">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-wl-bg-surface rounded-lg px-3 py-2">
              <p className="text-xs text-wl-text-secondary mb-1">Total Received</p>
              <p className="font-semibold text-wl-text-primary">
                {formatCurrency(
                  paymentWithBalance.reduce((sum, p) => sum + (p.status === "completed" ? p.amount : 0), 0)
                )}
              </p>
            </div>
            <div className="bg-wl-bg-surface rounded-lg px-3 py-2">
              <p className="text-xs text-wl-text-secondary mb-1">Current Balance</p>
              <p className="font-semibold text-wl-text-primary">
                {formatCurrency(paymentWithBalance[paymentWithBalance.length - 1]?.balance || 0)}
              </p>
            </div>
            <div className="bg-wl-bg-surface rounded-lg px-3 py-2">
              <p className="text-xs text-wl-text-secondary mb-1">Payment Count</p>
              <p className="font-semibold text-wl-text-primary">
                {paymentWithBalance.filter((p) => p.status === "completed").length}/{paymentWithBalance.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PaymentTimeline.displayName = "PaymentTimeline";

export { PaymentTimeline };
