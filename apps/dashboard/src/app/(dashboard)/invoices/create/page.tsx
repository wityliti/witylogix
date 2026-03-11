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

type BillingRuleType = "per-delivery" | "per-mile" | "per-hour" | "flat-rate" | "tiered" | "subscription";

interface Customer {
  id: string;
  name: string;
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

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cust-001",
    name: "Acme Corporation",
    email: "billing@acme.com",
    address: "123 Business Ave, New York, NY 10001",
  },
  {
    id: "cust-002",
    name: "Beta Inc",
    email: "finance@beta.com",
    address: "456 Commerce St, San Francisco, CA 94105",
  },
  {
    id: "cust-003",
    name: "Gamma Ltd",
    email: "accounting@gamma.co.uk",
    address: "789 Enterprise Rd, London, UK EC1A 1BB",
  },
  {
    id: "cust-004",
    name: "Delta Logistics",
    email: "billing@delta.com",
    address: "321 Logistics Way, Chicago, IL 60601",
  },
  {
    id: "cust-005",
    name: "Echo Distribution",
    email: "invoices@echo.com",
    address: "654 Distribution Blvd, Los Angeles, CA 90001",
  },
];

export default function CreateInvoicePage() {
  const router = useRouter();

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

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return MOCK_CUSTOMERS;
    const search = customerSearch.toLowerCase();
    return MOCK_CUSTOMERS.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search)
    );
  }, [customerSearch]);

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
    (id: string, field: keyof LineItem, value: any) => {
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

  const handleSaveDraft = useCallback(() => {
    console.log("Saving invoice as draft", {
      customer: selectedCustomer,
      lineItems,
      dueDate,
      notes,
      terms,
    });
    // TODO: API call
    router.push("/dashboard/invoices");
  }, [selectedCustomer, lineItems, dueDate, notes, terms, router]);

  const handleSendInvoice = useCallback(() => {
    if (!selectedCustomer || lineItems.length === 0) {
      alert("Please select a customer and add line items");
      return;
    }
    console.log("Sending invoice", {
      customer: selectedCustomer,
      lineItems,
      dueDate,
      notes,
      terms,
    });
    // TODO: API call
    router.push("/dashboard/invoices");
  }, [selectedCustomer, lineItems, dueDate, notes, terms, router]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-wl-text-primary">
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
          <Button variant="secondary" size="lg" onClick={handleSaveDraft}>
            Save Draft
          </Button>
          <Button variant="primary" size="lg" onClick={handleSendInvoice}>
            <Check className="w-4 h-4" />
            Send
          </Button>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              Customer
            </h2>

            {selectedCustomer ? (
              <div className="flex items-center justify-between p-4 bg-wl-bg-surface rounded border border-wl-border-subtle">
                <div>
                  <p className="font-semibold text-wl-text-primary">
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
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
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
                  className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-wl-text-primary"
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
                  className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-wl-text-primary"
                />
              </div>
            </div>
          </Card>

          {/* Billing Rule */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              Billing Rule
            </h2>
            <Select
              value={billingRuleType}
              onChange={(value) => setBillingRuleType(value as BillingRuleType)}
              label="Rule Type"
            >
              <option value="per-delivery">Per Delivery</option>
              <option value="per-mile">Per Mile</option>
              <option value="per-hour">Per Hour</option>
              <option value="flat-rate">Flat Rate</option>
              <option value="tiered">Tiered Pricing</option>
              <option value="subscription">Subscription</option>
            </Select>
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
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-wl-text-primary">
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
                    className="flex gap-3 p-4 bg-wl-bg-surface rounded border border-wl-border-subtle items-end"
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
                        className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-sm text-wl-text-primary"
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
                        className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-sm text-wl-text-primary"
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
                        className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-sm text-wl-text-primary"
                      />
                    </div>

                    <div className="w-20 text-right">
                      <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                        Amount
                      </label>
                      <p className="font-semibold text-wl-text-primary">
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
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
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
                  className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-wl-text-primary"
                />
              </div>
            </div>
          </Card>

          {/* Notes & Terms */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
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
                  className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-sm text-wl-text-primary"
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
                  className="w-full px-3 py-2 bg-wl-bg-inverse border border-wl-border-subtle rounded text-sm text-wl-text-primary"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Pricing Summary */}
          <Card className="p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-6">
              Invoice Summary
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-wl-text-secondary">Subtotal</span>
                <span className="font-medium text-wl-text-primary">
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              {parseFloat(discountPercentage) > 0 && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-wl-text-secondary">
                      Discount ({discountPercentage}%)
                    </span>
                    <span className="font-medium text-green-600">
                      -${discountAmount.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    className="w-full px-2 py-1 bg-wl-bg-inverse border border-wl-border-subtle rounded text-xs text-wl-text-primary"
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
                    className="w-full px-2 py-1 bg-wl-bg-inverse border border-wl-border-subtle rounded text-xs text-wl-text-primary"
                  />
                </div>
              )}

              <div className="border-t border-wl-border-subtle pt-3">
                <div className="flex justify-between mb-2">
                  <span className="text-wl-text-secondary">
                    Tax ({taxRate}%)
                  </span>
                  <span className="font-medium text-wl-text-primary">
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
                  className="w-full px-2 py-1 bg-wl-bg-inverse border border-wl-border-subtle rounded text-xs text-wl-text-primary"
                />
              </div>

              <div className="border-t-2 border-wl-border-subtle pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-wl-text-primary">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-wl-primary-500">
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

            {filteredCustomers.length === 0 ? (
              <p className="text-center py-6 text-wl-text-secondary">
                No customers found
              </p>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className="w-full text-left p-3 rounded border border-wl-border-subtle hover:bg-wl-bg-surface transition-colors"
                  >
                    <p className="font-medium text-wl-text-primary">
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
