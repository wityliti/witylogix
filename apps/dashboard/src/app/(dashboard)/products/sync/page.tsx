"use client";

import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { FieldMappingEditor } from "@/components/sync/field-mapping-editor";
import { SyncScheduleConfig } from "@/components/sync/sync-schedule-config";
import {
  useFieldMappings,
  useSyncSchedule,
  useProductPreview,
} from "@/hooks/use-product-sync";
import { useApiList } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  RefreshCw,
  Save,
  Download,
  Package,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   PRODUCT CATALOG SYNC PAGE — Field mapping & sync config
   Data: GET /api/v4/integrations?category=ECOMMERCE
   ═══════════════════════════════════════════════════════════ */

interface PlatformField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  sampleValue?: string;
}

interface ConnectedPlatform {
  id: string;
  name: string;
  platform: string;
  status: 'synced' | 'syncing' | 'error' | 'pending';
  lastSyncAt: string | null;
  productCount: number;
  fields: PlatformField[];
}

/* Per-platform field schemas — these are the documented product schemas for each platform. */
const PLATFORM_FIELDS: Record<string, ConnectedPlatform['fields']> = {
  shopify: [
    { id: 'sf-id', name: 'ID', type: 'string', required: true, sampleValue: 'gid://shopify/Product/12345' },
    { id: 'sf-title', name: 'Title', type: 'string', required: true, sampleValue: 'Premium Cardboard Box' },
    { id: 'sf-type', name: 'Product Type', type: 'string', required: false, sampleValue: 'Packaging' },
    { id: 'sf-vendor', name: 'Vendor', type: 'string', required: false, sampleValue: 'PackPro Inc' },
    { id: 'sf-price', name: 'Price', type: 'number', required: false, sampleValue: '24.99' },
    { id: 'sf-weight', name: 'Weight (lbs)', type: 'number', required: false, sampleValue: '0.5' },
    { id: 'sf-inventory', name: 'Inventory Count', type: 'number', required: true, sampleValue: '500' },
    { id: 'sf-status', name: 'Status', type: 'string', required: false, sampleValue: 'active' },
  ],
  woocommerce: [
    { id: 'wc-id', name: 'Product ID', type: 'string', required: true, sampleValue: '12345' },
    { id: 'wc-name', name: 'Name', type: 'string', required: true, sampleValue: 'Premium Box' },
    { id: 'wc-sku', name: 'SKU', type: 'string', required: false, sampleValue: 'BOX-001' },
    { id: 'wc-price', name: 'Regular Price', type: 'number', required: false, sampleValue: '24.99' },
    { id: 'wc-stock', name: 'Stock Quantity', type: 'number', required: false, sampleValue: '500' },
    { id: 'wc-status', name: 'Status', type: 'string', required: false, sampleValue: 'publish' },
  ],
  magento: [
    { id: 'mg-sku', name: 'SKU', type: 'string', required: true, sampleValue: 'BOX-MED-001' },
    { id: 'mg-name', name: 'Product Name', type: 'string', required: true, sampleValue: 'Medium Box' },
    { id: 'mg-price', name: 'Price', type: 'number', required: true, sampleValue: '24.99' },
    { id: 'mg-qty', name: 'Quantity', type: 'number', required: false, sampleValue: '500' },
    { id: 'mg-status', name: 'Status', type: 'string', required: false, sampleValue: '1' },
  ],
};

const DEFAULT_FIELDS: ConnectedPlatform['fields'] = [
  { id: 'df-id', name: 'Product ID', type: 'string', required: true },
  { id: 'df-name', name: 'Product Name', type: 'string', required: true },
  { id: 'df-sku', name: 'SKU', type: 'string', required: false },
  { id: 'df-price', name: 'Price', type: 'number', required: false },
  { id: 'df-qty', name: 'Quantity', type: 'number', required: false },
];

