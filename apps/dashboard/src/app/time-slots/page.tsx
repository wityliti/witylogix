"use client";

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

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

      <div style={{ padding: "var(--wl-space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
          {SLOTS.map((slot, i) => {
            const usage = (slot.currentBookings / slot.maxCapacity) * 100;
            const usageColor = usage > 85 ? "var(--wl-danger-400)" : usage > 60 ? "var(--wl-warning-400)" : "var(--wl-success-400)";

            return (
              <Card
                key={slot.id}
                className="wl-animate-in"
                style={{
                  opacity: slot.isActive ? 1 : 0.5,
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-5)" }}>
                  {/* Time display */}
                  <div
                    style={{
                      width: 100,
                      textAlign: "center",
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      background: "var(--wl-bg-surface)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-border-subtle)",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-primary-400)" }}>
                      {slot.start}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--wl-text-tertiary)", margin: "2px 0" }}>to</div>
                    <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-primary-400)" }}>
                      {slot.end}
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-3)", marginBottom: "var(--wl-space-2)" }}>
                      <span style={{ fontSize: "var(--wl-text-base)", fontWeight: 700, color: "var(--wl-text-primary)" }}>{slot.name}</span>
                      <Badge variant={slot.isActive ? "success" : "default"} dot>{slot.isActive ? "Active" : "Inactive"}</Badge>
                      {slot.surcharge > 0 && <Badge variant="primary">{formatCurrency(slot.surcharge)} surcharge</Badge>}
                    </div>

                    {/* Days */}
                    <div style={{ display: "flex", gap: 4, marginBottom: "var(--wl-space-2)" }}>
                      {DAYS.map((day, di) => {
                        const dayNum = di === 6 ? 0 : di + 1;
                        const active = slot.days.includes(dayNum);
                        return (
                          <span
                            key={day}
                            style={{
                              width: 28,
                              height: 22,
                              borderRadius: "var(--wl-radius-sm)",
                              background: active ? "rgba(245, 166, 35, 0.12)" : "var(--wl-bg-surface)",
                              color: active ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)",
                              fontSize: 10,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {day}
                          </span>
                        );
                      })}
                    </div>

                    <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>{slot.zone}</span>
                  </div>

                  {/* Capacity bar */}
                  <div style={{ width: 160, flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "var(--wl-text-tertiary)" }}>Capacity</span>
                      <span style={{ fontSize: 10, fontFamily: "var(--wl-font-mono)", color: usageColor }}>
                        {slot.currentBookings}/{slot.maxCapacity}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--wl-bg-overlay)", borderRadius: "var(--wl-radius-full)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${usage}%`,
                          height: "100%",
                          background: usageColor,
                          borderRadius: "var(--wl-radius-full)",
                          transition: `width var(--wl-duration-slow) var(--wl-ease-spring)`,
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
