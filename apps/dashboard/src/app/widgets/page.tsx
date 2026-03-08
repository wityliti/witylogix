"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Settings, Maximize2, Trash2, Plus, BarChart3, LineChart, PieChart, Table2, MapPin, Activity, Calendar } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   WIDGETS PAGE — Dashboard widget configuration & layout
   ═══════════════════════════════════════════════════════════ */

interface Widget {
  id: string;
  name: string;
  type: "stat" | "line_chart" | "bar_chart" | "pie_chart" | "table" | "map" | "activity" | "calendar";
  size: "1x1" | "2x1" | "1x2" | "2x2";
  isActive: boolean;
  gridPosition?: { row: number; col: number };
}

const ACTIVE_WIDGETS: Widget[] = [
  {
    id: "widget-001",
    name: "Revenue Overview",
    type: "line_chart",
    size: "2x1",
    isActive: true,
    gridPosition: { row: 1, col: 1 },
  },
  {
    id: "widget-002",
    name: "Order Volume",
    type: "bar_chart",
    size: "2x1",
    isActive: true,
    gridPosition: { row: 1, col: 3 },
  },
  {
    id: "widget-003",
    name: "Delivery Status",
    type: "pie_chart",
    size: "1x1",
    isActive: true,
    gridPosition: { row: 2, col: 1 },
  },
  {
    id: "widget-004",
    name: "Recent Orders",
    type: "table",
    size: "2x1",
    isActive: true,
    gridPosition: { row: 2, col: 2 },
  },
  {
    id: "widget-005",
    name: "Zone Coverage",
    type: "map",
    size: "1x2",
    isActive: true,
    gridPosition: { row: 3, col: 1 },
  },
  {
    id: "widget-006",
    name: "Activity Feed",
    type: "activity",
    size: "1x1",
    isActive: true,
    gridPosition: { row: 3, col: 2 },
  },
];

const AVAILABLE_WIDGETS = [
  {
    id: "avail-001",
    name: "Revenue Chart",
    type: "line_chart",
    description: "Line chart showing revenue trends",
  },
  {
    id: "avail-002",
    name: "Order Volume",
    type: "bar_chart",
    description: "Bar chart of orders over time",
  },
  {
    id: "avail-003",
    name: "Delivery Heatmap",
    type: "map",
    description: "Geographic visualization of deliveries",
  },
  {
    id: "avail-004",
    name: "Driver Performance",
    type: "table",
    description: "Table of driver metrics and ratings",
  },
  {
    id: "avail-005",
    name: "Zone Coverage",
    type: "map",
    description: "Map of service zones and coverage",
  },
  {
    id: "avail-006",
    name: "Recent Activity",
    type: "activity",
    description: "Real-time activity log feed",
  },
  {
    id: "avail-007",
    name: "Upcoming Deliveries",
    type: "calendar",
    description: "Calendar view of scheduled deliveries",
  },
  {
    id: "avail-008",
    name: "Customer Satisfaction",
    type: "pie_chart",
    description: "Pie chart of satisfaction ratings",
  },
];

const getWidgetIcon = (type: string) => {
  switch (type) {
    case "line_chart":
      return <LineChart size={18} />;
    case "bar_chart":
      return <BarChart3 size={18} />;
    case "pie_chart":
      return <PieChart size={18} />;
    case "table":
      return <Table2 size={18} />;
    case "map":
      return <MapPin size={18} />;
    case "activity":
      return <Activity size={18} />;
    case "calendar":
      return <Calendar size={18} />;
    case "stat":
      return <BarChart3 size={18} />;
    default:
      return null;
  }
};

const getWidgetColor = (index: number): string => {
  const colors = [
    "rgba(59, 130, 246, 0.1)",
    "rgba(34, 197, 94, 0.1)",
    "rgba(249, 115, 22, 0.1)",
    "rgba(168, 85, 247, 0.1)",
    "rgba(236, 72, 153, 0.1)",
    "rgba(14, 165, 233, 0.1)",
  ];
  return colors[index % colors.length];
};

