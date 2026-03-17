'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <div className="flex h-screen flex-col bg-[var(--wl-bg-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--wl-border-primary)] bg-[var(--wl-bg-primary)] px-8 py-6">
        <h1 className="text-3xl font-bold text-[var(--wl-text-primary)]">Integration Documentation</h1>
        <p className="mt-2 text-[var(--wl-text-secondary)]">
          Complete reference for all providers, webhooks, and integration guides
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--wl-border-primary)] px-8">
        <div className="flex gap-8">
          {(['sdk', 'webhooks', 'ratelimits', 'guides', 'troubleshooting', 'changelog'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-[var(--wl-primary)] text-[var(--wl-primary)]'
                  : 'border-transparent text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]'
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
        <Label className="text-[var(--wl-text-primary)]">Select Provider</Label>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="mt-2 w-64 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)]">
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
        <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
          <div className="mb-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">{selectedProvider} SDK</h3>
              <p className="mt-1 text-sm text-[var(--wl-text-secondary)]">Version: {sdk.version}</p>
            </div>

            <div className="rounded bg-[var(--wl-bg-primary)] p-4">
              <div className="text-sm text-[var(--wl-text-secondary)]">Base URL</div>
              <code className="mt-1 block text-sm font-mono text-[var(--wl-primary)]">{sdk.baseUrl}</code>
            </div>

            <div className="rounded bg-[var(--wl-bg-primary)] p-4">
              <div className="text-sm text-[var(--wl-text-secondary)]">Authentication</div>
              <code className="mt-1 block text-sm font-mono text-[var(--wl-primary)]">{sdk.authentication}</code>
            </div>
          </div>

          <div>
            <Input
              placeholder="Search methods..."
              value={methodSearch}
              onChange={(e) => setMethodSearch(e.target.value)}
              className="mb-4 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]"
            />

            <div className="space-y-4">
              {displayedMethods.map((method) => (
                <div key={method.name} className="rounded border border-[var(--wl-border-primary)] bg-[var(--wl-bg-primary)] p-4">
                  <h4 className="font-mono text-sm font-semibold text-[var(--wl-primary)]">{method.name}</h4>
                  <p className="mt-2 text-sm text-[var(--wl-text-secondary)]">{method.description}</p>

                  {method.parameters.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-[var(--wl-text-primary)]">Parameters:</div>
                      <ul className="mt-2 space-y-1 text-xs text-[var(--wl-text-secondary)]">
                        {method.parameters.map((param) => (
                          <li key={param.name}>
                            <code className="text-[var(--wl-primary)]">{param.name}</code> ({param.type})
                            {param.required && <span className="ml-1 text-red-500">*</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-[var(--wl-text-primary)]">Example:</div>
                    <code className="mt-2 block overflow-x-auto rounded bg-[var(--wl-bg-secondary)] p-2 text-xs font-mono text-[var(--wl-primary)]">
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
        <Label className="text-[var(--wl-text-primary)]">Search Webhook Events</Label>
        <Input
          placeholder="e.g., payment.success, refund.created"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)]"
        />
      </div>

      {searchQuery ? (
        <div className="space-y-4">
          {results.length === 0 ? (
            <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
              <p className="text-[var(--wl-text-secondary)]">No events found</p>
            </Card>
          ) : (
            results.map(({ provider, event }, idx) => (
              <Card key={idx} className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-mono text-sm font-semibold text-[var(--wl-primary)]">{event.type}</h4>
                    <p className="mt-1 text-sm text-[var(--wl-text-secondary)]">{event.description}</p>
                  </div>
                  <Badge variant="info">{provider}</Badge>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold text-[var(--wl-text-primary)]">Example Payload:</div>
                  <code className="mt-2 block overflow-x-auto rounded bg-[var(--wl-bg-primary)] p-3 text-xs font-mono text-[var(--wl-primary)]">
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
            <Card key={catalog.provider} className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
              <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">{catalog.provider}</h3>
              <div className="mt-4 space-y-2">
                {catalog.events.slice(0, 5).map((event) => (
                  <div key={event.type} className="text-sm text-[var(--wl-text-secondary)]">
                    <code className="text-[var(--wl-primary)]">{event.type}</code>
                  </div>
                ))}
                {catalog.events.length > 5 && (
                  <div className="text-sm text-[var(--wl-text-secondary)]">
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
    <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
      <h2 className="mb-6 text-xl font-semibold text-[var(--wl-text-primary)]">Rate Limits by Provider</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--wl-border-primary)]">
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Provider</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Per Second</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Per Minute</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Burst Capacity</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Window</th>
            </tr>
          </thead>
          <tbody>
            {rateLimits.map((limit) => (
              <tr key={limit.provider} className="border-b border-[var(--wl-border-primary)]">
                <td className="px-4 py-2 font-medium text-[var(--wl-text-primary)]">{limit.provider}</td>
                <td className="px-4 py-2 text-[var(--wl-text-secondary)]">{limit.requestsPerSecond}</td>
                <td className="px-4 py-2 text-[var(--wl-text-secondary)]">{limit.requestsPerMinute}</td>
                <td className="px-4 py-2 text-[var(--wl-text-secondary)]">{limit.burstCapacity}</td>
                <td className="px-4 py-2 text-[var(--wl-text-secondary)]">{limit.window}</td>
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
        <Label className="text-[var(--wl-text-primary)]">Select Provider</Label>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="mt-2 w-64 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)]">
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

      <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
        <h2 className="mb-4 text-xl font-semibold text-[var(--wl-text-primary)]">
          Setup Guide: {selectedProvider}
        </h2>

        <div className="space-y-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="rounded border border-[var(--wl-border-primary)] bg-[var(--wl-bg-primary)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wl-primary)] font-semibold text-white">
                  {step}
                </div>
                <h3 className="font-semibold text-[var(--wl-text-primary)]">
                  {step === 1 && 'Create Account & Get API Keys'}
                  {step === 2 && 'Install SDK & Configure'}
                  {step === 3 && 'Implement Error Handling'}
                  {step === 4 && 'Test & Deploy'}
                </h3>
              </div>
              <p className="mt-3 text-sm text-[var(--wl-text-secondary)]">
                {step === 1 && 'Visit the provider dashboard, create an account, and generate your API keys in the settings.'}
                {step === 2 && 'Install the official SDK via npm/pip and configure with your API credentials.'}
                {step === 3 && 'Implement proper error handling for rate limits, timeouts, and failed requests.'}
                {step === 4 && 'Test with sandbox credentials before deploying to production.'}
              </p>

              {step === 1 && (
                <div className="mt-3 rounded bg-[var(--wl-bg-secondary)] p-3">
                  <code className="text-xs font-mono text-[var(--wl-primary)]">
                    API_KEY=your_key_here
                  </code>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded bg-blue-500 bg-opacity-10 p-4 text-sm text-blue-400">
          Screenshot placeholder: Setup dashboard walkthrough
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
        <Label className="text-[var(--wl-text-primary)]">Search Troubleshooting Guides</Label>
        <Input
          placeholder="e.g., rate limit, authentication, timeout"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)]"
        />
      </div>

      <div className="space-y-4">
        {playbooks.length === 0 && searchQuery && (
          <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
            <p className="text-[var(--wl-text-secondary)]">No troubleshooting guides found</p>
          </Card>
        )}

        {playbooks.map((playbook) => (
          <Card key={playbook.id} className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">{playbook.title}</h3>
                {playbook.errorCode && (
                  <Badge variant="danger" className="mt-2">
                    {playbook.errorCode}
                  </Badge>
                )}
                <p className="mt-2 text-sm text-[var(--wl-text-secondary)]">{playbook.description}</p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold text-[var(--wl-text-primary)]">Resolution Steps:</h4>
              <ol className="mt-2 space-y-2 text-sm text-[var(--wl-text-secondary)]">
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
        <Label className="text-[var(--wl-text-primary)]">Select Provider</Label>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="mt-2 w-64 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)]">
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
          <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
            <p className="text-[var(--wl-text-secondary)]">No changelog available</p>
          </Card>
        ) : (
          changelog.map((entry) => (
            <Card key={entry.version} className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
              <div className="flex items-center gap-3">
                <Badge variant="primary">{entry.version}</Badge>
                <span className="text-sm text-[var(--wl-text-secondary)]">
                  {new Date(entry.date).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {entry.changes.map((change, idx) => (
                  <div key={idx} className="text-sm text-[var(--wl-text-secondary)]">
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
