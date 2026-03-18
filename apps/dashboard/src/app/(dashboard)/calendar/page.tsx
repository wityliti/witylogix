"use client";

import React, { useState } from "react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

interface CalendarRule {
  id: string;
  name: string;
  type: "BLACKOUT" | "HOLIDAY" | "CAPACITY_OVERRIDE" | "RECURRING";
  startDate: Date;
  endDate: Date;
  zones: string[];
  capacity?: number;
  isActive: boolean;
  recurrencePattern?: string;
}

interface DayCapacity {
  date: Date;
  totalSlots: number;
  booked: number;
  available: number;
  rules: CalendarRule[];
  isBlackout: boolean;
  isHoliday: boolean;
  isReducedCapacity: boolean;
}

const mockRules: CalendarRule[] = [
  {
    id: "rule-1",
    name: "Easter Holiday",
    type: "HOLIDAY",
    startDate: new Date(2026, 3, 5),
    endDate: new Date(2026, 3, 6),
    zones: ["North", "South", "West"],
    isActive: true,
  },
  {
    id: "rule-2",
    name: "Warehouse Maintenance",
    type: "BLACKOUT",
    startDate: new Date(2026, 3, 15),
    endDate: new Date(2026, 3, 16),
    zones: ["Central"],
    isActive: true,
  },
  {
    id: "rule-3",
    name: "Spring Capacity Reduction",
    type: "CAPACITY_OVERRIDE",
    startDate: new Date(2026, 2, 20),
    endDate: new Date(2026, 3, 10),
    zones: ["North", "East"],
    capacity: 35,
    isActive: true,
  },
  {
    id: "rule-4",
    name: "Weekend Limit",
    type: "RECURRING",
    startDate: new Date(2026, 3, 1),
    endDate: new Date(2026, 3, 30),
    zones: ["All"],
    capacity: 25,
    isActive: true,
    recurrencePattern: "Every Saturday & Sunday",
  },
  {
    id: "rule-5",
    name: "Memorial Day",
    type: "HOLIDAY",
    startDate: new Date(2026, 4, 25),
    endDate: new Date(2026, 4, 25),
    zones: ["All"],
    isActive: true,
  },
  {
    id: "rule-6",
    name: "Q2 Inventory Check",
    type: "BLACKOUT",
    startDate: new Date(2026, 3, 28),
    endDate: new Date(2026, 3, 29),
    zones: ["South", "West"],
    isActive: false,
  },
];

