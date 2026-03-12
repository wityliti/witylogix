"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════
   ROUTING PROVIDER CONFIGURATION PAGE
   Integration: Valhalla, VROOM, Routific, OptimoRoute, HERE, Route4Me, Mapbox, Google, OSRM, GraphHopper, TomTom
   ═══════════════════════════════════════════════════════════ */

type ProviderStatus = "ACTIVE" | "INACTIVE" | "ERROR";

interface HealthMetric {
  timestamp: number;
  latency: number;
}

interface RoutingProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  lastHealthCheck: string;
  avgLatency: number;
  requestsPerDay: number;
  apiKey: string;
  baseUrl: string;
  rateLimit: number;
  fallbackPriority: number;
  healthHistory: HealthMetric[];
}

const ROUTING_PROVIDERS: RoutingProvider[] = [
  {
    id: "valhalla",
    name: "Valhalla",
    status: "ACTIVE",
    lastHealthCheck: "2 minutes ago",
    avgLatency: 145,
    requestsPerDay: 8420,
    apiKey: "valhalla_key_****",
    baseUrl: "https://api.valhalla.mapzen.com",
    rateLimit: 10000,
    fallbackPriority: 1,
    healthHistory: [120, 145, 138, 152, 141, 148, 140, 135, 142].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "vroom",
    name: "VROOM",
    status: "ACTIVE",
    lastHealthCheck: "5 minutes ago",
    avgLatency: 289,
    requestsPerDay: 3240,
    apiKey: "vroom_key_****",
    baseUrl: "https://api.vroom.cloud",
    rateLimit: 5000,
    fallbackPriority: 2,
    healthHistory: [280, 295, 285, 290, 300, 275, 288, 292, 289].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "routific",
    name: "Routific",
    status: "ACTIVE",
    lastHealthCheck: "3 minutes ago",
    avgLatency: 234,
    requestsPerDay: 5120,
    apiKey: "routific_key_****",
    baseUrl: "https://api.routific.com",
    rateLimit: 8000,
    fallbackPriority: 3,
    healthHistory: [220, 240, 230, 235, 245, 225, 238, 232, 234].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "optimoroute",
    name: "OptimoRoute",
    status: "INACTIVE",
    lastHealthCheck: "2 hours ago",
    avgLatency: 156,
    requestsPerDay: 1240,
    apiKey: "optimoroute_key_****",
    baseUrl: "https://api.optimoroute.com",
    rateLimit: 6000,
    fallbackPriority: 4,
    healthHistory: [140, 160, 150, 155, 165, 145, 158, 152, 156].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "here",
    name: "HERE Maps",
    status: "ERROR",
    lastHealthCheck: "12 minutes ago",
    avgLatency: 445,
    requestsPerDay: 2180,
    apiKey: "here_key_****",
    baseUrl: "https://api.here.com",
    rateLimit: 7000,
    fallbackPriority: 5,
    healthHistory: [420, 450, 440, 455, 465, 435, 458, 452, 445].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "route4me",
    name: "Route4Me",
    status: "ACTIVE",
    lastHealthCheck: "1 minute ago",
    avgLatency: 198,
    requestsPerDay: 4650,
    apiKey: "route4me_key_****",
    baseUrl: "https://api.route4me.com",
    rateLimit: 9000,
    fallbackPriority: 6,
    healthHistory: [180, 200, 190, 205, 210, 185, 202, 195, 198].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "mapbox",
    name: "Mapbox",
    status: "ACTIVE",
    lastHealthCheck: "4 minutes ago",
    avgLatency: 112,
    requestsPerDay: 12850,
    apiKey: "mapbox_key_****",
    baseUrl: "https://api.mapbox.com",
    rateLimit: 15000,
    fallbackPriority: 7,
    healthHistory: [100, 115, 110, 120, 115, 105, 118, 110, 112].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "google",
    name: "Google Maps",
    status: "ACTIVE",
    lastHealthCheck: "6 minutes ago",
    avgLatency: 267,
    requestsPerDay: 9340,
    apiKey: "google_key_****",
    baseUrl: "https://maps.googleapis.com",
    rateLimit: 12000,
    fallbackPriority: 8,
    healthHistory: [250, 270, 265, 275, 280, 255, 272, 268, 267].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "osrm",
    name: "OSRM",
    status: "ACTIVE",
    lastHealthCheck: "2 minutes ago",
    avgLatency: 89,
    requestsPerDay: 6720,
    apiKey: "osrm_key_****",
    baseUrl: "https://router.project-osrm.org",
    rateLimit: 8500,
    fallbackPriority: 9,
    healthHistory: [85, 90, 88, 95, 92, 80, 88, 87, 89].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "graphhopper",
    name: "GraphHopper",
    status: "ACTIVE",
    lastHealthCheck: "7 minutes ago",
    avgLatency: 176,
    requestsPerDay: 3580,
    apiKey: "graphhopper_key_****",
    baseUrl: "https://api.graphhopper.com",
    rateLimit: 5500,
    fallbackPriority: 10,
    healthHistory: [160, 180, 170, 185, 190, 165, 182, 175, 176].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
  {
    id: "tomtom",
    name: "TomTom",
    status: "ACTIVE",
    lastHealthCheck: "3 minutes ago",
    avgLatency: 215,
    requestsPerDay: 4920,
    apiKey: "tomtom_key_****",
    baseUrl: "https://api.tomtom.com",
    rateLimit: 7500,
    fallbackPriority: 11,
    healthHistory: [200, 220, 210, 225, 230, 205, 222, 215, 215].map((l, i) => ({
      timestamp: Date.now() - (8 - i) * 3600000,
      latency: l,
    })),
  },
];

interface SparklineProps {
  data: HealthMetric[];
}

function Sparkline({ data }: SparklineProps) {
  if (!data || data.length === 0) return null;
  const maxLatency = Math.max(...data.map((d) => d.latency));
  const minLatency = Math.min(...data.map((d) => d.latency));
  const range = maxLatency - minLatency || 1;
  const width = 120;
  const height = 40;
  const pointWidth = width / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const x = i * pointWidth;
    const normalizedValue = (d.latency - minLatency) / range;
    const y = height - normalizedValue * (height - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-10">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="url(#gradient)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--wl-primary-500)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--wl-primary-500)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  const variants: Record<ProviderStatus, "success" | "warning" | "danger" | "default"> = {
    ACTIVE: "success",
    INACTIVE: "default",
    ERROR: "danger",
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

export default function RoutingPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [fallbackOrder, setFallbackOrder] = useState<string[]>(
    ROUTING_PROVIDERS.sort((a, b) => a.fallbackPriority - b.fallbackPriority).map((p) => p.id)
  );
  const [origin, setOrigin] = useState("123 Main St, San Francisco");
  const [destination, setDestination] = useState("456 Market St, San Francisco");
  const [compareProviders, setCompareProviders] = useState<string[]>(["mapbox", "osrm"]);

  const selected = selectedProvider ? ROUTING_PROVIDERS.find((p) => p.id === selectedProvider) : null;
  const sortedByPriority = ROUTING_PROVIDERS.sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  const mockRouteComparison = useMemo(() => {
    return {
      mapbox: { distance: "2.3 km", duration: "8 mins", eta: "2:45 PM", polyline: "encoded_polyline_mapbox" },
      osrm: { distance: "2.3 km", duration: "8 mins", eta: "2:46 PM", polyline: "encoded_polyline_osrm" },
      valhalla: { distance: "2.25 km", duration: "7 mins", eta: "2:44 PM", polyline: "encoded_polyline_valhalla" },
      google: { distance: "2.32 km", duration: "9 mins", eta: "2:47 PM", polyline: "encoded_polyline_google" },
    };
  }, []);

  return (
    <>
      <Header
        title="Routing Providers"
        subtitle="Configure and monitor route optimization providers"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn("p-6 space-y-6")}>
        {/* Overview Cards */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Providers</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {ROUTING_PROVIDERS.filter((p) => p.status === "ACTIVE").length}
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>out of 11 total</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avg Latency</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {Math.round(
                  ROUTING_PROVIDERS.reduce((sum, p) => sum + p.avgLatency, 0) / ROUTING_PROVIDERS.length
                )}
                <span className="text-xs text-wl-text-tertiary">ms</span>
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>across all providers</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Requests/Day</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {(ROUTING_PROVIDERS.reduce((sum, p) => sum + p.requestsPerDay, 0) / 1000).toFixed(0)}
                <span className="text-xs text-wl-text-tertiary">k</span>
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>total volume</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Error Rate</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-warning-500")}>
                {(
                  (ROUTING_PROVIDERS.filter((p) => p.status === "ERROR").length /
                    ROUTING_PROVIDERS.length) *
                  100
                ).toFixed(1)}
                <span className="text-xs text-wl-text-tertiary">%</span>
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>1 provider down</p>
            </div>
          </Card>
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
          {/* Provider Grid */}
          <div className={cn("lg:col-span-2 space-y-4")}>
            <div className={cn("flex items-center justify-between")}>
              <h2 className={cn("text-lg font-semibold text-wl-text-primary")}>Provider Configuration</h2>
              <div className={cn("flex gap-2")}>
                <Button variant="secondary" size="sm">
                  Health Check
                </Button>
                <Button variant="secondary" size="sm">
                  Refresh
                </Button>
              </div>
            </div>

            <div className={cn("grid grid-cols-1 gap-3")}>
              {ROUTING_PROVIDERS.map((provider) => (
                <Card
                  key={provider.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-wl-primary-400",
                    selectedProvider === provider.id && "border-wl-primary-500 bg-wl-bg-surface"
                  )}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div>
                        <h3 className={cn("font-semibold text-wl-text-primary")}>{provider.name}</h3>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Priority: #{provider.fallbackPriority}</p>
                      </div>
                      <StatusBadge status={provider.status} />
                    </div>

                    <div className={cn("grid grid-cols-4 gap-3 mb-3")}>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Last Check</p>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>{provider.lastHealthCheck}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Avg Latency</p>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>{provider.avgLatency}ms</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Requests/Day</p>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>{(provider.requestsPerDay / 1000).toFixed(1)}k</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Trend</p>
                        <div className={cn("h-8 mt-1")}>
                          <Sparkline data={provider.healthHistory} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className={cn("space-y-4")}>
            {selected ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                  </CardHeader>
                  <div className={cn("p-4 pt-0 space-y-4")}>
                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        API Key
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-wl-text-tertiary")}>
                        {selected.apiKey}
                      </div>
                      <Button variant="ghost" size="sm" className="mt-2 w-full">
                        Change Key
                      </Button>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Base URL
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-wl-text-tertiary break-all")}>
                        {selected.baseUrl}
                      </div>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Rate Limit
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-wl-text-tertiary")}>
                        {selected.rateLimit.toLocaleString()} req/hour
                      </div>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Fallback Priority
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-wl-text-tertiary")}>
                        #{selected.fallbackPriority} of {ROUTING_PROVIDERS.length}
                      </div>
                    </div>

                    <div className={cn("flex gap-2")}>
                      <Button variant="secondary" size="sm" className="flex-1">
                        Test
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1">
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <div className={cn("p-4 pt-0 space-y-2")}>
                    <Button
                      variant={selected.status === "ACTIVE" ? "danger" : "primary"}
                      size="sm"
                      className="w-full"
                    >
                      {selected.status === "ACTIVE" ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full">
                      Clear Cache
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <Card>
                <div className={cn("p-8 text-center")}>
                  <p className={cn("text-wl-text-tertiary")}>Select a provider to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Route Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Route Comparison Tool</CardTitle>
          </CardHeader>
          <div className={cn("p-4 pt-0")}>
            <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 mb-4")}>
              <div>
                <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                  Origin
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-text-primary text-sm outline-none"
                  )}
                />
              </div>
              <div>
                <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                  Destination
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-text-primary text-sm outline-none"
                  )}
                />
              </div>
            </div>

            <div className={cn("flex gap-2 mb-4")}>
              {["mapbox", "osrm", "valhalla", "google"].map((pid) => (
                <label key={pid} className={cn("flex items-center gap-2")}>
                  <input
                    type="checkbox"
                    checked={compareProviders.includes(pid)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCompareProviders([...compareProviders, pid]);
                      } else {
                        setCompareProviders(compareProviders.filter((p) => p !== pid));
                      }
                    }}
                    className={cn("w-4 h-4 rounded border-wl-border-default")}
                  />
                  <span className={cn("text-sm text-wl-text-primary")}>
                    {ROUTING_PROVIDERS.find((p) => p.id === pid)?.name}
                  </span>
                </label>
              ))}
            </div>

            <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
              {compareProviders.map((pid) => {
                const provider = ROUTING_PROVIDERS.find((p) => p.id === pid);
                const comparison = mockRouteComparison[pid as keyof typeof mockRouteComparison];
                if (!provider || !comparison) return null;

                return (
                  <Card key={pid} className={cn("bg-wl-bg-surface border-wl-border-subtle")}>
                    <div className={cn("p-3")}>
                      <h4 className={cn("font-semibold text-wl-text-primary mb-3")}>{provider.name}</h4>
                      <div className={cn("space-y-2 text-sm")}>
                        <div>
                          <p className={cn("text-xs text-wl-text-tertiary")}>Distance</p>
                          <p className={cn("font-semibold text-wl-text-primary")}>{comparison.distance}</p>
                        </div>
                        <div>
                          <p className={cn("text-xs text-wl-text-tertiary")}>Duration</p>
                          <p className={cn("font-semibold text-wl-text-primary")}>{comparison.duration}</p>
                        </div>
                        <div>
                          <p className={cn("text-xs text-wl-text-tertiary")}>ETA</p>
                          <p className={cn("font-semibold text-wl-text-primary")}>{comparison.eta}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Fallback Chain */}
        <Card>
          <CardHeader>
            <CardTitle>Fallback Priority Chain</CardTitle>
          </CardHeader>
          <div className={cn("p-4 pt-0")}>
            <p className={cn("text-sm text-wl-text-tertiary mb-4")}>
              Drag to reorder providers. If the primary provider fails, requests will be routed to the next in the chain.
            </p>
            <div className={cn("space-y-2")}>
              {sortedByPriority.map((provider, idx) => (
                <div key={provider.id} className={cn("flex items-center gap-3 p-3 bg-wl-bg-surface rounded border border-wl-border-subtle")}>
                  <div className={cn("flex-shrink-0 w-6 h-6 rounded-full bg-wl-primary-500 text-wl-text-inverse flex items-center justify-center text-xs font-bold")}>
                    {idx + 1}
                  </div>
                  <div className={cn("flex-1")}>
                    <p className={cn("font-semibold text-wl-text-primary")}>{provider.name}</p>
                    <p className={cn("text-xs text-wl-text-tertiary")}>{provider.status} · {provider.avgLatency}ms avg</p>
                  </div>
                  <StatusBadge status={provider.status} />
                  <Button variant="ghost" size="sm" className="text-wl-text-tertiary">
                    ⋮
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
