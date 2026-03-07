'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

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

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: 'var(--wl-bg)',
      padding: '20px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '30px'
    } as React.CSSProperties,
    headerTitle: {
      fontSize: '32px',
      fontWeight: '700'
    } as React.CSSProperties,
    headerSubtitle: {
      fontSize: '13px',
      color: 'var(--wl-muted)',
      marginTop: '4px'
    } as React.CSSProperties,
    actionButtonGroup: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
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
      color: '#ffffff'
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
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px',
      marginBottom: '20px'
    } as React.CSSProperties,
    card: {
      backgroundColor: 'var(--wl-surface)',
      border: '1px solid var(--wl-border)',
      borderRadius: '8px',
      padding: '20px'
    } as React.CSSProperties,
    cardTitle: {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '15px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid var(--wl-border)',
      fontSize: '13px'
    } as React.CSSProperties,
    infoLabel: {
      color: 'var(--wl-muted)',
      fontWeight: '500'
    } as React.CSSProperties,
    infoValue: {
      color: 'var(--wl-text)',
      fontWeight: '600'
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
      textAlign: 'left' as const,
      fontSize: '12px',
      fontWeight: '600',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    tableCell: {
      padding: '12px',
      borderBottom: '1px solid var(--wl-border)',
      fontSize: '13px'
    } as React.CSSProperties,
    timeline: {
      position: 'relative' as const,
      paddingLeft: '30px'
    } as React.CSSProperties,
    timelineItem: {
      marginBottom: '20px',
      paddingBottom: '20px',
      borderBottom: '1px solid var(--wl-border)'
    } as React.CSSProperties,
    timelineDot: {
      position: 'absolute' as const,
      left: '-22px',
      top: '0',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      backgroundColor: 'var(--wl-primary)',
      border: '3px solid var(--wl-surface)'
    } as React.CSSProperties,
    timelineTime: {
      fontSize: '12px',
      color: 'var(--wl-muted)',
      marginBottom: '4px'
    } as React.CSSProperties,
    timelineAction: {
      fontSize: '13px',
      fontWeight: '600',
      color: 'var(--wl-text)',
      marginBottom: '2px'
    } as React.CSSProperties,
    timelineDescription: {
      fontSize: '12px',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    noteCard: {
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '12px'
    } as React.CSSProperties,
    noteHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px',
      fontSize: '12px'
    } as React.CSSProperties,
    noteAuthor: {
      fontWeight: '600',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    noteTime: {
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    noteContent: {
      fontSize: '13px',
      color: 'var(--wl-text)',
      lineHeight: '1.5'
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
    fullWidth: {
      gridColumn: '1 / -1'
    } as React.CSSProperties,
    shippingInfo: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '15px'
    } as React.CSSProperties,
    mapPlaceholder: {
      width: '100%',
      height: '200px',
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--wl-muted)',
      fontSize: '13px'
    } as React.CSSProperties,
    totalsTable: {
      width: '100%',
      marginTop: '15px'
    } as React.CSSProperties,
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid var(--wl-border)',
      fontSize: '13px'
    } as React.CSSProperties,
    grandTotal: {
      display: 'flex',
      justifyContent: 'space-between',
      paddingTop: '15px',
      fontSize: '16px',
      fontWeight: '700',
      color: 'var(--wl-primary)'
    } as React.CSSProperties,
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '500',
      marginBottom: '6px',
      color: 'var(--wl-text)'
    } as React.CSSProperties
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>{mockOrder.orderNumber}</div>
          <div style={styles.headerSubtitle}>
            Created on {mockOrder.createdDate} • Source: {mockOrder.source}
          </div>
        </div>
        <div style={styles.actionButtonGroup}>
          <button style={{ ...styles.button, ...styles.primaryButton }}>Edit Order</button>
          <button style={{ ...styles.button, ...styles.secondaryButton }}>Create Shipment</button>
          <button style={{ ...styles.button, ...styles.secondaryButton }}>Print Label</button>
          <button style={{ ...styles.button, ...styles.secondaryButton }}>Refund</button>
          <button style={{ ...styles.button, ...styles.dangerButton }}>Cancel</button>
        </div>
      </div>

      {/* Status Banner */}
      <div style={{ ...styles.card, ...styles.fullWidth, marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={styles.cardTitle}>Order Status</div>
            <div style={{ marginTop: '8px' }}>
              <Badge
                label={getStatusLabel(mockOrder.status)}
                color={statusColors[mockOrder.status]}
              />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--wl-muted)' }}>
            Last updated: 2026-03-05 14:30
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Customer Info */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Customer Information</div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Name</span>
            <span style={styles.infoValue}>{mockOrder.customer.name}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Email</span>
            <span style={styles.infoValue}>{mockOrder.customer.email}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Phone</span>
            <span style={styles.infoValue}>{mockOrder.customer.phone}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Order History</span>
            <span style={styles.infoValue}>{mockOrder.customer.orderHistoryCount} orders</span>
          </div>
        </div>

        {/* Delivery Address */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Delivery Address</div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Street</span>
            <span style={styles.infoValue}>{mockOrder.address.street}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>City</span>
            <span style={styles.infoValue}>{mockOrder.address.city}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>State</span>
            <span style={styles.infoValue}>{mockOrder.address.state}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Zip</span>
            <span style={styles.infoValue}>{mockOrder.address.zip}</span>
          </div>
          <div style={styles.mapPlaceholder}>
            Map View Placeholder
          </div>
        </div>

        {/* Shipment Info */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Shipment Information</div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Tracking #</span>
            <span style={styles.infoValue}>{mockOrder.shipment.trackingNumber}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Carrier</span>
            <span style={styles.infoValue}>{mockOrder.shipment.carrier}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Status</span>
            <span>
              <Badge
                label={mockOrder.shipment.status.charAt(0).toUpperCase() + mockOrder.shipment.status.slice(1)}
                color={shipmentStatusColors[mockOrder.shipment.status]}
              />
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Estimated Delivery</span>
            <span style={styles.infoValue}>{mockOrder.shipment.eta}</span>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div style={{ ...styles.card, ...styles.fullWidth, marginBottom: '20px' }}>
        <div style={styles.cardTitle}>Line Items</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>Product</th>
              <th style={styles.tableHeader}>SKU</th>
              <th style={styles.tableHeader}>Qty</th>
              <th style={styles.tableHeader}>Unit Price</th>
              <th style={styles.tableHeader}>Total</th>
            </tr>
          </thead>
          <tbody>
            {mockOrder.lineItems.map(item => (
              <tr key={item.id}>
                <td style={styles.tableCell}>{item.product}</td>
                <td style={styles.tableCell}>{item.sku}</td>
                <td style={styles.tableCell}>{item.quantity}</td>
                <td style={styles.tableCell}>₹{item.unitPrice.toLocaleString()}</td>
                <td style={styles.tableCell}>₹{item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Order Totals */}
        <div style={styles.totalsTable}>
          <div style={styles.totalRow}>
            <span>Subtotal</span>
            <span>₹{mockOrder.subtotal.toLocaleString()}</span>
          </div>
          <div style={styles.totalRow}>
            <span>Tax</span>
            <span>₹{mockOrder.tax.toLocaleString()}</span>
          </div>
          <div style={styles.totalRow}>
            <span>Shipping</span>
            <span>₹{mockOrder.shipping.toLocaleString()}</span>
          </div>
          <div style={styles.totalRow}>
            <span>Discount</span>
            <span>-₹{mockOrder.discount.toLocaleString()}</span>
          </div>
          <div style={styles.grandTotal}>
            <span>Total Amount</span>
            <span>₹{mockOrder.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Activity Timeline */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Activity Timeline</div>
          <div style={styles.timeline}>
            {mockOrder.activities.map(activity => (
              <div key={activity.id} style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div style={styles.timelineTime}>{activity.timestamp}</div>
                <div style={styles.timelineAction}>{activity.action.replace(/_/g, ' ').toUpperCase()}</div>
                <div style={styles.timelineDescription}>{activity.description}</div>
                <div style={{ fontSize: '12px', color: 'var(--wl-muted)', marginTop: '4px' }}>
                  by {activity.actor}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes Section */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Internal Notes</div>

          <div style={{ marginBottom: '15px' }}>
            <label style={styles.label}>Add Note</label>
            <textarea
              style={styles.textarea}
              placeholder="Add internal notes..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <button
              onClick={addNote}
              style={{
                ...styles.button,
                ...styles.primaryButton,
                marginTop: '10px',
                width: '100%'
              }}
            >
              Add Note
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--wl-border)', paddingTop: '15px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--wl-muted)', marginBottom: '12px' }}>
              {notes.length} Note{notes.length !== 1 ? 's' : ''}
            </div>
            {notes.map(note => (
              <div key={note.id} style={styles.noteCard}>
                <div style={styles.noteHeader}>
                  <span style={styles.noteAuthor}>{note.author}</span>
                  <span style={styles.noteTime}>{note.timestamp}</span>
                </div>
                <div style={styles.noteContent}>{note.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
