'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type MapsSettings } from '@/components/maps/types';

/**
 * Google Maps Settings Page
 * Configure Google Maps API and default settings
 */
export default function MapsSettingsPage() {
  const [settings, setSettings] = useState<MapsSettings>({
    apiKey: '',
    defaultCenter: { lat: 37.7749, lng: -122.4194 },
    defaultZoom: 12,
    mapStyle: 'standard',
    enableHeatmap: true,
    enableDrawing: true,
    enableTraffic: false,
    enablePublicTransit: false,
    enableBicycling: false,
  });

  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>(
    'idle'
  );
  const [connectionError, setConnectionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mapsSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(parsed);
      setApiKeyMasked(maskApiKey(parsed.apiKey || ''));
    }
  }, []);

  // Mask API key for display
  const maskApiKey = (key: string): string => {
    if (!key) return '';
    if (key.length < 8) return '••••••••';
    return `${key.substring(0, 4)}${'•'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
  };

  // Handle API key update
  const handleApiKeyChange = (value: string) => {
    setTempApiKey(value);
  };

  // Save API key
  const saveApiKey = () => {
    if (tempApiKey.trim()) {
      setSettings((prev) => ({
        ...prev,
        apiKey: tempApiKey,
      }));
      setApiKeyMasked(maskApiKey(tempApiKey));
      setIsEditingApiKey(false);
      setTempApiKey('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // Test connection
  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');

    try {
      const apiKey = settings.apiKey || tempApiKey;
      if (!apiKey) {
        setConnectionStatus('error');
        setConnectionError('Please enter an API key first');
        return;
      }

      // Test by loading a simple geocoding request
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway&key=${apiKey}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK') {
          setConnectionStatus('success');
        } else {
          setConnectionStatus('error');
          setConnectionError(`API Error: ${data.status}`);
        }
      } else {
        setConnectionStatus('error');
        setConnectionError(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
    }

    // Reset status after 3 seconds
    setTimeout(() => setConnectionStatus('idle'), 3000);
  };

  // Handle setting changes
  const handleSettingChange = (key: keyof MapsSettings, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Save all settings
  const saveAllSettings = async () => {
    setIsSaving(true);

    try {
      // Save to localStorage (in production, this would be a backend call)
      localStorage.setItem('mapsSettings', JSON.stringify(settings));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      setConnectionError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
        <h1 className="text-3xl font-bold text-white">Google Maps Settings</h1>
        <p className="text-gray-400 mt-2">
          Configure your Google Maps API and customize default map behavior
        </p>
      </div>

      {/* API Key Section */}
      <section className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">API Configuration</h2>
            <p className="text-sm text-gray-400 mt-1">
              Get your API key from Google Cloud Console
            </p>
          </div>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 font-medium"
          >
            Google Cloud Console →
          </a>
        </div>

        {/* API Key Input */}
        <div>
          <label className="text-sm font-semibold text-gray-400 uppercase block mb-2">
            API Key
          </label>

          {!isEditingApiKey ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-2.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-gray-400 font-mono text-sm">
                {apiKeyMasked || 'No API key configured'}
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditingApiKey(true);
                  setTempApiKey(settings.apiKey);
                }}
              >
                {settings.apiKey ? 'Update' : 'Set'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Paste your Google Maps API key here..."
                className={cn(
                  'w-full px-4 py-2.5 rounded-md',
                  'bg-[#0a0a0f] border border-[#1e1e2e]',
                  'text-white placeholder:text-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  'font-mono text-sm'
                )}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={saveApiKey}
                  disabled={!tempApiKey.trim()}
                >
                  Save Key
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditingApiKey(false);
                    setTempApiKey('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Test Connection */}
        <div className="pt-4 border-t border-[#1e1e2e]">
          <Button
            variant="secondary"
            onClick={testConnection}
            disabled={connectionStatus === 'testing' || !settings.apiKey}
            className="flex items-center gap-2"
          >
            {connectionStatus === 'testing' && (
              <div className="w-3 h-3 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
            )}
            {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </Button>

          {/* Connection Status */}
          {connectionStatus === 'success' && (
            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-emerald-400">Connection successful!</span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
              <p className="text-sm text-red-400">
                <strong>Connection failed:</strong> {connectionError}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Default Map Settings */}
      <section className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-white mb-6">Default Map Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Center */}
          <div>
            <label className="text-sm font-semibold text-gray-400 uppercase block mb-2">
              Default Center - Latitude
            </label>
            <input
              type="number"
              value={settings.defaultCenter.lat}
              onChange={(e) =>
                handleSettingChange('defaultCenter', {
                  ...settings.defaultCenter,
                  lat: parseFloat(e.target.value),
                })
              }
              step="0.0001"
              className={cn(
                'w-full px-4 py-2.5 rounded-md',
                'bg-[#0a0a0f] border border-[#1e1e2e]',
                'text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              )}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-400 uppercase block mb-2">
              Default Center - Longitude
            </label>
            <input
              type="number"
              value={settings.defaultCenter.lng}
              onChange={(e) =>
                handleSettingChange('defaultCenter', {
                  ...settings.defaultCenter,
                  lng: parseFloat(e.target.value),
                })
              }
              step="0.0001"
              className={cn(
                'w-full px-4 py-2.5 rounded-md',
                'bg-[#0a0a0f] border border-[#1e1e2e]',
                'text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              )}
            />
          </div>

          {/* Default Zoom */}
          <div>
            <label className="text-sm font-semibold text-gray-400 uppercase block mb-2">
              Default Zoom Level
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="21"
                value={settings.defaultZoom}
                onChange={(e) =>
                  handleSettingChange('defaultZoom', parseInt(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-sm font-semibold text-white w-12 text-center">
                {settings.defaultZoom}
              </span>
            </div>
          </div>

          {/* Map Style */}
          <div>
            <label className="text-sm font-semibold text-gray-400 uppercase block mb-2">
              Map Style
            </label>
            <select
              value={settings.mapStyle}
              onChange={(e) =>
                handleSettingChange('mapStyle', e.target.value as 'standard' | 'satellite' | 'terrain')
              }
              className={cn(
                'w-full px-4 py-2.5 rounded-md',
                'bg-[#0a0a0f] border border-[#1e1e2e]',
                'text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              )}
            >
              <option value="standard">Standard</option>
              <option value="satellite">Satellite</option>
              <option value="terrain">Terrain</option>
            </select>
          </div>
        </div>
      </section>

      {/* Feature Toggles */}
      <section className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-white mb-6">Feature Toggles</h2>

        <div className="space-y-3">
          {[
            {
              key: 'enableHeatmap',
              label: 'Heatmap Layer',
              description: 'Show delivery density heatmaps on maps',
            },
            {
              key: 'enableDrawing',
              label: 'Drawing Tools',
              description: 'Allow zone creation and editing',
            },
            {
              key: 'enableTraffic',
              label: 'Traffic Layer',
              description: 'Display real-time traffic information',
            },
            {
              key: 'enablePublicTransit',
              label: 'Public Transit',
              description: 'Show public transportation options',
            },
            {
              key: 'enableBicycling',
              label: 'Bicycling Layer',
              description: 'Display bike lanes and routes',
            },
          ].map((feature) => (
            <div key={feature.key} className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] hover:border-blue-500/30 transition-colors">
              <div>
                <p className="text-sm font-semibold text-white">{feature.label}</p>
                <p className="text-xs text-gray-400 mt-1">{feature.description}</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[feature.key as keyof MapsSettings] as boolean}
                  onChange={(e) =>
                    handleSettingChange(feature.key as keyof MapsSettings, e.target.checked)
                  }
                  className="w-5 h-5 rounded border-[#1e1e2e] accent-blue-500"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {saveSuccess && (
            <div className="flex items-center gap-2 text-emerald-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">Settings saved successfully!</span>
            </div>
          )}
        </div>
        <Button
          variant="primary"
          onClick={saveAllSettings}
          disabled={isSaving || !settings.apiKey}
          className="flex items-center gap-2"
        >
          {isSaving && (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        </div>
      </div>
    </div>
  );
}