interface RawConnection {
  id: string;
  providerName: string;
  status: string;
  lastSyncTime: string | null;
  apiCallsCount: number;
  category: string;
}

function mapConnection(c: RawConnection): ConnectedPlatform {
  const platformKey = c.id.toLowerCase().replace(/[^a-z]/g, '');
  const matchKey = Object.keys(PLATFORM_FIELDS).find((k) => platformKey.includes(k));
  const fields = matchKey ? PLATFORM_FIELDS[matchKey] : DEFAULT_FIELDS;
  const status: ConnectedPlatform['status'] =
    c.status === 'connected' ? 'synced'
    : c.status === 'error' ? 'error'
    : c.status === 'pending' ? 'pending'
    : 'pending';

  return {
    id: c.id,
    name: c.providerName,
    platform: c.providerName,
    status,
    lastSyncAt: c.lastSyncTime,
    productCount: c.apiCallsCount,
    fields,
  };
}

type FieldType = 'string' | 'number' | 'boolean' | 'date';
interface SyncField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  sampleValue?: string;
}

const WITYLOGIX_FIELDS: SyncField[] = [
  { id: 'wl-id', name: 'Product ID', type: 'string', required: true, sampleValue: 'PROD-12345' },
  { id: 'wl-name', name: 'Product Name', type: 'string', required: true, sampleValue: 'Cardboard Box Medium' },
  { id: 'wl-sku', name: 'SKU', type: 'string', required: true, sampleValue: 'BOX-MED-001' },
  { id: 'wl-category', name: 'Category', type: 'string', required: false, sampleValue: 'Packaging' },
  { id: 'wl-price', name: 'Price (USD)', type: 'number', required: false, sampleValue: '24.99' },
  { id: 'wl-weight', name: 'Weight (lbs)', type: 'number', required: false, sampleValue: '0.5' },
  { id: 'wl-qty', name: 'Available Quantity', type: 'number', required: true, sampleValue: '500' },
  { id: 'wl-status', name: 'Status', type: 'string', required: false, sampleValue: 'active' },
  { id: 'wl-updated', name: 'Last Updated', type: 'date', required: false, sampleValue: '2026-03-16T10:30:00Z' },
];

function mapIntegrationToPlatform(raw: RawIntegration): ConnectedPlatform {
  let status: ConnectedPlatform['status'] = 'pending';
  if (raw.isEnabled) {
    if (raw.healthStatus === 'DOWN' || raw.healthStatus === 'DEGRADED') status = 'error';
    else if (raw.healthStatus === 'SYNCING') status = 'syncing';
    else status = 'synced';
  }
  const slug = raw.slug.toLowerCase();
  const productCount = typeof raw.config?.productCount === 'number' ? raw.config.productCount : 0;
  return {
    id: raw.slug,
    name: raw.name,
    platform: raw.name,
    status,
    lastSyncAt: raw.lastSyncAt,
    productCount,
    fields: PLATFORM_FIELDS[slug] ?? DEFAULT_FIELDS,
  };
}

const syncStatusIcon = {
  synced: <Check className="w-4 h-4" />,
  syncing: <RefreshCw className="w-4 h-4 animate-spin" />,
  error: <AlertCircle className="w-4 h-4" />,
  pending: <Clock className="w-4 h-4" />,
};

const syncStatusBadgeVariant: Record<string, 'success' | 'info' | 'danger' | 'warning'> = {
  synced: 'success',
  syncing: 'info',
  error: 'danger',
  pending: 'warning',
};

