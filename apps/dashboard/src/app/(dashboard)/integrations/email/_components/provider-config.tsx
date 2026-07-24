"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Settings, Plus } from "lucide-react";

interface Domain {
  domain: string;
  verified: boolean;
  dnsRecords: Array<{
    type: string;
    name: string;
    value: string;
  }>;
}

interface ProviderConfigProps {
  name: string;
  status: "active" | "inactive" | "error";
  configType: "api_key" | "oauth";
  apiKey?: string;
  domains: Domain[];
  sendingLimits: {
    perDay: number;
    perSecond: number;
    sent: number;
  };
}

export function ProviderConfig({
  name,
  status,
  configType,
  apiKey,
  domains,
  sendingLimits,
}: ProviderConfigProps) {
  return (
    <Card className="bg-wl-bg-elevated border-wl-border-default">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Configuration</span>
          <Badge variant={status === "active" ? "success" : "default"}>
            {status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auth Config */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">
            Authentication Method
          </h4>
          <div className="p-4 bg-wl-bg-surface rounded-lg border border-wl-border-default">
            <div className="text-sm text-gray-400 mb-2">
              {configType === "api_key" ? "API Key" : "OAuth 2.0"}
            </div>
            {apiKey && (
              <div className="font-mono text-xs text-gray-500 flex items-center justify-between p-2 bg-wl-bg-root rounded">
                <span>{apiKey}</span>
                <Copy className="w-4 h-4 cursor-pointer hover:text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Verified Domains */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">
              Verified Domains ({domains.length})
            </h4>
            <Button variant="secondary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Domain
            </Button>
          </div>
          <div className="space-y-3">
            {domains.map((domain, idx) => (
              <div
                key={idx}
                className="p-4 bg-wl-bg-surface rounded-lg border border-wl-border-default"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-sm text-white">
                    {domain.domain}
                  </div>
                  <Badge variant={domain.verified ? "success" : "warning"}>
                    {domain.verified ? "Verified" : "Pending"}
                  </Badge>
                </div>
                {domain.dnsRecords.length > 0 && (
                  <div className="space-y-2">
                    {domain.dnsRecords.map((record, ridx) => (
                      <div
                        key={ridx}
                        className="text-xs p-2 bg-wl-bg-root rounded font-mono text-gray-500"
                      >
                        <div>
                          <span className="text-cyan-400">{record.type}</span>{" "}
                          {record.name}
                        </div>
                        <div className="text-gray-400 mt-1">{record.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sending Limits */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">
            Sending Limits
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-wl-bg-surface rounded-lg border border-wl-border-default">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Per Day
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {sendingLimits.perDay.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-wl-bg-surface rounded-lg border border-wl-border-default">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Per Second
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {sendingLimits.perSecond}
              </div>
            </div>
            <div className="p-3 bg-wl-bg-surface rounded-lg border border-wl-border-default">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Sent (24h)
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {sendingLimits.sent.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-wl-border-default">
          {status === "active" && (
            <>
              <Button variant="secondary" size="sm">
                <Settings className="w-4 h-4 mr-1" />
                Edit Settings
              </Button>
              <Button variant="danger" size="sm">
                Disconnect
              </Button>
            </>
          )}
          {status === "inactive" && (
            <Button variant="primary" size="sm" className="w-full">
              Connect Provider
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