export default function CalendarPage() {
  const [selectedDay, setSelectedDay] = useState<DayCapacity | null>(null);
  const currentDate = new Date(2026, 2); // March 2026
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Helper: Get capacity data for a specific day
  const getDayCapacity = (date: Date): DayCapacity => {
    const dayRules = mockRules.filter(
      (rule) =>
        rule.isActive &&
        date >= rule.startDate &&
        date <= rule.endDate
    );

    const isBlackout = dayRules.some((r) => r.type === "BLACKOUT");
    const isHoliday = dayRules.some((r) => r.type === "HOLIDAY");
    const capacityRule = dayRules.find((r) => r.type === "CAPACITY_OVERRIDE");

    let totalSlots = 50;
    if (capacityRule && capacityRule.capacity) {
      totalSlots = capacityRule.capacity;
    }
    if (isBlackout) totalSlots = 0;

    const booked = isBlackout ? 0 : Math.floor(totalSlots * 0.6);
    const available = totalSlots - booked;
    const isReducedCapacity = totalSlots < 50 && !isBlackout;

    return {
      date,
      totalSlots,
      booked,
      available,
      rules: dayRules,
      isBlackout,
      isHoliday,
      isReducedCapacity,
    };
  };

  // Helper: Get day of week (0-6)
  const getDayOfWeek = (date: Date): number => date.getDay();

  // Helper: Get first day of month
  const getFirstDayOfMonth = (): number => {
    return new Date(currentYear, currentMonth, 1).getDay();
  };

  // Helper: Get days in month
  const getDaysInMonth = (): number => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  };

  const firstDay = getFirstDayOfMonth();
  const daysInMonth = getDaysInMonth();
  const today = new Date(2026, 2, 6); // March 6, 2026

  // Calculate stats
  const activeRules = mockRules.filter((r) => r.isActive).length;
  const blackoutDays = mockRules.filter((r) => r.type === "BLACKOUT" && r.isActive).reduce((acc, rule) => {
    const start = rule.startDate;
    const end = rule.endDate;
    let current = new Date(start);
    let count = 0;
    while (current <= end) {
      if (current.getMonth() === currentMonth) count++;
      current.setDate(current.getDate() + 1);
    }
    return acc + count;
  }, 0);
  const todayCapacity = getDayCapacity(today);
  const upcomingHolidays = mockRules
    .filter((r) => r.type === "HOLIDAY" && r.isActive && r.startDate >= today)
    .length;

  // Generate calendar days
  const calendarDays: (DayCapacity | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    calendarDays.push(getDayCapacity(date));
  }

  const getDayBackgroundColor = (day: DayCapacity | null): string => {
    if (!day) return "transparent";
    if (day.isBlackout) return "var(--wl-danger)";
    if (day.isHoliday) return "var(--wl-info)";
    if (day.isReducedCapacity) return "var(--wl-warning)";
    return "var(--wl-bg-secondary)";
  };

  return (
    <div className="min-h-screen bg-wl-bg-root text-wl-text-primary pb-10">
      {/* Header */}
      <Header title="Calendar & Availability" />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Top action bar */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold m-0 text-wl-text-primary">
            Calendar & Availability
          </h1>
          <Button variant="primary" size="md">
            Add Rule
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 mb-8">
          <StatCard
            label="Active Rules"
            value={activeRules.toString()}
            change={{ value: 2, label: "vs last month" }}
            accentColor="var(--wl-accent)"
            index={0}
          />
          <StatCard
            label="Blackout Days (Mar)"
            value={blackoutDays.toString()}
            change={{ value: -1, label: "vs last month" }}
            accentColor="var(--wl-danger)"
            index={1}
          />
          <StatCard
            label="Capacity (Today)"
            value={`${todayCapacity.available}/${todayCapacity.totalSlots}`}
            change={{ value: 8, label: "slots available" }}
            accentColor="var(--wl-success)"
            index={2}
          />
          <StatCard
            label="Upcoming Holidays"
            value={upcomingHolidays.toString()}
            change={{ value: 2, label: "next 30 days" }}
            accentColor="var(--wl-info)"
            index={3}
          />
        </div>

        <div className={cn(
          "grid gap-6",
          selectedDay ? "grid-cols-[1fr_380px]" : "grid-cols-1"
        )}>
          {/* Main Content */}
          <div>
            {/* Calendar Grid */}
            <Card className="p-6 mb-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold m-0 mb-4 text-wl-text-primary">
                  March 2026
                </h2>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-px mb-3">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-semibold text-wl-text-secondary p-2 uppercase"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                {/* Calendar grid */}
                <div
                  className="grid grid-cols-7 gap-px bg-wl-border p-px"
                >
                  {calendarDays.map((day, idx) => (
                    <div
                      key={idx}
                      onClick={() => day && setSelectedDay(day)}
                      style={{
                        // Intentional inline: dynamic styles based on day data
                        aspectRatio: "1",
                        backgroundColor: getDayBackgroundColor(day),
                        borderColor: day && day.date.getTime() === today.getTime()
                          ? `var(--wl-accent)`
                          : `var(--wl-border)`,
                        cursor: day ? "pointer" : "default",
                        opacity: day ? 1 : 0.4,
                      }}
                      className={cn(
                        "p-2 flex flex-col justify-between transition-all",
                        day && day.date.getTime() === today.getTime()
                          ? "border-2"
                          : "border",
                      )}
                      onMouseEnter={(e) => {
                        if (day) {
                          const elem = e.currentTarget as HTMLElement;
                          elem.style.backgroundColor = getDayBackgroundColor(day);
                          elem.style.transform = "scale(0.98)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (day) {
                          const elem = e.currentTarget as HTMLElement;
                          elem.style.backgroundColor = getDayBackgroundColor(day);
                          elem.style.transform = "scale(1)";
                        }
                      }}
                    >
                      {day && (
                        <>
                          <div
                            className="text-xs font-semibold"
                            style={{
                              // Intentional inline: dynamic text color based on day status
                              color: day.isBlackout || day.isHoliday
                                ? "white"
                                : "var(--wl-text-primary)",
                            }}
                          >
                            {day.date.getDate()}
                          </div>
                          <div
                            className="text-xs font-medium"
                            style={{
                              // Intentional inline: dynamic text color based on day status
                              color: day.isBlackout || day.isHoliday
                                ? "rgba(255,255,255,0.8)"
                                : "var(--wl-text-secondary)",
                            }}
                          >
                            {day.isBlackout
                              ? "Blocked"
                              : day.isHoliday
                              ? "Holiday"
                              : `${day.available}/${day.totalSlots}`}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex gap-4 flex-wrap pt-4 border-t border-wl-border text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-wl-bg-secondary border border-wl-border" />
                  <span>Normal Capacity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-wl-warning" />
                  <span>Reduced Capacity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-wl-info" />
                  <span>Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-wl-danger" />
                  <span>Blackout</span>
                </div>
              </div>
            </Card>

            {/* Rules List */}
            <div>
              <h2 className="text-xl font-semibold mb-4 text-wl-text-primary">
                Calendar Rules
              </h2>

              <div className="grid gap-3">
                {mockRules.map((rule) => (
                  <Card
                    key={rule.id}
                    className={cn(
                      "p-4 flex justify-between items-center",
                      !rule.isActive && "opacity-60"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-sm font-semibold m-0 text-wl-text-primary">
                          {rule.name}
                        </h3>
                        <Badge
                          variant={
                            rule.type === "BLACKOUT"
                              ? "default"
                              : rule.type === "HOLIDAY"
                              ? "info"
                              : rule.type === "CAPACITY_OVERRIDE"
                              ? "warning"
                              : "primary"
                          }
                        >
                          {rule.type.replace(/_/g, " ")}
                        </Badge>
                        {!rule.isActive && (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </div>

                      <div className="text-xs text-wl-text-secondary mb-2">
                        {rule.recurrencePattern
                          ? rule.recurrencePattern
                          : `${rule.startDate.toLocaleDateString()} - ${rule.endDate.toLocaleDateString()}`}
                        {rule.capacity && (
                          <span className="ml-3">
                            • Capacity: {rule.capacity} slots
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {rule.zones.map((zone) => (
                          <Badge key={zone} variant="primary">
                            {zone}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm">
                        Delete
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Side Panel */}
          {selectedDay && (
            <div className="sticky top-6">
              <Card className="p-5">
                <div className="mb-6 pb-4 border-b border-wl-border">
                  <h3 className="text-base font-semibold m-0 mb-2 text-wl-text-primary">
                    {selectedDay.date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <p className="m-0 text-xs text-wl-text-secondary">
                    {selectedDay.isBlackout
                      ? "Blackout Day"
                      : selectedDay.isHoliday
                      ? "Holiday"
                      : "Normal Day"}
                  </p>
                </div>

                {/* Capacity Details */}
                <div className="mb-5">
                  <h4 className="text-xs font-semibold m-0 mb-3 text-wl-text-secondary uppercase">
                    Capacity Details
                  </h4>
                  <div className="grid gap-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-wl-text-secondary">
                        Total Slots
                      </span>
                      <span className="font-semibold text-wl-text-primary">
                        {selectedDay.totalSlots}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-wl-text-secondary">
                        Booked
                      </span>
                      <span className="font-semibold text-wl-warning">
                        {selectedDay.booked}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-wl-text-secondary">
                        Available
                      </span>
                      <span className="font-semibold text-wl-success">
                        {selectedDay.available}
                      </span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="mt-3 h-1.5 bg-wl-bg-secondary rounded-full overflow-hidden">
                    <div
                      style={{
                        // Intentional inline: dynamic width calculation
                        height: "100%",
                        backgroundColor: "var(--wl-warning)",
                        width: `${(selectedDay.booked / selectedDay.totalSlots) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Active Rules */}
                {selectedDay.rules.length > 0 && (
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold m-0 mb-3 text-wl-text-secondary uppercase">
                      Active Rules
                    </h4>
                    <div className="grid gap-2">
                      {selectedDay.rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-2.5 bg-wl-bg-secondary rounded text-xs"
                        >
                          <div className="font-semibold text-wl-text-primary mb-1">
                            {rule.name}
                          </div>
                          <Badge
                            variant={
                              rule.type === "BLACKOUT"
                                ? "default"
                                : rule.type === "HOLIDAY"
                                ? "info"
                                : rule.type === "CAPACITY_OVERRIDE"
                                ? "warning"
                                : "primary"
                            }
                          >
                            {rule.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Slots */}
                <div className="mb-5">
                  <h4 className="text-xs font-semibold m-0 mb-3 text-wl-text-secondary uppercase">
                    Time Slots
                  </h4>
                  <div className="grid gap-1.5">
                    {["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map(
                      (time, idx) => (
                        <div
                          key={time}
                          className="flex justify-between p-2 bg-wl-bg-secondary rounded text-xs"
                        >
                          <span className="text-wl-text-primary font-medium">
                            {time}
                          </span>
                          <span className="text-wl-text-secondary">
                            {idx < 3 ? "3/5" : "2/5"} slots
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid gap-2 mb-3">
                  <Button variant="primary" size="md">
                    Adjust Capacity
                  </Button>
                  <Button variant="secondary" size="md">
                    Add Blackout
                  </Button>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-full mt-3 p-2 bg-transparent text-wl-text-secondary border-none cursor-pointer text-xs font-medium"
                >
                  Close Panel
                </button>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
