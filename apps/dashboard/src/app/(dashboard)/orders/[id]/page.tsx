'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  description: string;
}

interface Note {
  id: string;
  author: string;
  timestamp: string;
  content: string;
}

interface LineItem {
  id: string;
  product: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      author: 'Priya Kapoor',
      timestamp: '2026-03-05 14:30',
      content: 'Customer requested expedited shipping. Premium customers get priority.'
    },
    {
      id: '2',
      author: 'Rajesh Kumar',
      timestamp: '2026-03-04 10:15',
      content: 'Order verified and ready for fulfillment.'
    }
  ]);
  const [newNote, setNewNote] = useState('');

  const mockOrder = {
    orderNumber: '#WL-10042',
    status: 'ready_to_ship',
    createdDate: '2026-03-04',
    source: 'Shopify',
    customer: {
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@email.com',
      phone: '+91-9876543210',
      orderHistoryCount: 5
    },
    address: {
      street: '123 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zip: '560001'
    },
    lineItems: [
      { id: '1', product: 'Premium Bluetooth Speaker', sku: 'BS-001', quantity: 2, unitPrice: 2499, total: 4998 },
      { id: '2', product: 'USB-C Charging Cable', sku: 'USB-C-001', quantity: 3, unitPrice: 499, total: 1497 },
      { id: '3', product: 'Wireless Mouse', sku: 'WM-001', quantity: 1, unitPrice: 1299, total: 1299 }
    ],
    subtotal: 7794,
    tax: 1559,
    shipping: 100,
    discount: 500,
    total: 8953,
    shipment: {
      trackingNumber: 'WL-SHIP-2026-0001234',
      carrier: 'FedEx',
      status: 'processing',
      eta: '2026-03-08'
    },
    activities: [
      {
        id: '1',
        timestamp: '2026-03-05 14:30',
        actor: 'System',
        action: 'status_changed',
        description: 'Status changed from "confirmed" to "ready_to_ship"'
      },
      {
        id: '2',
        timestamp: '2026-03-05 10:00',
        actor: 'Priya Kapoor',
        action: 'order_created',
        description: 'Order created and confirmed'
      },
      {
        id: '3',
        timestamp: '2026-03-04 09:15',
        actor: 'System',
        action: 'order_received',
        description: 'Order received from Shopify'
      }
    ]
  };

  const statusColors: Record<string, string> = {
    'pending': '#8888a0',
    'confirmed': '#6C63FF',
    'ready_to_ship': '#ffa500',
    'shipped': '#4CAF50',
    'delivered': '#4CAF50',
    'cancelled': '#ff4444'
  };

  const shipmentStatusColors: Record<string, string> = {
    'processing': '#ffa500',
    'picked': '#6C63FF',
    'packed': '#6C63FF',
    'shipped': '#4CAF50',
    'in_transit': '#4CAF50',
    'delivered': '#4CAF50',
    'cancelled': '#ff4444'
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'ready_to_ship': 'Ready to Ship',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      author: 'Current User',
      timestamp: new Date().toLocaleString('en-IN'),
      content: newNote
    };
    setNotes([note, ...notes]);
    setNewNote('');
  };

  return (
    <div className="min-h-screen bg-wl-bg p-5 text-wl-text">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="text-4xl font-bold">{mockOrder.orderNumber}</div>
          <div className="text-sm text-wl-muted mt-1">
            Created on {mockOrder.createdDate} • Source: {mockOrder.source}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="px-4 py-2 rounded bg-wl-primary text-white font-semibold text-sm transition-all">Edit Order</button>
          <button className="px-4 py-2 rounded bg-transparent text-wl-primary font-semibold text-sm border border-wl-primary transition-all">Create Shipment</button>
          <button className="px-4 py-2 rounded bg-transparent text-wl-primary font-semibold text-sm border border-wl-primary transition-all">Print Label</button>
          <button className="px-4 py-2 rounded bg-transparent text-wl-primary font-semibold text-sm border border-wl-primary transition-all">Refund</button>
          <button className="px-4 py-2 rounded bg-red-400 text-white font-semibold text-sm transition-all">Cancel</button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold text-sm mb-2">Order Status</div>
            <div className="mt-2">
              <Badge
                label={getStatusLabel(mockOrder.status)}
                color={statusColors[mockOrder.status]}
              />
            </div>
          </div>
          <div className="text-sm text-wl-muted">
            Last updated: 2026-03-05 14:30
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 mb-5 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        {/* Customer Info */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="font-semibold text-sm mb-4">Customer Information</div>
          {[
            { label: 'Name', value: mockOrder.customer.name },
            { label: 'Email', value: mockOrder.customer.email },
            { label: 'Phone', value: mockOrder.customer.phone },
            { label: 'Order History', value: `${mockOrder.customer.orderHistoryCount} orders` }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-3 border-b border-wl-border text-sm last:border-0">
              <span className="text-wl-muted font-medium">{row.label}</span>
              <span className="text-wl-text font-semibold">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Delivery Address */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="font-semibold text-sm mb-4">Delivery Address</div>
          {[
            { label: 'Street', value: mockOrder.address.street },
            { label: 'City', value: mockOrder.address.city },
            { label: 'State', value: mockOrder.address.state },
            { label: 'Zip', value: mockOrder.address.zip }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-3 border-b border-wl-border text-sm last:border-0">
              <span className="text-wl-muted font-medium">{row.label}</span>
              <span className="text-wl-text font-semibold">{row.value}</span>
            </div>
          ))}
          <div className="w-full h-52 bg-wl-bg border border-wl-border rounded mt-3 flex items-center justify-center text-wl-muted text-sm">
            Map View Placeholder
          </div>
        </div>

        {/* Shipment Info */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="font-semibold text-sm mb-4">Shipment Information</div>
          {[
            { label: 'Tracking #', value: mockOrder.shipment.trackingNumber },
            { label: 'Carrier', value: mockOrder.shipment.carrier },
            { label: 'Status', value: null, isBadge: true },
            { label: 'Estimated Delivery', value: mockOrder.shipment.eta }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-3 border-b border-wl-border text-sm last:border-0">
              <span className="text-wl-muted font-medium">{row.label}</span>
              {row.isBadge ? (
                <Badge
                  label={mockOrder.shipment.status.charAt(0).toUpperCase() + mockOrder.shipment.status.slice(1)}
                  color={shipmentStatusColors[mockOrder.shipment.status]}
                />
              ) : (
                <span className="text-wl-text font-semibold">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
        <div className="font-semibold text-sm mb-4">Line Items</div>
        <table className="w-full border-collapse mt-4">
          <thead>
            <tr>
              {['Product', 'SKU', 'Qty', 'Unit Price', 'Total'].map(h => (
                <th key={h} className="bg-wl-bg border-b border-wl-border p-3 text-left text-xs font-semibold text-wl-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockOrder.lineItems.map(item => (
              <tr key={item.id}>
                <td className="border-b border-wl-border p-3 text-sm">{item.product}</td>
                <td className="border-b border-wl-border p-3 text-sm">{item.sku}</td>
                <td className="border-b border-wl-border p-3 text-sm">{item.quantity}</td>
                <td className="border-b border-wl-border p-3 text-sm">₹{item.unitPrice.toLocaleString()}</td>
                <td className="border-b border-wl-border p-3 text-sm">₹{item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Order Totals */}
        <div className="mt-4">
          {[
            { label: 'Subtotal', value: `₹${mockOrder.subtotal.toLocaleString()}` },
            { label: 'Tax', value: `₹${mockOrder.tax.toLocaleString()}` },
            { label: 'Shipping', value: `₹${mockOrder.shipping.toLocaleString()}` },
            { label: 'Discount', value: `-₹${mockOrder.discount.toLocaleString()}` }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-2 border-b border-wl-border text-sm">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
          <div className="flex justify-between py-4 border-t border-wl-border text-base font-bold text-wl-primary">
            <span>Total Amount</span>
            <span>₹{mockOrder.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Activity Timeline */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="font-semibold text-sm mb-4">Activity Timeline</div>
          <div className="relative pl-8">
            {mockOrder.activities.map((activity, idx) => (
              <div key={activity.id} className="mb-5 pb-5 border-b border-wl-border last:border-0">
                <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-wl-primary border-4 border-wl-surface" />
                <div className="text-xs text-wl-muted">{activity.timestamp}</div>
                <div className="text-sm font-semibold text-wl-text mt-1">{activity.action.replace(/_/g, ' ').toUpperCase()}</div>
                <div className="text-xs text-wl-muted mt-1">{activity.description}</div>
                <div className="text-xs text-wl-muted mt-1">by {activity.actor}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-wl-surface border border-wl-border rounded p-5">
          <div className="font-semibold text-sm mb-4">Internal Notes</div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-wl-text mb-1">Add Note</label>
            <textarea
              className="w-full p-3 bg-wl-bg border border-wl-border rounded text-wl-text text-sm min-h-20 font-inherit box-border"
              placeholder="Add internal notes..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <button
              onClick={addNote}
              className="w-full mt-2 px-4 py-2 rounded bg-wl-primary text-white font-semibold text-sm transition-all"
            >
              Add Note
            </button>
          </div>

          <div className="border-t border-wl-border pt-4">
            <div className="text-xs font-semibold text-wl-muted mb-3">
              {notes.length} Note{notes.length !== 1 ? 's' : ''}
            </div>
            {notes.map(note => (
              <div key={note.id} className="bg-wl-bg border border-wl-border rounded p-3 mb-3">
                <div className="flex justify-between mb-2 text-xs">
                  <span className="font-semibold text-wl-text">{note.author}</span>
                  <span className="text-wl-muted">{note.timestamp}</span>
                </div>
                <div className="text-sm text-wl-text leading-relaxed">{note.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
