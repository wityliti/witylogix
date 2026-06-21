"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  maxCapacity: number;
  cutoffMinutes: number;
  surcharge: number | string;
  isActive: boolean;
  deliveryZone?: { id: string; name: string } | null;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function TimeSlotsPage() {
  const { items: slots, loading, error, refetch } = useApiList<TimeSlot>("/api/v4/time-slots", { limit: 100 });

  if (loading) return <TableSkeleton rows={7} columns={4} />;
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
            description="Create delivery windows to let customers choose preferred delivery times."
            action={{ label: "Create Slot", onClick: () => {} }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {slots.map((slot) => {
              const surcharge = typeof slot.surcharge === "string" ? parseFloat(slot.surcharge) : slot.surcharge;

              return (
                <Card
                  key={slot.id}
                  className={cn(
                    "bg-[#12121a] border border-[#1e1e2e]",
                    slot.isActive ? "opacity-100" : "opacity-50"
                  )}
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

                    {/* Capacity */}
                    <div className="w-36 shrink-0 text-center">
                      <div className="text-xs text-gray-400 mb-1">Max Capacity</div>
                      <div className="text-lg font-bold text-white">{slot.maxCapacity}</div>
                      <div className="text-xs text-gray-400">deliveries</div>
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
