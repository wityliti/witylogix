"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { LoadingSkeleton, ErrorState } from "@/components/ui/loading";

const LocationsOverviewMap = dynamic(
  () => import('./components/locations-overview-map').then((m) => m.LocationsOverviewMap),
  { ssr: false },
);

type LocationType = "WAREHOUSE" | "STORE" | "HUB" | "DEPOT" | "PICKUP_POINT";
type LocationStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

interface Location {
  id: string;
  name: string;
  type: LocationType;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  latitude: number;
  longitude: number;
  activeShipments: number;
  totalProcessed: number;
  avgPrepTime: number;
  operatingHours: Record<string, { open: string; close: string }> | null;
  status: LocationStatus;
}

const typeVariant = (t: LocationType): "info" | "success" | "primary" | "warning" | "default" => {
  const map: Record<LocationType, "info" | "success" | "primary" | "warning" | "default"> = {
    WAREHOUSE: "info",
    STORE: "success",
    HUB: "primary",
    DEPOT: "warning",
    PICKUP_POINT: "default",
  };
  return map[t];
};

const statusVariant = (s: LocationStatus): "success" | "warning" | "danger" => {
  const map: Record<LocationStatus, "success" | "warning" | "danger"> = {
    ACTIVE: "success",
    INACTIVE: "danger",
    MAINTENANCE: "warning",
  };
  return map[s];
};

const typeLabel = (t: LocationType): string => {
  const map: Record<LocationType, string> = {
    WAREHOUSE: "Warehouse",
    STORE: "Store",
    HUB: "Hub",
    DEPOT: "Depot",
    PICKUP_POINT: "Pickup Point",
  };
  return map[t];
};

// ─── Location Form Modal ──────────────────────────────────

