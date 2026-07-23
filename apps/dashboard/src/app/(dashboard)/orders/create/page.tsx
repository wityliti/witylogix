'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApiList, useApiMutation } from '@/hooks/use-api';

interface ApiCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
}

interface LineItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Customer {
  id?: string;
  name: string;
  email: string;
  phone: string;
}

interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer>({ name: '', email: '', phone: '' });
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [address, setAddress] = useState<DeliveryAddress>({ street: '', city: '', state: '', zip: '' });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('9:00-13:00');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [priority, setPriority] = useState('normal');
  const [tags, setTags] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(50);
  const [newLineItem, setNewLineItem] = useState({
    productName: '',
    sku: '',
    quantity: 1,
    unitPrice: 0
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lineItemError, setLineItemError] = useState<string | null>(null);

  const { items: customers, loading: customersLoading, setSearch: setCustomerSearchApi } = useApiList<ApiCustomer>('/api/v4/customers', { limit: 10 });
  const { items: products, loading: productsLoading } = useApiList<ApiProduct>('/api/v4/products', { limit: 50 });
  const { execute: createOrder, loading: creating } = useApiMutation<{ id: string }>('POST', '/api/v4/orders');

  const addLineItem = () => {
    if (!newLineItem.productName || newLineItem.quantity <= 0 || newLineItem.unitPrice <= 0) {
      setLineItemError('Please fill product name, quantity, and unit price');
      return;
    }
    setLineItemError(null);
    const lineItem: LineItem = {
      id: Date.now().toString(),
      productName: newLineItem.productName,
      sku: newLineItem.sku,
      quantity: newLineItem.quantity,
      unitPrice: newLineItem.unitPrice,
      total: newLineItem.quantity * newLineItem.unitPrice
    };
    setLineItems([...lineItems, lineItem]);
    setNewLineItem({ productName: '', sku: '', quantity: 1, unitPrice: 0 });
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = Math.round(subtotal * (tax / 100));
  const discountAmount = Math.min(discount, subtotal);
  const total = subtotal + taxAmount + shipping - discountAmount;

  const getPriorityColor = (pri: string) => {
    const colors: Record<string, string> = {
      'normal': 'var(--wl-neutral-400)',
      'express': 'var(--wl-warning-500)',
      'same-day': 'var(--wl-danger-500)',
    };
    return colors[pri] || 'var(--wl-neutral-400)';
  };

  const buildPayload = (shopifyPrefix: string, extraTags: string[] = []) => ({
    shopifyOrderId: `${shopifyPrefix}-${Date.now()}`,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    addressLine1: address.street,
    addressCity: address.city,
    addressState: address.state,
    addressZip: address.zip,
    totalPrice: total,
    deliveryDate: deliveryDate || undefined,
    deliveryNotes: deliveryNotes || undefined,
    paymentMethod,
    priority: priority.toUpperCase(),
    tags: [...(tags ? tags.split(',').map(t => t.trim()) : []), ...extraTags],
    lineItems: lineItems.map(item => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  });

  const handleCreateOrder = async () => {
    if (!customer.name || !customer.email || !address.street || lineItems.length === 0) {
      setSubmitError('Please fill all required fields and add at least one line item');
      return;
    }
    setSubmitError(null);
    try {
      const result = await createOrder(buildPayload('MANUAL'));
      if (result?.id) {
        setSuccessOrderId(result.id);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create order');
    }
  };

  const handleSaveDraft = async () => {
    if (!customer.name) {
      setSubmitError('Please enter customer name');
      return;
    }
    setSubmitError(null);
    try {
      const result = await createOrder(buildPayload('DRAFT', ['draft']));
      if (result?.id) {
        setSuccessOrderId(result.id);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save draft');
    }
  };

  if (successOrderId) {
    return (
      <div className="min-h-screen bg-wl-bg-root p-6 text-wl-text-primary flex items-center justify-center">
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-bold mb-2">Order Created</h2>
          <p className="text-wl-text-secondary text-sm mb-6">Order ID: {successOrderId}</p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/orders')}
              className="flex-1 px-4 py-2.5 rounded bg-wl-info-500 text-white font-semibold text-sm transition-all hover:bg-wl-primary-600"
            >
              View Orders
            </button>
            <button
              onClick={() => {
                setSuccessOrderId(null);
                setCustomer({ name: '', email: '', phone: '' });
                setAddress({ street: '', city: '', state: '', zip: '' });
                setLineItems([]);
                setTags('');
                setDeliveryNotes('');
              }}
              className="flex-1 px-4 py-2.5 rounded bg-transparent text-wl-info-500 font-semibold text-sm border border-wl-info-500 transition-all hover:bg-wl-info-500 hover:text-white"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-root p-6 text-wl-text-primary">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Create Order</h1>
        <p className="text-sm text-wl-text-secondary">Create and manage new orders with customer and delivery information</p>
      </div>

      {submitError && (
        <div className="mb-6 p-4 bg-wl-danger-bg border border-wl-danger-500 rounded text-wl-danger-400 text-sm">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fit,minmax(400px,1fr))] mb-6">
        {/* Customer Section */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6">
          <h3 className="text-base font-semibold mb-4 text-wl-text-primary">Customer Information</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-2">Customer Type</label>
            <div className="flex gap-5 mb-4">
              {[
                { checked: isNewCustomer, label: 'New Customer' },
                { checked: !isNewCustomer, label: 'Existing Customer' }
              ].map((opt, idx) => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer text-sm text-wl-text-secondary">
                  <input
                    type="radio"
                    checked={opt.checked}
                    onChange={() => setIsNewCustomer(opt.label === 'New Customer')}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {!isNewCustomer ? (
            <div className="mb-4 relative">
              <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Search Customer</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
                placeholder="Search by name or email..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerSearchApi(e.target.value);
                }}
              />
              {customerSearch && customersLoading && (
                <div className="absolute bg-wl-bg-surface border border-wl-border-default rounded mt-1 z-10 w-full p-3 text-sm text-wl-text-secondary">
                  Searching…
                </div>
              )}
              {customerSearch && !customersLoading && customers.length > 0 && (
                <div className="absolute bg-wl-bg-surface border border-wl-border-default rounded mt-1 z-10 max-h-52 overflow-y-auto w-full">
                  {customers.map(c => (
                    <div
                      key={c.id}
                      className="p-3 cursor-pointer border-b border-wl-border-default hover:bg-wl-bg-root text-sm text-wl-text-secondary"
                      onClick={() => {
                        setCustomer({ id: c.id, name: c.name, email: c.email, phone: c.phone });
                        setCustomerSearch('');
                        setCustomerSearchApi('');
                      }}
                    >
                      <p className="font-medium text-wl-text-primary">{c.name}</p>
                      <p className="text-xs text-wl-text-secondary">{c.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Full Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder="Enter customer name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Email *</label>
            <input
              type="email"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder="customer@example.com"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Phone Number</label>
            <input
              type="tel"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder="+91-9876543210"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6">
          <h3 className="text-base font-semibold mb-4 text-wl-text-primary">Delivery Address</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Street Address *</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder="Enter street address"
              value={address.street}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">City *</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder="Enter city"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">State *</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
                placeholder="Enter state"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Zip Code *</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
                placeholder="Enter zip code"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Delivery Preferences */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6">
          <h3 className="text-base font-semibold mb-4 text-wl-text-primary">Delivery Preferences</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Preferred Delivery Date</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Time Slot</label>
            <select
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
            >
              <option value="9:00-13:00">9:00 AM - 1:00 PM</option>
              <option value="13:00-17:00">1:00 PM - 5:00 PM</option>
              <option value="17:00-21:00">5:00 PM - 9:00 PM</option>
              <option value="flexible">Flexible (Any time)</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Delivery Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm min-h-20 font-inherit box-border focus:outline-none focus:border-wl-info-500"
              placeholder="Add special delivery instructions..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Payment & Priority */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6">
          <h3 className="text-base font-semibold mb-4 text-wl-text-primary">Payment & Priority</h3>

          <div className="mb-5">
            <label className="block text-sm font-medium text-wl-text-secondary mb-2.5">Payment Method</label>
            <div className="flex flex-col gap-2.5">
              {['cod', 'prepaid', 'invoice'].map(method => (
                <label key={method} className="flex items-center gap-2 cursor-pointer text-sm text-wl-text-secondary">
                  <input
                    type="radio"
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  {method === 'cod' ? 'Cash on Delivery' : method === 'prepaid' ? 'Prepaid' : 'Invoice'}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-wl-text-secondary mb-2.5">Priority</label>
            <div className="flex gap-2.5 flex-wrap mb-2.5">
              {['normal', 'express', 'same-day'].map(pri => (
                <button
                  key={pri}
                  onClick={() => setPriority(pri)}
                  className={cn(
                    'px-4 py-2 rounded border text-sm font-semibold transition-all',
                    priority === pri
                      ? 'bg-wl-info-500 text-white border-wl-info-500'
                      : 'bg-transparent text-wl-info-500 border-wl-info-500'
                  )}
                >
                  {pri === 'normal' ? 'Normal' : pri === 'express' ? 'Express' : 'Same Day'}
                </button>
              ))}
            </div>
            <div className="mt-2.5">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ color: getPriorityColor(priority), background: `color-mix(in srgb, ${getPriorityColor(priority)} 13%, transparent)` }}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder="e.g., VIP, Fragile, Gift Wrap"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6 mb-6">
        <h3 className="text-base font-semibold mb-4 text-wl-text-primary">Line Items</h3>

        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-2.5 mb-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Product Name</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder={productsLoading ? 'Loading products…' : 'Search product…'}
              value={newLineItem.productName}
              onChange={(e) => {
                const product = products.find(p => p.name === e.target.value);
                setNewLineItem({
                  ...newLineItem,
                  productName: e.target.value,
                  sku: product?.sku || newLineItem.sku,
                  unitPrice: product?.price || newLineItem.unitPrice
                });
              }}
              list="products"
            />
            <datalist id="products">
              {products.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">SKU</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border"
              placeholder="SKU"
              value={newLineItem.sku}
              onChange={(e) => setNewLineItem({ ...newLineItem, sku: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Quantity</label>
            <input
              type="number"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              min="1"
              value={newLineItem.quantity}
              onChange={(e) => setNewLineItem({ ...newLineItem, quantity: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Unit Price</label>
            <input
              type="number"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
              min="0"
              value={newLineItem.unitPrice}
              onChange={(e) => setNewLineItem({ ...newLineItem, unitPrice: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">&nbsp;</label>
            <button
              onClick={addLineItem}
              className="w-full px-4 py-2.5 rounded bg-wl-info-500 text-white font-semibold text-sm transition-all hover:bg-wl-primary-600"
            >
              Add
            </button>
          </div>
        </div>
        {lineItemError && (
          <p className="text-wl-danger-400 text-xs -mt-2 mb-3">{lineItemError}</p>
        )}

        {lineItems.length > 0 && (
          <table className="w-full border-collapse mt-4 mb-5">
            <thead>
              <tr>
                {['Product', 'SKU', 'Qty', 'Unit Price', 'Total', 'Action'].map(h => (
                  <th key={h} className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left text-xs font-semibold text-wl-text-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map(item => (
                <tr key={item.id}>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-text-secondary">{item.productName}</td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-text-secondary">{item.sku}</td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-text-secondary">{item.quantity}</td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-text-secondary">₹{item.unitPrice.toLocaleString()}</td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-text-secondary">₹{item.total.toLocaleString()}</td>
                  <td className="border-b border-wl-border-default p-3 text-sm">
                    <button
                      onClick={() => removeLineItem(item.id)}
                      className="px-2.5 py-1.5 rounded bg-wl-danger-500 text-white font-semibold text-xs transition-all hover:bg-wl-danger-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Order Totals */}
        <div className="border-t border-wl-border-default pt-4">
          <div className="flex justify-between py-2 text-sm text-wl-text-secondary">
            <span>Subtotal:</span>
            <span className="font-semibold">₹{subtotal.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-4 mt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Tax (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
                min="0"
                max="100"
                value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text-secondary mb-1.5">Discount (₹)</label>
              <input
                type="number"
                className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-secondary text-sm box-border focus:outline-none focus:border-wl-info-500"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex justify-between py-2 text-sm text-wl-text-secondary">
            <span>Tax ({tax}%):</span>
            <span className="font-semibold">₹{taxAmount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between py-2 text-sm text-wl-text-secondary">
            <span>Shipping:</span>
            <span className="font-semibold">₹{shipping.toLocaleString()}</span>
          </div>

          <div className="flex justify-between py-2 text-sm text-wl-text-secondary">
            <span>Discount:</span>
            <span className="font-semibold">-₹{discountAmount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between py-4 border-t border-wl-border-default text-base font-bold text-wl-info-500">
            <span>Total Amount:</span>
            <span>₹{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={handleCreateOrder}
            disabled={creating}
            className={cn(
              "flex-1 px-4 py-2.5 rounded font-semibold text-sm transition-all",
              creating ? "bg-wl-info-500 text-white opacity-50 cursor-not-allowed" : "bg-wl-info-500 text-white hover:bg-wl-primary-600"
            )}
          >
            {creating ? 'Creating...' : 'Create Order'}
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={creating}
            className="flex-1 px-4 py-2.5 rounded bg-transparent text-wl-info-500 font-semibold text-sm border border-wl-info-500 transition-all hover:bg-wl-info-500 hover:text-white disabled:opacity-50"
          >
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}
