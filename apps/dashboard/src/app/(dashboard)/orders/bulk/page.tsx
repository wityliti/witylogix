'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApiList, useApiMutation } from '@/hooks/use-api';

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

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk Operations</h1>
        <p className="text-sm text-gray-400">Perform bulk actions on multiple orders at once</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
        <p className="text-base font-semibold mb-4 text-white">Search & Filter Orders</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Search Order Number or Customer</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-gray-300 text-sm box-border focus:outline-none focus:border-blue-500"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Filter by Status</label>
            <select
              className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-gray-300 text-sm box-border focus:outline-none focus:border-blue-500"
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">&nbsp;</label>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
              }}
              className="px-4 py-2.5 rounded bg-transparent text-blue-500 font-semibold text-sm border border-blue-500 transition-all hover:bg-blue-500 hover:text-white"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Selection and Bulk Actions */}
      {filteredOrders.length > 0 && (
        <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-400 flex-1">
            {selectedOrders.size > 0 ? (
              `${selectedOrders.size} order${selectedOrders.size !== 1 ? 's' : ''} selected`
            ) : (
              'Select orders to perform bulk actions'
            )}
          </p>
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2.5 rounded bg-transparent text-blue-500 font-semibold text-sm border border-blue-500 transition-all hover:bg-blue-500 hover:text-white"
          >
            {selectedOrders.size === filteredOrders.length && selectedOrders.size > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
        <p className="text-base font-semibold mb-4 text-white">Orders ({filteredOrders.length})</p>
        {filteredOrders.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={selectedOrders.size === filteredOrders.length && selectedOrders.size > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left text-xs font-semibold text-gray-400">Order Number</th>
                <th className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left text-xs font-semibold text-gray-400">Customer</th>
                <th className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left text-xs font-semibold text-gray-400">Total</th>
                <th className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left text-xs font-semibold text-gray-400">Status</th>
                <th className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left text-xs font-semibold text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id}>
                  <td className="border-b border-[#1e1e2e] p-3">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                    />
                  </td>
                  <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">
                    <strong>{order.orderNumber}</strong>
                  </td>
                  <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{order.customer}</td>
                  <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">₹{order.total.toLocaleString()}</td>
                  <td className="border-b border-[#1e1e2e] p-3 text-sm">
                    <Badge
                      label={getStatusLabel(order.status)}
                      color={statusColors[order.status]}
                    />
                  </td>
                  <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-gray-400">
            No orders found
          </div>
        )}
      </div>

      {/* Bulk Actions Section */}
      {selectedOrders.size > 0 && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
          <p className="text-base font-semibold mb-4 text-white">Bulk Actions</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Select Action</label>
              <select
                className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-gray-300 text-sm box-border focus:outline-none focus:border-blue-500"
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">New Status</label>
                <select
                  className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-gray-300 text-sm box-border focus:outline-none focus:border-blue-500"
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Select Route</label>
                <select
                  className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-gray-300 text-sm box-border focus:outline-none focus:border-blue-500"
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">&nbsp;</label>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction || (bulkAction === 'assign_route' && !selectedRoute)}
                className={cn(
                  "px-4 py-2.5 rounded font-semibold text-sm transition-all",
                  !bulkAction || (bulkAction === 'assign_route' && !selectedRoute)
                    ? "bg-blue-500 text-white opacity-50 cursor-not-allowed"
                    : "bg-blue-500 text-white cursor-pointer hover:bg-blue-600"
                )}
              >
                Execute Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-8 max-w-md w-11/12 text-white">
            <h2 className="text-lg font-bold mb-4">Confirm Bulk Action</h2>
            <div className="text-sm text-gray-300 mb-5 leading-relaxed">
              <div className="mb-2.5">
                Action: <strong>{bulkAction === 'update_status' ? 'Update Status' : bulkAction === 'assign_route' ? 'Assign to Route' : 'Execute'}</strong>
              </div>
              <div className="mb-2.5">
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
              <div className="mt-4 text-wl-muted">
                This action will affect all selected orders. Do you want to continue?
              </div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2.5 rounded bg-transparent text-blue-500 font-semibold text-sm border border-blue-500 transition-all hover:bg-blue-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="px-4 py-2.5 rounded bg-blue-500 text-white font-semibold text-sm transition-all hover:bg-blue-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-8 max-w-md w-11/12 text-white">
            <h2 className="text-lg font-bold mb-4">Processing Orders...</h2>
            <div className="w-full h-2 bg-[#0a0a0f] rounded overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-4 text-center text-sm text-gray-400">
              {progress}% Complete
            </p>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {operationResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-8 max-w-md w-11/12 text-white">
            <h2 className="text-lg font-bold mb-4">Operation Complete</h2>
            <div className="text-sm text-gray-300 mb-5">
              <div className="mb-2.5 text-emerald-500">
                <strong>{operationResults.success} order{operationResults.success !== 1 ? 's' : ''} processed successfully</strong>
              </div>
              {operationResults.failed > 0 && (
                <div className="text-red-500">
                  <strong>{operationResults.failed} order{operationResults.failed !== 1 ? 's' : ''} failed</strong>
                </div>
              )}
            </div>

            {operationResults.details.length > 0 && (
              <div className="mt-4">
                {operationResults.details.map((detail, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "bg-[#0a0a0f] border rounded p-3 mb-2",
                      detail.message.includes('Successfully')
                        ? "border-l-4 border-l-emerald-500"
                        : "border-l-4 border-l-red-500"
                    )}
                  >
                    <p className="font-semibold text-sm text-gray-300">{detail.orderId}</p>
                    <p className="text-xs text-gray-400 mt-1">{detail.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2.5 justify-end mt-5">
              <button
                onClick={resetOperations}
                className="px-4 py-2.5 rounded bg-blue-500 text-white font-semibold text-sm transition-all hover:bg-blue-600"
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
