'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ESignaturesIntegrationPage() {
  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="E-Signature Integrations"
        subtitle="Manage e-signature provider connections"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn('p-6 bg-wl-bg-root space-y-6')}>
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Providers</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>e-signature services</p>
            </div>
          </Card>

          {expandedSections.providers && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:border-blue-500/50">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="text-blue-500 text-2xl">{provider.icon}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {provider.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {provider.status === "connected" && `Connected on ${provider.connectedAt}`}
                            {provider.status === "disconnected" && "Not connected"}
                            {provider.status === "error" && "Connection error"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          provider.status === "connected"
                            ? "success"
                            : provider.status === "error"
                              ? "danger"
                              : "default"
                        }
                        className={cn(
                          provider.status === "connected" &&
                            "bg-green-500/20 text-green-400 border border-green-500/50",
                          provider.status === "error" && "bg-red-500/20 text-red-400 border border-red-500/50"
                        )}
                      >
                        {provider.status === "connected" && (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </>
                        )}
                        {provider.status === "disconnected" && "Disconnected"}
                        {provider.status === "error" && (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Error
                          </>
                        )}
                      </Badge>
                    </div>

                    {/* Stats Grid */}
                    {provider.status === "connected" && (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-wl-border-default">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">
                              Templates
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {provider.templates}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">
                              Envelopes
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {provider.envelopes?.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="mb-6">
                          <p className="text-xs font-medium text-gray-500 uppercase">
                            Last Sync
                          </p>
                          <p className="text-sm text-white mt-1 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-green-500" />
                            {provider.lastSync}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {provider.status === "connected" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            <Power className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </>
                      ) : provider.status === "error" ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-blue-500 hover:bg-blue-500/90"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Reconnect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-blue-500 hover:bg-blue-500/90"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Templates</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>signing templates</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Completion Rate</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>no active providers</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>E-Signature Providers</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-400 mb-2')}>No e-signature providers connected</p>
            <p className={cn('text-sm text-gray-500 mb-6')}>
              Connect DocuSign, Adobe Sign, HelloSign, PandaDoc, and more from the Marketplace to
              send, track, and manage e-signatures on contracts and agreements.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>

          {expandedSections.envelopes && (
            <div className="space-y-4">
              {envelopes.map((envelope) => (
                <Card key={envelope.id} className="bg-wl-bg-elevated">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-white">
                          {envelope.documentName}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Created {envelope.createdAt}
                          {envelope.dueDate && ` • Due ${envelope.dueDate}`}
                        </p>
                      </div>
                      <Badge
                        variant={getStatusBadgeVariant(envelope.status)}
                        className={cn(
                          "capitalize flex items-center gap-1",
                          envelope.status === "completed" || envelope.status === "signed"
                            ? "bg-green-500/20 text-green-400"
                            : envelope.status === "viewed"
                              ? "bg-blue-500/20 text-blue-400"
                              : envelope.status === "sent"
                                ? "bg-gray-500/20 text-gray-400"
                                  : "bg-red-500/20 text-red-400"
                        )}
                      >
                        {getStatusIcon(envelope.status)}
                        {envelope.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6 pb-6 border-b border-wl-border-default">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Completion
                        </p>
                        <p className="text-sm font-bold text-white">{envelope.progress}%</p>
                      </div>
                      <div className="w-full h-2 bg-wl-bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-500/70"
                          style={{ width: `${envelope.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Signers */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-3">
                        Signing Order
                      </p>
                      <div className="space-y-2">
                        {envelope.signers.map((signer) => (
                          <div key={signer.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-wl-bg-surface flex items-center justify-center text-xs font-semibold">
                                {signer.order}
                              </div>
                              <div>
                                <p className="font-medium text-white">{signer.name}</p>
                                <p className="text-xs text-gray-500">{signer.email}</p>
                              </div>
                            </div>
                            <div className={cn("px-2 py-1 rounded text-xs font-semibold capitalize",
                              signer.status === "signed"
                                ? "bg-green-500/20 text-green-400"
                                : signer.status === "viewed"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : signer.status === "declined"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-gray-500/20 text-gray-400"
                            )}>
                              {signer.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-wl-border-default">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
                      >
                        <DownloadCloud className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      {envelope.status === "sent" || envelope.status === "viewed" ? (
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Void
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Templates Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("templates")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Signing Templates
              </h2>
              <Badge variant="default" className="bg-wl-bg-surface">
                {templates.length} templates
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.templates ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.templates && (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id} className="bg-wl-bg-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-white">
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {template.provider} • Created {template.created}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-500">{template.usage}</p>
                        <p className="text-xs text-gray-500">times used</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-wl-border-default">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Fields
                        </p>
                        <p className="text-lg font-bold text-white mt-1">
                          {template.fields}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Signers
                        </p>
                        <p className="text-lg font-bold text-white mt-1">
                          {template.signers}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Status
                        </p>
                        <Badge variant="success" className="mt-1 bg-green-500/20 text-green-400">
                          Active
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 bg-blue-500 hover:bg-blue-500/90"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="primary"
                className="w-full bg-blue-500 hover:bg-blue-500/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Template
              </Button>
            </div>
          )}
        </div>

        {/* Webhook Events Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("webhooks")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Webhook Event Log
              </h2>
              <Badge variant="success" className="bg-green-500/20 text-green-400">
                All delivered
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.webhooks ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.webhooks && (
            <Card className="bg-wl-bg-elevated">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {webhookEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start justify-between p-4 bg-wl-bg-surface rounded-lg border border-wl-border-default"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="success"
                            className="bg-green-500/20 text-green-400 text-xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Success
                          </Badge>
                          <code className="text-xs font-mono text-blue-500">
                            {event.event}
                          </code>
                        </div>
                        <p className="text-sm text-white font-medium">
                          {event.envelope}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {event.details}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-gray-500">
                          {event.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Audit Trail Section */}
        <div>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("audit")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Audit Trail
              </h2>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.audit ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.audit && (
            <Card className="bg-wl-bg-elevated">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-4 p-4 bg-wl-bg-surface rounded-lg border border-wl-border-default"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">
                            {entry.action}
                          </h4>
                          <span className="text-xs font-mono text-gray-500">
                            {entry.ipAddress}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">
                          {entry.details}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{entry.user}</span>
                          <span>•</span>
                          <span>{entry.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
