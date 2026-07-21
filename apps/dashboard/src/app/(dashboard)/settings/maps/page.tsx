'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { CheckCircle2, AlertCircle, Map, Settings2, RefreshCw } from 'lucide-react';

interface MapsConfig {
  googleMapsApiKey?: string;
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
  enableHeatmap: boolean;
  enableDrawing: boolean;
}

interface ShopData {
  settings?: {
    mapsConfig?: MapsConfig;
  };
}

const DEFAULT_CONFIG: MapsConfig = {
  googleMapsApiKey: '',
  defaultCenter: { lat: 37.7749, lng: -122.4194 },
  defaultZoom: 12,
  enableHeatmap: true,
  enableDrawing: true,
};

const WLMap = dynamic(() => import('@/components/map/wl-map').then(m => m.WLMap), { ssr: false });

function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length < 8) return '••••••••';
  return `${key.substring(0, 4)}${'•'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
}

export default function MapsSettingsPage() {
  const { data: shopData, loading, error, refetch } = useApiQuery<ShopData>('/api/v4/shops/me');

  const [config, setConfig] = useState<MapsConfig>(DEFAULT_CONFIG);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (shopData?.settings?.mapsConfig) {
      setConfig({ ...DEFAULT_CONFIG, ...shopData.settings.mapsConfig });
    }
  }, [shopData]);

  const maskedKey = useMemo(() => maskApiKey(config.googleMapsApiKey ?? ''), [config.googleMapsApiKey]);

  const handleSettingChange = <K extends keyof MapsConfig>(key: K, value: MapsConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveApiKey = () => {
    if (tempApiKey.trim()) {
      setConfig(prev => ({ ...prev, googleMapsApiKey: tempApiKey.trim() }));
    } else {
      setConfig(prev => ({ ...prev, googleMapsApiKey: '' }));
    }
    setIsEditingApiKey(false);
    setTempApiKey('');
  };

  const testConnection = async () => {
    const key = (isEditingApiKey ? tempApiKey : config.googleMapsApiKey) ?? '';
    if (!key) {
      setTestStatus('error');
      setTestError('Enter an API key first');
      return;
    }
    setTestStatus('testing');
    setTestError('');
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway&key=${key}`
      );
      const data = await response.json();
      if (response.ok && data.status === 'OK') {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(data.error_message ?? data.status ?? 'API returned an error');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    }
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      await api.patch('/api/v4/shops/me', { settings: { mapsConfig: config } });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Map Settings"
        subtitle="Configure your default map centre, zoom, and optional API keys for enhanced geocoding"
        actions={
          <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Keyless notice */}
        <Card className="border border-wl-success-600/30 bg-wl-success-500/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Map className="w-5 h-5 text-wl-success-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-wl-success-400">Maps work without an API key</p>
                <p className="text-xs text-wl-text-secondary mt-1">
                  All dashboard maps use free CARTO basemaps (MapLibre GL) — no API key required. The
                  optional Google Maps API key below enables enhanced geocoding, places autocomplete, and
                  satellite imagery features only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Optional Google Maps API Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Optional: Google Maps API Key</CardTitle>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-wl-info-400 hover:text-wl-info-400"
              >
                Google Cloud Console →
              </a>
            </div>
            <p className="text-xs text-wl-text-secondary mt-1">
              Required only for Places autocomplete, geocoding, and satellite view. Leave empty to use
              keyless CARTO maps.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider block mb-2">
                API Key
              </label>
              {!isEditingApiKey ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-wl-text-secondary font-mono text-sm">
                    {maskedKey || <span className="text-wl-text-tertiary italic">Not configured (keyless CARTO active)</span>}
                  </div>
                  {maskedKey && <Badge variant="success" dot>Configured</Badge>}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsEditingApiKey(true);
                      setTempApiKey('');
                    }}
                  >
                    {maskedKey ? 'Update' : 'Set Key'}
                  </Button>
                  {maskedKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSettingChange('googleMapsApiKey', '')}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={e => setTempApiKey(e.target.value)}
                    placeholder="Paste Google Maps API key (or leave blank to clear)"
                    autoFocus
                    className={cn(
                      'w-full px-4 py-2.5 rounded-md',
                      'bg-wl-bg-root border border-wl-border-default',
                      'text-wl-text-primary placeholder:text-wl-text-tertiary',
                      'focus:outline-none focus:ring-2 focus:ring-wl-info-500 focus:border-transparent',
                      'font-mono text-sm'
                    )}
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={saveApiKey}>
                      Save Key
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={testConnection}
                      disabled={testStatus === 'testing'}
                    >
                      {testStatus === 'testing' ? 'Testing…' : 'Test'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingApiKey(false);
                        setTempApiKey('');
                        setTestStatus('idle');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Test key button when not editing */}
            {!isEditingApiKey && maskedKey && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={testConnection}
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
                </Button>
                {testStatus === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-wl-success-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connection OK
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-wl-danger-400">
                    <AlertCircle className="w-3.5 h-3.5" /> {testError}
                  </span>
                )}
              </div>
            )}
            {isEditingApiKey && testStatus === 'success' && (
              <p className="text-xs text-wl-success-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Key is valid
              </p>
            )}
            {isEditingApiKey && testStatus === 'error' && (
              <p className="text-xs text-wl-danger-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {testError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Default Map Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Default Map Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider block mb-2">
                  Default Latitude
                </label>
                <input
                  type="number"
                  value={config.defaultCenter.lat}
                  onChange={e =>
                    handleSettingChange('defaultCenter', {
                      ...config.defaultCenter,
                      lat: parseFloat(e.target.value) || 0,
                    })
                  }
                  step="0.0001"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-md',
                    'bg-wl-bg-root border border-wl-border-default',
                    'text-wl-text-primary',
                    'focus:outline-none focus:ring-2 focus:ring-wl-info-500 focus:border-transparent'
                  )}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider block mb-2">
                  Default Longitude
                </label>
                <input
                  type="number"
                  value={config.defaultCenter.lng}
                  onChange={e =>
                    handleSettingChange('defaultCenter', {
                      ...config.defaultCenter,
                      lng: parseFloat(e.target.value) || 0,
                    })
                  }
                  step="0.0001"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-md',
                    'bg-wl-bg-root border border-wl-border-default',
                    'text-wl-text-primary',
                    'focus:outline-none focus:ring-2 focus:ring-wl-info-500 focus:border-transparent'
                  )}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider block mb-2">
                  Default Zoom Level: <span className="text-wl-text-primary">{config.defaultZoom}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="18"
                  value={config.defaultZoom}
                  onChange={e => handleSettingChange('defaultZoom', parseInt(e.target.value))}
                  className="w-full accent-wl-info-500"
                />
                <div className="flex justify-between text-xs text-wl-text-tertiary mt-1">
                  <span>1 — World</span>
                  <span>10 — City</span>
                  <span>18 — Street</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature toggles */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Toggles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { key: 'enableHeatmap' as const, label: 'Heatmap Layer', desc: 'Show delivery density heatmaps on analytics maps' },
                { key: 'enableDrawing' as const, label: 'Drawing Tools', desc: 'Allow zone creation and polygon editing on zone maps' },
              ].map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-lg bg-wl-bg-root border border-wl-border-default hover:border-wl-info-500/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-wl-text-primary">{label}</p>
                    <p className="text-xs text-wl-text-secondary mt-0.5">{desc}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={config[key]}
                    onClick={() => handleSettingChange(key, !config[key])}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent',
                      'transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-wl-info-500',
                      config[key] ? 'bg-wl-primary-600' : 'bg-wl-bg-elevated'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
                        'transform transition duration-200',
                        config[key] ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Live preview map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-wl-info-400" />
              Preview
            </CardTitle>
            <p className="text-xs text-wl-text-secondary mt-1">
              This is how your default map view will appear across the dashboard.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64 rounded-lg overflow-hidden border border-wl-border-default">
              <WLMap
                center={[config.defaultCenter.lng, config.defaultCenter.lat]}
                zoom={config.defaultZoom}
              />
            </div>
            <p className="text-xs text-wl-text-tertiary mt-2">
              Map rendered with free CARTO basemaps (keyless). Adjust lat/lng/zoom above and save to update.
            </p>
          </CardContent>
        </Card>

        {/* Save footer */}
        <div className="flex items-center justify-between py-2">
          {saveSuccess && (
            <span className="flex items-center gap-2 text-sm text-wl-success-400">
              <CheckCircle2 className="w-4 h-4" />
              Settings saved
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-2 text-sm text-wl-danger-400">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </span>
          )}
          {!saveSuccess && !saveError && <div />}
          <Button variant="primary" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
