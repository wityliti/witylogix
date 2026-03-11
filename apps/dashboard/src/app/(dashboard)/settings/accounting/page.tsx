/**
 * Accounting Integration Settings Page
 * Configure QuickBooks and Xero integrations
 * OAuth connection, sync settings, and history
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
      const res = await fetch('/api/accounting/status');
      if (!res.ok) throw new Error('Failed to fetch accounting status');
      const data = await res.json();
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
      const res = await fetch(`/api/accounting/sync/history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sync history');
      const data = await res.json();
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
      const res = await fetch(`/api/accounting/disconnect/${provider}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
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

      const res = await fetch('/api/accounting/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: [], // In real implementation, would sync pending invoices
          providers: [manualSyncProvider],
          force: true,
        }),
      });

      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Accounting Integration</h1>
        <p className="text-sm text-muted-foreground">
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
            <Card key={provider} className={cn('relative', connection && 'border-primary')}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-primary">{getProviderIcon(provider)}</div>
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
                      <div className="bg-muted rounded p-2">
                        <div className="text-muted-foreground text-xs">Synced</div>
                        <div className="text-lg font-semibold">{connection.syncedCount || 0}</div>
                      </div>
                      <div className="bg-muted rounded p-2">
                        <div className="text-muted-foreground text-xs">Failed</div>
                        <div className="text-lg font-semibold text-destructive">{connection.failedCount || 0}</div>
                      </div>
                    </div>

                    {connection.lastSyncAt && (
                      <div className="text-xs text-muted-foreground">
                        Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
                      </div>
                    )}

                    {/* Disconnect Button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full text-destructive hover:text-destructive"
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">Sync Settings</TabsTrigger>
            <TabsTrigger value="manual">Manual Sync</TabsTrigger>
            <TabsTrigger value="history">Sync History</TabsTrigger>
          </TabsList>

          {/* Sync Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Sync Settings</CardTitle>
                <CardDescription>Configure automatic invoice synchronization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Auto Sync Toggle */}
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Automatic Sync</p>
                    <p className="text-sm text-muted-foreground">
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
                    <p className="font-medium mb-3">Sync Frequency</p>
                    <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                      <SelectTrigger className="w-full">
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
                <div className="space-y-3 py-3 border-t border-border">
                  <p className="font-medium">Sync Options</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="include-discounts"
                        defaultChecked
                        className="h-4 w-4 rounded border border-input"
                      />
                      <label
                        htmlFor="include-discounts"
                        className="text-sm cursor-pointer"
                      >
                        Include discounts in sync
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="include-taxes"
                        defaultChecked
                        className="h-4 w-4 rounded border border-input"
                      />
                      <label
                        htmlFor="include-taxes"
                        className="text-sm cursor-pointer"
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
            <Card>
              <CardHeader>
                <CardTitle>Manual Sync</CardTitle>
                <CardDescription>Manually sync invoices to your accounting software</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="font-medium">Select Provider</p>
                  <Select
                    value={manualSyncProvider}
                    onValueChange={(v) => setManualSyncProvider(v as 'quickbooks' | 'xero')}
                  >
                    <SelectTrigger>
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
            <Card>
              <CardHeader>
                <CardTitle>Sync History</CardTitle>
                <CardDescription>Recent invoice synchronization events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>External ID</TableHead>
                        <TableHead>Synced At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncHistory.length > 0 ? (
                        syncHistory.map(record => (
                          <TableRow key={record.id}>
                            <TableCell className="font-mono text-sm">{record.invoiceId.slice(0, 8)}</TableCell>
                            <TableCell className="capitalize">{record.provider}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(record.status)}>
                                {record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {record.externalId ? record.externalId.slice(0, 12) : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {record.syncedAt
                                ? new Date(record.syncedAt).toLocaleDateString()
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No sync history
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
