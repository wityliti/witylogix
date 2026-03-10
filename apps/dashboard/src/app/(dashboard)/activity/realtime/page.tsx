"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Package,
  Car,
  CheckCircle,
  Zap,
  LogIn,
  Pause,
  Play,
  Filter,
  RotateCcw,
} from "lucide-react";

interface RealtimeEvent {
  id: string;
  type: "order.created" | "driver.assigned" | "delivery.completed" | "webhook.fired" | "user.login";
  title: string;
  description: string;
  timestamp: Date;
  avatar?: string;
  initials?: string;
  status: "pending" | "completed" | "failed";
}

const EVENT_TYPES = {
  "order.created": {
    label: "Order Created",
    icon: <Package className="w-4 h-4" />,
    color: "#3b82f6",
  },
  "driver.assigned": {
    label: "Driver Assigned",
    icon: <Car className="w-4 h-4" />,
    color: "#8b5cf6",
  },
  "delivery.completed": {
    label: "Delivery Completed",
    icon: <CheckCircle className="w-4 h-4" />,
    color: "#10b981",
  },
  "webhook.fired": {
    label: "Webhook Fired",
    icon: <Zap className="w-4 h-4" />,
    color: "#f59e0b",
  },
  "user.login": {
    label: "User Login",
    icon: <LogIn className="w-4 h-4" />,
    color: "#6366f1",
  },
};

const MOCK_EVENTS: RealtimeEvent[] = [
  {
    id: "evt-001",
    type: "order.created",
    title: "Order #12847 Created",
    description: "New order placed for delivery to San Francisco",
    timestamp: new Date(Date.now() - 2 * 1000),
    initials: "SC",
    status: "completed",
  },
  {
    id: "evt-002",
    type: "driver.assigned",
    title: "Driver Marcus Assigned",
    description: "Marcus Johnson assigned to Order #12847",
    timestamp: new Date(Date.now() - 15 * 1000),
    initials: "MJ",
    status: "completed",
  },
  {
    id: "evt-003",
    type: "delivery.completed",
    title: "Delivery Complete",
    description: "Order #12843 delivered successfully to customer",
    timestamp: new Date(Date.now() - 45 * 1000),
    initials: "ED",
    status: "completed",
  },
  {
    id: "evt-004",
    type: "webhook.fired",
    title: "Inventory Webhook",
    description: "Stock update webhook from Shopify processed",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    initials: "SHP",
    status: "completed",
  },
  {
    id: "evt-005",
    type: "user.login",
    title: "User Login",
    description: "Sarah Chen logged in from 192.168.1.45",
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
    initials: "SC",
    status: "completed",
  },
  {
    id: "evt-006",
    type: "order.created",
    title: "Order #12846 Created",
    description: "New express delivery order placed",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    initials: "JD",
    status: "completed",
  },
  {
    id: "evt-007",
    type: "driver.assigned",
    title: "Driver Emily Assigned",
    description: "Emily Rodriguez assigned to Order #12846",
    timestamp: new Date(Date.now() - 6 * 60 * 1000),
    initials: "ER",
    status: "pending",
  },
  {
    id: "evt-008",
    type: "delivery.completed",
    title: "Delivery Complete",
    description: "Order #12842 delivered to downtown location",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    initials: "DP",
    status: "completed",
  },
];

// Format timestamp to relative time
const getRelativeTime = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
};

// Live Indicator Component
const LiveIndicator = ({ isLive }: { isLive: boolean }) => {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "w-2 h-2 rounded-full",
        isLive
          ? "bg-[var(--wl-success)] animate-pulse"
          : "bg-[var(--wl-text-secondary)]"
      )} />
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--wl-text-secondary)]">
        {isLive ? "Live" : "Paused"}
      </span>
    </div>
  );
};

