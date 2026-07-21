"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { Clock, Plus, Pencil, Power, Filter, Search, List, Map } from "lucide-react";

const TimeSlotsZoneMap = dynamic(
  () => import("./time-slots-zone-map").then((m) => m.TimeSlotsZoneMap),
  { ssr: false, loading: () => <LoadingSkeleton className="h-[540px] w-full rounded-xl" /> }
);

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  maxCapacity: number;
  cutoffMinutes: number;
  surcharge: string | number;
  isActive: boolean;
  deliveryZone?: { id: string; name: string } | null;
}

interface CreateSlotBody {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  maxCapacity: number;
  cutoffMinutes: number;
  surcharge: number;
  deliveryZoneId?: string | null;
}

const DEFAULT_FORM: CreateSlotBody = {
  name: "",
  startTime: "09:00",
  endTime: "12:00",
  daysOfWeek: [1, 2, 3, 4, 5],
  maxCapacity: 50,
  cutoffMinutes: 120,
  surcharge: 0,
};

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function CreateSlotModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateSlotBody>(DEFAULT_FORM);
  const { execute: create, loading: isLoading } = useApiMutation<TimeSlot>(
    "POST",
    "/api/v4/time-slots",
  );

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter((x) => x !== d)
        : [...f.daysOfWeek, d].sort(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.daysOfWeek.length === 0) return;
    await create(form);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-wl-border-default">
          <h2 className="text-base font-semibold text-wl-text-primary">New Time Slot</h2>
          <button
            onClick={onClose}
            className="text-wl-text-muted hover:text-wl-text-primary transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-wl-text-secondary mb-1">
              Slot Name *
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Morning Express"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                Start Time
              </label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTime: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                End Time
              </label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endTime: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-wl-text-secondary mb-2">
              Days of Week *
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-xs font-semibold border transition-all",
                    form.daysOfWeek.includes(i)
                      ? "bg-wl-primary border-wl-primary text-white"
                      : "bg-wl-bg-overlay border-wl-border-default text-wl-text-muted hover:border-wl-border-strong",
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                Max Capacity
              </label>
              <Input
                type="number"
                min={1}
                value={form.maxCapacity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxCapacity: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                Surcharge ($)
              </label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.surcharge}
                onChange={(e) =>
                  setForm((f) => ({ ...f, surcharge: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={isLoading || !form.name || form.daysOfWeek.length === 0}
            >
              {isLoading ? "Creating…" : "Create Slot"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TimeSlotsPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  const { items: slots, loading, error, refetch } = useApiList<TimeSlot>("/api/v4/time-slots", {
    limit: 100,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return slots.filter((s) => {
      if (filterStatus === "active" && !s.isActive) return false;
      if (filterStatus === "inactive" && s.isActive) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [slots, search, filterStatus]);

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error.message}
        onRetry={refetch}
      />
    );

  return (
    <>
      {showCreate && (
        <CreateSlotModal
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}

      <Header
        title="Time Slots"
        subtitle={`${slots.filter((s) => s.isActive).length} active delivery windows`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 p-0.5 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
              <button
                onClick={() => setView("list")}
                aria-label="List view"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  view === "list"
                    ? "bg-wl-primary text-white"
                    : "text-wl-text-muted hover:text-wl-text-primary"
                )}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setView("map")}
                aria-label="Map view"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  view === "map"
                    ? "bg-wl-primary text-white"
                    : "text-wl-text-muted hover:text-wl-text-primary"
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Map
              </button>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Slot
            </Button>
          </div>
        }
      />

      <div className="p-6 bg-wl-bg-elevated min-h-screen">
        {/* Filters — only shown in list view */}
        {view === "list" && <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search slots…"
              className="pl-9"
            />
          </div>

          <div className="flex gap-1 p-1 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
            {(["all", "active", "inactive"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterStatus(opt)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all",
                  filterStatus === opt
                    ? "bg-wl-primary text-white"
                    : "text-wl-text-muted hover:text-wl-text-primary",
                )}
              >
                {opt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-wl-text-muted">
            <Filter className="w-3.5 h-3.5" />
            {filtered.length} of {slots.length} slots
          </div>
        </div>}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            {
              label: "Total Slots",
              value: slots.length,
              color: "text-wl-text-primary",
            },
            {
              label: "Active",
              value: slots.filter((s) => s.isActive).length,
              color: "text-wl-success-400",
            },
            {
              label: "Inactive",
              value: slots.filter((s) => !s.isActive).length,
              color: "text-wl-text-muted",
            },
            {
              label: "Total Capacity",
              value: slots.filter((s) => s.isActive).reduce((a, s) => a + s.maxCapacity, 0),
              color: "text-wl-info-400",
            },
          ].map((c) => (
            <Card key={c.label} className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="p-4">
                <p className="text-xs text-wl-text-muted mb-1">{c.label}</p>
                <p className={cn("text-2xl font-bold", c.color)}>{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Map view */}
        {view === "map" && <TimeSlotsZoneMap />}

        {/* Slots list */}
        {view === "list" && (
          filtered.length === 0 ? (
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="p-12 text-center">
                <Clock className="w-12 h-12 text-wl-text-muted mx-auto mb-4" />
                <h3 className="text-base font-semibold text-wl-text-primary mb-2">
                  {slots.length === 0 ? "No time slots configured" : "No slots match your filter"}
                </h3>
                <p className="text-sm text-wl-text-muted mb-4">
                  {slots.length === 0
                    ? "Create your first delivery window to get started."
                    : "Try adjusting your search or filter."}
                </p>
                {slots.length === 0 && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Slot
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((slot) => {
              const surcharge =
                typeof slot.surcharge === "string"
                  ? parseFloat(slot.surcharge)
                  : slot.surcharge;

              return (
                <Card
                  key={slot.id}
                  className={cn(
                    "bg-wl-bg-surface border-wl-border-default transition-opacity",
                    !slot.isActive && "opacity-55",
                  )}
                >
                  <div className="p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                    {/* Time block */}
                    <div className="w-24 shrink-0 text-center p-2 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
                      <p className="text-xs font-bold font-mono text-wl-info-400">
                        {formatTime(slot.startTime)}
                      </p>
                      <p className="text-xs text-wl-text-muted my-0.5">to</p>
                      <p className="text-xs font-bold font-mono text-wl-info-400">
                        {formatTime(slot.endTime)}
                      </p>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-wl-text-primary">
                          {slot.name}
                        </span>
                        <Badge variant={slot.isActive ? "success" : "default"} dot>
                          {slot.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {surcharge > 0 && (
                          <Badge variant="primary">
                            {formatCurrency(surcharge)} surcharge
                          </Badge>
                        )}
                        {slot.deliveryZone && (
                          <Badge variant="info">{slot.deliveryZone.name}</Badge>
                        )}
                      </div>

                      {/* Days */}
                      <div className="flex gap-1 mb-1.5">
                        {DAY_LABELS.map((day, i) => {
                          const active = slot.daysOfWeek.includes(i);
                          return (
                            <span
                              key={day}
                              className={cn(
                                "w-7 h-6 rounded text-xs font-semibold flex items-center justify-center",
                                active
                                  ? "bg-wl-warning-500/20 text-wl-warning-400"
                                  : "bg-wl-bg-overlay text-wl-text-muted",
                              )}
                            >
                              {day}
                            </span>
                          );
                        })}
                      </div>

                      <p className="text-xs text-wl-text-muted">
                        Cutoff: {slot.cutoffMinutes} min before window
                      </p>
                    </div>

                    {/* Capacity */}
                    <div className="w-36 shrink-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-wl-text-muted">Max Capacity</span>
                        <span className="text-xs font-semibold text-wl-text-primary">
                          {slot.maxCapacity}
                        </span>
                      </div>
                      <div className="h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-wl-info-500"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" aria-label="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label="Toggle active">
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
}
