"use client";

import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useApiList } from '@/hooks/use-api';

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SLOTS = [
  { id: "ts-1", name: "Early Morning", start: "6:00 AM", end: "9:00 AM", days: [1, 2, 3, 4, 5], maxCapacity: 30, currentBookings: 18, surcharge: 0, zone: "All Zones", isActive: true },
  { id: "ts-2", name: "Morning Express", start: "9:00 AM", end: "12:00 PM", days: [1, 2, 3, 4, 5, 6], maxCapacity: 50, currentBookings: 42, surcharge: 0, zone: "All Zones", isActive: true },
  { id: "ts-3", name: "Midday", start: "12:00 PM", end: "3:00 PM", days: [1, 2, 3, 4, 5, 6], maxCapacity: 50, currentBookings: 35, surcharge: 0, zone: "All Zones", isActive: true },
  { id: "ts-4", name: "Afternoon", start: "3:00 PM", end: "6:00 PM", days: [1, 2, 3, 4, 5, 6, 0], maxCapacity: 40, currentBookings: 28, surcharge: 2.50, zone: "All Zones", isActive: true },
  { id: "ts-5", name: "Evening Premium", start: "6:00 PM", end: "9:00 PM", days: [1, 2, 3, 4, 5], maxCapacity: 25, currentBookings: 22, surcharge: 5.00, zone: "Downtown Core", isActive: true },
  { id: "ts-6", name: "Weekend Special", start: "10:00 AM", end: "4:00 PM", days: [6, 0], maxCapacity: 60, currentBookings: 8, surcharge: 3.00, zone: "All Zones", isActive: true },
  { id: "ts-7", name: "Night Delivery", start: "9:00 PM", end: "12:00 AM", days: [4, 5, 6], maxCapacity: 15, currentBookings: 0, surcharge: 8.00, zone: "Downtown Core", isActive: false },
];

export default function TimeSlotsPage() {
  return (
    <>
      <Header
        title="Time Slots"
        subtitle="Configure delivery windows and capacity"
        actions={<Button variant="primary" size="md">+ Create Slot</Button>}
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        <div className="flex flex-col gap-4">
          {SLOTS.map((slot, i) => {
            const usage = (slot.currentBookings / slot.maxCapacity) * 100;
            const usageColor = usage > 85 ? "#ef4444" : usage > 60 ? "#f59e0b" : "#10b981";

            return (
              <Card
                key={slot.id}
                className={cn("bg-[#12121a] border border-[#1e1e2e]", slot.isActive ? "opacity-100" : "opacity-50")}
              >
                <div className="p-4 flex items-center gap-5">
                  {/* Time display */}
                  <div className="w-24 text-center p-1 bg-[#1a1a2e] rounded border border-[#1e1e2e] shrink-0">
                    <div className="text-xs font-bold font-mono text-blue-400">
                      {slot.start}
                    </div>
                    <div className="text-xs text-gray-400 my-0.5">to</div>
                    <div className="text-xs font-bold font-mono text-blue-400">
                      {slot.end}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-base font-bold text-white">{slot.name}</span>
                      <Badge variant={slot.isActive ? "success" : "default"} dot>{slot.isActive ? "Active" : "Inactive"}</Badge>
                      {slot.surcharge > 0 && <Badge variant="primary">{formatCurrency(slot.surcharge)} surcharge</Badge>}
                    </div>

                    {/* Days */}
                    <div className="flex gap-1 mb-2">
                      {DAYS.map((day, di) => {
                        const dayNum = di === 6 ? 0 : di + 1;
                        const active = slot.days.includes(dayNum);
                        return (
                          <span
                            key={day}
                            className={cn(
                              'w-7 h-5.5 rounded-sm text-xs font-semibold flex items-center justify-center',
                              active
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-[#1a1a2e] text-gray-400'
                            )}
                          >
                            {day}
                          </span>
                        );
                      })}
                    </div>

                    <span className="text-xs text-gray-400">{slot.zone}</span>
                  </div>

                  {/* Capacity bar */}
                  <div className="w-40 shrink-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-400">Capacity</span>
                      <span className="text-xs font-mono" style={{ color: usageColor }}>
                        {slot.currentBookings}/{slot.maxCapacity}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${usage}%`,
                          backgroundColor: usageColor,
                        }}
                      />
                    </div>
                  </div>

                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
