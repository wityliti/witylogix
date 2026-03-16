'use client';

import { useState, useMemo } from 'react';
import { Header } from '../../../../components/layout/header';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { cn } from '../../../../lib/utils';
import { FieldMappingEditor } from '../../../../components/sync/field-mapping-editor';
import { SyncScheduleConfig } from '../../../../components/sync/sync-schedule-config';
import {
  useFieldMappings,
  useSyncSchedule,
  useProductPreview,
} from '../../../../hooks/use-product-sync';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  RefreshCw,
  Save,
  Download,
  Upload,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   PRODUCT CATALOG SYNC PAGE — Field mapping & sync config
   ═══════════════════════════════════════════════════════════ */

interface ConnectedPlatform {
  id: string;
  name: string;
  platform: string;
  status: 'synced' | 'syncing' | 'error' | 'pending';
  lastSyncAt: string | null;
  productCount: number;
  fields: Array<{
    id: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    required: boolean;
    sampleValue?: string;
  }>;
}

const MOCK_PLATFORMS: ConnectedPlatform[] = [
  {
    id: 'shopify-main',
    name: 'Main Store',
    platform: 'Shopify',
    status: 'synced',
    lastSyncAt: new Date(Date.now() - 5 * 60000).toISOString(),
    productCount: 1245,
    fields: [
      { id: 'sf-id', name: 'ID', type: 'string', required: true, sampleValue: 'gid://shopify/Product/12345' },
      { id: 'sf-title', name: 'Title', type: 'string', required: true, sampleValue: 'Premium Cardboard Box' },
      { id: 'sf-type', name: 'Product Type', type: 'string', required: false, sampleValue: 'Packaging' },
      { id: 'sf-vendor', name: 'Vendor', type: 'string', required: false, sampleValue: 'PackPro Inc' },
      { id: 'sf-price', name: 'Price', type: 'number', required: false, sampleValue: '24.99' },
      { id: 'sf-weight', name: 'Weight (lbs)', type: 'number', required: false, sampleValue: '0.5' },
      { id: 'sf-inventory', name: 'Inventory Count', type: 'number', required: true, sampleValue: '500' },
      { id: 'sf-status', name: 'Status', type: 'string', required: false, sampleValue: 'active' },
    ],
  },
  {
    id: 'wix-store',
    name: 'Wix Store',
    platform: 'Wix',
    status: 'pending',
    lastSyncAt: null,
    productCount: 0,
    fields: [
      { id: 'wx-id', name: 'Product ID', type: 'string', required: true, sampleValue: 'WX-98765' },
      { id: 'wx-name', name: 'Product Name', type: 'string', required: true, sampleValue: 'Standard Box' },
      { id: 'wx-category', name: 'Category', type: 'string', required: false, sampleValue: 'Boxes' },
      { id: 'wx-price', name: 'Sale Price', type: 'number', required: false, sampleValue: '19.99' },
      { id: 'wx-qty', name: 'Quantity', type: 'number', required: true, sampleValue: '250' },
    ],
  },
  {
    id: 'amazon-seller',
    name: 'Amazon Seller Central',
    platform: 'Amazon',
    status: 'error',
    lastSyncAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    productCount: 342,
    fields: [
      { id: 'az-sku', name: 'SKU', type: 'string', required: true, sampleValue: 'PACK-001' },
      { id: 'az-asin', name: 'ASIN', type: 'string', required: true, sampleValue: 'B0C3X5Y8Z1' },
      { id: 'az-name', name: 'Product Name', type: 'string', required: true, sampleValue: 'Eco Shipping Box' },
      { id: 'az-price', name: 'Price', type: 'number', required: true, sampleValue: '22.50' },
      { id: 'az-fba-qty', name: 'FBA Quantity', type: 'number', required: true, sampleValue: '150' },
    ],
  },
];

