'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
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
  CreditCard,
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
  const { items: gateways, loading, error, refetch } = useApiList<GatewayConfig>('/api/v4/payments/gateways');
  const { execute: setDefault } = useApiMutation('PATCH', '/api/v4/payments/gateways/:id/default');

  const [activeTab, setActiveTab] = useState('overview');
  const [isTestPaymentLoading, setIsTestPaymentLoading] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{ gateway: string; ok: boolean } | null>(null);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const transactionFeesComparison = gateways
    .filter((g) => g.code !== 'cod')
    .map((g) => ({
      gateway: g.name,
      percent: g.transactionFeePercent,
      fixed: g.fixedFeeInCents,
      for100: Math.round(g.transactionFeePercent * 100 + g.fixedFeeInCents),
      for1000: Math.round(g.transactionFeePercent * 1000 + g.fixedFeeInCents),
    }));

  const handleSetDefault = async (gatewayId: string) => {
    try {
      await setDefault({ id: gatewayId });
      refetch();
    } catch {
      // error handled by hook
    }
  };

  const handleTestPayment = async (gateway: GatewayConfig) => {
    setIsTestPaymentLoading(gateway.id);
    try {
      const resp = await fetch(`/api/v4/payments/gateways/${gateway.id}/test`, { method: 'POST' });
      setTestResult({ gateway: gateway.name, ok: resp.ok });
    } catch {
      setTestResult({ gateway: gateway.name, ok: false });
    } finally {
      setIsTestPaymentLoading(null);
    }
  };

  const toggleSecretVisibility = (id: string) => {
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
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#12121a]">
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
              <EmptyState
                icon={<CreditCard className="w-8 h-8" />}
                title="No payment gateways configured"
                description="Connect a payment processor to start accepting payments."
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {gateways.map((gateway) => (
                  <Card
                    key={gateway.id}
                    className={cn(
                      'border-2 transition-all bg-[#12121a]',
                      gateway.isDefault ? 'border-blue-500 bg-blue-500/5' : 'border-[#1e1e2e]',
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
                          <Badge variant="primary" className="bg-blue-500 text-white">DEFAULT</Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Status</span>
                        <div className="flex items-center gap-2">
                          {gateway.status === 'connected' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-medium text-green-600">Connected</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <span className="text-sm font-medium text-red-600">Not Configured</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-sm text-gray-400 block mb-2">Supported Methods</span>
                        <div className="flex flex-wrap gap-1">
                          {gateway.supportedMethods.map((method) => (
                            <Badge key={method} variant="default" className="text-xs capitalize bg-[#1a1a2e]">
                              {method.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {gateway.healthScore !== undefined && gateway.status === 'connected' && (
                        <div className="bg-[#1a1a2e] rounded-lg p-3">
                          <span className="text-xs text-gray-400">Health Score</span>
                          <p className="text-lg font-semibold text-blue-500 mt-1">{gateway.healthScore}%</p>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="flex gap-2">
                      {gateway.status === 'connected' && !gateway.isDefault && (
                        <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleSetDefault(gateway.id)}>
                          <Zap className="w-4 h-4 mr-2" />
                          Set as Default
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleTestPayment(gateway)}
                        disabled={gateway.status === 'disconnected' || isTestPaymentLoading !== null}
                      >
                        {isTestPaymentLoading === gateway.id ? (
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        Test
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {testResult && (
              <Card className={cn('border-l-4 bg-[#12121a] border border-[#1e1e2e]', testResult.ok ? 'border-l-emerald-500' : 'border-l-red-500')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    {testResult.ok ? (
                      <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {testResult.ok ? `${testResult.gateway}: Test Successful` : `${testResult.gateway}: Test Failed`}
                      </div>
                      <div className="text-sm text-gray-400">
                        {testResult.ok
                          ? "Gateway is reachable and properly configured."
                          : "Check your gateway configuration or environment variables."}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

                      {gateway.status === 'connected' && gateway.code !== 'cod' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-red-600 hover:text-red-700"
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
                  <Plus className="w-8 h-8 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-white mb-2">Add Payment Gateway</p>
                  <p className="text-xs text-gray-400 mb-4">Connect another payment processor</p>
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
            {gateways.filter((g) => g.status === 'connected' && g.config).length === 0 ? (
              <Card className="p-8 bg-[#12121a] border border-[#1e1e2e] text-center">
                <Shield className="w-8 h-8 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">No gateway credentials are exposed here.</p>
                <p className="text-gray-500 text-xs mt-1">Credentials are managed via environment variables for security.</p>
              </Card>
            ) : (
              gateways.filter((g) => g.status === 'connected' && g.config).map((gateway) => (
                <Card key={gateway.id} className="bg-[#12121a] border border-[#1e1e2e]">
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
                    {gateway.code === 'stripe' && gateway.config?.publicKey && (
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">Public Key</label>
                        <div className="flex gap-2">
                          <Input type="text" value={gateway.config.publicKey} readOnly className="bg-[#1a1a2e] border-[#1e1e2e] text-white" />
                          <Button variant="secondary" size="sm" onClick={() => copyToClipboard(gateway.config?.publicKey ?? '')}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {gateway.code === 'paypal' && gateway.config?.clientId && (
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">Client ID</label>
                        <div className="flex gap-2">
                          <Input type={showSecrets[gateway.id] ? 'text' : 'password'} value={gateway.config.clientId} readOnly className="bg-[#1a1a2e] border-[#1e1e2e] text-white" />
                          <Button variant="secondary" size="sm" onClick={() => toggleSecretVisibility(gateway.id)}>
                            {showSecrets[gateway.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    {gateway.code === 'square' && gateway.config?.accessToken && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Access Token</label>
                          <div className="flex gap-2">
                            <Input type={showSecrets[gateway.id] ? 'text' : 'password'} value={gateway.config.accessToken} readOnly className="bg-[#1a1a2e] border-[#1e1e2e] text-white" />
                            <Button variant="secondary" size="sm" onClick={() => toggleSecretVisibility(gateway.id)}>
                              {showSecrets[gateway.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                        {gateway.config.locationId && (
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Location ID</label>
                            <Input type="text" value={gateway.config.locationId} readOnly className="bg-[#1a1a2e] border-[#1e1e2e] text-white" />
                          </div>
                        )}
                      </>
                    )}
                    <div className="pt-4 border-t border-[#1e1e2e]">
                      <p className="text-xs text-gray-400">
                        <Shield className="w-3 h-3 inline mr-1" />
                        Credentials are managed via environment variables and are never stored in the database.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="space-y-6">
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Transaction Fee Comparison</CardTitle>
                <CardDescription>Estimated fees for different transaction amounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e2e]">
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
                        const savings = maxFee100 - row.for100;
                        return (
                          <tr key={i} className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition">
                            <td className="py-3 px-4 font-medium text-white">{row.gateway}</td>
                            <td className="py-3 px-4 text-right text-white">
                              {row.percent}% + ${(row.fixed / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right text-white">${(row.for100 / 100).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-white">${(row.for1000 / 100).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">
                              {savings > 0 ? (
                                <span className="text-emerald-500 font-medium">+${(savings / 100).toFixed(2)}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 p-4 bg-[#1a1a2e] rounded-lg">
                  <p className="text-xs text-gray-400">
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
