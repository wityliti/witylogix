"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui";
import type { Invoice, InvoiceStatus } from "./types";

interface InvoiceTableProps {
  invoices: Invoice[];
  onSend?: (invoiceId: string) => void;
  onMarkPaid?: (invoiceId: string) => void;
  onDownload?: (invoiceId: string) => void;
  onEdit?: (invoiceId: string) => void;
  onDelete?: (invoiceId: string) => void;
}

const statusConfig: Record<InvoiceStatus, { variant: any; label: string }> = {
  draft: { variant: "default", label: "Draft" },
  sent: { variant: "info", label: "Sent" },
  paid: { variant: "success", label: "Paid" },
  overdue: { variant: "danger", label: "Overdue" },
  void: { variant: "warning", label: "Void" },
};

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

export function InvoiceTable({
  invoices,
  onSend,
  onMarkPaid,
  onDownload,
  onEdit,
  onDelete,
}: InvoiceTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc" | null;
  }>({ key: "", direction: null });

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  }, [invoices, selectedIds]);

  const handleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") {
          return { key, direction: "desc" };
        } else if (prev.direction === "desc") {
          return { key: "", direction: null };
        }
      }
      return { key, direction: "asc" };
    });
  }, []);

  const sortedInvoices = [...invoices].sort((a, b) => {
    if (!sortConfig.direction || !sortConfig.key) return 0;

    let aVal: any = a[sortConfig.key as keyof Invoice];
    let bVal: any = b[sortConfig.key as keyof Invoice];

    if (
      sortConfig.key === "amount" ||
      sortConfig.key === "dueDate" ||
      sortConfig.key === "issueDate"
    ) {
      aVal = typeof aVal === "string" ? new Date(aVal).getTime() : aVal;
      bVal = typeof bVal === "string" ? new Date(bVal).getTime() : bVal;
    }

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  if (invoices.length === 0) {
    return (
      <div className="border border-wl-border-subtle rounded-lg px-8 py-12 text-center">
        <svg
          className="w-12 h-12 mx-auto mb-4 text-wl-text-tertiary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-wl-text-secondary font-medium">No invoices yet</p>
        <p className="text-wl-text-tertiary text-sm mt-1">
          Create your first invoice to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-wl-primary-500/10 border border-wl-primary-500/20 rounded-lg">
          <span className="text-sm text-wl-text-secondary">
            {selectedIds.size} invoice{selectedIds.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelectedIds(new Set())}
            >
              Deselect
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-wl-border-subtle rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-wl-bg-surface border-b border-wl-border-subtle">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === invoices.length && invoices.length > 0
                  }
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded cursor-pointer"
                  aria-label="Select all invoices"
                />
              </th>
              {[
                { key: "invoiceNumber", label: "Invoice #" },
                { key: "customerName", label: "Customer" },
                { key: "amount", label: "Amount" },
                { key: "status", label: "Status" },
                { key: "issueDate", label: "Issue Date" },
                { key: "dueDate", label: "Due Date" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-wider",
                    "text-wl-text-secondary transition-colors duration-fast",
                    "cursor-pointer hover:text-wl-text-primary",
                  )}
                  style={{ userSelect: "none" }}
                >
                  <div className="flex items-center gap-2">
                    {label}
                    {sortConfig.key === key && (
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {sortConfig.direction === "asc" ? (
                          <path d="M7 14l5-5 5 5z" />
                        ) : (
                          <path d="M7 10l5 5 5-5z" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedInvoices.map((invoice, index) => (
              <tr
                key={invoice.id}
                className={cn(
                  "border-b border-wl-border-subtle transition-colors duration-fast",
                  index % 2 === 1 && "bg-wl-bg-surface",
                  selectedIds.has(invoice.id) && "bg-wl-primary-500/10",
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(invoice.id)}
                    onChange={() => handleSelectRow(invoice.id)}
                    className="w-4 h-4 rounded cursor-pointer"
                    aria-label={`Select invoice ${invoice.invoiceNumber}`}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-mono text-wl-text-primary">
                  {invoice.invoiceNumber}
                </td>
                <td className="px-4 py-3 text-sm text-wl-text-primary">
                  {invoice.customerName}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-wl-text-primary">
                  {formatCurrency(invoice.amount)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge variant={statusConfig[invoice.status].variant} dot>
                    {statusConfig[invoice.status].label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-wl-text-secondary">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="px-4 py-3 text-sm text-wl-text-secondary">
                  {formatDate(invoice.dueDate)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-1">
                    {invoice.status !== "paid" && (
                      <>
                        {invoice.status === "draft" && onSend && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onSend(invoice.id)}
                                title="Send invoice"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  />
                                </svg>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send</TooltipContent>
                          </Tooltip>
                        )}

                        {invoice.status === "sent" && onMarkPaid && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onMarkPaid(invoice.id)}
                                title="Mark as paid"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark Paid</TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    )}

                    {onDownload && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDownload(invoice.id)}
                            title="Download PDF"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>
                    )}

                    {onEdit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(invoice.id)}
                            title="Edit invoice"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    )}

                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(invoice.id)}
                            title="Delete invoice"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
