/**
 * Accounting Integration Settings Page
 * Configure QuickBooks and Xero integrations
 * OAuth connection, sync settings, and history
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AccountingConnection {
  id: string;
  provider: 'quickbooks' | 'xero';
  email?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  syncedCount?: number;
  failedCount?: number;
}

interface SyncRecord {
  id: string;
  invoiceId: string;
  provider: 'quickbooks' | 'xero';
  status: 'pending' | 'synced' | 'failed' | 'skipped';
  externalId?: string;
  errorMessage?: string;
  syncedAt?: Date;
  createdAt: Date;
}

export default function AccountingSettingsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<AccountingConnection[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [autoSync, setAutoSync] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState('daily');
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);
  const [manualSyncProvider, setManualSyncProvider] = useState<'quickbooks' | 'xero'>('quickbooks');

  // Fetch accounting status on mount and when tab changes
  useEffect(() => {
    fetchAccountingStatus();
    fetchSyncHistory();
  }, []);

  async function fetchAccountingStatus() {
    try {
      setLoading(true);
      const data = await api.get<{ connections: AccountingConnection[]; hasConnections: boolean }>('/api/accounting/status');
      setConnections(data.connections || []);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSyncHistory(provider?: string) {
    try {
      const params = new URLSearchParams({ limit: '10', offset: '0' });
      if (provider) params.append('provider', provider);
      const data = await api.get<{ records: SyncRecord[]; total: number }>(`/api/accounting/sync/history?${params}`);
      setSyncHistory(data.records || []);
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    }
  }

  async function handleConnect(provider: 'quickbooks' | 'xero') {
    try {
      // This will redirect to OAuth
      window.location.href = `/api/accounting/connect/${provider}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  async function handleDisconnect(provider: 'quickbooks' | 'xero') {
    try {
      setDisconnectingProvider(provider);
      await api.delete(`/api/accounting/disconnect/${provider}`);
      await fetchAccountingStatus();
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnection failed');
    } finally {
      setDisconnectingProvider(null);
    }
  }

  async function handleManualSync() {
    try {
      if (!connections.some(c => c.provider === manualSyncProvider && c.isActive)) {
        setError(`No active ${manualSyncProvider} connection`);
        return;
      }

      await api.post('/api/accounting/sync/batch', {
        invoiceIds: [],
        providers: [manualSyncProvider],
        force: true,
      });

      // Refresh history
      await fetchSyncHistory(manualSyncProvider);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  }

  const getProviderLabel = (provider: string) => {
    return provider === 'quickbooks' ? 'QuickBooks Online' : 'Xero';
  };

  const getProviderIcon = (provider: string) => {
    return provider === 'quickbooks' ? (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      </svg>
    ) : (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      </svg>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return 'success';
      case 'failed':
        return 'danger';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6 bg-wl-bg-root min-h-screen p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Accounting Integration</h1>
        <p className="text-sm text-wl-text-secondary">
          Connect your accounting software to automatically sync invoices and payments
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {['quickbooks', 'xero'].map(provider => {
          const connection = connections.find(c => c.provider === provider && c.isActive);

          return (
            <Card key={provider} className={cn('relative border border-wl-border-default bg-wl-bg-surface', connection && 'border-wl-info-500')}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-wl-info-500">{getProviderIcon(provider)}</div>
                    <div>
                      <CardTitle className="text-lg">{getProviderLabel(provider)}</CardTitle>
                      <CardDescription>
                        {connection
                          ? `Connected as ${connection.email || 'Unknown'}`
                          : 'Not connected'}
                      </CardDescription>
                    </div>
                  </div>
                  {connection && (
                    <Badge variant="success">Connected</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {connection ? (
                  <>
                    {/* Connection Stats */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-wl-bg-elevated rounded p-2">
                        <div className="text-wl-text-secondary text-xs">Synced</div>
                        <div className="text-lg font-semibold text-white">{connection.syncedCount || 0}</div>
                      </div>
                      <div className="bg-wl-bg-elevated rounded p-2">
                        <div className="text-wl-text-secondary text-xs">Failed</div>
                        <div className="text-lg font-semibold text-wl-danger-500">{connection.failedCount || 0}</div>
                      </div>
                    </div>

                    {connection.lastSyncAt && (
                      <div className="text-xs text-wl-text-secondary">
                        Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
                      </div>
                    )}

                    {/* Disconnect Button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full text-wl-danger-500 hover:text-wl-danger-500"
                          disabled={disconnectingProvider === provider}
                        >
                          Disconnect
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Disconnect {getProviderLabel(provider)}</DialogTitle>
                          <DialogDescription>
                            This will stop syncing invoices to {getProviderLabel(provider)}. You can reconnect anytime.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              // Close dialog via escape
                              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => {
                              handleDisconnect(provider as 'quickbooks' | 'xero');
                              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                            }}
                          >
                            Disconnect
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => handleConnect(provider as 'quickbooks' | 'xero')}
                  >
                    Connect {getProviderLabel(provider)}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      {connections.some(c => c.isActive) && (
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-wl-bg-elevated border border-wl-border-default">
            <TabsTrigger value="settings">Sync Settings</TabsTrigger>
            <TabsTrigger value="manual">Manual Sync</TabsTrigger>
            <TabsTrigger value="history">Sync History</TabsTrigger>
          </TabsList>

          {/* Sync Settings Tab */}
          <TabsContent value="settings">
            <Card className="border border-wl-border-default bg-wl-bg-surface">
              <CardHeader>
                <CardTitle>Sync Settings</CardTitle>
                <CardDescription>Configure automatic invoice synchronization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Auto Sync Toggle */}
                <div className="flex items-center justify-between py-3 border-b border-wl-border-default">
                  <div>
                    <p className="font-medium text-white">Automatic Sync</p>
                    <p className="text-sm text-wl-text-secondary">
                      Automatically sync new invoices to all connected providers
                    </p>
                  </div>
                  <Switch
                    checked={autoSync}
                    onCheckedChange={setAutoSync}
                  />
                </div>

                {/* Sync Frequency */}
                {autoSync && (
                  <div className="py-3">
                    <p className="font-medium mb-3 text-white">Sync Frequency</p>
                    <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                      <SelectTrigger className="w-full border-wl-border-default bg-wl-bg-elevated text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Every Hour</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Sync Options */}
                <div className="space-y-3 py-3 border-t border-wl-border-default">
                  <p className="font-medium text-white">Sync Options</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="include-discounts"
                        defaultChecked
                        className="h-4 w-4 rounded border border-wl-border-default"
                      />
                      <label
                        htmlFor="include-discounts"
                        className="text-sm cursor-pointer text-white"
                      >
                        Include discounts in sync
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="include-taxes"
                        defaultChecked
                        className="h-4 w-4 rounded border border-wl-border-default"
                      />
                      <label
                        htmlFor="include-taxes"
                        className="text-sm cursor-pointer text-white"
                      >
                        Include taxes in sync
                      </label>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <Button variant="primary" className="w-full">
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Sync Tab */}
          <TabsContent value="manual">
            <Card className="border border-wl-border-default bg-wl-bg-surface">
              <CardHeader>
                <CardTitle>Manual Sync</CardTitle>
                <CardDescription>Manually sync invoices to your accounting software</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="font-medium text-white">Select Provider</p>
                  <Select
                    value={manualSyncProvider}
                    onValueChange={(v) => setManualSyncProvider(v as 'quickbooks' | 'xero')}
                  >
                    <SelectTrigger className="border-wl-border-default bg-wl-bg-elevated text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {connections
                        .filter(c => c.isActive)
                        .map(c => (
                          <SelectItem key={c.provider} value={c.provider}>
                            {getProviderLabel(c.provider)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <AlertDescription>
                    This will sync all pending invoices to the selected provider. The process may take a few minutes.
                  </AlertDescription>
                </Alert>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleManualSync}
                >
                  Sync Now
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync History Tab */}
          <TabsContent value="history">
            <Card className="border border-wl-border-default bg-wl-bg-surface">
              <CardHeader>
                <CardTitle>Sync History</CardTitle>
                <CardDescription>Recent invoice synchronization events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table>
                    <TableHeader>
                      <TableRow className="border-b border-wl-border-default">
                        <TableHead className="text-white">Invoice</TableHead>
                        <TableHead className="text-white">Provider</TableHead>
                        <TableHead className="text-white">Status</TableHead>
                        <TableHead className="text-white">External ID</TableHead>
                        <TableHead className="text-white">Synced At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncHistory.length > 0 ? (
                        syncHistory.map(record => (
                          <TableRow key={record.id} className="border-b border-wl-border-default">
                            <TableCell className="font-mono text-sm text-white">{record.invoiceId.slice(0, 8)}</TableCell>
                            <TableCell className="capitalize text-white">{record.provider}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(record.status)}>
                                {record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-white">
                              {record.externalId ? record.externalId.slice(0, 12) : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-white">
                              {record.syncedAt
                                ? new Date(record.syncedAt).toLocaleDateString()
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-wl-text-secondary py-8">
                            No sync history
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