interface LocationFormData {
  name: string;
  type: LocationType;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: LocationFormData = {
  name: '', type: 'WAREHOUSE', addressLine1: '', city: '', province: '',
  postalCode: '', country: 'US', latitude: '', longitude: '', phone: '', email: '',
};

function LocationFormModal({
  mode,
  location,
  onClose,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  location?: Location;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<LocationFormData>(
    location
      ? {
          name: location.name,
          type: location.type,
          addressLine1: location.addressLine1,
          city: location.city,
          province: location.province ?? '',
          postalCode: location.postalCode ?? '',
          country: location.country ?? 'US',
          latitude: location.latitude?.toString() ?? '',
          longitude: location.longitude?.toString() ?? '',
          phone: location.phone ?? '',
          email: location.email ?? '',
        }
      : EMPTY_FORM
  );
  const [formError, setFormError] = useState<string | null>(null);

  const { execute: createLocation, loading: creating } = useApiMutation<Location>('POST', '/api/v4/locations');
  const { execute: updateLocation, loading: updating } = useApiMutation<Location>(
    'PATCH',
    `/api/v4/locations/${location?.id ?? 'new'}`,
  );
  const saving = creating || updating;

  const set = useCallback(
    <K extends keyof LocationFormData>(key: K, value: LocationFormData[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!form.name || !form.addressLine1 || !form.city || isNaN(lat) || isNaN(lng)) {
      setFormError('Name, address, city, latitude, and longitude are required.');
      return;
    }
    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      addressLine1: form.addressLine1,
      city: form.city,
      country: form.country || 'US',
      latitude: lat,
      longitude: lng,
    };
    if (form.province) payload.province = form.province;
    if (form.postalCode) payload.postalCode = form.postalCode;
    if (form.phone) payload.phone = form.phone;
    if (form.email) payload.email = form.email;
    try {
      if (mode === 'create') {
        await createLocation(payload);
      } else {
        await updateLocation(payload);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save location.';
      setFormError(msg);
    }
  };

  const inputCls = cn(
    'w-full px-3 py-2 rounded-md bg-wl-bg-elevated border border-wl-border-default',
    'text-sm text-wl-text-primary placeholder-wl-text-tertiary outline-none',
    'focus:border-wl-info-500 focus:ring-2 focus:ring-wl-info-500/20 transition-colors',
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-wl-border-default flex-shrink-0">
          <h2 className="text-base font-semibold text-wl-text-primary">
            {mode === 'create' ? 'Add Location' : 'Edit Location'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-wl-text-secondary hover:text-wl-text-primary text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Name *</label>
              <input
                className={inputCls}
                placeholder="e.g. Main Warehouse"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Type</label>
              <select
                className={inputCls}
                value={form.type}
                onChange={(e) => set('type', e.target.value as LocationType)}
              >
                <option value="WAREHOUSE">Warehouse</option>
                <option value="STORE">Store</option>
                <option value="HUB">Hub</option>
                <option value="DEPOT">Depot</option>
                <option value="PICKUP_POINT">Pickup Point</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Address *</label>
              <input
                className={inputCls}
                placeholder="123 Main St"
                value={form.addressLine1}
                onChange={(e) => set('addressLine1', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">City *</label>
              <input
                className={inputCls}
                placeholder="City"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Province / State</label>
              <input
                className={inputCls}
                placeholder="State"
                value={form.province}
                onChange={(e) => set('province', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Postal Code</label>
              <input
                className={inputCls}
                placeholder="00000"
                value={form.postalCode}
                onChange={(e) => set('postalCode', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Country</label>
              <input
                className={inputCls}
                placeholder="US"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Latitude *</label>
              <input
                className={inputCls}
                type="number"
                step="any"
                min={-90}
                max={90}
                placeholder="e.g. 40.7128"
                value={form.latitude}
                onChange={(e) => set('latitude', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Longitude *</label>
              <input
                className={inputCls}
                type="number"
                step="any"
                min={-180}
                max={180}
                placeholder="e.g. -74.0060"
                value={form.longitude}
                onChange={(e) => set('longitude', e.target.value)}
                required
              />
            </div>
            <p className="col-span-2 text-xs text-wl-text-tertiary -mt-2">
              Tip: find coordinates at maps.google.com (right-click → copy location)
            </p>

            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Phone</label>
              <input
                className={inputCls}
                type="tel"
                placeholder="+1 555 000 0000"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">Email</label>
              <input
                className={inputCls}
                type="email"
                placeholder="location@example.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          </div>

          {formError && (
            <p className="text-sm text-wl-danger-400 bg-wl-danger-500/10 border border-wl-danger-500/20 rounded-md px-3 py-2">
              {formError}
            </p>
          )}
        </form>

        <div className="flex justify-end gap-2 p-5 border-t border-wl-border-default flex-shrink-0">
          <Button variant="ghost" size="md" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Location' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const { items: locations, loading, error, refetch } = useApiList<Location>('/api/v4/locations');
  const [typeFilter, setTypeFilter] = useState<LocationType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const filtered = useMemo(() => {
    return locations.filter((loc) => {
      if (typeFilter !== "ALL" && loc.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          loc.name.toLowerCase().includes(q) ||
          loc.addressLine1.toLowerCase().includes(q) ||
          loc.city.toLowerCase().includes(q) ||
          loc.province.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [typeFilter, search, locations]);

  const stats = {
    totalLocations: locations.length,
    activeLocations: locations.filter((l) => l.status === "ACTIVE").length,
    totalShipments: locations.reduce((sum, l) => sum + l.activeShipments, 0),
    avgPrepTime: Math.round(
      locations.length > 0
        ? locations.reduce((sum, l) => sum + l.avgPrepTime, 0) / locations.length
        : 0
    ),
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error?.message ?? 'Failed to load locations'} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Locations"
        subtitle={`${stats.totalLocations} total · ${stats.activeLocations} active`}
        actions={
          <div className={cn("flex gap-2 items-center")}>
            <div className={cn("flex rounded-lg border border-wl-border-default overflow-hidden")}>
              {(["grid", "map"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  aria-pressed={viewMode === v}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors capitalize",
                    viewMode === v
                      ? "bg-wl-primary-600 text-white"
                      : "bg-wl-bg-surface text-wl-text-secondary hover:text-white"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
              + Add Location
            </Button>
          </div>
        }
      />

      <div className={cn("p-6")}>
        {/* KPI Stats */}
        <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6")}>
          <StatCard label="Total Locations" value={stats.totalLocations} index={0} accentColor="var(--wl-info-500)" />
          <StatCard label="Active" value={stats.activeLocations} index={1} accentColor="var(--wl-success-500)" />
          <StatCard label="Shipments Today" value={stats.totalShipments} index={2} accentColor="var(--wl-info-500)" />
          <StatCard label="Avg Prep Time" value={`${stats.avgPrepTime}m`} index={3} accentColor="var(--wl-warning-500)" />
        </div>

        {/* Filters Bar */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
          <div className={cn("flex-1 min-w-72 max-w-sm")}>
            <input
              type="text"
              placeholder="Search locations, cities, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("w-full p-2 px-4 bg-wl-bg-surface border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none")}
            />
          </div>

          <div className={cn("flex gap-1 flex-wrap")}>
            {(["ALL", "WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => {
              const count =
                t === "ALL" ? locations.length : locations.filter((loc) => loc.type === t).length;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "py-1 px-3 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                    typeFilter === t
                      ? "bg-wl-info-500 text-wl-text-inverse border-wl-info-500"
                      : "bg-transparent text-wl-text-secondary border-wl-border-default"
                  )}
                >
                  {t === "ALL" ? "All Types" : typeLabel(t as LocationType)}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* MAP VIEW */}
        {viewMode === "map" && (
          <LocationsOverviewMap locations={filtered} />
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && filtered.length > 0 && (
          <div
            className={cn("grid gap-5")}
            style={{ gridTemplateColumns: selectedLocation ? "1fr 380px" : "1fr" }}
          >
            <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4")}>
              {filtered.map((location, i) => (
                <Card
                  key={location.id}
                  hover
                  onClick={() =>
                    setSelectedLocation(selectedLocation?.id === location.id ? null : location)
                  }
                  className={cn("cursor-pointer relative overflow-hidden flex flex-col gap-3")}
                  style={{
                    animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                    opacity: 0,
                    borderColor:
                      selectedLocation?.id === location.id ? "var(--wl-info-500)" : undefined,
                  }}
                >
                  {/* Status indicator line */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-0.5",
                      location.status === "ACTIVE"
                        ? "bg-wl-success-500"
                        : location.status === "MAINTENANCE"
                        ? "bg-wl-warning-500"
                        : "bg-wl-danger-500"
                    )}
                  />

                  <div className={cn("flex justify-between items-start")}>
                    <div className={cn("flex-1 min-w-0")}>
                      <div className={cn("flex gap-2 items-center mb-1")}>
                        <span className={cn("text-base font-bold text-wl-text-primary truncate")}>
                          {location.name}
                        </span>
                        {location.isDefault && (
                          <span className={cn("text-sm opacity-80 text-wl-info-400")}>★</span>
                        )}
                      </div>
                      <Badge variant={typeVariant(location.type)} dot>
                        {typeLabel(location.type)}
                      </Badge>
                    </div>
                    <Badge variant={statusVariant(location.status)} dot>
                      {location.status}
                    </Badge>
                  </div>

                  <div>
                    <div className={cn("text-sm text-wl-text-primary font-medium")}>{location.addressLine1}</div>
                    <div className={cn("text-xs text-wl-text-secondary mt-0.5")}>
                      {location.city}, {location.province} {location.postalCode}
                    </div>
                  </div>

                  <div className={cn("h-px bg-wl-bg-elevated")} />

                  <div className={cn("grid grid-cols-3 gap-2")}>
                    <div>
                      <div className={cn("text-xs text-wl-text-secondary mb-1")}>Active</div>
                      <div className={cn("text-lg font-bold font-mono text-wl-info-400")}>
                        {location.activeShipments}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-secondary mb-1")}>Processed</div>
                      <div className={cn("text-lg font-bold font-mono text-wl-success-500")}>
                        {location.totalProcessed}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-secondary mb-1")}>Prep</div>
                      <div className={cn("text-lg font-bold font-mono text-wl-neutral-300")}>
                        {location.avgPrepTime}m
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex gap-2 flex-wrap mt-auto pt-3 border-t border-wl-border-default"
                    )}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setEditingLocation(location); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled
                      title="Status management requires admin access"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {location.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                    {!location.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        title="Contact support to set default location"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Set Default
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {selectedLocation && (
              <div
                className={cn(
                  "rounded-xl bg-wl-bg-surface border border-wl-border-default p-5",
                  "flex flex-col gap-4 h-fit sticky top-6"
                )}
              >
                <div className={cn("flex justify-between items-start")}>
                  <div>
                    <div className={cn("text-base font-bold text-wl-text-primary mb-1")}>
                      {selectedLocation.name}
                    </div>
                    <Badge variant={typeVariant(selectedLocation.type)} dot>
                      {typeLabel(selectedLocation.type)}
                    </Badge>
                  </div>
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className={cn(
                      "text-wl-text-secondary hover:text-white text-lg leading-none transition-colors"
                    )}
                  >
                    ✕
                  </button>
                </div>

                <Badge
                  variant={statusVariant(selectedLocation.status)}
                  dot
                  className={cn("w-fit")}
                >
                  {selectedLocation.status}
                </Badge>

                <div>
                  <div
                    className={cn(
                      "text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider"
                    )}
                  >
                    Address
                  </div>
                  <div className={cn("text-sm text-wl-text-primary font-medium")}>
                    {selectedLocation.addressLine1}
                  </div>
                  <div className={cn("text-sm text-wl-neutral-300")}>
                    {selectedLocation.city}, {selectedLocation.province}{" "}
                    {selectedLocation.postalCode}
                  </div>
                  <div className={cn("text-xs text-wl-text-secondary mt-1")}>
                    {selectedLocation.country}
                  </div>
                </div>

                {(selectedLocation.phone || selectedLocation.email) && (
                  <div>
                    <div
                      className={cn(
                        "text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider"
                      )}
                    >
                      Contact
                    </div>
                    {selectedLocation.phone && (
                      <div className={cn("text-sm text-wl-neutral-300 font-mono mb-1")}>
                        {selectedLocation.phone}
                      </div>
                    )}
                    {selectedLocation.email && (
                      <div className={cn("text-sm text-wl-neutral-300")}>
                        {selectedLocation.email}
                      </div>
                    )}
                  </div>
                )}

                <div className={cn("h-px bg-wl-bg-elevated")} />

                <div className={cn("grid grid-cols-3 gap-3")}>
                  <div>
                    <div className={cn("text-xs text-wl-text-secondary mb-1")}>Active</div>
                    <div className={cn("text-lg font-bold font-mono text-wl-info-400")}>
                      {selectedLocation.activeShipments}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-xs text-wl-text-secondary mb-1")}>Processed</div>
                    <div className={cn("text-lg font-bold font-mono text-wl-success-500")}>
                      {selectedLocation.totalProcessed}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-xs text-wl-text-secondary mb-1")}>Prep</div>
                    <div className={cn("text-lg font-bold font-mono text-wl-neutral-300")}>
                      {selectedLocation.avgPrepTime}m
                    </div>
                  </div>
                </div>

                {selectedLocation.operatingHours && (
                  <div>
                    <div
                      className={cn(
                        "text-xs font-semibold text-wl-text-secondary uppercase mb-2 tracking-wider"
                      )}
                    >
                      Operating Hours
                    </div>
                    <table className={cn("w-full text-xs border-collapse")}>
                      <tbody>
                        {Object.entries(selectedLocation.operatingHours).map(([day, hours]) => (
                          <tr key={day} className={cn("border-b border-wl-border-default")}>
                            <td className={cn("py-1.5 pr-3 text-wl-neutral-300 font-medium whitespace-nowrap")}>
                              {day}
                            </td>
                            <td
                              className={cn(
                                "py-1.5",
                                hours.open === "closed"
                                  ? "text-wl-text-secondary"
                                  : "text-wl-text-primary font-mono"
                              )}
                            >
                              {hours.open === "closed"
                                ? "Closed"
                                : `${hours.open} – ${hours.close}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={cn("flex gap-2 flex-wrap mt-auto pt-3 border-t border-wl-border-default")}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setEditingLocation(selectedLocation)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    title="Status management requires admin access"
                  >
                    {selectedLocation.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                  {!selectedLocation.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      title="Contact support to set default location"
                    >
                      Set Default
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GRID VIEW — empty state */}
        {viewMode === "grid" && filtered.length === 0 && !loading && (
          <div className={cn("flex flex-col items-center justify-center py-20 text-center gap-2")}>
            <div className={cn("text-wl-text-secondary text-sm")}>No locations match your filters.</div>
            {(typeFilter !== "ALL" || search) && (
              <button
                onClick={() => { setTypeFilter("ALL"); setSearch(""); }}
                className={cn("text-xs text-wl-info-400 hover:text-wl-info-400")}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <LocationFormModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSuccess={refetch}
        />
      )}

      {editingLocation && (
        <LocationFormModal
          mode="edit"
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSuccess={refetch}
        />
      )}
    </>
  );
}
