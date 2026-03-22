'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PlatformStats } from './_components/platform-stats';
import { PlatformCard } from './_components/platform-card';
import { CategoryMapping } from './_components/category-mapping';
import { VariantMapping } from './_components/variant-mapping';
import { WebhookConfig } from './_components/webhook-config';
import { ConflictRules } from './_components/conflict-rules';

interface PlatformConnection {
  id: string;
  name: string;
  slug: string;
  logo: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync?: string;
  productsSynced: number;
  ordersSynced: number;
  syncSettings: {
    productSync: { enabled: boolean; direction: 'in' | 'out' | 'both' };
    orderSync: { enabled: boolean; direction: 'in' | 'out' | 'both' };
    inventorySync: { enabled: boolean };
    customerSync: { enabled: boolean };
  };
  webhooks: {
    id: string;
    event: string;
    status: 'active' | 'failed';
    lastTriggered: string;
  }[];
}

const PLATFORMS: PlatformConnection[] = [
  {
    id: 'shop-001',
    name: 'Shopify',
    slug: 'shopify',
    logo: '🛍',
    status: 'connected',
    lastSync: '2026-03-12T14:32:00Z',
    productsSynced: 1247,
    ordersSynced: 3891,
    syncSettings: {
      productSync: { enabled: true, direction: 'both' },
      orderSync: { enabled: true, direction: 'in' },
      inventorySync: { enabled: true },
      customerSync: { enabled: true },
    },
    webhooks: [
      {
        id: 'hook-001',
        event: 'products/update',
        status: 'active',
        lastTriggered: '2026-03-12T14:31:00Z',
      },
      {
        id: 'hook-002',
        event: 'orders/create',
        status: 'active',
        lastTriggered: '2026-03-12T14:28:00Z',
      },
      {
        id: 'hook-003',
        event: 'inventory/update',
        status: 'failed',
        lastTriggered: '2026-03-12T13:45:00Z',
      },
    ],
  },
  {
    id: 'woo-001',
    name: 'WooCommerce',
    slug: 'woocommerce',
    logo: '🔧',
    status: 'connected',
    lastSync: '2026-03-12T14:15:00Z',
    productsSynced: 856,
    ordersSynced: 2145,
    syncSettings: {
      productSync: { enabled: true, direction: 'both' },
      orderSync: { enabled: true, direction: 'both' },
      inventorySync: { enabled: true },
      customerSync: { enabled: false },
    },
    webhooks: [
      {
        id: 'hook-004',
        event: 'product.updated',
        status: 'active',
        lastTriggered: '2026-03-12T14:12:00Z',
      },
      {
        id: 'hook-005',
        event: 'order.created',
        status: 'active',
        lastTriggered: '2026-03-12T14:00:00Z',
      },
    ],
  },
  {
    id: 'mag-001',
    name: 'Magento',
    slug: 'magento',
    logo: '📊',
    status: 'disconnected',
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: 'both' },
      orderSync: { enabled: false, direction: 'in' },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: 'bigc-001',
    name: 'BigCommerce',
    slug: 'bigcommerce',
    logo: '📈',
    status: 'disconnected',
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: 'both' },
      orderSync: { enabled: false, direction: 'in' },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: 'amz-001',
    name: 'Amazon',
    slug: 'amazon',
    logo: '🟠',
    status: 'disconnected',
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: 'in' },
      orderSync: { enabled: false, direction: 'in' },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: 'ebay-001',
    name: 'eBay',
    slug: 'ebay',
    logo: '🏷',
    status: 'error',
    lastSync: '2026-03-11T10:00:00Z',
    productsSynced: 432,
    ordersSynced: 1205,
    syncSettings: {
      productSync: { enabled: true, direction: 'both' },
      orderSync: { enabled: true, direction: 'in' },
      inventorySync: { enabled: true },
      customerSync: { enabled: false },
    },
    webhooks: [
      {
        id: 'hook-006',
        event: 'ItemEnded',
        status: 'failed',
        lastTriggered: '2026-03-11T09:45:00Z',
      },
    ],
  },
  {
    id: 'etsy-001',
    name: 'Etsy',
    slug: 'etsy',
    logo: '✨',
    status: 'disconnected',
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: 'both' },
      orderSync: { enabled: false, direction: 'in' },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: 'sq-001',
    name: 'Square Online',
    slug: 'square',
    logo: '⬛',
    status: 'disconnected',
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: 'both' },
      orderSync: { enabled: false, direction: 'in' },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
];

export default function ECommerceIntegrationPage() {
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(
    'shop-001'
  );
  const [selectedTab, setSelectedTab] = useState<
    'overview' | 'mapping' | 'webhooks' | 'conflict'
  >('overview');

  const connected = PLATFORMS.filter((p) => p.status === 'connected');
  const totalProducts = PLATFORMS.reduce((sum, p) => sum + p.productsSynced, 0);
  const totalOrders = PLATFORMS.reduce((sum, p) => sum + p.ordersSynced, 0);
  const syncErrors = PLATFORMS.filter((p) => p.status === 'error').length;

  return (
    <>
      <Header
        title="E-Commerce Platforms"
        subtitle={`${connected.length} connected · ${totalProducts.toLocaleString()} products · ${totalOrders.toLocaleString()} orders`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlatformStats
          connected={connected.length}
          totalProducts={totalProducts}
          totalOrders={totalOrders}
          syncErrors={syncErrors}
        />

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-[#1a1a2e] rounded-lg p-1 mb-8">
          {(['overview', 'mapping', 'webhooks', 'conflict'] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  selectedTab === tab
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-400'
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            )
          )}
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Platform Status</h2>
              <Button variant="primary" className="inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Connect Platform
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {PLATFORMS.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  isExpanded={expandedPlatform === platform.id}
                  onToggleExpand={(id) =>
                    setExpandedPlatform(expandedPlatform === id ? null : id)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Mapping Tab */}
        {selectedTab === 'mapping' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Product Mapping</h2>
            <CategoryMapping />
            <VariantMapping />
          </div>
        )}

        {/* Webhooks Tab */}
        {selectedTab === 'webhooks' && (
          <WebhookConfig platforms={PLATFORMS} />
        )}

        {/* Conflict Tab */}
        {selectedTab === 'conflict' && <ConflictRules />}
      </div>
    </>
  );
}
