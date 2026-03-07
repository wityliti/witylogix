'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  total: number;
  status: string;
  date: string;
}

interface BulkOperationResult {
  success: number;
  failed: number;
  details: { orderId: string; message: string }[];
}

export default function BulkOperationsPage() {
  const [orders, setOrders] = useState<Order[]>([
    { id: '1', orderNumber: '#WL-10042', customer: 'Rajesh Kumar', total: 8953, status: 'ready_to_ship', date: '2026-03-04' },
    { id: '2', orderNumber: '#WL-10041', customer: 'Priya Singh', total: 5432, status: 'confirmed', date: '2026-03-03' },
    { id: '3', orderNumber: '#WL-10040', customer: 'Amit Patel', total: 12500, status: 'pending', date: '2026-03-02' },
    { id: '4', orderNumber: '#WL-10039', customer: 'Sneha Reddy', total: 3200, status: 'ready_to_ship', date: '2026-03-01' },
    { id: '5', orderNumber: '#WL-10038', customer: 'Vikram Kumar', total: 7800, status: 'pending', date: '2026-02-28' },
    { id: '6', orderNumber: '#WL-10037', customer: 'Ananya Gupta', total: 4500, status: 'confirmed', date: '2026-02-27' },
    { id: '7', orderNumber: '#WL-10036', customer: 'Karan Singh', total: 9999, status: 'ready_to_ship', date: '2026-02-26' },
    { id: '8', orderNumber: '#WL-10035', customer: 'Neha Sharma', total: 6700, status: 'confirmed', date: '2026-02-25' }
  ]);

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [bulkAction, setBulkAction] = useState('');
  const [newStatus, setNewStatus] = useState('ready_to_ship');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [operationResults, setOperationResults] = useState<BulkOperationResult | null>(null);

  const mockRoutes = [
    { id: '1', name: 'Bangalore East - Route A' },
    { id: '2', name: 'Bangalore West - Route B' },
    { id: '3', name: 'Bangalore North - Route C' },
    { id: '4', name: 'Bangalore South - Route D' }
  ];

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length && selectedOrders.size > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedOrders.size === 0) return;
    setShowConfirmation(true);
  };

  const confirmAction = () => {
    setShowConfirmation(false);
    setShowProgress(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Simulate results
          setOperationResults({
            success: selectedOrders.size - 1,
            failed: 1,
            details: [
              { orderId: '#WL-10042', message: 'Successfully processed' },
              { orderId: '#WL-10041', message: 'Successfully processed' },
              { orderId: '#WL-10040', message: 'Failed: Order locked by another user' }
            ]
          });
          setShowProgress(false);
          return 100;
        }
        return prev + 15;
      });
    }, 300);
  };

  const resetOperations = () => {
    setBulkAction('');
    setSelectedOrders(new Set());
    setOperationResults(null);
    setProgress(0);
  };

  const statusColors: Record<string, string> = {
    'pending': '#8888a0',
    'confirmed': '#6C63FF',
    'ready_to_ship': '#ffa500',
    'shipped': '#4CAF50',
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
      marginBottom: '8px'
    } as React.CSSProperties,
    subtitle: {
      fontSize: '14px',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    card: {
      backgroundColor: 'var(--wl-surface)',
      border: '1px solid var(--wl-border)',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    } as React.CSSProperties,
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '15px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    controlsRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '15px',
      marginBottom: '20px'
    } as React.CSSProperties,
    formGroup: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '6px'
    } as React.CSSProperties,
    label: {
      fontSize: '13px',
      fontWeight: '500',
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
    actionBar: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      padding: '15px',
      backgroundColor: 'var(--wl-bg)',
      borderRadius: '6px',
      marginBottom: '20px'
    } as React.CSSProperties,
    selectionInfo: {
      fontSize: '13px',
      color: 'var(--wl-muted)',
      flex: 1
    } as React.CSSProperties,
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const
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
    checkbox: {
      cursor: 'pointer'
    } as React.CSSProperties,
    modal: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    } as React.CSSProperties,
    modalContent: {
      backgroundColor: 'var(--wl-surface)',
      border: '1px solid var(--wl-border)',
      borderRadius: '8px',
      padding: '30px',
      maxWidth: '500px',
      width: '90%',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    modalTitle: {
      fontSize: '18px',
      fontWeight: '700',
      marginBottom: '15px'
    } as React.CSSProperties,
    modalBody: {
      fontSize: '13px',
      color: 'var(--wl-muted)',
      marginBottom: '20px',
      lineHeight: '1.6'
    } as React.CSSProperties,
    modalActions: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'flex-end'
    } as React.CSSProperties,
    progressBar: {
      width: '100%',
      height: '8px',
      backgroundColor: 'var(--wl-bg)',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '15px'
    } as React.CSSProperties,
    progressFill: {
      height: '100%',
      backgroundColor: 'var(--wl-primary)',
      transition: 'width 0.3s'
    } as React.CSSProperties,
    resultsList: {
      marginTop: '15px'
    } as React.CSSProperties,
    resultItem: {
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '8px',
      fontSize: '13px'
    } as React.CSSProperties,
    resultSuccess: {
      borderLeftColor: '#4CAF50',
      borderLeftWidth: '3px'
    } as React.CSSProperties,
    resultFailed: {
      borderLeftColor: '#ff4444',
      borderLeftWidth: '3px'
    } as React.CSSProperties
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Bulk Operations</div>
        <div style={styles.subtitle}>Perform bulk actions on multiple orders at once</div>
      </div>

      {/* Search and Filter */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Search & Filter Orders</div>
        <div style={styles.controlsRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Search Order Number or Customer</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Filter by Status</label>
            <select
              style={styles.select}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="ready_to_ship">Ready to Ship</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>&nbsp;</label>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
              }}
              style={{ ...styles.button, ...styles.secondaryButton }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Selection and Bulk Actions */}
      {filteredOrders.length > 0 && (
        <div style={styles.actionBar}>
          <div style={styles.selectionInfo}>
            {selectedOrders.size > 0 ? (
              `${selectedOrders.size} order${selectedOrders.size !== 1 ? 's' : ''} selected`
            ) : (
              'Select orders to perform bulk actions'
            )}
          </div>
          <button
            onClick={toggleSelectAll}
            style={{ ...styles.button, ...styles.secondaryButton }}
          >
            {selectedOrders.size === filteredOrders.length && selectedOrders.size > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Orders ({filteredOrders.length})</div>
        {filteredOrders.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={selectedOrders.size === filteredOrders.length && selectedOrders.size > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={styles.tableHeader}>Order Number</th>
                <th style={styles.tableHeader}>Customer</th>
                <th style={styles.tableHeader}>Total</th>
                <th style={styles.tableHeader}>Status</th>
                <th style={styles.tableHeader}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id}>
                  <td style={styles.tableCell}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                    />
                  </td>
                  <td style={styles.tableCell}>
                    <strong>{order.orderNumber}</strong>
                  </td>
                  <td style={styles.tableCell}>{order.customer}</td>
                  <td style={styles.tableCell}>₹{order.total.toLocaleString()}</td>
                  <td style={styles.tableCell}>
                    <Badge
                      label={getStatusLabel(order.status)}
                      color={statusColors[order.status]}
                    />
                  </td>
                  <td style={styles.tableCell}>{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--wl-muted)' }}>
            No orders found
          </div>
        )}
      </div>

      {/* Bulk Actions Section */}
      {selectedOrders.size > 0 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Bulk Actions</div>
          <div style={styles.controlsRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Action</label>
              <select
                style={styles.select}
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="">-- Select Action --</option>
                <option value="update_status">Update Status</option>
                <option value="assign_route">Assign to Route</option>
                <option value="print_labels">Print Labels</option>
                <option value="export_csv">Export to CSV</option>
                <option value="cancel">Cancel Orders</option>
              </select>
            </div>

            {bulkAction === 'update_status' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>New Status</label>
                <select
                  style={styles.select}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="ready_to_ship">Ready to Ship</option>
                  <option value="shipped">Shipped</option>
                </select>
              </div>
            )}

            {bulkAction === 'assign_route' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Route</label>
                <select
                  style={styles.select}
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                >
                  <option value="">-- Select Route --</option>
                  {mockRoutes.map(route => (
                    <option key={route.id} value={route.id}>{route.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>&nbsp;</label>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction || (bulkAction === 'assign_route' && !selectedRoute)}
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity: !bulkAction || (bulkAction === 'assign_route' && !selectedRoute) ? 0.5 : 1,
                  cursor: !bulkAction || (bulkAction === 'assign_route' && !selectedRoute) ? 'not-allowed' : 'pointer'
                }}
              >
                Execute Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalTitle}>Confirm Bulk Action</div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: '10px' }}>
                Action: <strong>{bulkAction === 'update_status' ? 'Update Status' : bulkAction === 'assign_route' ? 'Assign to Route' : 'Execute'}</strong>
              </div>
              <div style={{ marginBottom: '10px' }}>
                Orders selected: <strong>{selectedOrders.size}</strong>
              </div>
              {bulkAction === 'update_status' && (
                <div>
                  New status: <strong>{getStatusLabel(newStatus)}</strong>
                </div>
              )}
              {bulkAction === 'assign_route' && (
                <div>
                  Route: <strong>{mockRoutes.find(r => r.id === selectedRoute)?.name}</strong>
                </div>
              )}
              <div style={{ marginTop: '15px', color: 'var(--wl-muted)' }}>
                This action will affect all selected orders. Do you want to continue?
              </div>
            </div>
            <div style={styles.modalActions}>
              <button
                onClick={() => setShowConfirmation(false)}
                style={{ ...styles.button, ...styles.secondaryButton }}
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                style={{ ...styles.button, ...styles.primaryButton }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgress && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalTitle}>Processing Orders...</div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
            <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '13px', color: 'var(--wl-muted)' }}>
              {progress}% Complete
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {operationResults && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalTitle}>Operation Complete</div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#4CAF50' }}>{operationResults.success} order{operationResults.success !== 1 ? 's' : ''} processed successfully</strong>
              </div>
              {operationResults.failed > 0 && (
                <div style={{ color: '#ff4444' }}>
                  <strong>{operationResults.failed} order{operationResults.failed !== 1 ? 's' : ''} failed</strong>
                </div>
              )}
            </div>

            {operationResults.details.length > 0 && (
              <div style={styles.resultsList}>
                {operationResults.details.map((detail, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...styles.resultItem,
                      ...detail.message.includes('Successfully') ? styles.resultSuccess : styles.resultFailed
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>{detail.orderId}</div>
                    <div style={{ fontSize: '12px', color: 'var(--wl-muted)', marginTop: '4px' }}>
                      {detail.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                onClick={resetOperations}
                style={{ ...styles.button, ...styles.primaryButton }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