export default function ProductSyncPage() {
  const { items: rawConnections, loading: connectionsLoading } = useApiList<RawConnection>(
    '/api/v4/integrations/connections'
  );
  const platforms = rawConnections
    .filter((c) => ['ecommerce', 'marketplace'].includes(c.category))
    .map(mapConnection);

  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'mapping' | 'schedule' | 'preview'>('mapping');
  const [testSyncInProgress, setTestSyncInProgress] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateInput, setShowTemplateInput] = useState(false);

  const effectivePlatformId = selectedPlatformId || platforms[0]?.id || '';
  const selectedPlatform = platforms.find((p) => p.id === effectivePlatformId);
  const {
    mappings,
    addMapping,
    removeMapping,
    updateTransformer,
    autoMapFields,
    saveMappings,
  } = useFieldMappings(effectivePlatformId);

  const {
    schedule,
    setSchedule,
  } = useSyncSchedule(effectivePlatformId);

  const {
    previewProduct,
  } = useProductPreview(effectivePlatformId, mappings);

  const unmappedRequired = useMemo(() => {
    if (!selectedPlatform) return [];
    const mappedWLFields = mappings.map((m) => m.targetFieldId);
    return WITYLOGIX_FIELDS.filter((f) => f.required && !mappedWLFields.includes(f.id));
  }, [mappings, selectedPlatform]);

  const handleAutoMap = () => {
    if (selectedPlatform) autoMapFields(selectedPlatform.fields, WITYLOGIX_FIELDS);
  };

  const handleTestSync = async () => {
    if (!selectedPlatform) return;
    setTestSyncInProgress(true);
    const sampleProduct = Object.fromEntries(
      selectedPlatform.fields.map((f) => [f.name, f.sampleValue ?? ""]),
    );
    await runPreview(sampleProduct);
    setTestSyncInProgress(false);
  };

  const handleSaveTemplate = () => {
    if (templateName.trim()) {
      saveMappings(templateName);
      setTemplateName('');
      setShowTemplateInput(false);
    }
  };

  if (loadingPlatforms) {
    return (
      <div className="space-y-6">
        <Header title="Product Catalog Sync" subtitle="Configure field mappings and sync schedules for connected platforms" />
        <Card>
          <CardHeader><CardTitle>Connected Platforms</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (platformsError) {
    return (
      <div className="space-y-6">
        <Header title="Product Catalog Sync" subtitle="Configure field mappings and sync schedules for connected platforms" />
        <ErrorState message={platformsError} onRetry={fetchPlatforms} />
      </div>
    );
  }

  if (connectionsLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <Header
        title="Product Catalog Sync"
        subtitle="Configure field mappings and sync schedules for connected platforms"
      />

      {/* Connected Platforms Section */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          {platforms.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="font-medium mb-1">No ecommerce platforms connected</p>
              <p className="text-sm">Connect a platform in Integrations to start syncing products.</p>
            </div>
          ) : (
          <div className="grid gap-3">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatformId(platform.id)}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border transition-all',
                  effectivePlatformId === platform.id
                    ? 'hover:bg-[#1a1a2e] border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-[#12121a] border-[#1e1e2e] hover:border-[#1e1e2e]'
                )}
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">
                      {platform.name}
                    </h4>
                    <p className="text-sm text-gray-300">
                      {platform.platform} • {platform.productCount} products
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={syncStatusBadgeVariant[platform.status]} className="gap-1">
                        {syncStatusIcon[platform.status]}
                        {platform.status.charAt(0).toUpperCase() + platform.status.slice(1)}
                      </Badge>
                      {platform.lastSyncAt && (
                        <span className="text-xs text-gray-300">
                          {new Date(platform.lastSyncAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <ChevronRight
                      className={cn('w-5 h-5 text-gray-300 transition-transform', selectedPlatformId === platform.id && 'rotate-90')}
                    />
                  </div>

                  <ChevronRight
                    className={cn(
                      'w-5 h-5 text-gray-300 transition-transform',
                      effectivePlatformId === platform.id && 'rotate-90'
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      {selectedPlatform && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-wl-border-default">
            {(['mapping', 'schedule', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-3 font-medium text-sm transition-colors border-b-2',
                  activeTab === tab
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-300 hover:text-white'
                )}
              >
                {tab === 'mapping' && 'Field Mapping'}
                {tab === 'schedule' && 'Sync Schedule'}
                {tab === 'preview' && 'Preview'}
              </button>
            ))}
          </div>

          {/* Field Mapping Tab */}
          {activeTab === 'mapping' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Field Mapping Editor</CardTitle>
                  <Button variant="secondary" size="sm" onClick={handleAutoMap} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Auto-Map
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {unmappedRequired.length > 0 && (
                  <div className="p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-600 mb-1">Unmapped Required Fields</h4>
                      <p className="text-sm text-gray-300">{unmappedRequired.map((f) => f.name).join(', ')}</p>
                    </div>
                  </div>
                )}
                <FieldMappingEditor
                  platformFields={selectedPlatform.fields}
                  witylogixFields={WITYLOGIX_FIELDS}
                  mappings={mappings}
                  onAddMapping={addMapping}
                  onRemoveMapping={removeMapping}
                  onUpdateTransformer={updateTransformer}
                />
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="secondary" onClick={() => setShowTemplateInput(!showTemplateInput)} className="gap-2">
                  <Download className="w-4 h-4" />
                  Save Template
                </Button>
                {showTemplateInput && (
                  <div className="flex gap-2 ml-auto flex-1 max-w-xs">
                    <input
                      type="text"
                      placeholder="Template name..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className={cn(
                        'flex-1 px-3 py-2 text-sm rounded-md',
                        'bg-wl-bg-surface border border-wl-border-default',
                        'text-white placeholder:text-gray-300',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500'
                      )}
                    />
                    <Button variant="primary" size="sm" onClick={handleSaveTemplate} className="gap-2">
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                  </div>
                )}
                <Button
                  variant="primary"
                  onClick={() => saveMappings()}
                  className="gap-2"
                  disabled={unmappedRequired.length > 0}
                >
                  <Check className="w-4 h-4" />
                  Save Mappings
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Sync Schedule Tab */}
          {activeTab === 'schedule' && (
            <Card>
              <CardHeader><CardTitle>Sync Schedule & Direction</CardTitle></CardHeader>
              <CardContent>
                {schedule && (
                  <SyncScheduleConfig
                    schedule={schedule}
                    onScheduleChange={(s) => setSchedule({ ...schedule, ...s })}
                    platformName={selectedPlatform.name}
                  />
                )}
              </CardContent>
              <CardFooter>
                <Button variant="primary" onClick={() => saveMappings()} className="gap-2">
                  <Check className="w-4 h-4" />
                  Save Schedule
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Mapping Preview</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTestSync}
                    disabled={testSyncInProgress || previewLoading || unmappedRequired.length > 0}
                    className="gap-2"
                  >
                    <RefreshCw className={cn('w-4 h-4', testSyncInProgress && 'animate-spin')} />
                    {testSyncInProgress ? 'Testing...' : 'Test Sync (5 Products)'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-wl-bg-surface rounded-lg p-4 border border-wl-border-default">
                  <h4 className="font-semibold text-white mb-4">
                    Sample Product Transformation
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-300 mb-3">Source ({selectedPlatform.name})</h5>
                      <div className="space-y-2 text-sm">
                        {previewProduct?.source &&
                          Object.entries(previewProduct.source).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between p-2 bg-wl-bg-elevated rounded"
                            >
                              <span className="text-gray-300">{key}:</span>
                              <span className="text-white font-medium">{String(value)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-300 mb-3">Target (Witylogix)</h5>
                      <div className="space-y-2 text-sm">
                        {previewProduct?.target &&
                          Object.entries(previewProduct.target).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between p-2 bg-wl-bg-elevated rounded"
                            >
                              <span className="text-gray-300">{key}:</span>
                              <span className="text-white font-medium">{String(value)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
                {testSyncInProgress && (
                  <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                    <span className="text-sm text-gray-300">Testing sync with 5 sample products...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
