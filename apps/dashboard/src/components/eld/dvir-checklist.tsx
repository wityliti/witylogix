"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type ItemStatus = "pass" | "fail" | "na";

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  required: boolean;
  status?: ItemStatus;
  defectNote?: string;
  attachedPhoto?: string;
}

interface DVIRChecklistProps {
  vehicleId: string;
  driverId?: string;
  items?: ChecklistItem[];
  onSubmit?: (items: ChecklistItem[]) => void;
  onCancel?: () => void;
  readonly?: boolean;
  className?: string;
}

const defaultItems: ChecklistItem[] = [
  // Exterior
  { id: "ext-1", label: "Windshield & wipers", category: "Exterior", required: true },
  { id: "ext-2", label: "Mirrors & glass", category: "Exterior", required: true },
  { id: "ext-3", label: "Lights & reflectors", category: "Exterior", required: true },
  { id: "ext-4", label: "Body & paint condition", category: "Exterior", required: false },
  { id: "ext-5", label: "Doors & hinges", category: "Exterior", required: true },

  // Interior
  { id: "int-1", label: "Seats & restraints", category: "Interior", required: true },
  { id: "int-2", label: "Steering wheel", category: "Interior", required: true },
  { id: "int-3", label: "Pedals & controls", category: "Interior", required: true },
  { id: "int-4", label: "Gauges & instruments", category: "Interior", required: true },
  { id: "int-5", label: "Horn & wipers", category: "Interior", required: true },

  // Engine
  { id: "eng-1", label: "Engine noise/leaks", category: "Engine", required: true },
  { id: "eng-2", label: "Coolant level", category: "Engine", required: true },
  { id: "eng-3", label: "Oil level & condition", category: "Engine", required: true },
  { id: "eng-4", label: "Brake fluid level", category: "Engine", required: true },
  { id: "eng-5", label: "Power steering fluid", category: "Engine", required: false },

  // Tires & Wheels
  { id: "tire-1", label: "Tire tread depth", category: "Tires/Wheels", required: true },
  { id: "tire-2", label: "Tire pressure & condition", category: "Tires/Wheels", required: true },
  { id: "tire-3", label: "Wheels & lug nuts", category: "Tires/Wheels", required: true },
  { id: "tire-4", label: "Spare tire & mount", category: "Tires/Wheels", required: true },

  // Brakes
  { id: "brake-1", label: "Brake pedal condition", category: "Brakes", required: true },
  { id: "brake-2", label: "Parking brake function", category: "Brakes", required: true },
  { id: "brake-3", label: "Brake hoses & lines", category: "Brakes", required: true },
  { id: "brake-4", label: "Trailer brake function", category: "Brakes", required: false },

  // Lights
  { id: "light-1", label: "Headlights", category: "Lights", required: true },
  { id: "light-2", label: "Tail lights & reflectors", category: "Lights", required: true },
  { id: "light-3", label: "Brake lights", category: "Lights", required: true },
  { id: "light-4", label: "Turn signals", category: "Lights", required: true },

  // Coupling (if applicable)
  { id: "coup-1", label: "Fifth wheel condition", category: "Coupling", required: false },
  { id: "coup-2", label: "Coupling integrity", category: "Coupling", required: false },
  { id: "coup-3", label: "Air/electric connections", category: "Coupling", required: false },

  // Other
  { id: "other-1", label: "Fire extinguisher", category: "Other", required: false },
  { id: "other-2", label: "First aid kit", category: "Other", required: false },
  { id: "other-3", label: "Emergency equipment", category: "Other", required: false },
];

/**
 * DVIR Checklist Component
 * Vehicle inspection checklist with pass/fail/NA status tracking
 * Includes defect notes and photo attachments
 */
