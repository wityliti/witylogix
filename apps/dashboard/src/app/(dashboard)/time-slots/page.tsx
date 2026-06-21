"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useApiList } from "@/hooks/use-api";
import { Clock } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TimeSlot {
  id: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  daysOfWeek: number[];
  maxCapacity: number;
  surcharge: string | number;
  isActive: boolean;
  deliveryZone?: { id: string; name: string } | null;
  _count?: { orders?: number; shipments?: number };
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function TimeSlotsPage() {
  const { items: slots, loading, error, refetch } = useApiList<TimeSlot>("/api/v4/time-slots?limit=50");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

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
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Slot
          </Button>
        }
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        {slots.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8" />}
            title="No time slots configured"
            description="Create delivery time windows to allow customers to choose their preferred delivery slot."
            action={{ label: "Create Time Slot", onClick: () => {} }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {slots.map((slot) => {
              const currentBookings = (slot._count?.orders ?? 0) + (slot._count?.shipments ?? 0);
              const usage = slot.maxCapacity > 0 ? (currentBookings / slot.maxCapacity) * 100 : 0;
              const usageColor = usage > 85 ? "#ef4444" : usage > 60 ? "#f59e0b" : "#10b981";
              const surcharge = typeof slot.surcharge === "string" ? parseFloat(slot.surcharge) : (slot.surcharge ?? 0);

              return (
                <Card
                  key={slot.id}
                  className={cn("bg-[#12121a] border border-[#1e1e2e]", !slot.isActive && "opacity-50")}
                >
                  <div className="p-4 flex items-center gap-5">
                    {/* Time display */}
                    <div className="w-24 text-center p-1 bg-[#1a1a2e] rounded border border-[#1e1e2e] shrink-0">
                      <div className="text-xs font-bold font-mono text-blue-400">
                        {formatTime(slot.startTime)}
                      </div>
                      <div className="text-xs text-gray-400 my-0.5">to</div>
                      <div className="text-xs font-bold font-mono text-blue-400">
                        {formatTime(slot.endTime)}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-base font-bold text-white">{slot.name}</span>
                        <Badge variant={slot.isActive ? "success" : "default"} dot>
                          {slot.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {surcharge > 0 && (
                          <Badge variant="primary">{formatCurrency(surcharge)} surcharge</Badge>
                        )}
                      </div>

                      {/* Days */}
                      <div className="flex gap-1 mb-2">
                        {DAYS.map((day, di) => {
                          const dayNum = di === 6 ? 0 : di + 1;
                          const active = slot.daysOfWeek.includes(dayNum);
                          return (
                            <span
                              key={day}
                              className={cn(
                                "w-7 h-5.5 rounded-sm text-xs font-semibold flex items-center justify-center",
                                active
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-[#1a1a2e] text-gray-400"
                              )}
                            >
                              {day}
                            </span>
                          );
                        })}
                      </div>

                      <span className="text-xs text-gray-400">
                        {slot.deliveryZone?.name ?? "All Zones"}
                      </span>
                    </div>

                    {/* Capacity bar */}
                    <div className="w-40 shrink-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-400">Capacity</span>
                        <span className="text-xs font-mono" style={{ color: usageColor }}>
                          {currentBookings}/{slot.maxCapacity}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(usage, 100)}%`, backgroundColor: usageColor }}
                        />
                      </div>
                    </div>

                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
