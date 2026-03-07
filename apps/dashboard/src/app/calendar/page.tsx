"use client";

import React, { useState } from "react";
import { Header } from "../../components/layout/header";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { Card } from "../../components/ui/card";
import { StatCard } from "../../components/ui/stat-card";

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
    <div
      style={{
        className="min-h-screen bg-wl-bg-root"
        className="text-wl-text-primary",
        paddingBottom: 40,
      }}
    >
      {/* Header */}
      <Header title="Calendar & Availability" />

      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "24px 24px",
        }}
      >
        {/* Top action bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              margin: 0,
              className="text-wl-text-primary",
            }}
          >
            Calendar & Availability
          </h1>
          <Button variant="primary" size="md">
            Add Rule
          </Button>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedDay ? "1fr 380px" : "1fr",
            gap: 24,
          }}
        >
          {/* Main Content */}
          <div>
            {/* Calendar Grid */}
            <Card
              style={{
                padding: 24,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  marginBottom: 24,
                }}
              >
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    margin: "0 0 16px 0",
                    className="text-wl-text-primary",
                  }}
                >
                  March 2026
                </h2>

                {/* Day headers */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 1,
                    marginBottom: 12,
                  }}
                >
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        style={{
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 600,
                          className="text-wl-text-secondary",
                          padding: 8,
                          textTransform: "uppercase",
                        }}
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                {/* Calendar grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 1,
                    backgroundColor: "var(--wl-border)",
                    padding: 1,
                  }}
                >
                  {calendarDays.map((day, idx) => (
                    <div
                      key={idx}
                      onClick={() => day && setSelectedDay(day)}
                      style={{
                        aspectRatio: "1",
                        backgroundColor: getDayBackgroundColor(day),
                        border:
                          day && day.date.getTime() === today.getTime()
                            ? `2px solid var(--wl-accent)`
                            : `1px solid var(--wl-border)`,
                        cursor: day ? "pointer" : "default",
                        padding: 8,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transition: "all 0.2s ease",
                        opacity: day ? 1 : 0.4,
                      }}
                      onMouseEnter={(e) => {
                        if (day) {
                          const elem = e.currentTarget as HTMLElement;
                          elem.style.backgroundColor = getDayBackgroundColor(
                            day
                          );
                          elem.style.transform = "scale(0.98)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (day) {
                          const elem = e.currentTarget as HTMLElement;
                          elem.style.backgroundColor =
                            getDayBackgroundColor(day);
                          elem.style.transform = "scale(1)";
                        }
                      }}
                    >
                      {day && (
                        <>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color:
                                day.isBlackout || day.isHoliday
                                  ? "white"
                                  : "var(--wl-text-primary)",
                            }}
                          >
                            {day.date.getDate()}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color:
                                day.isBlackout || day.isHoliday
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
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  paddingTop: 16,
                  borderTop: `1px solid var(--wl-border)`,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: "var(--wl-bg-secondary)",
                      border: `1px solid var(--wl-border)`,
                    }}
                  />
                  <span>Normal Capacity</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: "var(--wl-warning)",
                    }}
                  />
                  <span>Reduced Capacity</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: "var(--wl-info)",
                    }}
                  />
                  <span>Holiday</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: "var(--wl-danger)",
                    }}
                  />
                  <span>Blackout</span>
                </div>
              </div>
            </Card>

            {/* Rules List */}
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 16,
                  className="text-wl-text-primary",
                }}
              >
                Calendar Rules
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {mockRules.map((rule) => (
                  <Card
                    key={rule.id}
                    style={{
                      padding: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      opacity: rule.isActive ? 1 : 0.6,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 8,
                        }}
                      >
                        <h3
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            margin: 0,
                            className="text-wl-text-primary",
                          }}
                        >
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

                      <div
                        style={{
                          fontSize: 12,
                          className="text-wl-text-secondary",
                          marginBottom: 8,
                        }}
                      >
                        {rule.recurrencePattern
                          ? rule.recurrencePattern
                          : `${rule.startDate.toLocaleDateString()} - ${rule.endDate.toLocaleDateString()}`}
                        {rule.capacity && (
                          <span style={{ marginLeft: 12 }}>
                            • Capacity: {rule.capacity} slots
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {rule.zones.map((zone) => (
                          <Badge key={zone} variant="primary">
                            {zone}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginLeft: 16,
                      }}
                    >
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
            <div
              style={{
                position: "sticky",
                top: 24,
              }}
            >
              <Card
                style={{
                  padding: 20,
                }}
              >
                <div
                  style={{
                    marginBottom: 24,
                    paddingBottom: 16,
                    borderBottom: `1px solid var(--wl-border)`,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      margin: "0 0 8px 0",
                      className="text-wl-text-primary",
                    }}
                  >
                    {selectedDay.date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      className="text-wl-text-secondary",
                    }}
                  >
                    {selectedDay.isBlackout
                      ? "Blackout Day"
                      : selectedDay.isHoliday
                      ? "Holiday"
                      : "Normal Day"}
                  </p>
                </div>

                {/* Capacity Details */}
                <div
                  style={{
                    marginBottom: 20,
                  }}
                >
                  <h4
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      margin: "0 0 12px 0",
                      className="text-wl-text-secondary",
                      textTransform: "uppercase",
                    }}
                  >
                    Capacity Details
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ className="text-wl-text-secondary" }}>
                        Total Slots
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          className="text-wl-text-primary",
                        }}
                      >
                        {selectedDay.totalSlots}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ className="text-wl-text-secondary" }}>
                        Booked
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--wl-warning)",
                        }}
                      >
                        {selectedDay.booked}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ className="text-wl-text-secondary" }}>
                        Available
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--wl-success)",
                        }}
                      >
                        {selectedDay.available}
                      </span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div
                    style={{
                      marginTop: 12,
                      height: 6,
                      backgroundColor: "var(--wl-bg-secondary)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        backgroundColor: "var(--wl-warning)",
                        width: `${(selectedDay.booked / selectedDay.totalSlots) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Active Rules */}
                {selectedDay.rules.length > 0 && (
                  <div
                    style={{
                      marginBottom: 20,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        margin: "0 0 12px 0",
                        className="text-wl-text-secondary",
                        textTransform: "uppercase",
                      }}
                    >
                      Active Rules
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {selectedDay.rules.map((rule) => (
                        <div
                          key={rule.id}
                          style={{
                            padding: 10,
                            backgroundColor: "var(--wl-bg-secondary)",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              className="text-wl-text-primary",
                              marginBottom: 4,
                            }}
                          >
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
                <div
                  style={{
                    marginBottom: 20,
                  }}
                >
                  <h4
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      margin: "0 0 12px 0",
                      className="text-wl-text-secondary",
                      textTransform: "uppercase",
                    }}
                  >
                    Time Slots
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    {["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map(
                      (time, idx) => (
                        <div
                          key={time}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: 8,
                            backgroundColor: "var(--wl-bg-secondary)",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              className="text-wl-text-primary",
                              fontWeight: 500,
                            }}
                          >
                            {time}
                          </span>
                          <span
                            style={{
                              className="text-wl-text-secondary",
                            }}
                          >
                            {idx < 3 ? "3/5" : "2/5"} slots
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                  }}
                >
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
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: 8,
                    backgroundColor: "transparent",
                    className="text-wl-text-secondary",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
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
