'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

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

interface Order {
  orderNumber: string;
  status: string;
  createdDate: string;
  source: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    orderHistoryCount: number;
  };
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  shipment: {
    trackingNumber: string;
    carrier: string;
    status: string;
    eta: string;
  };
  activities: Activity[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');

  const { data: order, loading, error, refetch } = useApiQuery<Order>(
    id ? `/api/v4/orders/${id}` : null
  );
  const { execute: addNoteApi } = useApiMutation<Note>('POST', `/api/v4/orders/${id}/notes`);

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

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await addNoteApi({ content: newNote });
      setNewNote('');
      refetch();
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <div className="text-center text-gray-400">Order not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white">{order.orderNumber}</h1>
          <p className="text-sm text-gray-400 mt-2">
            Created on {order.createdDate} • Source: {order.source}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="primary">Edit Order</Button>
          <Button variant="secondary">Create Shipment</Button>
          <Button variant="secondary">Print Label</Button>
          <Button variant="secondary">Refund</Button>
          <Button variant="danger">Cancel</Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-sm text-gray-300 mb-3">Order Status</p>
            <div>
              <Badge variant="default">{getStatusLabel(order.status)}</Badge>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Last updated: {order.createdDate}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        {/* Customer Info */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Customer Information</h3>
          {[
            { label: 'Name', value: order.customer.name },
            { label: 'Email', value: order.customer.email },
            { label: 'Phone', value: order.customer.phone },
            { label: 'Order History', value: `${order.customer.orderHistoryCount} orders` }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-3 border-b border-[#1e1e2e] text-sm last:border-0">
              <span className="text-gray-400 font-medium">{row.label}</span>
              <span className="text-gray-300 font-semibold">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Delivery Address */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Delivery Address</h3>
          {[
            { label: 'Street', value: order.address.street },
            { label: 'City', value: order.address.city },
            { label: 'State', value: order.address.state },
            { label: 'Zip', value: order.address.zip }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-3 border-b border-[#1e1e2e] text-sm last:border-0">
              <span className="text-gray-400 font-medium">{row.label}</span>
              <span className="text-gray-300 font-semibold">{row.value}</span>
            </div>
          ))}
          <div className="w-full h-52 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg mt-3 flex items-center justify-center text-gray-400 text-sm">
            Map View Placeholder
          </div>
        </div>

        {/* Shipment Info */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Shipment Information</h3>
          {[
            { label: 'Tracking #', value: order.shipment.trackingNumber },
            { label: 'Carrier', value: order.shipment.carrier },
            { label: 'Status', value: null, isBadge: true },
            { label: 'Estimated Delivery', value: order.shipment.eta }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-3 border-b border-[#1e1e2e] text-sm last:border-0">
              <span className="text-gray-400 font-medium">{row.label}</span>
              {row.isBadge ? (
                <Badge variant="default">
                  {order.shipment.status.charAt(0).toUpperCase() + order.shipment.status.slice(1)}
                </Badge>
              ) : (
                <span className="text-gray-300 font-semibold">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-sm text-white mb-4">Line Items</h3>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Product', 'SKU', 'Qty', 'Unit Price', 'Total'].map(h => (
                <th key={h} className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left text-xs font-semibold text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map(item => (
              <tr key={item.id}>
                <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{item.product}</td>
                <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{item.sku}</td>
                <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{item.quantity}</td>
                <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">₹{item.unitPrice.toLocaleString()}</td>
                <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">₹{item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Order Totals */}
        <div className="mt-4">
          {[
            { label: 'Subtotal', value: `₹${order.subtotal.toLocaleString()}` },
            { label: 'Tax', value: `₹${order.tax.toLocaleString()}` },
            { label: 'Shipping', value: `₹${order.shipping.toLocaleString()}` },
            { label: 'Discount', value: `-₹${order.discount.toLocaleString()}` }
          ].map((row, idx) => (
            <div key={idx} className="flex justify-between py-2 border-b border-[#1e1e2e] text-sm text-gray-300">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
          <div className="flex justify-between py-4 border-t border-[#1e1e2e] text-base font-bold text-blue-500">
            <span>Total Amount</span>
            <span>₹{order.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Activity Timeline */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Activity Timeline</h3>
          <div className="relative pl-8">
            {order.activities.map((activity, idx) => (
              <div key={activity.id} className="mb-5 pb-5 border-b border-[#1e1e2e] last:border-0">
                <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-blue-500 border-4 border-[#12121a]" />
                <p className="text-xs text-gray-400">{activity.timestamp}</p>
                <p className="text-sm font-semibold text-gray-300 mt-1">{activity.action.replace(/_/g, ' ').toUpperCase()}</p>
                <p className="text-xs text-gray-400 mt-1">{activity.description}</p>
                <p className="text-xs text-gray-400 mt-1">by {activity.actor}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Internal Notes</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Add Note</label>
            <textarea
              className="w-full p-3 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-gray-300 text-sm min-h-20 font-inherit box-border"
              placeholder="Add internal notes..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <Button variant="primary" className="w-full mt-2" onClick={addNote}>
              Add Note
            </Button>
          </div>

          <div className="border-t border-[#1e1e2e] pt-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">
              {notes.length} Note{notes.length !== 1 ? 's' : ''}
            </p>
            {notes.map(note => (
              <div key={note.id} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded p-3 mb-3">
                <div className="flex justify-between mb-2 text-xs">
                  <span className="font-semibold text-gray-300">{note.author}</span>
                  <span className="text-gray-400">{note.timestamp}</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{note.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
