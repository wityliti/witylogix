'use client';

import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/loading-skeleton';

export default function MessagingIntegrationsPage() {
  return (
    <>
      <Header
        title="Messaging Integrations"
        subtitle="Manage SMS, push notification, and chat providers"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn("p-6 bg-wl-bg-root space-y-6")}>
        {/* Channel Tabs */}
        <div className={cn('flex gap-2')}>
          {(['SMS', 'PUSH', 'CHAT'] as const).map((channel) => (
            <button
              key={channel}
              onClick={() => setSelectedChannel(channel)}
              className={cn(
                'px-4 py-2 rounded-md font-semibold text-sm transition',
                selectedChannel === channel
                  ? "bg-blue-500 text-white"
                  : "bg-wl-bg-elevated text-gray-400 hover:bg-wl-bg-surface"
              )}
            >
              {channel}
            </button>
          ))}
        </div>

        {/* Overview Stats */}
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">SMS Providers</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>configured</p>
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Push Providers</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>configured</p>
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Messages Sent Today</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>across all channels</p>
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Delivery Rate</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>no active providers</p>
            </div>
          </Card>
        </div>

        {error && (
          <ErrorState
            title="Failed to load messaging providers"
            error={error}
            onRetry={fetchProviders}
          />
        )}

        <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-6')}>
          {/* Provider Configuration */}
          <div className={cn('lg:col-span-2 space-y-6')}>
            {/* Channel Config */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Configuration</CardTitle>
              </CardHeader>
              <div className={cn("p-4 pt-0 space-y-4")}>
                <div>
                  <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                    Primary Provider for {selectedChannel}
                  </label>
                  <select
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                    defaultValue={channelProviders[0]?.id || ""}
                  >
                    {channelProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                    Fallback Providers
                  </label>
                  <div className={cn("space-y-2")}>
                    {channelProviders.map((provider) => (
                      <label key={provider.id} className={cn("flex items-center gap-2")}>
                        <input type="checkbox" className={cn("w-4 h-4")} defaultChecked />
                        <span className={cn("text-sm text-white")}>{provider.name}</span>
                      </label>
                      <select
                        className={cn('w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none')}
                        defaultValue={installedChannelProviders[0]?.slug ?? ''}
                      >
                        {installedChannelProviders.map((p) => (
                          <option key={p.slug} value={p.slug}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={cn('text-xs font-semibold text-gray-400 block mb-2')}>
                        Fallback Providers
                      </label>
                      <div className={cn('space-y-2')}>
                        {installedChannelProviders.map((p) => (
                          <label key={p.slug} className={cn('flex items-center gap-2')}>
                            <input type="checkbox" className={cn('w-4 h-4')} defaultChecked />
                            <span className={cn('text-sm text-white')}>{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={cn('py-6 text-center text-gray-500 text-sm')}>
                    No {selectedChannel} providers installed. Install a provider to configure this channel.
                  </div>
                )}
              </div>
            </Card>

            {/* Providers List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedChannel} Providers</CardTitle>
                  <Button variant="secondary" size="sm" onClick={fetchProviders}>Refresh</Button>
                </div>
              </CardHeader>
              <div className={cn("p-4 pt-0 space-y-3")}>
                {channelProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className={cn(
                      "p-4 rounded border border-wl-border-default hover:border-blue-400 transition"
                    )}
                  >
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div>
                        <h4 className={cn("font-semibold text-white")}>{provider.name}</h4>
                        <p className={cn("text-xs text-gray-300")}>
                          Rate limit: {provider.rateLimit.toLocaleString()} messages/day
                        </p>
                      </div>
                    )
                    : channelProviders.map((provider) => {
                      const badge = providerBadge(provider);
                      return (
                        <div
                          key={provider.slug}
                          className={cn('p-4 rounded border border-wl-border-default hover:border-blue-400 transition')}
                        >
                          <div className={cn('flex items-start justify-between mb-2')}>
                            <div>
                              <h4 className={cn('font-semibold text-white')}>{provider.name}</h4>
                              <p className={cn('text-xs text-gray-400 mt-0.5')}>{provider.authType}</p>
                            </div>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </div>

                          <p className={cn('text-xs text-gray-300 mb-3 line-clamp-2')}>{provider.description}</p>

                    <div className={cn("h-12 bg-wl-bg-surface rounded mb-3")}>
                      <BarChart data={[45, 38, 52, 48, 55, 42, 50]} height={48} />
                    </div>

                          <div className={cn('flex gap-2')}>
                            <Button variant="secondary" size="sm">
                              {provider.installed ? 'Configure' : 'Install'}
                            </Button>
                            {provider.installed && (
                              <Button variant="ghost" size="sm">Test</Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
              </div>
            </Card>
          </div>
        </Card>

          {/* Right Sidebar */}
          <div className={cn('space-y-4')}>
            {/* Test Message Sender */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Send Test Message</CardTitle>
              </CardHeader>
              <div className={cn('p-4 pt-0 space-y-3')}>
                <div>
                  <label className={cn('text-xs font-semibold text-gray-400 block mb-2')}>Channel</label>
                  <select
                    value={testChannel}
                    onChange={(e) => setTestChannel(e.target.value as ChannelType)}
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                  >
                    {(['SMS', 'PUSH', 'CHAT'] as const).map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={cn('text-xs font-semibold text-gray-400 block mb-2')}>
                    {testChannel === 'SMS' ? 'Phone Number' : testChannel === 'PUSH' ? 'Device Token' : 'User ID'}
                  </label>
                  <input
                    type="text"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder={
                      testChannel === 'SMS' ? '1234567890'
                        : testChannel === 'PUSH' ? 'device_token_...'
                          : 'user_id_...'
                    }
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                  />
                </div>

                <div>
                  <label className={cn('text-xs font-semibold text-gray-400 block mb-2')}>
                    Message Content
                  </label>
                  <textarea
                    placeholder="Test message content..."
                    rows={3}
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                  />
                </div>

                <Button variant="primary" className="w-full">
                  Send Test
                </Button>
              </div>
            </Card>

            {/* Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rate Limits</CardTitle>
              </CardHeader>
              <div className={cn("p-4 pt-0 space-y-3")}>
                {channelProviders.map((provider) => (
                  <div key={provider.id}>
                    <p className={cn("text-xs font-semibold text-gray-400 mb-1")}>
                      {provider.name}
                    </p>
                    <div className={cn("flex items-center gap-2")}>
                      <div className={cn("flex-1 h-2 rounded bg-wl-bg-surface overflow-hidden")}>
                        <div
                          className={cn("h-full bg-blue-500")}
                          style={{ width: "65%" }}
                        />
                      </div>
                      <span className={cn("text-xs text-gray-300")}>650/1000</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Message Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Message Templates</CardTitle>
          </CardHeader>
          <div className={cn('p-4 pt-0')}>
            <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-4')}>
              <div className={cn('space-y-2')}>
                {MESSAGE_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={cn(
                      'p-3 rounded cursor-pointer transition',
                      selectedTemplate === template.id
                        ? "bg-blue-500/10 border border-blue-400"
                        : "bg-wl-bg-surface border border-wl-border-default hover:border-blue-400"
                    )}
                  >
                    <p className={cn('font-semibold text-white text-sm')}>{template.name}</p>
                    <div className={cn('flex items-center gap-2 mt-1')}>
                      <Badge variant="primary" className="text-xs">{template.channel}</Badge>
                    </div>
                  </div>
                ))}
              </div>

              {selectedTemplateObj && (
                <div className={cn('lg:col-span-2 space-y-4')}>
                  <div>
                    <label className={cn('text-xs font-semibold text-gray-400 block mb-2')}>Template Name</label>
                    <input
                      type="text"
                      value={selected.name}
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                      )}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className={cn('text-xs font-semibold text-gray-400 block mb-2')}>Content</label>
                    <textarea
                      value={selectedTemplateObj.content}
                      rows={4}
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none font-mono"
                      )}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className={cn('text-xs font-semibold text-gray-400 block mb-2')}>Variables</label>
                    <div className={cn('flex flex-wrap gap-2')}>
                      {selectedTemplateObj.variables.map((v) => (
                        <Badge key={v} variant="info">{v}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className={cn('flex gap-2')}>
                    <Button variant="primary" className="flex-1">Edit</Button>
                    <Button variant="secondary" className="flex-1">Preview</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
