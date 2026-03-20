'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApiMutation } from '@/hooks/use-api';

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

  const mockCustomers = [
    { id: '1', name: 'Rajesh Kumar', email: 'rajesh.kumar@email.com', phone: '+91-9876543210' },
    { id: '2', name: 'Priya Singh', email: 'priya.singh@email.com', phone: '+91-9876543211' },
    { id: '3', name: 'Amit Patel', email: 'amit.patel@email.com', phone: '+91-9876543212' }
  ];

  const mockProducts = [
    { name: 'Premium Bluetooth Speaker', sku: 'BS-001', price: 2499 },
    { name: 'USB-C Charging Cable', sku: 'USB-C-001', price: 499 },
    { name: 'Wireless Mouse', sku: 'WM-001', price: 1299 },
    { name: 'Laptop Stand', sku: 'LS-001', price: 1999 }
  ];

  const filteredCustomers = mockCustomers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const addLineItem = () => {
    if (!newLineItem.productName || newLineItem.quantity <= 0 || newLineItem.unitPrice <= 0) {
      alert('Please fill all line item fields');
      return;
    }

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
      'normal': '#8888a0',
      'express': '#ffa500',
      'same-day': '#ff4444'
    };
    return colors[pri] || '#8888a0';
  };

  const handleCreateOrder = () => {
    if (!customer.name || !customer.email || !address.street || lineItems.length === 0) {
      alert('Please fill all required fields');
      return;
    }
    alert(`Order created successfully! Total: ₹${total}`);
  };

  const handleSaveDraft = () => {
    alert('Order saved as draft');
  };

  return (
    <div className="min-h-screen bg-wl-bg p-5 text-wl-text">
      <div className="mb-8">
        <div className="text-4xl font-bold mb-2 text-wl-text">Create Order</div>
        <div className="text-sm text-wl-muted">Create and manage new orders with customer and delivery information</div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[repeat(auto-fit,minmax(400px,1fr))] mb-5">
        {/* Customer Section */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="text-base font-semibold mb-4 text-wl-text">Customer Information</div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-2">Customer Type</label>
            <div className="flex gap-5 mb-4">
              {[
                { checked: isNewCustomer, label: 'New Customer' },
                { checked: !isNewCustomer, label: 'Existing Customer' }
              ].map((opt, idx) => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer text-sm">
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text mb-1.5">Search Customer</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
                placeholder="Search by name or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customerSearch && (
                <div className="absolute bg-wl-surface border border-wl-border rounded mt-1 z-10 max-h-52 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      className="p-3 cursor-pointer border-b border-wl-border hover:bg-wl-bg text-sm"
                      onClick={() => {
                        setCustomer(c);
                        setCustomerSearch('');
                      }}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-wl-muted">{c.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Full Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="Enter customer name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Email *</label>
            <input
              type="email"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="customer@example.com"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Phone Number</label>
            <input
              type="tel"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="+91-9876543210"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="text-base font-semibold mb-4 text-wl-text">Delivery Address</div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Street Address *</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="Enter street address"
              value={address.street}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
            />
            <div className="text-xs text-wl-muted mt-1">Address autocomplete placeholder</div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">City *</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="Enter city"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text mb-1.5">State *</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
                placeholder="Enter state"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text mb-1.5">Zip Code *</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
                placeholder="Enter zip code"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Delivery Preferences */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="text-base font-semibold mb-4 text-wl-text">Delivery Preferences</div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Preferred Delivery Date</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Time Slot</label>
            <select
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
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
            <label className="block text-sm font-medium text-wl-text mb-1.5">Delivery Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm min-h-20 font-inherit box-border"
              placeholder="Add special delivery instructions..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Payment & Priority */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="text-base font-semibold mb-4 text-wl-text">Payment & Priority</div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-wl-text mb-2.5">Payment Method</label>
            <div className="flex flex-col gap-2.5">
              {['cod', 'prepaid', 'invoice'].map(method => (
                <label key={method} className="flex items-center gap-2 cursor-pointer text-sm">
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
            <label className="block text-sm font-medium text-wl-text mb-2.5">Priority</label>
            <div className="flex gap-2.5 flex-wrap mb-2.5">
              {['normal', 'express', 'same-day'].map(pri => (
                <button
                  key={pri}
                  onClick={() => setPriority(pri)}
                  className={cn(
                    'px-4 py-2 rounded border text-sm font-semibold transition-all',
                    priority === pri
                      ? 'bg-wl-primary text-white border-wl-primary'
                      : 'bg-transparent text-wl-primary border-wl-primary'
                  )}
                >
                  {pri === 'normal' ? 'Normal' : pri === 'express' ? 'Express' : 'Same Day'}
                </button>
              ))}
            </div>
            <div className="mt-2.5">
              <Badge
                label={priority.charAt(0).toUpperCase() + priority.slice(1)}
                color={getPriorityColor(priority)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="e.g., VIP, Fragile, Gift Wrap"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
        <div className="text-base font-semibold mb-4 text-wl-text">Line Items</div>

        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-2.5 mb-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Product Name</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="Search product..."
              value={newLineItem.productName}
              onChange={(e) => {
                const product = mockProducts.find(p => p.name === e.target.value);
                setNewLineItem({
                  ...newLineItem,
                  productName: e.target.value,
                  sku: product?.sku || '',
                  unitPrice: product?.price || 0
                });
              }}
              list="products"
            />
            <datalist id="products">
              {mockProducts.map(p => (
                <option key={p.sku} value={p.name} />
              ))}
            </datalist>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">SKU</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              placeholder="SKU"
              value={newLineItem.sku}
              readOnly
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Quantity</label>
            <input
              type="number"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              min="1"
              value={newLineItem.quantity}
              onChange={(e) => setNewLineItem({ ...newLineItem, quantity: parseInt(e.target.value) })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">Unit Price</label>
            <input
              type="number"
              className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
              min="0"
              value={newLineItem.unitPrice}
              onChange={(e) => setNewLineItem({ ...newLineItem, unitPrice: parseFloat(e.target.value) })}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1.5">&nbsp;</label>
            <button
              onClick={addLineItem}
              className="w-full px-4 py-2.5 rounded bg-wl-primary text-white font-semibold text-sm transition-all"
            >
              Add
            </button>
          </div>
        </div>

        {lineItems.length > 0 && (
          <table className="w-full border-collapse mt-4 mb-5">
            <thead>
              <tr>
                {['Product', 'SKU', 'Qty', 'Unit Price', 'Total', 'Action'].map(h => (
                  <th key={h} className="bg-wl-bg border-b border-wl-border p-3 text-left text-xs font-semibold text-wl-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map(item => (
                <tr key={item.id}>
                  <td className="border-b border-wl-border p-3 text-sm">{item.productName}</td>
                  <td className="border-b border-wl-border p-3 text-sm">{item.sku}</td>
                  <td className="border-b border-wl-border p-3 text-sm">{item.quantity}</td>
                  <td className="border-b border-wl-border p-3 text-sm">₹{item.unitPrice.toLocaleString()}</td>
                  <td className="border-b border-wl-border p-3 text-sm">₹{item.total.toLocaleString()}</td>
                  <td className="border-b border-wl-border p-3 text-sm">
                    <button
                      onClick={() => removeLineItem(item.id)}
                      className="px-2.5 py-1.5 rounded bg-red-400 text-white font-semibold text-xs transition-all"
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
        <div className="border-t border-wl-border pt-4">
          <div className="flex justify-between py-2 text-sm">
            <span>Subtotal:</span>
            <span className="font-semibold">₹{subtotal.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-4 mt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text mb-1.5">Tax (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
                min="0"
                max="100"
                value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value))}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-wl-text mb-1.5">Discount (₹)</label>
              <input
                type="number"
                className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-between py-2 text-sm">
            <span>Tax ({tax}%):</span>
            <span className="font-semibold">₹{taxAmount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between py-2 text-sm">
            <span>Shipping:</span>
            <span className="font-semibold">₹{shipping.toLocaleString()}</span>
          </div>

          <div className="flex justify-between py-2 text-sm">
            <span>Discount:</span>
            <span className="font-semibold">-₹{discountAmount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between py-4 border-t border-wl-border text-base font-bold text-wl-primary">
            <span>Total Amount:</span>
            <span>₹{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={handleCreateOrder}
            className="flex-1 px-4 py-2.5 rounded bg-wl-primary text-white font-semibold text-sm transition-all"
          >
            Create Order
          </button>
          <button
            onClick={handleSaveDraft}
            className="flex-1 px-4 py-2.5 rounded bg-transparent text-wl-primary font-semibold text-sm border border-wl-primary transition-all"
          >
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}
