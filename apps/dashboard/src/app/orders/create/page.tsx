'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

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

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: 'var(--wl-bg)',
      padding: '20px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    header: {
      marginBottom: '30px'
    } as React.CSSProperties,
    title: {
      fontSize: '32px',
      fontWeight: '700',
      marginBottom: '8px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    subtitle: {
      fontSize: '14px',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: '20px',
      marginBottom: '20px'
    } as React.CSSProperties,
    sectionCard: {
      backgroundColor: 'var(--wl-surface)',
      border: '1px solid var(--wl-border)',
      borderRadius: '8px',
      padding: '20px'
    } as React.CSSProperties,
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '15px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    formGroup: {
      marginBottom: '15px'
    } as React.CSSProperties,
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '500',
      marginBottom: '6px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    input: {
      width: '100%',
      padding: '10px 12px',
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      color: 'var(--wl-text)',
      fontSize: '13px',
      boxSizing: 'border-box'
    } as React.CSSProperties,
    textarea: {
      width: '100%',
      padding: '10px 12px',
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      color: 'var(--wl-text)',
      fontSize: '13px',
      minHeight: '80px',
      fontFamily: 'inherit',
      boxSizing: 'border-box'
    } as React.CSSProperties,
    select: {
      width: '100%',
      padding: '10px 12px',
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      color: 'var(--wl-text)',
      fontSize: '13px',
      boxSizing: 'border-box'
    } as React.CSSProperties,
    radioGroup: {
      display: 'flex',
      gap: '20px',
      marginBottom: '15px'
    } as React.CSSProperties,
    radioLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      fontSize: '13px'
    } as React.CSSProperties,
    button: {
      padding: '10px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s'
    } as React.CSSProperties,
    primaryButton: {
      backgroundColor: 'var(--wl-primary)',
      color: '#ffffff',
      marginRight: '10px'
    } as React.CSSProperties,
    secondaryButton: {
      backgroundColor: 'transparent',
      color: 'var(--wl-primary)',
      border: '1px solid var(--wl-primary)'
    } as React.CSSProperties,
    dangerButton: {
      backgroundColor: '#ff4444',
      color: '#ffffff'
    } as React.CSSProperties,
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      marginTop: '15px'
    } as React.CSSProperties,
    tableHeader: {
      backgroundColor: 'var(--wl-bg)',
      borderBottom: '1px solid var(--wl-border)',
      padding: '12px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: '600',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    tableCell: {
      padding: '12px',
      borderBottom: '1px solid var(--wl-border)',
      fontSize: '13px'
    } as React.CSSProperties,
    totalsSection: {
      marginTop: '20px',
      paddingTop: '20px',
      borderTop: '1px solid var(--wl-border)'
    } as React.CSSProperties,
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '10px',
      fontSize: '13px'
    } as React.CSSProperties,
    totalValue: {
      fontWeight: '600',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    grandTotal: {
      display: 'flex',
      justifyContent: 'space-between',
      paddingTop: '15px',
      borderTop: '1px solid var(--wl-border)',
      fontSize: '16px',
      fontWeight: '700',
      color: 'var(--wl-primary)'
    } as React.CSSProperties,
    buttonGroup: {
      display: 'flex',
      gap: '10px',
      marginTop: '20px'
    } as React.CSSProperties,
    customerSearchResults: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: 'var(--wl-surface)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      marginTop: '4px',
      zIndex: 10,
      maxHeight: '200px',
      overflowY: 'auto' as const
    } as React.CSSProperties,
    customerOption: {
      padding: '10px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid var(--wl-border)',
      fontSize: '13px'
    } as React.CSSProperties,
    customerOptionHover: {
      backgroundColor: 'var(--wl-bg)'
    } as React.CSSProperties,
    productAutocomplete: {
      position: 'relative',
      marginBottom: '15px'
    } as React.CSSProperties,
    priorityBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: getPriorityColor(priority) + '20'
    } as React.CSSProperties
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Create Order</div>
        <div style={styles.subtitle}>Create and manage new orders with customer and delivery information</div>
      </div>

      <div style={styles.grid}>
        {/* Customer Section */}
        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>Customer Information</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Customer Type</label>
            <div style={styles.radioGroup}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={isNewCustomer}
                  onChange={() => setIsNewCustomer(true)}
                />
                New Customer
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={!isNewCustomer}
                  onChange={() => setIsNewCustomer(false)}
                />
                Existing Customer
              </label>
            </div>
          </div>

          {!isNewCustomer ? (
            <div style={styles.formGroup}>
              <label style={styles.label}>Search Customer</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Search by name or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customerSearch && (
                <div style={styles.customerSearchResults}>
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      style={styles.customerOption}
                      onClick={() => {
                        setCustomer(c);
                        setCustomerSearch('');
                      }}
                    >
                      <div style={{ fontWeight: '500' }}>{c.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--wl-muted)' }}>{c.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div style={styles.formGroup}>
            <label style={styles.label}>Full Name *</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter customer name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Email *</label>
            <input
              type="email"
              style={styles.input}
              placeholder="customer@example.com"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Phone Number</label>
            <input
              type="tel"
              style={styles.input}
              placeholder="+91-9876543210"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </div>
        </div>

        {/* Delivery Address */}
        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>Delivery Address</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Street Address *</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter street address"
              value={address.street}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
            />
            <div style={{ fontSize: '11px', color: 'var(--wl-muted)', marginTop: '4px' }}>
              Address autocomplete placeholder
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>City *</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter city"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>State *</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Enter state"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Zip Code *</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Enter zip code"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Delivery Preferences */}
        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>Delivery Preferences</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Preferred Delivery Date</label>
            <input
              type="date"
              style={styles.input}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Time Slot</label>
            <select
              style={styles.select}
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
            >
              <option value="9:00-13:00">9:00 AM - 1:00 PM</option>
              <option value="13:00-17:00">1:00 PM - 5:00 PM</option>
              <option value="17:00-21:00">5:00 PM - 9:00 PM</option>
              <option value="flexible">Flexible (Any time)</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Delivery Notes</label>
            <textarea
              style={styles.textarea}
              placeholder="Add special delivery instructions..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Payment & Priority */}
        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>Payment & Priority</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Payment Method</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['cod', 'prepaid', 'invoice'].map(method => (
                <label key={method} style={styles.radioLabel}>
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

          <div style={{ ...styles.formGroup, marginTop: '20px' }}>
            <label style={styles.label}>Priority</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['normal', 'express', 'same-day'].map(pri => (
                <button
                  key={pri}
                  onClick={() => setPriority(pri)}
                  style={{
                    ...styles.button,
                    backgroundColor: priority === pri ? 'var(--wl-primary)' : 'transparent',
                    color: priority === pri ? '#ffffff' : 'var(--wl-primary)',
                    border: '1px solid ' + getPriorityColor(pri)
                  }}
                >
                  {pri === 'normal' ? 'Normal' : pri === 'express' ? 'Express' : 'Same Day'}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '10px' }}>
              <Badge
                label={priority.charAt(0).toUpperCase() + priority.slice(1)}
                color={getPriorityColor(priority)}
              />
            </div>
          </div>

          <div style={{ ...styles.formGroup, marginTop: '20px' }}>
            <label style={styles.label}>Tags (comma-separated)</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g., VIP, Fragile, Gift Wrap"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionTitle}>Line Items</div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px', gap: '10px', marginBottom: '15px' }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Product Name</label>
            <input
              type="text"
              style={styles.input}
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

          <div style={styles.formGroup}>
            <label style={styles.label}>SKU</label>
            <input
              type="text"
              style={styles.input}
              placeholder="SKU"
              value={newLineItem.sku}
              readOnly
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Quantity</label>
            <input
              type="number"
              style={styles.input}
              min="1"
              value={newLineItem.quantity}
              onChange={(e) => setNewLineItem({ ...newLineItem, quantity: parseInt(e.target.value) })}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Unit Price</label>
            <input
              type="number"
              style={styles.input}
              min="0"
              value={newLineItem.unitPrice}
              onChange={(e) => setNewLineItem({ ...newLineItem, unitPrice: parseFloat(e.target.value) })}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>&nbsp;</label>
            <button
              onClick={addLineItem}
              style={{ ...styles.button, ...styles.primaryButton, width: '100%' }}
            >
              Add
            </button>
          </div>
        </div>

        {lineItems.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Product</th>
                <th style={styles.tableHeader}>SKU</th>
                <th style={styles.tableHeader}>Qty</th>
                <th style={styles.tableHeader}>Unit Price</th>
                <th style={styles.tableHeader}>Total</th>
                <th style={styles.tableHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map(item => (
                <tr key={item.id}>
                  <td style={styles.tableCell}>{item.productName}</td>
                  <td style={styles.tableCell}>{item.sku}</td>
                  <td style={styles.tableCell}>{item.quantity}</td>
                  <td style={styles.tableCell}>₹{item.unitPrice.toLocaleString()}</td>
                  <td style={styles.tableCell}>₹{item.total.toLocaleString()}</td>
                  <td style={styles.tableCell}>
                    <button
                      onClick={() => removeLineItem(item.id)}
                      style={{ ...styles.button, ...styles.dangerButton, padding: '6px 10px', fontSize: '12px' }}
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
        <div style={styles.totalsSection}>
          <div style={styles.totalRow}>
            <span>Subtotal:</span>
            <span style={styles.totalValue}>₹{subtotal.toLocaleString()}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px', marginTop: '15px' }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tax (%)</label>
              <input
                type="number"
                style={styles.input}
                min="0"
                max="100"
                value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value))}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Discount (₹)</label>
              <input
                type="number"
                style={styles.input}
                min="0"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div style={styles.totalRow}>
            <span>Tax ({tax}%):</span>
            <span style={styles.totalValue}>₹{taxAmount.toLocaleString()}</span>
          </div>

          <div style={styles.totalRow}>
            <span>Shipping:</span>
            <span style={styles.totalValue}>₹{shipping.toLocaleString()}</span>
          </div>

          <div style={styles.totalRow}>
            <span>Discount:</span>
            <span style={styles.totalValue}>-₹{discountAmount.toLocaleString()}</span>
          </div>

          <div style={styles.grandTotal}>
            <span>Total Amount:</span>
            <span>₹{total.toLocaleString()}</span>
          </div>
        </div>

        <div style={styles.buttonGroup}>
          <button
            onClick={handleCreateOrder}
            style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
          >
            Create Order
          </button>
          <button
            onClick={handleSaveDraft}
            style={{ ...styles.button, ...styles.secondaryButton, flex: 1 }}
          >
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}
