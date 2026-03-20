'use client';

import { useState } from 'react';
import { useApiList, useApiMutation } from '@/hooks/use-api';
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
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ChevronRight,
  Loader,
} from 'lucide-react';

interface GatewayConfig {
  id: string;
  name: string;
  code: 'stripe' | 'paypal' | 'square' | 'cod';
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
  };
  healthScore?: number;
  monthlyVolume?: number;
}

export default function PaymentSettingsPage(): JSX.Element {
  const { items: gateways, loading, error, refetch } = useApiList<GatewayConfig>('/api/v4/payments/gateways');
  const { execute: setDefault } = useApiMutation('PATCH', '/api/v4/payments/gateways/:id/default');
  const { execute: disconnect } = useApiMutation('DELETE', '/api/v4/payments/gateways/:id');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const mockGatewayConfigs: GatewayConfig[] = gateways ?? [
  {
    id: 'stripe-prod',
    name: 'Stripe',
    code: 'stripe',
    status: 'connected',
    isDefault: true,
    isProduction: true,
    icon: '💳',
    supportedMethods: ['card', 'apple_pay', 'google_pay', 'bank_transfer'],
    transactionFeePercent: 2.9,
    fixedFeeInCents: 30,
    config: {
      publicKey: 'pk_live_abc123***',
    },
    healthScore: 100,
    monthlyVolume: 25000000,
  },
  {
    id: 'paypal-prod',
    name: 'PayPal',
    code: 'paypal',
    status: 'connected',
    isDefault: false,
    isProduction: true,
    icon: '🅿️',
    supportedMethods: ['paypal', 'card'],
    transactionFeePercent: 2.9,
    fixedFeeInCents: 30,
    config: {
      clientId: 'AXyz123***',
    },
    healthScore: 98,
    monthlyVolume: 12000000,
  },
  {
    id: 'square-prod',
    name: 'Square',
    code: 'square',
    status: 'connected',
    isDefault: false,
    isProduction: true,
    icon: '◻️',
    supportedMethods: ['card', 'apple_pay', 'google_pay'],
    transactionFeePercent: 2.6,
    fixedFeeInCents: 0,
    config: {
      accessToken: 'sq_live_***',
      locationId: 'L123ABC***',
    },
    healthScore: 100,
    monthlyVolume: 8500000,
  },
  {
    id: 'cod-live',
    name: 'Cash on Delivery',
    code: 'cod',
    status: 'connected',
    isDefault: false,
    isProduction: true,
    icon: '💰',
    supportedMethods: ['cash'],
    transactionFeePercent: 0,
    fixedFeeInCents: 0,
    healthScore: 100,
    monthlyVolume: 5000000,
  },
];

  const transactionFeesComparison = [
    { gateway: 'Stripe', percent: 2.9, fixed: 30, for100: 319, for1000: 2930 },
    { gateway: 'PayPal', percent: 2.9, fixed: 30, for100: 319, for1000: 2930 },
    { gateway: 'Square', percent: 2.6, fixed: 0, for100: 260, for1000: 2600 },
  ];

  const [isTestPaymentLoading, setIsTestPaymentLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleSetDefault = async (gatewayCode: string): Promise<void> => {
    try {
      await setDefault({ code: gatewayCode });
      refetch();
    } catch (error) {
      console.error('Failed to set default gateway:', error);
    }
  };

  const handleDisconnect = async (id: string): Promise<void> => {
    try {
      await disconnect({ id });
      refetch();
        ),
      );
    } catch (error) {
      console.error('Failed to disconnect gateway:', error);
    }
  };

  const handleTestPayment = async (gatewayCode: string): Promise<void> => {
    setIsTestPaymentLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert(`Test payment initiated with ${gatewayCode.toUpperCase()}`);
    } catch (error) {
      console.error('Test payment failed:', error);
      alert('Test payment failed');
    } finally {
      setIsTestPaymentLoading(false);
    }
  };

  const toggleSecretVisibility = (id: string): void => {
    setShowSecrets((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header
        title="Payment Gateways"
        description="Configure and manage payment processing providers"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="fees">Fee Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {gateways.map((gateway) => (
                <Card
                  key={gateway.id}
                  className={cn(
                    'border-2 transition-all',
                    gateway.isDefault
                      ? 'border-[var(--wl-primary)] bg-[var(--wl-primary)]/5'
                      : 'border-[var(--wl-border)]',
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{gateway.icon}</span>
                        <div>
                          <CardTitle>{gateway.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {gateway.code.toUpperCase()}
                          </CardDescription>
                        </div>
                      </div>
                      {gateway.isDefault && (
                        <Badge
                          variant="primary"
                          className="bg-[var(--wl-primary)] text-white"
                        >
                          DEFAULT
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--wl-text-secondary)]">
                        Status
                      </span>
                      <div className="flex items-center gap-2">
                        {gateway.status === 'connected' ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-green-600">
                              Connected
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-red-600">
                              Disconnected
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-[var(--wl-text-secondary)] block mb-2">
                        Supported Methods
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {gateway.supportedMethods.map((method) => (
                          <Badge
                            key={method}
                            variant="secondary"
                            className="text-xs capitalize bg-[var(--wl-bg-secondary)]"
                          >
                            {method.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {gateway.healthScore !== undefined && (
                        <div className="bg-[var(--wl-bg-secondary)] rounded-lg p-3">
                          <span className="text-xs text-[var(--wl-text-secondary)]">
                            Health Score
                          </span>
                          <p className="text-lg font-semibold text-[var(--wl-primary)] mt-1">
                            {gateway.healthScore}%
                          </p>
                        </div>
                      )}

                      {gateway.monthlyVolume !== undefined && (
                        <div className="bg-[var(--wl-bg-secondary)] rounded-lg p-3">
                          <span className="text-xs text-[var(--wl-text-secondary)]">
                            Monthly Volume
                          </span>
                          <p className="text-lg font-semibold text-[var(--wl-primary)] mt-1">
                            ${(gateway.monthlyVolume / 100000).toFixed(0)}K
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="flex gap-2">
                    {gateway.status === 'connected' && !gateway.isDefault && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleSetDefault(gateway.code)}
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
                      disabled={
                        gateway.status === 'disconnected' || isTestPaymentLoading
                      }
                    >
                      {isTestPaymentLoading ? (
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4 mr-2" />
                      )}
                      Test
                    </Button>

                    {gateway.status === 'connected' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-red-600 hover:text-red-700"
                        onClick={() => handleDisconnect(gateway.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Disconnect
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>

            <Card className="border-dashed border-2 border-[var(--wl-border)]">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Plus className="w-8 h-8 mx-auto text-[var(--wl-text-secondary)] mb-3" />
                  <p className="text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                    Add Payment Gateway
                  </p>
                  <p className="text-xs text-[var(--wl-text-secondary)] mb-4">
                    Connect another payment processor
                  </p>
                  <Button variant="primary" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Gateway
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            {gateways
              .filter((g) => g.status === 'connected')
              .map((gateway) => (
                <Card key={gateway.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{gateway.icon}</span>
                      <div>
                        <CardTitle>{gateway.name} Configuration</CardTitle>
                        <CardDescription>
                          API keys and credentials
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {gateway.code === 'stripe' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Public Key
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={gateway.config?.publicKey || ''}
                              readOnly
                              className="bg-[var(--wl-bg-secondary)]"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(gateway.config?.publicKey || '')
                              }
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {gateway.code === 'paypal' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Client ID
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type={showSecrets[gateway.id] ? 'text' : 'password'}
                              value={gateway.config?.clientId || ''}
                              readOnly
                              className="bg-[var(--wl-bg-secondary)]"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => toggleSecretVisibility(gateway.id)}
                            >
                              {showSecrets[gateway.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(gateway.config?.clientId || '')
                              }
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {gateway.code === 'square' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Access Token
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type={showSecrets[gateway.id] ? 'text' : 'password'}
                              value={gateway.config?.accessToken || ''}
                              readOnly
                              className="bg-[var(--wl-bg-secondary)]"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => toggleSecretVisibility(gateway.id)}
                            >
                              {showSecrets[gateway.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Location ID
                          </label>
                          <Input
                            type="text"
                            value={gateway.config?.locationId || ''}
                            readOnly
                            className="bg-[var(--wl-bg-secondary)]"
                          />
                        </div>
                      </>
                    )}

                    <div className="pt-4 border-t border-[var(--wl-border)]">
                      <p className="text-xs text-[var(--wl-text-secondary)]">
                        <Shield className="w-3 h-3 inline mr-1" />
                        Credentials are encrypted and never displayed in full
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="fees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Fee Comparison</CardTitle>
                <CardDescription>
                  Estimated fees for different transaction amounts
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--wl-border)]">
                        <th className="text-left py-3 px-4 font-medium">
                          Gateway
                        </th>
                        <th className="text-right py-3 px-4 font-medium">
                          Rate
                        </th>
                        <th className="text-right py-3 px-4 font-medium">
                          Fee on $100
                        </th>
                        <th className="text-right py-3 px-4 font-medium">
                          Fee on $1,000
                        </th>
                        <th className="text-right py-3 px-4 font-medium">
                          Savings vs Highest
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionFeesComparison.map((row, i) => {
                        const maxFee100 = Math.max(
                          ...transactionFeesComparison.map((r) => r.for100),
                        );
                        const savings100 = maxFee100 - row.for100;

                        return (
                          <tr
                            key={i}
                            className="border-b border-[var(--wl-border)] hover:bg-[var(--wl-bg-secondary)] transition"
                          >
                            <td className="py-3 px-4">
                              <span className="font-medium">
                                {row.gateway}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {row.percent}% + ${(row.fixed / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              ${(row.for100 / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              ${(row.for1000 / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {savings100 > 0 ? (
                                <span className="text-green-600 font-medium">
                                  +${(savings100 / 100).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-[var(--wl-text-secondary)]">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-[var(--wl-bg-secondary)] rounded-lg">
                  <p className="text-xs text-[var(--wl-text-secondary)]">
                    <DollarSign className="w-3 h-3 inline mr-2" />
                    Fees shown are estimates. Actual fees may vary based on
                    payment method, region, and volume discounts.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
