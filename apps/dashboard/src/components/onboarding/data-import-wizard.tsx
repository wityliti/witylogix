"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import { ChevronDown, Plus, Truck, Upload, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataImportWizardProps extends HTMLAttributes<HTMLDivElement> {
  onDriverAdded?: (driver: { name: string; phone: string; email: string; vehicleType: string }) => void;
  onVehicleAdded?: (vehicle: { make: string; model: string; year: number; plate: string; type: string }) => void;
  onCSVImported?: (file: File) => void;
  onSkip?: () => void;
}

const DataImportWizard = forwardRef<HTMLDivElement, DataImportWizardProps>(
  ({ onDriverAdded, onVehicleAdded, onCSVImported, onSkip, className, ...props }, ref) => {
    const [expandedCard, setExpandedCard] = useState<string | null>("driver");
    const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());

    // Driver form state
    const [driverForm, setDriverForm] = useState({
      name: "",
      phone: "",
      email: "",
      vehicleType: "car",
    });

    // Vehicle form state
    const [vehicleForm, setVehicleForm] = useState({
      make: "",
      model: "",
      year: new Date().getFullYear(),
      plate: "",
      type: "car",
    });

    // CSV state
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvPreview, setCsvPreview] = useState<string[]>([]);

    const handleAddDriver = () => {
      if (driverForm.name && driverForm.email) {
        onDriverAdded?.(driverForm);
        setCompletedCards(new Set([...completedCards, "driver"]));
        setDriverForm({ name: "", phone: "", email: "", vehicleType: "car" });
        setExpandedCard(null);
      }
    };

    const handleAddVehicle = () => {
      if (vehicleForm.make && vehicleForm.model && vehicleForm.plate) {
        onVehicleAdded?.(vehicleForm);
        setCompletedCards(new Set([...completedCards, "vehicle"]));
        setVehicleForm({
          make: "",
          model: "",
          year: new Date().getFullYear(),
          plate: "",
          type: "car",
        });
        setExpandedCard(null);
      }
    };

    const handleCSVDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === "text/csv") {
        handleCSVFile(file);
      }
    };

    const handleCSVFile = (file: File) => {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split("\n").slice(0, 3).filter((l) => l.trim());
        setCsvPreview(lines);
      };
      reader.readAsText(file);
    };

    const handleCSVImport = () => {
      if (csvFile) {
        onCSVImported?.(csvFile);
        setCompletedCards(new Set([...completedCards, "csv"]));
        setCsvFile(null);
        setCsvPreview([]);
        setExpandedCard(null);
      }
    };

    const handleSkip = () => {
      onSkip?.();
      setCompletedCards(new Set([...completedCards, "skip"]));
      setExpandedCard(null);
    };

    const isCompleted = (cardId: string) => completedCards.has(cardId);

    return (
      <div
        ref={ref}
        className={cn(
          "w-full space-y-3",
          className
        )}
        {...props}
      >
        {/* Add Driver Card */}
        <div
          className={cn(
            "rounded-lg border overflow-hidden transition-all duration-base",
            isCompleted("driver")
              ? "bg-wl-success-bg border-wl-success-500/30"
              : expandedCard === "driver"
                ? "border-wl-primary-500 bg-wl-bg-overlay"
                : "border-wl-border-subtle bg-wl-bg-overlay hover:border-wl-border-default"
          )}
        >
          {/* Header */}
          <button
            onClick={() =>
              setExpandedCard(expandedCard === "driver" ? null : "driver")
            }
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-wl-bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {isCompleted("driver") ? (
                <div className="w-10 h-10 rounded-full bg-wl-success-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-wl-success-400" strokeWidth={3} />
                </div>
              ) : (
                <Plus className="w-5 h-5 text-wl-primary-400 flex-shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-wl-text-primary">
                  {isCompleted("driver") ? "Driver Added" : "Add Driver"}
                </h3>
                <p className="text-xs text-wl-text-tertiary">
                  {isCompleted("driver")
                    ? `${driverForm.name} has been added`
                    : "Add your first driver to the system"}
                </p>
              </div>
            </div>
            {!isCompleted("driver") && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-wl-text-tertiary transition-transform flex-shrink-0",
                  expandedCard === "driver" && "rotate-180"
                )}
              />
            )}
          </button>

          {/* Content */}
          {expandedCard === "driver" && !isCompleted("driver") && (
            <div className="border-t border-wl-border-subtle p-4 space-y-3">
              <input
                type="text"
                placeholder="Full Name"
                value={driverForm.name}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500 transition-colors"
              />
              <input
                type="phone"
                placeholder="Phone Number"
                value={driverForm.phone}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, phone: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500 transition-colors"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={driverForm.email}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, email: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500 transition-colors"
              />
              <select
                value={driverForm.vehicleType}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, vehicleType: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary focus:outline-none focus:border-wl-primary-500 transition-colors"
              >
                <option value="car">Car</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="bike">Bike</option>
              </select>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={handleAddDriver}
                disabled={!driverForm.name || !driverForm.email}
              >
                Add Driver
              </Button>
            </div>
          )}
        </div>

        {/* Add Vehicle Card */}
        <div
          className={cn(
            "rounded-lg border overflow-hidden transition-all duration-base",
            isCompleted("vehicle")
              ? "bg-wl-success-bg border-wl-success-500/30"
              : expandedCard === "vehicle"
                ? "border-wl-primary-500 bg-wl-bg-overlay"
                : "border-wl-border-subtle bg-wl-bg-overlay hover:border-wl-border-default"
          )}
        >
          {/* Header */}
          <button
            onClick={() =>
              setExpandedCard(expandedCard === "vehicle" ? null : "vehicle")
            }
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-wl-bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {isCompleted("vehicle") ? (
                <div className="w-10 h-10 rounded-full bg-wl-success-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-wl-success-400" strokeWidth={3} />
                </div>
              ) : (
                <Truck className="w-5 h-5 text-wl-primary-400 flex-shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-wl-text-primary">
                  {isCompleted("vehicle") ? "Vehicle Added" : "Add Vehicle"}
                </h3>
                <p className="text-xs text-wl-text-tertiary">
                  {isCompleted("vehicle")
                    ? `${vehicleForm.make} ${vehicleForm.model} added`
                    : "Add a vehicle to your fleet"}
                </p>
              </div>
            </div>
            {!isCompleted("vehicle") && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-wl-text-tertiary transition-transform flex-shrink-0",
                  expandedCard === "vehicle" && "rotate-180"
                )}
              />
            )}
          </button>

          {/* Content */}
          {expandedCard === "vehicle" && !isCompleted("vehicle") && (
            <div className="border-t border-wl-border-subtle p-4 space-y-3">
              <input
                type="text"
                placeholder="Make (e.g., Toyota)"
                value={vehicleForm.make}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, make: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500 transition-colors"
              />
              <input
                type="text"
                placeholder="Model (e.g., Camry)"
                value={vehicleForm.model}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, model: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500 transition-colors"
              />
              <input
                type="number"
                placeholder="Year"
                value={vehicleForm.year}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    year: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500 transition-colors"
              />
              <input
                type="text"
                placeholder="License Plate"
                value={vehicleForm.plate}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, plate: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500 transition-colors"
              />
              <select
                value={vehicleForm.type}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, type: e.target.value })
                }
                className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded-md text-sm text-wl-text-primary focus:outline-none focus:border-wl-primary-500 transition-colors"
              >
                <option value="car">Car</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="bike">Bike</option>
              </select>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={handleAddVehicle}
                disabled={!vehicleForm.make || !vehicleForm.model || !vehicleForm.plate}
              >
                Add Vehicle
              </Button>
            </div>
          )}
        </div>

        {/* Import CSV Card */}
        <div
          className={cn(
            "rounded-lg border overflow-hidden transition-all duration-base",
            isCompleted("csv")
              ? "bg-wl-success-bg border-wl-success-500/30"
              : expandedCard === "csv"
                ? "border-wl-primary-500 bg-wl-bg-overlay"
                : "border-wl-border-subtle bg-wl-bg-overlay hover:border-wl-border-default"
          )}
        >
          {/* Header */}
          <button
            onClick={() =>
              setExpandedCard(expandedCard === "csv" ? null : "csv")
            }
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-wl-bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {isCompleted("csv") ? (
                <div className="w-10 h-10 rounded-full bg-wl-success-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-wl-success-400" strokeWidth={3} />
                </div>
              ) : (
                <Upload className="w-5 h-5 text-wl-primary-400 flex-shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-wl-text-primary">
                  {isCompleted("csv") ? "CSV Imported" : "Import CSV"}
                </h3>
                <p className="text-xs text-wl-text-tertiary">
                  {isCompleted("csv")
                    ? `${csvFile?.name || "Data"} imported successfully`
                    : "Upload a CSV file to bulk import data"}
                </p>
              </div>
            </div>
            {!isCompleted("csv") && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-wl-text-tertiary transition-transform flex-shrink-0",
                  expandedCard === "csv" && "rotate-180"
                )}
              />
            )}
          </button>

          {/* Content */}
          {expandedCard === "csv" && !isCompleted("csv") && (
            <div className="border-t border-wl-border-subtle p-4 space-y-3">
              <div
                onDrop={handleCSVDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-wl-border-subtle rounded-lg p-6 text-center cursor-pointer hover:border-wl-primary-500 hover:bg-wl-primary-500/5 transition-all"
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-wl-text-tertiary" />
                <p className="text-sm font-medium text-wl-text-primary">
                  Drop CSV file here
                </p>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCSVFile(file);
                  }}
                  className="hidden"
                  id="csv-input"
                />
                <label htmlFor="csv-input" className="absolute inset-0" />
              </div>

              {csvPreview.length > 0 && (
                <div className="bg-wl-bg-surface rounded p-2 text-xs space-y-1">
                  <p className="text-wl-text-secondary font-semibold">
                    Preview (first 3 rows)
                  </p>
                  {csvPreview.map((line, i) => (
                    <p key={i} className="text-wl-text-tertiary truncate">
                      {line}
                    </p>
                  ))}
                </div>
              )}

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={handleCSVImport}
                disabled={!csvFile}
              >
                Import Data
              </Button>
            </div>
          )}
        </div>

        {/* Skip Card */}
        <div
          className={cn(
            "rounded-lg border overflow-hidden transition-all duration-base",
            isCompleted("skip")
              ? "bg-wl-border-subtle border-wl-border-default"
              : "border-wl-border-subtle bg-wl-bg-overlay hover:border-wl-border-default"
          )}
        >
          {/* Header */}
          <button
            onClick={handleSkip}
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-wl-bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {isCompleted("skip") ? (
                <X className="w-5 h-5 text-wl-text-tertiary flex-shrink-0" />
              ) : (
                <X className="w-5 h-5 text-wl-text-tertiary flex-shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-wl-text-secondary">
                  Skip for Now
                </h3>
                <p className="text-xs text-wl-text-tertiary">
                  You can add data later from your dashboard
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }
);

DataImportWizard.displayName = "DataImportWizard";

export { DataImportWizard };
export type { DataImportWizardProps };
