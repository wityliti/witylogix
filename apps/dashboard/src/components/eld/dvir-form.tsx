"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle, X, Upload, Edit2, Check, Printer } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   DVIR FORM — Pre/Post-trip inspection with checklist & defects
   Multi-section, photo upload, driver signature, validation
   ═══════════════════════════════════════════════════════════ */

type InspectionItemStatus = "PASS" | "FAIL" | "N/A";
type ComponentCategory = "tires" | "brakes" | "lights" | "coupling" | "engine" | "body" | "other";

interface InspectionItem {
  id: string;
  name: string;
  status: InspectionItemStatus;
  notes?: string;
}

interface ComponentGroup {
  category: ComponentCategory;
  label: string;
  items: InspectionItem[];
}

interface DVIRFormProps {
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  inspectionType: "PRE_TRIP" | "POST_TRIP";
  onSubmit?: (data: unknown) => void;
}

const COMPONENT_GROUPS: ComponentGroup[] = [
  {
    category: "tires",
    label: "Tires & Wheels",
    items: [
      { id: "tire-1", name: "Front left tire condition", status: "PASS" },
      { id: "tire-2", name: "Front right tire condition", status: "PASS" },
      { id: "tire-3", name: "Rear tires condition", status: "PASS" },
      { id: "tire-4", name: "Spare tire present & inflated", status: "PASS" },
      { id: "tire-5", name: "Wheel rims secure", status: "PASS" },
    ],
  },
  {
    category: "brakes",
    label: "Brakes & ABS",
    items: [
      { id: "brake-1", name: "Service brakes functional", status: "PASS" },
      { id: "brake-2", name: "Parking brake holds", status: "PASS" },
      { id: "brake-3", name: "ABS warning light off", status: "PASS" },
      { id: "brake-4", name: "Brake fluid level adequate", status: "PASS" },
    ],
  },
  {
    category: "lights",
    label: "Lights & Reflectors",
    items: [
      { id: "light-1", name: "Headlights functional", status: "PASS" },
      { id: "light-2", name: "Tail lights functional", status: "PASS" },
      { id: "light-3", name: "Turn signals working", status: "PASS" },
      { id: "light-4", name: "Brake lights functional", status: "PASS" },
      { id: "light-5", name: "Reflectors clean & bright", status: "PASS" },
    ],
  },
  {
    category: "coupling",
    label: "Coupling & Connections",
    items: [
      { id: "coup-1", name: "Fifth wheel secure", status: "N/A" },
      { id: "coup-2", name: "Trailer connections secure", status: "N/A" },
      { id: "coup-3", name: "Air brake lines intact", status: "N/A" },
    ],
  },
  {
    category: "engine",
    label: "Engine & Systems",
    items: [
      { id: "eng-1", name: "Engine starts & runs smoothly", status: "PASS" },
      { id: "eng-2", name: "Oil level adequate", status: "PASS" },
      { id: "eng-3", name: "Coolant level adequate", status: "PASS" },
      { id: "eng-4", name: "No visible leaks", status: "PASS" },
      { id: "eng-5", name: "Warning lights off", status: "PASS" },
    ],
  },
  {
    category: "body",
    label: "Body & Safety",
    items: [
      { id: "body-1", name: "No loose parts or debris", status: "PASS" },
      { id: "body-2", name: "Windows & mirrors clean", status: "PASS" },
      { id: "body-3", name: "Fire extinguisher present", status: "PASS" },
      { id: "body-4", name: "Emergency equipment present", status: "PASS" },
    ],
  },
];