export function DVIRChecklist({
  vehicleId,
  driverId,
  items = defaultItems,
  onSubmit,
  onCancel,
  readonly = false,
  className,
}: DVIRChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(items);
  const [expandedDefects, setExpandedDefects] = useState<Set<string>>(new Set());

  // Group items by category
  const groupedItems = checklist.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  // Calculate completion
  const requiredItems = checklist.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => item.status);
  const completionPercentage = Math.round(
    (completedRequired.length / requiredItems.length) * 100
  );

  const canSubmit = completedRequired.length === requiredItems.length;

  // Handle status change
  const handleStatusChange = (itemId: string, newStatus: ItemStatus | undefined) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: newStatus,
              defectNote: newStatus === "fail" ? item.defectNote || "" : undefined,
              attachedPhoto:
                newStatus === "fail" ? item.attachedPhoto : undefined,
            }
          : item
      )
    );
  };

  // Handle defect note update
  const handleDefectNoteChange = (itemId: string, note: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, defectNote: note } : item
      )
    );
  };

  // Toggle defect details
  const toggleDefectDetails = (itemId: string) => {
    setExpandedDefects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const categories = Object.keys(groupedItems);

  return (
    <div
      className={cn(
        "rounded-lg border border-wl-border-default bg-wl-bg-elevated p-6 space-y-6",
        className
      )}
    >
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">
            Vehicle Inspection Report (DVIR)
          </h2>
          <p className="text-sm text-wl-text-secondary mt-1">
            Vehicle ID: {vehicleId}
            {driverId && ` • Driver ID: ${driverId}`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-wl-text-secondary">
              Required Items Completed
            </span>
            <span className="text-sm font-semibold text-wl-text-primary">
              {completedRequired.length}/{requiredItems.length}
            </span>
          </div>
          <div className="h-2 bg-wl-bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                completionPercentage === 100
                  ? "bg-wl-success-500"
                  : "bg-wl-primary-500"
              )}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-xs text-wl-text-secondary text-right">
            {completionPercentage}% Complete
          </p>
        </div>
      </div>

      {/* Checklist Sections */}
      <div className="space-y-4">
        {categories.map((category) => {
          const categoryItems = groupedItems[category];
          const categoryCompleted = categoryItems.filter((item) => item.status).length;
          const categoryRequired = categoryItems.filter((item) => item.required).length;

          return (
            <div
              key={category}
              className="border border-wl-border-default rounded-lg overflow-hidden"
            >
              {/* Category Header */}
              <div className="bg-wl-bg-secondary px-4 py-3 border-b border-wl-border-default">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-wl-text-primary">
                    {category}
                  </h3>
                  <span className="text-xs text-wl-text-secondary">
                    {categoryCompleted}/{categoryRequired} required
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-wl-border-default">
                {categoryItems.map((item) => {
                  const isExpanded = expandedDefects.has(item.id);
                  const isFailed = item.status === "fail";

                  return (
                    <div key={item.id} className="p-4 space-y-3">
                      {/* Item Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-wl-text-primary">
                              {item.label}
                            </p>
                            {item.required && (
                              <span className="text-xs text-wl-danger-400 font-medium">
                                Required
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Toggle Buttons */}
                        {!readonly && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  item.id,
                                  item.status === "pass" ? undefined : "pass"
                                )
                              }
                              className={cn(
                                "text-xs px-2 py-1.5 rounded font-medium transition-colors",
                                item.status === "pass"
                                  ? "bg-wl-success-500/20 text-wl-success-400"
                                  : "bg-wl-bg-secondary text-wl-text-secondary hover:text-wl-success-400"
                              )}
                            >
                              ✓ Pass
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  item.id,
                                  item.status === "fail" ? undefined : "fail"
                                )
                              }
                              className={cn(
                                "text-xs px-2 py-1.5 rounded font-medium transition-colors",
                                item.status === "fail"
                                  ? "bg-wl-danger-500/20 text-wl-danger-400"
                                  : "bg-wl-bg-secondary text-wl-text-secondary hover:text-wl-danger-400"
                              )}
                            >
                              ✕ Fail
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  item.id,
                                  item.status === "na" ? undefined : "na"
                                )
                              }
                              className={cn(
                                "text-xs px-2 py-1.5 rounded font-medium transition-colors",
                                item.status === "na"
                                  ? "bg-wl-text-secondary/20 text-wl-text-secondary"
                                  : "bg-wl-bg-secondary text-wl-text-secondary hover:text-wl-text-secondary"
                              )}
                            >
                              N/A
                            </button>
                          </div>
                        )}

                        {/* Status Display (readonly) */}
                        {readonly && (
                          <div className="text-xs font-medium flex-shrink-0">
                            {item.status === "pass" && (
                              <span className="text-wl-success-400">✓ Pass</span>
                            )}
                            {item.status === "fail" && (
                              <span className="text-wl-danger-400">✕ Fail</span>
                            )}
                            {item.status === "na" && (
                              <span className="text-wl-text-secondary">N/A</span>
                            )}
                            {!item.status && (
                              <span className="text-wl-text-secondary">—</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Defect Details (if failed) */}
                      {isFailed && (
                        <div className="space-y-2 pl-4 border-l border-wl-danger-500/30">
                          {/* Expand/Collapse Button */}
                          <button
                            onClick={() => toggleDefectDetails(item.id)}
                            className="text-xs text-wl-danger-400 hover:text-wl-danger-300 font-medium"
                          >
                            {isExpanded ? "▼" : "▶"} Defect Details
                          </button>

                          {/* Defect Form */}
                          {isExpanded && !readonly && (
                            <div className="space-y-3 mt-2">
                              {/* Defect Note */}
                              <div>
                                <label className="text-xs font-medium text-wl-text-secondary block mb-1">
                                  Describe the defect:
                                </label>
                                <textarea
                                  value={item.defectNote || ""}
                                  onChange={(e) =>
                                    handleDefectNoteChange(item.id, e.target.value)
                                  }
                                  placeholder="Describe the defect and severity..."
                                  className="w-full text-xs px-2 py-1.5 rounded bg-wl-bg-secondary border border-wl-border-default text-wl-text-primary placeholder:text-wl-text-secondary focus:outline-none focus:ring-1 focus:ring-wl-primary-500"
                                  rows={2}
                                />
                              </div>

                              {/* Photo Attachment */}
                              <div>
                                <label className="text-xs font-medium text-wl-text-secondary block mb-1">
                                  Attach photo:
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    id={`photo-${item.id}`}
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                        const reader = new FileReader();
                                        reader.onloadend = (event) => {
                                          setChecklist((prev) =>
                                            prev.map((i) =>
                                              i.id === item.id
                                                ? {
                                                    ...i,
                                                    attachedPhoto:
                                                      event.target?.result as string,
                                                  }
                                                : i
                                            )
                                          );
                                        };
                                        reader.readAsDataURL(e.target.files[0]);
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={`photo-${item.id}`}
                                    className="text-xs px-2 py-1.5 rounded bg-wl-bg-secondary text-wl-primary-400 hover:bg-wl-primary-500/20 cursor-pointer font-medium transition-colors"
                                  >
                                    📷 Choose Photo
                                  </label>
                                  {item.attachedPhoto && (
                                    <span className="text-xs text-wl-success-400">
                                      ✓ Photo attached
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Display defect info (readonly) */}
                          {readonly && (
                            <div className="space-y-2 text-xs text-wl-text-secondary">
                              {item.defectNote && (
                                <p>
                                  <span className="font-medium">Note:</span>{" "}
                                  {item.defectNote}
                                </p>
                              )}
                              {item.attachedPhoto && (
                                <p className="text-wl-success-400">
                                  ✓ Photo attached
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      {!readonly && (
        <div className="border-t border-wl-border-default pt-6 flex gap-3 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-sm px-4 py-2 rounded border border-wl-border-default text-wl-text-primary hover:bg-wl-bg-secondary transition-colors font-medium"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onSubmit?.(checklist)}
            disabled={!canSubmit}
            className={cn(
              "text-sm px-4 py-2 rounded font-medium transition-colors",
              canSubmit
                ? "bg-wl-success-500/20 text-wl-success-400 hover:bg-wl-success-500/30"
                : "bg-wl-bg-secondary text-wl-text-secondary cursor-not-allowed opacity-50"
            )}
          >
            Submit DVIR
          </button>
        </div>
      )}
    </div>
  );
}
