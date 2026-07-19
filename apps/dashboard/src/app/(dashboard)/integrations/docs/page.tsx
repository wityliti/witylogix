'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import {
  useSDKReference,
  useWebhookCatalog,
  useRateLimitReference,
  useTroubleshootingSearch,
  useAPIChangelog,
} from '@/hooks/use-integration-docs';

const PROVIDERS = ['Stripe', 'PayPal', 'Square', 'Adyen', 'AWS S3', 'Google Pay'];

export default function DocsPortal() {
  const [activeTab, setActiveTab] = useState<'sdk' | 'webhooks' | 'ratelimits' | 'guides' | 'troubleshooting' | 'changelog'>('sdk');
  const [selectedProvider, setSelectedProvider] = useState('Stripe');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex h-screen flex-col bg-wl-bg-root">
      <Header title="Integration Documentation" subtitle="Complete reference for all providers, webhooks, and integration guides" />

      {/* Tabs */}
      <div className="border-b border-wl-border-default px-8">
        <div className="flex gap-8">
          {(['sdk', 'webhooks', 'ratelimits', 'guides', 'troubleshooting', 'changelog'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-wl-primary-500 text-wl-primary-400'
                  : 'border-transparent text-wl-text-secondary hover:text-white'
              )}
            >
              {tab === 'ratelimits' ? 'Rate Limits' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {activeTab === 'sdk' && <SDKReference selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider} />}

        {activeTab === 'webhooks' && <WebhookCatalog searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

        {activeTab === 'ratelimits' && <RateLimitReference />}

        {activeTab === 'guides' && <ConfigurationGuides selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider} />}

        {activeTab === 'troubleshooting' && <TroubleshootingSection searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

        {activeTab === 'changelog' && <APIChangelog selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider} />}
      </div>
    </div>
  );
}