export default function WidgetsPage() {
  const [activeWidgets, setActiveWidgets] = useState(ACTIVE_WIDGETS);
  const [showGallery, setShowGallery] = useState(false);

  const handleRemoveWidget = (widgetId: string) => {
    setActiveWidgets(activeWidgets.filter((w) => w.id !== widgetId));
  };

  const handleAddWidget = (widget: (typeof AVAILABLE_WIDGETS)[0]) => {
    alert(`Widget "${widget.name}" added to dashboard (mock)`);
  };

  return (
    <>
      <Header
        title="Dashboard Widgets"
        subtitle={`${activeWidgets.length} active · ${AVAILABLE_WIDGETS.length} available`}
        actions={
          <Button variant="primary" size="md" onClick={() => setShowGallery(!showGallery)}>
            {showGallery ? "Hide Gallery" : "+ Add Widget"}
          </Button>
        }
      />

      <div className={cn("p-6")}>
        {/* Active Widgets Section */}
        <div className={cn("mb-8")}>
          <h2 className={cn("text-lg font-semibold text-wl-text-primary mb-4")}>
            Active Widgets
          </h2>
          <div
            className={cn("grid gap-4 auto-fill")}
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {activeWidgets.map((widget, idx) => (
              <Card key={widget.id} className={cn("flex flex-col")}>
                <CardHeader className={cn("pb-3")}>
                  <div className={cn("flex justify-between items-start")}>
                    <div className={cn("flex gap-2 items-center flex-1")}>
                      <div
                        className={cn("p-2 rounded-md flex items-center justify-center text-wl-text-primary")}
                        style={{ background: getWidgetColor(idx) }}
                      >
                        {getWidgetIcon(widget.type)}
                      </div>
                      <div>
                        <CardTitle className={cn("text-base")}>
                          {widget.name}
                        </CardTitle>
                        <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                          {widget.size}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn("flex-1 pt-0 pb-4")}>
                  {/* Status Badge */}
                  <div className={cn("mb-4")}>
                    <Badge variant="success">Active</Badge>
                  </div>

                  {/* Widget Preview Placeholder */}
                  <div
                    className={cn("border border-dashed border-wl-border-default rounded-md h-30 flex items-center justify-center mb-4 text-xs text-wl-text-secondary")}
                    style={{ background: getWidgetColor(idx), height: "120px" }}
                  >
                    Widget Preview
                  </div>

                  {/* Action Buttons */}
                  <div className={cn("flex gap-2")}>
                    <Button variant="secondary" size="sm" className={cn("flex-1")}>
                      <Settings size={14} />
                    </Button>
                    <Button variant="secondary" size="sm" className={cn("flex-1")}>
                      <Maximize2 size={14} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className={cn("flex-1")}
                      onClick={() => handleRemoveWidget(widget.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Widget Gallery Section */}
        {showGallery && (
          <div className={cn("mb-8")}>
            <h2 className={cn("text-lg font-semibold text-wl-text-primary mb-4")}>
              Widget Gallery
            </h2>
            <div
              className={cn("grid gap-4 auto-fill")}
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {AVAILABLE_WIDGETS.map((widget, idx) => (
                <Card key={widget.id} className={cn("flex flex-col")}>
                  <CardHeader className={cn("pb-3")}>
                    <div className={cn("flex gap-2 items-center")}>
                      <div
                        className={cn("p-2 rounded-md flex items-center justify-center text-wl-text-primary")}
                        style={{ background: getWidgetColor(idx) }}
                      >
                        {getWidgetIcon(widget.type)}
                      </div>
                      <CardTitle className={cn("text-base")}>
                        {widget.name}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className={cn("flex-1 pt-0 pb-4 flex flex-col")}>
                    {/* Description */}
                    <p className={cn("text-sm text-wl-text-secondary mb-4 flex-1")}>
                      {widget.description}
                    </p>

                    {/* Preview Placeholder */}
                    <div
                      className={cn("border border-dashed border-wl-border-default rounded-md flex items-center justify-center mb-4 text-xs text-wl-text-secondary")}
                      style={{ background: getWidgetColor(idx), height: "100px" }}
                    >
                      Preview
                    </div>

                    {/* Add Button */}
                    <Button
                      variant="primary"
                      size="sm"
                      className={cn("w-full")}
                      onClick={() => handleAddWidget(widget)}
                    >
                      <Plus size={14} style={{ marginRight: 4 }} />
                      Add to Dashboard
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Layout Preview */}
        <div>
          <h2 className={cn("text-lg font-semibold text-wl-text-primary mb-4")}>
            Layout Preview
          </h2>
          <Card className={cn("p-6")}>
            <div
              className={cn("grid gap-3")}
              style={{
                gridTemplateColumns: "repeat(4, 1fr)",
                gridTemplateRows: "repeat(3, 120px)",
                minHeight: "400px",
              }}
            >
              {/* Grid Labels */}
              {activeWidgets.map((widget) => {
                const colSpan = widget.size.includes("2x") ? 2 : 1;
                const rowSpan = widget.size.includes("x2") ? 2 : 1;

                return (
                  <div
                    key={widget.id}
                    className={cn("border-2 border-wl-border-default rounded-md p-3 flex items-center justify-center flex-col gap-2 text-sm font-semibold text-wl-text-primary text-center")}
                    style={{
                      gridColumn: `span ${colSpan}`,
                      gridRow: `span ${rowSpan}`,
                      background: getWidgetColor(
                        ACTIVE_WIDGETS.indexOf(widget)
                      ),
                    }}
                  >
                    <div className={cn("flex gap-2 items-center")}>
                      {getWidgetIcon(widget.type)}
                      {widget.name}
                    </div>
                    <span className={cn("text-xs text-wl-text-secondary")}>
                      {widget.size}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Grid Legend */}
          <div className={cn("mt-4 p-4 bg-wl-bg-overlay rounded-md")}>
            <p className={cn("text-sm text-wl-text-secondary m-0 mb-2")}>
              Grid: 4 columns x 3 rows · Widget sizes: 1x1, 2x1, 1x2, 2x2
            </p>
            <p className={cn("text-xs text-wl-text-tertiary m-0")}>
              Drag widgets to reorder. Colors indicate different widget types.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
