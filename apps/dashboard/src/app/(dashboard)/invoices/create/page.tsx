"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Eye,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { api } from '@/lib/api';
import { useApiList } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';

type BillingRuleType = "per-delivery" | "per-mile" | "per-hour" | "flat-rate" | "tiered" | "subscription";

interface Customer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  address: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxable: boolean;
}

function normalizeCustomer(raw: Record<string, unknown>): Customer {
  const firstName = String(raw.firstName || '');
  const lastName = String(raw.lastName || '');
  return {
    id: String(raw.id),
    name: [firstName, lastName].filter(Boolean).join(' ') || String(raw.email || raw.id),
    firstName,
    lastName,
    email: String(raw.email || ''),
    address: String(raw.addressLine1 || raw.address || ''),
  };
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { items: rawCustomers, loading: customersLoading } = useApiList<Record<string, unknown>>('/api/v4/customers', { limit: 100 });
  const realCustomers = useMemo(() => rawCustomers.map(normalizeCustomer), [rawCustomers]);

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [billingStartDate, setBillingStartDate] = useState("");
  const [billingEndDate, setBillingEndDate] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [billingRuleType, setBillingRuleType] = useState<BillingRuleType>(
    "per-delivery"
  );
  const [dueDate, setDueDate] = useState("");
  const [dueDatePreset, setDueDatePreset] = useState("net-30");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [taxRate, setTaxRate] = useState("10");
  const [discountPercentage, setDiscountPercentage] = useState("0");
  const [showPreview, setShowPreview] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return realCustomers;
    const search = customerSearch.toLowerCase();
    return realCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search)
    );
  }, [customerSearch, realCustomers]);

  // Calculate totals
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  }, [lineItems]);

  const discountAmount = useMemo(() => {
    return (subtotal * parseFloat(discountPercentage || "0")) / 100;
  }, [subtotal, discountPercentage]);

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = useMemo(() => {
    return (taxableAmount * parseFloat(taxRate || "0")) / 100;
  }, [taxableAmount, taxRate]);

  const total = useMemo(() => {
    return subtotal - discountAmount + taxAmount;
  }, [subtotal, discountAmount, taxAmount]);

  // Handle due date preset
  const handleDueDatePreset = useCallback(
    (preset: string) => {
      setDueDatePreset(preset);
      const today = new Date();
      let daysToAdd = 30;

      switch (preset) {
        case "net-30":
          daysToAdd = 30;
          break;
        case "net-60":
          daysToAdd = 60;
          break;
        case "net-90":
          daysToAdd = 90;
          break;
      }

      const newDate = new Date(today);
      newDate.setDate(newDate.getDate() + daysToAdd);
      setDueDate(newDate.toISOString().split("T")[0]);
    },
    []
  );

  // Line items management
  const addLineItem = useCallback(() => {
    const newItem: LineItem = {
      id: `li-${Date.now()}`,
      description: "",
      quantity: 1,
      rate: 0,
      taxable: true,
    };
    setLineItems([...lineItems, newItem]);
  }, [lineItems]);

  const removeLineItem = useCallback(
    (id: string) => {
      setLineItems(lineItems.filter((item) => item.id !== id));
    },
    [lineItems]
  );

  const updateLineItem = useCallback(
    (id: string, field: keyof LineItem, value: string | number) => {
      setLineItems(
        lineItems.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      );
    },
    [lineItems]
  );

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setShowCustomerModal(false);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      const payload = {
        status: 'draft' as const,
        customerId: selectedCustomer?.id,
        manualLineItems: lineItems.map(({ description, quantity, rate, taxable }) => ({
          description,
          quantity,
          unitPrice: rate,
          taxable,
        })),
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        taxRate: parseFloat(taxRate || '0'),
        discountPercentage: parseFloat(discountPercentage || '0'),
      };
      await api.post('/api/v4/invoices', payload);
      addToast({
        type: 'success',
        title: 'Draft saved',
        message: 'Your invoice draft has been saved.',
      });
      router.push('/dashboard/invoices');
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to save draft',
        message: err instanceof Error ? err.message : 'Could not save the draft. Please try again.',
      });
    } finally {
      setIsSavingDraft(false);
    }
  }, [selectedCustomer, lineItems, dueDate, notes, terms, taxRate, discountPercentage, isSavingDraft, addToast, router]);

  const handleSendInvoice = useCallback(async () => {
    if (!selectedCustomer || lineItems.length === 0) {
      addToast({
        type: 'error',
        title: 'Cannot create invoice',
        message: 'Please select a customer and add at least one line item.',
      });
      return;
    }
    if (isSending) return;
    setIsSending(true);
    try {
      const payload = {
        status: 'sent' as const,
        customerId: selectedCustomer.id,
        manualLineItems: lineItems.map(({ description, quantity, rate, taxable }) => ({
          description,
          quantity,
          unitPrice: rate,
          taxable,
        })),
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        taxRate: parseFloat(taxRate || '0'),
        discountPercentage: parseFloat(discountPercentage || '0'),
      };
      await api.post('/api/v4/invoices', payload);
      addToast({
        type: 'success',
        title: 'Invoice created',
        message: 'The invoice has been created and sent.',
      });
      router.push('/dashboard/invoices');
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to create invoice',
        message: err instanceof Error ? err.message : 'Could not create the invoice. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  }, [selectedCustomer, lineItems, dueDate, notes, terms, taxRate, discountPercentage, isSending, addToast, router]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-wl-bg-root min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-white">
              Create Invoice
            </h1>
            <p className="text-wl-text-secondary">
              Create and send a new invoice to your customer
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => setShowPreview(true)}>
            <Eye className="w-4 h-4" />
            Preview
          </Button>
          <Button variant="secondary" size="lg" onClick={handleSaveDraft} disabled={isSavingDraft || isSending}>
            {isSavingDraft ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button variant="primary" size="lg" onClick={handleSendInvoice} disabled={isSending || isSavingDraft}>
            <Check className="w-4 h-4" />
            {isSending ? 'Creating...' : 'Send'}
          </Button>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h2 className="text-lg font-semibold text-white mb-4">
              Customer
            </h2>

            {selectedCustomer ? (
              <div className={cn("flex items-center justify-between p-4 bg-wl-bg-elevated rounded border border-wl-border-default")}>
                <div>
                  <p className="font-semibold text-white">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-sm text-wl-text-secondary">
                    {selectedCustomer.email}
                  </p>
                  <p className="text-sm text-wl-text-secondary">
                    {selectedCustomer.address}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setShowCustomerModal(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4" />
                Select Customer
              </Button>
            )}
          </Card>

          {/* Billing Dates */}
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h2 className="text-lg font-semibold text-white mb-4">
              Billing Period
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Billing Start Date
                </label>
                <input
                  type="date"
                  value={billingStartDate}
                  onChange={(e) => setBillingStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Billing End Date
                </label>
                <input
                  type="date"
                  value={billingEndDate}
                  onChange={(e) => setBillingEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white"
                />
              </div>
            </div>
          </Card>

          {/* Billing Rule */}
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h2 className="text-lg font-semibold text-white mb-4">
              Billing Rule
            </h2>
            <Select
              value={billingRuleType}
              onChange={(e) => setBillingRuleType(e.target.value as BillingRuleType)}
              label="Rule Type"
              options={[
                { value: "per-delivery", label: "Per Delivery" },
                { value: "per-mile", label: "Per Mile" },
                { value: "per-hour", label: "Per Hour" },
                { value: "flat-rate", label: "Flat Rate" },
                { value: "tiered", label: "Tiered Pricing" },
                { value: "subscription", label: "Subscription" },
              ]}
            />
            <p className="mt-2 text-xs text-wl-text-secondary">
              {billingRuleType === "per-delivery" &&
                "Charge a fixed amount per delivery"}
              {billingRuleType === "per-mile" &&
                "Charge based on distance traveled"}
              {billingRuleType === "per-hour" &&
                "Charge based on time spent"}
              {billingRuleType === "flat-rate" &&
                "Charge a fixed amount regardless of metrics"}
              {billingRuleType === "tiered" &&
                "Apply tiered pricing based on quantity"}
              {billingRuleType === "subscription" &&
                "Recurring subscription billing"}
            </p>
          </Card>

          {/* Line Items */}
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Line Items
              </h2>
              <Button variant="secondary" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-wl-text-secondary">
                <p className="mb-3">No line items yet</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addLineItem}
                >
                  <Plus className="w-4 h-4" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn("flex gap-3 p-4 bg-wl-bg-elevated rounded border border-wl-border-default items-end")}
                  >
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(
                            item.id,
                            "description",
                            e.target.value
                          )
                        }
                        placeholder="Item description"
                        className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-white"
                      />
                    </div>

                    <div className="w-20">
                      <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(
                            item.id,
                            "quantity",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-white"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                        Rate
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) =>
                          updateLineItem(
                            item.id,
                            "rate",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-white"
                      />
                    </div>

                    <div className="w-20 text-right">
                      <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                        Amount
                      </label>
                      <p className="font-semibold text-white">
                        ${(item.quantity * item.rate).toFixed(2)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Due Date */}
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h2 className="text-lg font-semibold text-white mb-4">
              Due Date
            </h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={dueDatePreset === "net-30" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => handleDueDatePreset("net-30")}
                >
                  Net 30
                </Button>
                <Button
                  variant={dueDatePreset === "net-60" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => handleDueDatePreset("net-60")}
                >
                  Net 60
                </Button>
                <Button
                  variant={dueDatePreset === "net-90" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => handleDueDatePreset("net-90")}
                >
                  Net 90
                </Button>
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Custom Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setDueDatePreset("custom");
                  }}
                  className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white"
                />
              </div>
            </div>
          </Card>

          {/* Notes & Terms */}
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h2 className="text-lg font-semibold text-white mb-4">
              Notes & Terms
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for the customer..."
                  rows={3}
                  className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Terms & Conditions
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Add any terms and conditions..."
                  rows={3}
                  className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-sm text-white"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Pricing Summary */}
          <Card className={cn("p-6 sticky top-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h2 className="text-lg font-semibold text-white mb-6">
              Invoice Summary
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-wl-text-secondary">Subtotal</span>
                <span className="font-medium text-white">
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              {parseFloat(discountPercentage) > 0 && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-wl-text-secondary">
                      Discount ({discountPercentage}%)
                    </span>
                    <span className="font-medium text-emerald-600">
                      -${discountAmount.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    className="w-full px-2 py-1 bg-wl-bg-elevated border border-wl-border-default rounded text-xs text-white"
                  />
                </div>
              )}

              {parseFloat(discountPercentage) === 0 && (
                <div>
                  <label className="block text-xs font-medium text-wl-text-secondary mb-2">
                    Discount %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    className="w-full px-2 py-1 bg-wl-bg-elevated border border-wl-border-default rounded text-xs text-white"
                  />
                </div>
              )}

              <div className="border-t border-wl-border-default pt-3">
                <div className="flex justify-between mb-2">
                  <span className="text-wl-text-secondary">
                    Tax ({taxRate}%)
                  </span>
                  <span className="font-medium text-white">
                    ${taxAmount.toFixed(2)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full px-2 py-1 bg-wl-bg-elevated border border-wl-border-default rounded text-xs text-white"
                />
              </div>

              <div className="border-t-2 border-wl-border-default pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-white">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-blue-500">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <Modal
          isOpen={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          title="Select Customer"
        >
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <Input
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              icon={null}
            />

            {customersLoading ? (
              <p className="text-center py-6 text-wl-text-secondary">
                Loading customers...
              </p>
            ) : filteredCustomers.length === 0 ? (
              <p className="text-center py-6 text-wl-text-secondary">
                No customers found
              </p>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className={cn("w-full text-left p-3 rounded border border-wl-border-default hover:bg-wl-bg-elevated transition-colors")}
                  >
                    <p className="font-medium text-white">
                      {customer.name}
                    </p>
                    <p className="text-sm text-wl-text-secondary">
                      {customer.email}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Invoice Preview"
        >
          <div className="max-h-96 overflow-y-auto">
            <div className="bg-white p-6 rounded text-gray-900 space-y-4">
              {selectedCustomer && (
                <div>
                  <p className="font-bold text-lg">{selectedCustomer.name}</p>
                  <p className="text-sm">{selectedCustomer.email}</p>
                  <p className="text-sm">{selectedCustomer.address}</p>
                </div>
              )}

              {lineItems.length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Description</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Rate</th>
                      <th className="text-right py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">${item.rate.toFixed(2)}</td>
                        <td className="text-right">
                          ${(item.quantity * item.rate).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="border-t pt-4 space-y-2 text-right">
                <div className="flex justify-end gap-4">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {parseFloat(discountPercentage) > 0 && (
                  <div className="flex justify-end gap-4 text-green-600">
                    <span>Discount:</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-end gap-4">
                  <span>Tax:</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-4 font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