// Event Item Component
const EventItem = ({ event, isNew }: { event: RealtimeEvent; isNew?: boolean }) => {
  const eventConfig = EVENT_TYPES[event.type];

  return (
    <div
      className={cn(
        "flex gap-4 p-4 border-l-4 transition-all duration-300",
        isNew && "bg-[var(--wl-bg-secondary)] animate-slideInLeft",
        !isNew && "border-b border-[var(--wl-border)]",
        event.status === "failed" && "opacity-60"
      )}
      style={{ borderLeftColor: eventConfig.color }}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0 mt-1">
        <AvatarFallback className="text-xs font-bold bg-[var(--wl-bg-secondary)]">
          {event.initials}
        </AvatarFallback>
      </Avatar>

      {/* Event Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="p-1.5 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: eventConfig.color + "20" }}
            >
              <span style={{ color: eventConfig.color }}>
                {eventConfig.icon}
              </span>
            </div>
            <span className="font-semibold text-[var(--wl-text-primary)]">
              {event.title}
            </span>
            <Badge
              variant={
                event.status === "completed"
                  ? "success"
                  : event.status === "failed"
                  ? "danger"
                  : "info"
              }
              className="text-xs"
            >
              {event.status}
            </Badge>
          </div>
          <span className="text-xs text-[var(--wl-text-secondary)] flex-shrink-0 whitespace-nowrap">
            {getRelativeTime(event.timestamp)}
          </span>
        </div>

        <p className="text-sm text-[var(--wl-text-secondary)] ml-9">
          {event.description}
        </p>
      </div>
    </div>
  );
};

// Main Realtime Activity Page
export default function RealtimeActivityPage() {
  const [events, setEvents] = useState<RealtimeEvent[]>(MOCK_EVENTS);
  const [isLive, setIsLive] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [newEventCount, setNewEventCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEventIdRef = useRef<string>(MOCK_EVENTS[0].id);

  // Simulate new events arriving
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const eventTypeKeys = Object.keys(EVENT_TYPES) as Array<keyof typeof EVENT_TYPES>;
      const randomType = eventTypeKeys[Math.floor(Math.random() * eventTypeKeys.length)];
      const names = ["Sarah Chen", "Marcus Johnson", "Emily Rodriguez", "David Park"];
      const name = names[Math.floor(Math.random() * names.length)];

      const newEvent: RealtimeEvent = {
        id: `evt-${Date.now()}`,
        type: randomType,
        title: `${EVENT_TYPES[randomType].label} - ${Math.floor(Math.random() * 9000) + 1000}`,
        description: `New event: ${name} triggered a ${EVENT_TYPES[randomType].label.toLowerCase()} action`,
        timestamp: new Date(),
        initials: name.split(" ").map((n) => n[0]).join(""),
        status: "completed",
      };

      setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
      setNewEventCount((prev) => prev + 1);
      lastEventIdRef.current = newEvent.id;

      // Auto-scroll if at top
      if (containerRef.current && isLive) {
        containerRef.current.scrollTop = 0;
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (isLive && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [isLive, events[0]?.id]);

  const filteredEvents =
    selectedEventType === "all"
      ? events
      : events.filter((e) => e.type === selectedEventType);

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Real-time Activity"
        subtitle="Live event stream of dashboard activity"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant={isLive ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className="flex items-center gap-2"
            >
              {isLive ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              )}
            </Button>
          </div>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Stats Card */}
        <Card className="bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)] mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                    Status
                  </p>
                  <p className="text-lg font-bold text-[var(--wl-text-primary)]">
                    <LiveIndicator isLive={isLive} />
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                  New Events
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  {newEventCount}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                  Events in Feed
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  {filteredEvents.length}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                  Success Rate
                </p>
                <p className="text-2xl font-bold text-[var(--wl-success)]">
                  {Math.round(
                    (filteredEvents.filter((e) => e.status === "completed").length /
                      filteredEvents.length) *
                    100
                  )}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter Bar */}
        <Card className="bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)] mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-[var(--wl-text-secondary)]" />
              <span className="text-sm font-semibold text-[var(--wl-text-primary)]">
                Filter:
              </span>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedEventType("all")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all",
                    selectedEventType === "all"
                      ? "bg-[var(--wl-primary)] text-white"
                      : "bg-[var(--wl-bg-tertiary)] text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
                  )}
                >
                  All
                </button>
                {Object.entries(EVENT_TYPES).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedEventType(type)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1",
                      selectedEventType === type
                        ? "text-white"
                        : "bg-[var(--wl-bg-tertiary)] text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
                    )}
                    style={{
                      backgroundColor:
                        selectedEventType === type ? config.color : undefined,
                    }}
                  >
                    {config.icon}
                    <span>{config.label}</span>
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEvents(MOCK_EVENTS);
                  setNewEventCount(0);
                }}
                className="ml-auto flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Events Feed */}
        <Card className="border border-[var(--wl-border)] overflow-hidden">
          <CardHeader className="border-b border-[var(--wl-border)]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Event Stream</CardTitle>
                <CardDescription>
                  Real-time dashboard activity and system events
                </CardDescription>
              </div>
              <LiveIndicator isLive={isLive} />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div
              ref={containerRef}
              className="max-h-[600px] overflow-y-auto"
            >
              {filteredEvents.length > 0 ? (
                <div>
                  {filteredEvents.map((event, idx) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      isNew={idx === 0 && isLive}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <Zap className="w-12 h-12 text-[var(--wl-text-secondary)] mb-3 opacity-30" />
                  <p className="text-[var(--wl-text-primary)] font-medium mb-1">
                    No events found
                  </p>
                  <p className="text-[var(--wl-text-secondary)] text-sm">
                    Change your filter or resume live stream to see events
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-6 text-center text-xs text-[var(--wl-text-secondary)]">
          <p>
            Events are simulated for demonstration. Last event received {getRelativeTime(events[0]?.timestamp || new Date())}
          </p>
        </div>
      </main>

      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slideInLeft {
          animation: slideInLeft 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
