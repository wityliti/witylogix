'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Zap,
  DollarSign,
  Shield,
  TestTube,
  Loader,
} from 'lucide-react';

interface GatewayConfig {
  id: string;
  name: string;
  code: string;
  status: 'connected' | 'disconnected';
  isDefault: boolean;
  isProduction: boolean;
  icon: string;
  supportedMethods: string[];
  transactionFeePercent: number;
  fixedFeeInCents: number;
  config?: {
    clientId?: string;
    accessToken?: string;
    locationId?: string;
    publicKey?: string;
    lastDigits?: string;
    expiryDate?: string;
  };
  healthScore?: number;
  monthlyVolume?: number;
}

export default function PaymentSettingsPage() {
  const { data, loading, error, refetch } = useApiQuery<{ data: GatewayConfig[] }>('/api/v4/payments/gateways');

  const [activeTab, setActiveTab] = useState('overview');
  const [isTestPaymentLoading, setIsTestPaymentLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const gateways: GatewayConfig[] = data?.data ?? [];

  const handleSetDefault = async (id: string): Promise<void> => {
    try {
      await api.patch(`/api/v4/payments/gateways/${id}/default`, {});
      refetch();
    } catch {
      // Error surfaced by refetch
    }
  };

  const handleDisconnect = async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/v4/payments/gateways/${id}`);
      refetch();
    } catch {
      // Error surfaced by refetch
    }
  };

  const handleTestPayment = async (code: string): Promise<void> => {
    setIsTestPaymentLoading(true);
    try {
      await api.post('/api/v4/payments', {
        paymentType: 'TEST',
        paymentMethod: code.toUpperCase(),
        amount: 100,
        currency: 'USD',
        metadata: { test: true },
      });
    } finally {
      setIsTestPaymentLoading(false);
    }
  };

  const toggleSecretVisibility = (id: string): void => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const transactionFeesComparison = gateways
    .filter((g) => g.transactionFeePercent > 0 || g.fixedFeeInCents > 0)
    .map((g) => ({
      gateway: g.name,
      percent: g.transactionFeePercent,
      fixed: g.fixedFeeInCents,
      for100: Math.round(100 * g.transactionFeePercent + g.fixedFeeInCents),
      for1000: Math.round(1000 * g.transactionFeePercent + g.fixedFeeInCents),
    }));

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Payment Gateways"
        subtitle="Configure and manage payment processing providers"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'configuration', label: 'Configuration' },
            { id: 'fees', label: 'Fee Comparison' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="segment"
          className="mb-8"
        />

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {gateways.length === 0 ? (
              <Card className="border-dashed border-2 border-wl-border-default bg-wl-bg-surface">
                <CardContent className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <DollarSign className="w-10 h-10 mx-auto text-wl-text-tertiary mb-4" />
                    <p className="text-sm font-medium text-white mb-2">No payment gateways configured</p>
                    <p className="text-xs text-wl-text-secondary mb-4">
                      Cash on Delivery is always available. Add a payment method to unlock card processing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {gateways.map((gateway) => (
                  <Card
                    key={gateway.id}
                    className={cn(
                      'border-2 transition-all bg-wl-bg-surface',
                      gateway.isDefault ? 'border-wl-info-500 bg-wl-info-bg' : 'border-wl-border-default',
                    )}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{gateway.icon}</span>
                          <div>
                            <CardTitle>{gateway.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">{gateway.code.toUpperCase()}</CardDescription>
                          </div>
                        </div>
                        {gateway.isDefault && (
                          <Badge variant="primary" className="bg-wl-info-500 text-white">DEFAULT</Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-wl-text-secondary">Status</span>
                        <div className="flex items-center gap-2">
                          {gateway.status === 'connected' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-wl-success-500" />
                              <span className="text-sm font-medium text-wl-success-500">Connected</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-wl-danger-500" />
                              <span className="text-sm font-medium text-wl-danger-500">Disconnected</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-sm text-wl-text-secondary block mb-2">Supported Methods</span>
                        <div className="flex flex-wrap gap-1">
                          {gateway.supportedMethods.map((method) => (
                            <Badge key={method} variant="default" className="text-xs capitalize bg-wl-bg-elevated">
                              {method.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {gateway.healthScore !== undefined && (
                        <div className="grid grid-cols-1 gap-3">
                          <div className="bg-wl-bg-elevated rounded-lg p-3">
                            <span className="text-xs text-wl-text-secondary">Health Score</span>
                            <p className="text-lg font-semibold text-wl-info-500 mt-1">{gateway.healthScore}%</p>
                          </div>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="flex gap-2">
                      {gateway.status === 'connected' && !gateway.isDefault && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSetDefault(gateway.id)}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Set as Default
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleTestPayment(gateway.code)}
                        disabled={gateway.status === 'disconnected' || isTestPaymentLoading}
                      >
                        {isTestPaymentLoading ? (
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        Test
                      </Button>

                      {gateway.status === 'connected' && gateway.code !== 'cod' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-wl-danger-500 hover:text-wl-danger-600"
                          onClick={() => handleDisconnect(gateway.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-dashed border-2 border-wl-border-default bg-wl-bg-surface">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Plus className="w-8 h-8 mx-auto text-wl-text-secondary mb-3" />
                  <p className="text-sm font-medium text-white mb-2">Add Payment Gateway</p>
                  <p className="text-xs text-wl-text-secondary mb-4">
                    Connect Stripe, PayPal, or Square. Requires API keys in environment configuration.
                  </p>
                  <Button variant="primary" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Gateway
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'configuration' && (
          <div className="space-y-6">
            {gateways.filter((g) => g.status === 'connected').length === 0 ? (
              <Card className="bg-wl-bg-surface border border-wl-border-default">
                <CardContent className="py-12 text-center text-wl-text-secondary">
                  No connected gateways to configure.
                </CardContent>
              </Card>
            ) : (
              gateways
                .filter((g) => g.status === 'connected')
                .map((gateway) => (
                  <Card key={gateway.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{gateway.icon}</span>
                        <div>
                          <CardTitle>{gateway.name} Configuration</CardTitle>
                          <CardDescription>API keys and credentials</CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {gateway.config?.lastDigits && (
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Card Details</label>
                          <Input
                            type="text"
                            value={`**** **** **** ${gateway.config.lastDigits}${gateway.config.expiryDate ? ` (exp: ${gateway.config.expiryDate})` : ''}`}
                            readOnly
                            className="bg-wl-bg-elevated border-wl-border-default text-white"
                          />
                        </div>
                      )}

                      {gateway.code === 'cod' && (
                        <div className="p-4 bg-wl-bg-elevated rounded-lg">
                          <p className="text-sm text-wl-text-secondary">
                            Cash on Delivery requires no API credentials. Collect payment upon delivery.
                          </p>
                        </div>
                      )}

                      {!gateway.config?.lastDigits && gateway.code !== 'cod' && (
                        <div className="p-4 bg-wl-bg-elevated rounded-lg">
                          <p className="text-sm text-wl-text-secondary">
                            <Shield className="w-3 h-3 inline mr-1" />
                            Credentials are configured via environment variables and never stored in plain text.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Fee Comparison</CardTitle>
                <CardDescription>Estimated fees for your configured payment methods</CardDescription>
              </CardHeader>

              <CardContent>
                {transactionFeesComparison.length === 0 ? (
                  <p className="text-sm text-wl-text-secondary text-center py-8">
                    No fee data available. Configure payment gateways to see fee comparison.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-wl-border-default">
                          <th className="text-left py-3 px-4 font-medium text-white">Gateway</th>
                          <th className="text-right py-3 px-4 font-medium text-white">Rate</th>
                          <th className="text-right py-3 px-4 font-medium text-white">Fee on $100</th>
                          <th className="text-right py-3 px-4 font-medium text-white">Fee on $1,000</th>
                          <th className="text-right py-3 px-4 font-medium text-white">Savings vs Highest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionFeesComparison.map((row, i) => {
                          const maxFee100 = Math.max(...transactionFeesComparison.map((r) => r.for100));
                          const savings100 = maxFee100 - row.for100;
                          return (
                            <tr key={i} className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition">
                              <td className="py-3 px-4"><span className="font-medium text-white">{row.gateway}</span></td>
                              <td className="py-3 px-4 text-right text-white">
                                {row.percent}% + ${(row.fixed / 100).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right text-white">${(row.for100 / 100).toFixed(2)}</td>
                              <td className="py-3 px-4 text-right text-white">${(row.for1000 / 100).toFixed(2)}</td>
                              <td className="py-3 px-4 text-right">
                                {savings100 > 0 ? (
                                  <span className="text-wl-success-500 font-medium">+${(savings100 / 100).toFixed(2)}</span>
                                ) : (
                                  <span className="text-wl-text-secondary">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6 p-4 bg-wl-bg-elevated rounded-lg">
                  <p className="text-xs text-wl-text-secondary">
                    <DollarSign className="w-3 h-3 inline mr-2" />
                    Fees shown are estimates. Actual fees may vary based on payment method, region, and volume discounts.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