function SDKReference({
  selectedProvider,
  setSelectedProvider,
}: {
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
}) {
  const { sdk, searchMethods } = useSDKReference(selectedProvider);
  const [methodSearch, setMethodSearch] = useState('');

  const displayedMethods = methodSearch ? searchMethods(methodSearch) : sdk?.methods.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-white">Select Provider</Label>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="mt-2 w-64 bg-wl-bg-surface text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sdk && (
        <Card className="border border-wl-border-default bg-wl-bg-surface p-6">
          <div className="mb-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{selectedProvider} SDK</h3>
              <p className="mt-1 text-sm text-wl-text-secondary">Version: {sdk.version}</p>
            </div>

            <div className="rounded bg-wl-bg-root p-4">
              <div className="text-sm text-wl-text-secondary">Base URL</div>
              <code className="mt-1 block text-sm font-mono text-wl-info-500">{sdk.baseUrl}</code>
            </div>

            <div className="rounded bg-wl-bg-root p-4">
              <div className="text-sm text-wl-text-secondary">Authentication</div>
              <code className="mt-1 block text-sm font-mono text-wl-info-500">{sdk.authentication}</code>
            </div>
          </div>

          <div>
            <Input
              placeholder="Search methods..."
              value={methodSearch}
              onChange={(e) => setMethodSearch(e.target.value)}
              className="mb-4 bg-wl-bg-root text-white"
            />

            <div className="space-y-4">
              {displayedMethods.map((method) => (
                <div key={method.name} className="rounded border border-wl-border-default bg-wl-bg-root p-4">
                  <h4 className="font-mono text-sm font-semibold text-wl-info-500">{method.name}</h4>
                  <p className="mt-2 text-sm text-wl-text-secondary">{method.description}</p>

                  {method.parameters.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-white">Parameters:</div>
                      <ul className="mt-2 space-y-1 text-xs text-wl-text-secondary">
                        {method.parameters.map((param) => (
                          <li key={param.name}>
                            <code className="text-wl-info-500">{param.name}</code> ({param.type})
                            {param.required && <span className="ml-1 text-wl-danger-500">*</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-white">Example:</div>
                    <code className="mt-2 block overflow-x-auto rounded bg-wl-bg-surface p-2 text-xs font-mono text-wl-info-500">
                      {method.example}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function WebhookCatalog({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const { catalogs, searchEvents } = useWebhookCatalog();
  const results = searchEvents(searchQuery);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-white">Search Webhook Events</Label>
        <Input
          placeholder="e.g., payment.success, refund.created"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-2 bg-wl-bg-surface text-white"
        />
      </div>

      {searchQuery ? (
        <div className="space-y-4">
          {results.length === 0 ? (
            <Card className="border border-wl-border-default bg-wl-bg-surface p-6">
              <p className="text-wl-text-secondary">No events found</p>
            </Card>
          ) : (
            results.map(({ provider, event }, idx) => (
              <Card key={idx} className="border border-wl-border-default bg-wl-bg-surface p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-mono text-sm font-semibold text-wl-info-500">{event.type}</h4>
                    <p className="mt-1 text-sm text-wl-text-secondary">{event.description}</p>
                  </div>
                  <Badge variant="info">{provider}</Badge>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold text-white">Example Payload:</div>
                  <code className="mt-2 block overflow-x-auto rounded bg-wl-bg-root p-3 text-xs font-mono text-wl-info-500">
                    {event.example}
                  </code>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {catalogs.map((catalog) => (
            <Card key={catalog.provider} className="border border-wl-border-default bg-wl-bg-surface p-6">
              <h3 className="text-lg font-semibold text-white">{catalog.provider}</h3>
              <div className="mt-4 space-y-2">
                {catalog.events.slice(0, 5).map((event) => (
                  <div key={event.type} className="text-sm text-wl-text-secondary">
                    <code className="text-wl-info-500">{event.type}</code>
                  </div>
                ))}
                {catalog.events.length > 5 && (
                  <div className="text-sm text-wl-text-secondary">
                    +{catalog.events.length - 5} more events
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RateLimitReference() {
  const { rateLimits } = useRateLimitReference();

  return (
    <Card className="border border-wl-border-default bg-wl-bg-surface p-6">
      <h2 className="mb-6 text-xl font-semibold text-white">Rate Limits by Provider</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-wl-border-default">
              <th className="px-4 py-2 text-left text-white">Provider</th>
              <th className="px-4 py-2 text-left text-white">Per Second</th>
              <th className="px-4 py-2 text-left text-white">Per Minute</th>
              <th className="px-4 py-2 text-left text-white">Burst Capacity</th>
              <th className="px-4 py-2 text-left text-white">Window</th>
            </tr>
          </thead>
          <tbody>
            {rateLimits.map((limit) => (
              <tr key={limit.provider} className="border-b border-wl-border-default">
                <td className="px-4 py-2 font-medium text-white">{limit.provider}</td>
                <td className="px-4 py-2 text-wl-text-secondary">{limit.requestsPerSecond}</td>
                <td className="px-4 py-2 text-wl-text-secondary">{limit.requestsPerMinute}</td>
                <td className="px-4 py-2 text-wl-text-secondary">{limit.burstCapacity}</td>
                <td className="px-4 py-2 text-wl-text-secondary">{limit.window}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ConfigurationGuides({
  selectedProvider,
  setSelectedProvider,
}: {
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-white">Select Provider</Label>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="mt-2 w-64 bg-wl-bg-surface text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-wl-border-default bg-wl-bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">
          Setup Guide: {selectedProvider}
        </h2>

        <div className="space-y-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="rounded border border-wl-border-default bg-wl-bg-root p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wl-primary-500 font-semibold text-white">
                  {step}
                </div>
                <h3 className="font-semibold text-white">
                  {step === 1 && 'Create Account & Get API Keys'}
                  {step === 2 && 'Install SDK & Configure'}
                  {step === 3 && 'Implement Error Handling'}
                  {step === 4 && 'Test & Deploy'}
                </h3>
              </div>
              <p className="mt-3 text-sm text-wl-text-secondary">
                {step === 1 && 'Visit the provider dashboard, create an account, and generate your API keys in the settings.'}
                {step === 2 && 'Install the official SDK via npm/pip and configure with your API credentials.'}
                {step === 3 && 'Implement proper error handling for rate limits, timeouts, and failed requests.'}
                {step === 4 && 'Test with sandbox credentials before deploying to production.'}
              </p>

              {step === 1 && (
                <div className="mt-3 rounded bg-wl-bg-surface p-3">
                  <code className="text-xs font-mono text-wl-info-500">
                    API_KEY=your_key_here
                  </code>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded border border-wl-border-default bg-wl-bg-root p-4">
          <p className="mb-2 text-sm font-medium text-wl-text-primary">Integration Checklist</p>
          <ul className="space-y-1 text-sm text-wl-text-secondary">
            <li>✓ API credentials stored in environment variables</li>
            <li>✓ Webhook endpoint registered and signature verified</li>
            <li>✓ Idempotency keys used for all payment requests</li>
            <li>✓ Retry logic with exponential backoff implemented</li>
            <li>✓ Sandbox testing completed before production go-live</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

function TroubleshootingSection({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const { playbooks } = useTroubleshootingSearch(searchQuery);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-white">Search Troubleshooting Guides</Label>
        <Input
          placeholder="e.g., rate limit, authentication, timeout"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-2 bg-wl-bg-surface text-white"
        />
      </div>

      <div className="space-y-4">
        {playbooks.length === 0 && searchQuery && (
          <Card className="border border-wl-border-default bg-wl-bg-surface p-6">
            <p className="text-wl-text-secondary">No troubleshooting guides found</p>
          </Card>
        )}

        {playbooks.map((playbook) => (
          <Card key={playbook.id} className="border border-wl-border-default bg-wl-bg-surface p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">{playbook.title}</h3>
                {playbook.errorCode && (
                  <Badge variant="danger" className="mt-2">
                    {playbook.errorCode}
                  </Badge>
                )}
                <p className="mt-2 text-sm text-wl-text-secondary">{playbook.description}</p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold text-white">Resolution Steps:</h4>
              <ol className="mt-2 space-y-2 text-sm text-wl-text-secondary">
                {playbook.steps.map((step, idx) => (
                  <li key={idx} className="ml-5 list-decimal">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {playbook.relatedTopics.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {playbook.relatedTopics.map((topic) => (
                    <Badge key={topic} variant="info">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function APIChangelog({
  selectedProvider,
  setSelectedProvider,
}: {
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
}) {
  const { changelog } = useAPIChangelog(selectedProvider);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-white">Select Provider</Label>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="mt-2 w-64 bg-wl-bg-surface text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {changelog.length === 0 ? (
          <Card className="border border-wl-border-default bg-wl-bg-surface p-6">
            <p className="text-wl-text-secondary">No changelog available</p>
          </Card>
        ) : (
          changelog.map((entry) => (
            <Card key={entry.version} className="border border-wl-border-default bg-wl-bg-surface p-6">
              <div className="flex items-center gap-3">
                <Badge variant="primary">{entry.version}</Badge>
                <span className="text-sm text-wl-text-secondary">
                  {new Date(entry.date).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {entry.changes.map((change, idx) => (
                  <div key={idx} className="text-sm text-wl-text-secondary">
                    <Badge variant={change.type as any} className="mb-2">
                      {change.type}
                    </Badge>
                    <p className="ml-3">{change.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