export function DVIRForm({
  vehicleNumber,
  driverId,
  driverName,
  inspectionType,
  onSubmit,
}: DVIRFormProps) {
  const [components, setComponents] = useState<ComponentGroup[]>(COMPONENT_GROUPS);
  const [defects, setDefects] = useState<
    Array<{
      id: string;
      component: string;
      description: string;
      severity: "CRITICAL" | "MAJOR" | "MINOR";
      photoUrl?: string;
    }>
  >([]);
  const [newDefect, setNewDefect] = useState({
    component: "",
    description: "",
    severity: "MINOR" as const,
  });
  const [showSignature, setShowSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSignatureDone, setIsSignatureDone] = useState(false);
  const [photoInput, setPhotoInput] = useState<string | null>(null);

  const handleItemStatusChange = (groupIdx: number, itemIdx: number, status: InspectionItemStatus) => {
    setComponents((prev) => {
      const newComponents = [...prev];
      newComponents[groupIdx].items[itemIdx].status = status;
      return newComponents;
    });
  };

  const handleAddDefect = () => {
    if (!newDefect.component || !newDefect.description) return;

    const defect = {
      id: `def-${Date.now()}`,
      component: newDefect.component,
      description: newDefect.description,
      severity: newDefect.severity as "CRITICAL" | "MAJOR" | "MINOR",
      photoUrl: photoInput || undefined,
    };

    setDefects((prev) => [defect, ...prev]);
    setNewDefect({ component: "", description: "", severity: "MINOR" });
    setPhotoInput(null);
  };

  const handleRemoveDefect = (id: string) => {
    setDefects((prev) => prev.filter((d) => d.id !== id));
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const startSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
  };

  const finishSignature = () => {
    if (canvasRef.current?.toDataURL().length! > 100) {
      setIsSignatureDone(true);
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setIsSignatureDone(false);
    }
  };

  const handleSubmit = () => {
    const formData = {
      vehicleNumber,
      driverId,
      driverName,
      inspectionType,
      timestamp: new Date().toISOString(),
      items: components.flatMap((g) => g.items),
      defects,
      signatureDone: isSignatureDone,
    };

    onSubmit?.(formData);
  };

  const failedItems = components.flatMap((g) => g.items).filter((i) => i.status === "FAIL");
  const isValid = failedItems.length === defects.length && isSignatureDone;

  return (
    <Card className="border-[var(--wl-border)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {inspectionType === "PRE_TRIP" ? "Pre-Trip" : "Post-Trip"} Inspection Report
            </CardTitle>
            <p className="text-xs text-wl-text-secondary mt-2">
              Vehicle: {vehicleNumber} • Driver: {driverName}
            </p>
          </div>
          <Badge variant={failedItems.length === 0 ? "success" : "danger"}>
            {failedItems.length === 0 ? "✓ No Defects" : `${failedItems.length} Defect(s)`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Component sections */}
        {components.map((group, groupIdx) => (
          <div key={group.category} className="space-y-2">
            <h4 className="text-sm font-semibold text-wl-text-primary flex items-center gap-2">
              {group.label}
              <span className="text-xs text-wl-text-secondary">
                ({group.items.filter((i) => i.status === "PASS").length}/{group.items.length})
              </span>
            </h4>

            <div className="space-y-2">
              {group.items.map((item, itemIdx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)]"
                >
                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                    <span className="text-sm text-wl-text-primary flex-1">{item.name}</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleItemStatusChange(groupIdx, itemIdx, "PASS")}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-colors",
                        item.status === "PASS"
                          ? "bg-wl-success-500/20 text-wl-success-400 border border-wl-success-500/30"
                          : "bg-white/5 text-wl-text-secondary hover:bg-white/10"
                      )}
                    >
                      ✓ Pass
                    </button>
                    <button
                      onClick={() => handleItemStatusChange(groupIdx, itemIdx, "FAIL")}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-colors",
                        item.status === "FAIL"
                          ? "bg-wl-danger-500/20 text-wl-danger-400 border border-wl-danger-500/30"
                          : "bg-white/5 text-wl-text-secondary hover:bg-white/10"
                      )}
                    >
                      ✗ Fail
                    </button>
                    <button
                      onClick={() => handleItemStatusChange(groupIdx, itemIdx, "N/A")}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-colors",
                        item.status === "N/A"
                          ? "bg-wl-info-500/20 text-wl-info-400 border border-wl-info-500/30"
                          : "bg-white/5 text-wl-text-secondary hover:bg-white/10"
                      )}
                    >
                      N/A
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Defects section */}
        <div className="border-t border-[var(--wl-border)] pt-6 space-y-4">
          <h4 className="text-sm font-semibold text-wl-text-primary">Defects & Issues</h4>

          {defects.length > 0 && (
            <div className="space-y-2">
              {defects.map((defect) => (
                <div
                  key={defect.id}
                  className="p-3 rounded-lg bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)] flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-wl-text-primary">
                      {defect.component}
                    </p>
                    <p className="text-xs text-wl-text-secondary mt-1">{defect.description}</p>
                    <Badge
                      variant={
                        defect.severity === "CRITICAL"
                          ? "danger"
                          : defect.severity === "MAJOR"
                            ? "warning"
                            : "info"
                      }
                      className="mt-2 text-xs"
                    >
                      {defect.severity}
                    </Badge>
                  </div>
                  <button
                    onClick={() => handleRemoveDefect(defect.id)}
                    className="text-wl-text-secondary hover:text-wl-danger-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {failedItems.length > defects.length && (
            <div className="p-3 rounded-lg bg-wl-warning-500/10 border border-wl-warning-500/30 text-sm text-wl-warning-300">
              ⚠ {failedItems.length - defects.length} failed item(s) need defect details
            </div>
          )}

          {/* New defect form */}
          <div className="p-4 rounded-lg bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)] space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Component"
                value={newDefect.component}
                onChange={(e) => setNewDefect((prev) => ({ ...prev, component: e.target.value }))}
                className="h-8 text-xs"
              />
              <select
                value={newDefect.severity}
                onChange={(e) =>
                  setNewDefect((prev) => ({
                    ...prev,
                    severity: e.target.value as "CRITICAL" | "MAJOR" | "MINOR",
                  }))
                }
                className="h-8 text-xs px-2 rounded bg-[var(--wl-bg-primary)] border border-[var(--wl-border)] text-wl-text-primary"
              >
                <option value="MINOR">Minor</option>
                <option value="MAJOR">Major</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <textarea
              placeholder="Describe the defect..."
              value={newDefect.description}
              onChange={(e) => setNewDefect((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full h-20 p-2 text-xs rounded bg-[var(--wl-bg-primary)] border border-[var(--wl-border)] text-wl-text-primary placeholder:text-wl-text-secondary resize-none"
            />

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPhotoInput(photoInput ? null : "photo")}
              >
                <Upload className="w-3 h-3 mr-1" />
                {photoInput ? "Remove" : "Add Photo"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={handleAddDefect}
                disabled={!newDefect.component || !newDefect.description}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Add Defect
              </Button>
            </div>
          </div>
        </div>

        {/* Signature section */}
        <div className="border-t border-[var(--wl-border)] pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-wl-text-primary">Driver Signature</h4>
            {isSignatureDone && <Badge variant="success">✓ Signed</Badge>}
          </div>

          <div className="space-y-2">
            {!showSignature ? (
              <Button
                variant="secondary"
                className="w-full h-9"
                onClick={() => setShowSignature(true)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Sign Here
              </Button>
            ) : (
              <div className="space-y-2">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={120}
                  onMouseDown={startSignature}
                  onMouseMove={drawSignature}
                  onMouseUp={finishSignature}
                  className="w-full border border-[var(--wl-border)] rounded bg-[var(--wl-bg-primary)] cursor-crosshair"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={clearSignature}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => setShowSignature(false)}
                    disabled={!isSignatureDone}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[var(--wl-border)] pt-6 flex gap-2">
          <Button
            variant="secondary"
            className="h-9"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button
            variant="primary"
            className="h-9 flex-1"
            onClick={handleSubmit}
            disabled={!isValid}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Submit Inspection
          </Button>
        </div>

        {!isValid && (
          <div className="text-xs text-wl-text-secondary text-center">
            Complete all failed items and sign to submit
          </div>
        )}
      </CardContent>
    </Card>
  );
}
