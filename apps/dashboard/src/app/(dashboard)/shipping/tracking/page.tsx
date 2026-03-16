'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TrackingRecord {
  id: string;
  trackingNumber: string;
  orderId: string;
  carrier: string;
  currentStatus: string;
  eta: string | null;
  lastLocation: string;
  createdAt: string;
  recipientName: string;
}

type FilterStatus = 'ALL' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Exception';
type SortBy = 'eta' | 'status' | 'carrier' | 'date';

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'In Transit', label: 'In Transit' },
  { key: 'Out for Delivery', label: 'Out for Delivery' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Exception', label: 'Exception' },
];

const CARRIERS = ['FedEx', 'UPS', 'DHL', 'Canada Post', 'Purolator'];

const statusVariant = (
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    'Delivered': 'success',
    'Out for Delivery': 'warning',
    'In Transit': 'primary',
    'Exception': 'danger',
    'Pending': 'info',
  };
  return map[status] ?? 'default';
};

// Mock shipment tracking data
const MOCK_SHIPMENTS: TrackingRecord[] = Array.from({ length: 24 }, (_, i) => {
  const statuses: FilterStatus[] = ['In Transit', 'Out for Delivery', 'Delivered', 'Exception'];
  const status = statuses[i % statuses.length] as FilterStatus;
  const carrier = CARRIERS[i % CARRIERS.length];

  return {
    id: `ship-${i + 1}`,
    trackingNumber: `TRK${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    orderId: `ORD-${1000 + i}`,
    carrier,
    currentStatus: status,
    eta: status === 'Delivered' ? null : new Date(Date.now() + (1 + Math.random() * 5) * 86400000).toISOString(),
    lastLocation: ['Vancouver, BC', 'Toronto, ON', 'Montreal, QC', 'Calgary, AB'][i % 4],
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    recipientName: ['Emma Watson', 'James Chen', 'Maria Garcia', 'Robert Kim'][i % 4],
  };
});

export default function ShippingTrackingPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [bulkTrackingInput, setBulkTrackingInput] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Filter shipments
  const filteredShipments = useMemo(() => {
    let result = MOCK_SHIPMENTS;

    // Filter by status
    if (filterStatus !== 'ALL') {
      result = result.filter((s) => s.currentStatus === filterStatus);
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.trackingNumber.toLowerCase().includes(q) ||
          s.orderId.toLowerCase().includes(q) ||
          s.recipientName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [filterStatus, searchQuery]);

  // Sort shipments
  const sortedShipments = useMemo(() => {
    const sorted = [...filteredShipments];

    switch (sortBy) {
      case 'eta':
        return sorted.sort(
          (a, b) =>
            (a.eta ? new Date(a.eta).getTime() : Infinity) -
            (b.eta ? new Date(b.eta).getTime() : Infinity)
        );
      case 'status':
        return sorted.sort((a, b) => a.currentStatus.localeCompare(b.currentStatus));
      case 'carrier':
        return sorted.sort((a, b) => a.carrier.localeCompare(b.carrier));
      case 'date':
      default:
        return sorted.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }, [filteredShipments, sortBy]);

  // Count by status
  const statusCounts = useMemo(() => {
    const counts: Record<FilterStatus, number> = {
      'ALL': MOCK_SHIPMENTS.length,
      'In Transit': MOCK_SHIPMENTS.filter((s) => s.currentStatus === 'In Transit').length,
      'Out for Delivery': MOCK_SHIPMENTS.filter((s) => s.currentStatus === 'Out for Delivery').length,
      'Delivered': MOCK_SHIPMENTS.filter((s) => s.currentStatus === 'Delivered').length,
      'Exception': MOCK_SHIPMENTS.filter((s) => s.currentStatus === 'Exception').length,
    };
    return counts;
  }, []);

  // Handle bulk tracking
  const handleBulkTracking = () => {
    const trackingNumbers = bulkTrackingInput
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter((s) => s);

    if (trackingNumbers.length > 0) {
      // Filter to show only these tracking numbers
      const query = trackingNumbers[0];
      setSearchQuery(query);
      setBulkTrackingInput('');
      setShowBulkInput(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const csv =
      'Tracking Number,Order ID,Carrier,Status,ETA,Last Location,Recipient\n' +
      sortedShipments
        .map(
          (s) =>
            `${s.trackingNumber},${s.orderId},${s.carrier},${s.currentStatus},"${s.eta || 'N/A'}",${s.lastLocation},${s.recipientName}`
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracking-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <>
      <Header
        title="Shipment Tracking"
        subtitle={`${MOCK_SHIPMENTS.length} shipments · ${statusCounts['In Transit']} in transit`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={() => setShowBulkInput(!showBulkInput)}>
              + Bulk Tracking
            </Button>
            <Button variant="secondary" size="md" onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Bulk Tracking Input */}
        {showBulkInput && (
          <Card className="border-wl-primary-500/30">
            <CardHeader>
              <CardTitle>Bulk Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                placeholder="Paste multiple tracking numbers (comma, semicolon, or newline separated)"
                value={bulkTrackingInput}
                onChange={(e) => setBulkTrackingInput(e.target.value)}
                className={cn(
                  'w-full p-3 rounded-md border border-wl-border-default',
                  'bg-wl-bg-surface text-wl-text-primary text-sm',
                  'font-mono placeholder:text-wl-text-tertiary',
                  'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
                )}
                rows={4}
              />
              <div className="flex gap-2">
                <Button variant="primary" size="md" onClick={handleBulkTracking}>
                  Track {bulkTrackingInput.split(/[\n,;]/).filter((s) => s.trim()).length} Items
                </Button>
                <Button variant="ghost" size="md" onClick={() => setShowBulkInput(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by tracking number, order ID, or recipient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'flex-1 px-4 py-2 rounded-md border border-wl-border-default',
              'bg-wl-bg-elevated text-wl-text-primary text-sm',
              'placeholder:text-wl-text-tertiary',
              'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
            )}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={cn(
              'px-4 py-2 rounded-md border border-wl-border-default',
              'bg-wl-bg-elevated text-wl-text-primary text-sm',
              'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
            )}
          >
            <option value="date">Sort by Date</option>
            <option value="eta">Sort by ETA</option>
            <option value="status">Sort by Status</option>
            <option value="carrier">Sort by Carrier</option>
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                'border',
                filterStatus === tab.key
                  ? 'bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500'
                  : 'bg-transparent text-wl-text-secondary border-wl-border-default hover:border-wl-border-default'
              )}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-70">({statusCounts[tab.key]})</span>
            </button>
          ))}
        </div>

        {/* Shipments Grid */}
        {sortedShipments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedShipments.map((shipment) => {
              const isExpanded = expandedCard === shipment.id;
              const hoursUntilETA = shipment.eta
                ? Math.floor((new Date(shipment.eta).getTime() - Date.now()) / (1000 * 60 * 60))
                : null;

              return (
                <Card
                  key={shipment.id}
                  hover
                  onClick={() => setExpandedCard(isExpanded ? null : shipment.id)}
                  className={cn(
                    isExpanded && 'ring-2 ring-wl-primary-500'
                  )}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                            {shipment.carrier}
                          </p>
                          <p className="text-lg font-mono font-bold text-wl-primary-400 mt-1">
                            {shipment.trackingNumber}
                          </p>
                        </div>
                        <Badge variant={statusVariant(shipment.currentStatus)}>
                          {shipment.currentStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-wl-text-secondary">
                        Order: {shipment.orderId}
                      </p>
                    </div>

                    {/* Status and Location */}
                    <div className="space-y-2 border-t border-wl-border-subtle pt-4">
                      <div>
                        <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                          Current Location
                        </p>
                        <p className="text-sm text-wl-text-primary mt-1">
                          {shipment.lastLocation}
                        </p>
                      </div>

                      {/* Recipient */}
                      <div>
                        <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                          Recipient
                        </p>
                        <p className="text-sm text-wl-text-primary mt-1">
                          {shipment.recipientName}
                        </p>
                      </div>

                      {/* ETA */}
                      {shipment.eta && (
                        <div>
                          <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                            Estimated Delivery
                          </p>
                          <p className="text-sm text-wl-primary-400 font-medium mt-1">
                            {hoursUntilETA && hoursUntilETA > 0
                              ? `In ${hoursUntilETA}h`
                              : 'Today'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-wl-border-subtle pt-4 space-y-3">
                        <div className="flex gap-2">
                          <Button variant="primary" size="sm" className="flex-1">
                            View Details
                          </Button>
                          <Button variant="secondary" size="sm" className="flex-1">
                            Copy Link
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <p className="text-wl-text-tertiary">No shipments found</p>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Clear search
              </Button>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