const WITYLOGIX_FIELDS = [
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

export default function ProductSyncPage() {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('shopify-main');
  const [activeTab, setActiveTab] = useState<'mapping' | 'schedule' | 'preview'>('mapping');
  const [testSyncInProgress, setTestSyncInProgress] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateInput, setShowTemplateInput] = useState(false);

  const selectedPlatform = MOCK_PLATFORMS.find((p) => p.id === selectedPlatformId);
  const {
    mappings,
    addMapping,
    removeMapping,
    updateTransformer,
    autoMapFields,
    saveMappings,
  } = useFieldMappings(selectedPlatformId);

  const {
    schedule,
    setSchedule,
  } = useSyncSchedule(selectedPlatformId);

  const {
    previewProduct,
  } = useProductPreview(selectedPlatformId, mappings);

  const unmappedRequired = useMemo(() => {
    if (!selectedPlatform) return [];
    const mappedWLFields = mappings.map((m) => m.targetFieldId);
    return WITYLOGIX_FIELDS.filter(
      (f) => f.required && !mappedWLFields.includes(f.id)
    );
  }, [mappings, selectedPlatform]);

  const handleAutoMap = () => {
    if (selectedPlatform) {
      autoMapFields(selectedPlatform.fields, WITYLOGIX_FIELDS);
    }
  };

  const handleTestSync = async () => {
    setTestSyncInProgress(true);
    // Simulate test sync
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestSyncInProgress(false);
  };

  const handleSaveTemplate = () => {
    if (templateName.trim()) {
      saveMappings(templateName);
      setTemplateName('');
      setShowTemplateInput(false);
    }
  };

  const syncStatusColor = {
    synced: 'bg-wl-success-bg text-wl-success-500',
    syncing: 'bg-wl-info-bg text-wl-info-500',
    error: 'bg-wl-danger-bg text-wl-danger-500',
    pending: 'bg-wl-warning-bg text-wl-warning-500',
  };

  const syncStatusIcon = {
    synced: <Check className="w-4 h-4" />,
    syncing: <RefreshCw className="w-4 h-4 animate-spin" />,
    error: <AlertCircle className="w-4 h-4" />,
    pending: <Clock className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6">
      <Header
        title="Product Catalog Sync"
        description="Configure field mappings and sync schedules for connected platforms"
      />

      {/* Connected Platforms Section */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {MOCK_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatformId(platform.id)}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border transition-all',
                  selectedPlatformId === platform.id
                    ? 'bg-wl-bg-overlay border-wl-primary-500 ring-2 ring-wl-primary-500/20'
                    : 'bg-wl-bg-surface border-wl-border-subtle hover:border-wl-border-default'
                )}
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className="flex-1">
                    <h4 className="font-semibold text-wl-text-primary">
                      {platform.name}
                    </h4>
                    <p className="text-sm text-wl-text-secondary">
                      {platform.platform} • {platform.productCount} products
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        platform.status === 'synced'
                          ? 'success'
                          : platform.status === 'syncing'
                            ? 'info'
                            : platform.status === 'error'
                              ? 'danger'
                              : 'warning'
                      }
                      className="gap-1"
                    >
                      {syncStatusIcon[platform.status]}
                      {platform.status.charAt(0).toUpperCase() +
                        platform.status.slice(1)}
                    </Badge>
                    {platform.lastSyncAt && (
                      <span className="text-xs text-wl-text-secondary">
                        {new Date(platform.lastSyncAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  <ChevronRight
                    className={cn(
                      'w-5 h-5 text-wl-text-secondary transition-transform',
                      selectedPlatformId === platform.id && 'rotate-90'
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedPlatform && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-wl-border-subtle">
            {(['mapping', 'schedule', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-3 font-medium text-sm transition-colors border-b-2',
                  activeTab === tab
                    ? 'border-wl-primary-500 text-wl-primary-500'
                    : 'border-transparent text-wl-text-secondary hover:text-wl-text-primary'
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
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAutoMap}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Auto-Map
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Unmapped Required Fields Warning */}
                {unmappedRequired.length > 0 && (
                  <div className="p-4 bg-wl-warning-bg/20 border border-wl-warning-500/30 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-wl-warning-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-wl-warning-600 mb-1">
                        Unmapped Required Fields
                      </h4>
                      <p className="text-sm text-wl-text-secondary">
                        {unmappedRequired.map((f) => f.name).join(', ')}
                      </p>
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
                <Button
                  variant="secondary"
                  onClick={() => setShowTemplateInput(!showTemplateInput)}
                  className="gap-2"
                >
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
                        'bg-wl-bg-surface border border-wl-border-subtle',
                        'text-wl-text-primary placeholder:text-wl-text-secondary',
                        'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
                      )}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveTemplate}
                      className="gap-2"
                    >
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
              <CardHeader>
                <CardTitle>Sync Schedule & Direction</CardTitle>
              </CardHeader>

              <CardContent>
                <SyncScheduleConfig
                  schedule={schedule}
                  onScheduleChange={setSchedule}
                  platformName={selectedPlatform.name}
                />
              </CardContent>

              <CardFooter>
                <Button
                  variant="primary"
                  onClick={() => saveMappings()}
                  className="gap-2"
                >
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
                    disabled={testSyncInProgress || unmappedRequired.length > 0}
                    className="gap-2"
                  >
                    <RefreshCw
                      className={cn(
                        'w-4 h-4',
                        testSyncInProgress && 'animate-spin'
                      )}
                    />
                    {testSyncInProgress
                      ? 'Testing...'
                      : 'Test Sync (5 Products)'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="bg-wl-bg-surface rounded-lg p-4 border border-wl-border-subtle">
                  <h4 className="font-semibold text-wl-text-primary mb-4">
                    Sample Product Transformation
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Source */}
                    <div>
                      <h5 className="text-sm font-medium text-wl-text-secondary mb-3">
                        Source ({selectedPlatform.name})
                      </h5>
                      <div className="space-y-2 text-sm">
                        {previewProduct?.source &&
                          Object.entries(previewProduct.source).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between p-2 bg-wl-bg-elevated rounded"
                            >
                              <span className="text-wl-text-secondary">{key}:</span>
                              <span className="text-wl-text-primary font-medium">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Target */}
                    <div>
                      <h5 className="text-sm font-medium text-wl-text-secondary mb-3">
                        Target (Witylogix)
                      </h5>
                      <div className="space-y-2 text-sm">
                        {previewProduct?.target &&
                          Object.entries(previewProduct.target).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between p-2 bg-wl-bg-elevated rounded"
                            >
                              <span className="text-wl-text-secondary">{key}:</span>
                              <span className="text-wl-text-primary font-medium">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {testSyncInProgress && (
                  <div className="p-4 bg-wl-info-bg/20 border border-wl-info-500/30 rounded-lg flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-wl-info-500 animate-spin" />
                    <span className="text-sm text-wl-text-secondary">
                      Testing sync with 5 sample products...
                    </span>
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
