"use client";

import { cn } from "@/lib/utils";
import { UserPlus, Truck, Upload, ArrowRight, Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OnboardingData } from "../types";

interface DataImportProps {
  data: OnboardingData;
  onAddDriver: (driver: {
    name: string;
    phone: string;
    email: string;
    vehicleType: string;
  }) => void;
  onAddVehicle: (vehicle: {
    make: string;
    model: string;
    year: string;
    plate: string;
    type: string;
  }) => void;
  onImportVehicles: (csvContent: string) => void;
  onSkip: () => void;
}

interface DriverForm {
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
}

interface VehicleForm {
  make: string;
  model: string;
  year: string;
  plate: string;
  type: string;
}

export function DataImport({
  data,
  onAddDriver,
  onAddVehicle,
  onImportVehicles,
  onSkip,
}: DataImportProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [driverForm, setDriverForm] = useState<DriverForm>({
    name: "",
    phone: "",
    email: "",
    vehicleType: "van",
  });
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>({
    make: "",
    model: "",
    year: new Date().getFullYear().toString(),
    plate: "",
    type: "van",
  });
  const [driverAdded, setDriverAdded] = useState(false);
  const [vehicleAdded, setVehicleAdded] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);

  const handleAddDriver = () => {
    if (driverForm.name && driverForm.phone && driverForm.email) {
      onAddDriver(driverForm);
      setDriverAdded(true);
      setTimeout(() => {
        setExpandedCard(null);
        setDriverForm({ name: "", phone: "", email: "", vehicleType: "van" });
        setDriverAdded(false);
      }, 1500);
    }
  };

  const handleAddVehicle = () => {
    if (vehicleForm.make && vehicleForm.model && vehicleForm.plate) {
      onAddVehicle(vehicleForm);
      setVehicleAdded(true);
      setTimeout(() => {
        setExpandedCard(null);
        setVehicleForm({
          make: "",
          model: "",
          year: new Date().getFullYear().toString(),
          plate: "",
          type: "van",
        });
        setVehicleAdded(false);
      }, 1500);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCsvContent(content);
        onImportVehicles(content);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-wl-primary-500/10");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-wl-primary-500/10");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-wl-primary-500/10");
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setCsvFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCsvContent(content);
        onImportVehicles(content);
      };
      reader.readAsText(file);
    }
  };

  const cardConfig = [
    {
      id: "driver",
      title: "Add First Driver",
      icon: UserPlus,
      color: "from-wl-primary-500 to-wl-primary-600",
    },
    {
      id: "vehicle",
      title: "Add First Vehicle",
      icon: Truck,
      color: "from-wl-info-500 to-wl-info-600",
    },
    {
      id: "import",
      title: "Import Vehicles",
      icon: Upload,
      color: "from-wl-success-500 to-wl-success-600",
    },
    {
      id: "skip",
      title: "Skip for Now",
      icon: ArrowRight,
      color: "from-wl-neutral-600 to-wl-neutral-700",
    },
  ];

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-wl-text-primary m-0">
          Get started with your data
        </h2>
        <p className="text-sm text-wl-text-secondary m-0">
          Add your first data or skip for now
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-wl-text-tertiary">
        <div
          className="h-1 bg-wl-primary-500 rounded-full flex-1"
          style={{ width: "88%" }}
        />
        <span>88%</span>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Add Driver Card */}
        <button
          onClick={() =>
            setExpandedCard(expandedCard === "driver" ? null : "driver")
          }
          className={cn(
            "relative p-5 rounded-lg border-2 transition-all duration-300",
            "flex flex-col gap-4",
            expandedCard === "driver"
              ? "border-wl-primary-500 bg-wl-bg-surface/80 shadow-lg"
              : "border-wl-border-default hover:border-wl-border-strong bg-wl-bg-surface/50 hover:bg-wl-bg-surface/70",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  "bg-gradient-to-br from-wl-primary-500 to-wl-primary-600",
                )}
              >
                <UserPlus className="w-5 h-5 text-wl-text-inverse" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-wl-text-primary m-0">
                  Add First Driver
                </h3>
                <p className="text-xs text-wl-text-tertiary m-0 mt-1">
                  Register a new driver
                </p>
              </div>
            </div>
          </div>

          {driverAdded && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-wl-success-500/15 border border-wl-success-500/30">
              <Check className="w-4 h-4 text-wl-success-400" />
              <p className="text-xs text-wl-success-300 m-0">Driver added!</p>
            </div>
          )}

          {expandedCard === "driver" && !driverAdded && (
            <div className="flex flex-col gap-3 pt-2 border-t border-wl-border-subtle">
              <input
                type="text"
                placeholder="Driver name"
                value={driverForm.name}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, name: e.target.value })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-md text-xs",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary placeholder-wl-text-tertiary",
                  "focus:outline-none focus:border-wl-primary-400",
                )}
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={driverForm.phone}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, phone: e.target.value })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-md text-xs",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary placeholder-wl-text-tertiary",
                  "focus:outline-none focus:border-wl-primary-400",
                )}
              />
              <input
                type="email"
                placeholder="Email"
                value={driverForm.email}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, email: e.target.value })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-md text-xs",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary placeholder-wl-text-tertiary",
                  "focus:outline-none focus:border-wl-primary-400",
                )}
              />
              <select
                value={driverForm.vehicleType}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, vehicleType: e.target.value })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-md text-xs",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary",
                  "focus:outline-none focus:border-wl-primary-400",
                )}
              >
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
              </select>
              <Button
                onClick={handleAddDriver}
                variant="primary"
                size="sm"
                disabled={
                  !driverForm.name || !driverForm.phone || !driverForm.email
                }
                className="w-full"
              >
                Add Driver
              </Button>
            </div>
          )}
        </button>

        {/* Add Vehicle Card */}
        <button
          onClick={() =>
            setExpandedCard(expandedCard === "vehicle" ? null : "vehicle")
          }
          className={cn(
            "relative p-5 rounded-lg border-2 transition-all duration-300",
            "flex flex-col gap-4",
            expandedCard === "vehicle"
              ? "border-wl-info-500 bg-wl-bg-surface/80 shadow-lg"
              : "border-wl-border-default hover:border-wl-border-strong bg-wl-bg-surface/50 hover:bg-wl-bg-surface/70",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  "bg-gradient-to-br from-wl-info-500 to-wl-info-600",
                )}
              >
                <Truck className="w-5 h-5 text-wl-text-inverse" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-wl-text-primary m-0">
                  Add First Vehicle
                </h3>
                <p className="text-xs text-wl-text-tertiary m-0 mt-1">
                  Register a vehicle
                </p>
              </div>
            </div>
          </div>

          {vehicleAdded && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-wl-success-500/15 border border-wl-success-500/30">
              <Check className="w-4 h-4 text-wl-success-400" />
              <p className="text-xs text-wl-success-300 m-0">Vehicle added!</p>
            </div>
          )}

          {expandedCard === "vehicle" && !vehicleAdded && (
            <div className="flex flex-col gap-3 pt-2 border-t border-wl-border-subtle">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Make"
                  value={vehicleForm.make}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, make: e.target.value })
                  }
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-xs",
                    "bg-wl-bg-overlay border border-wl-border-default",
                    "text-wl-text-primary placeholder-wl-text-tertiary",
                    "focus:outline-none focus:border-wl-primary-400",
                  )}
                />
                <input
                  type="text"
                  placeholder="Model"
                  value={vehicleForm.model}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, model: e.target.value })
                  }
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-xs",
                    "bg-wl-bg-overlay border border-wl-border-default",
                    "text-wl-text-primary placeholder-wl-text-tertiary",
                    "focus:outline-none focus:border-wl-primary-400",
                  )}
                />
              </div>
              <input
                type="text"
                placeholder="License plate"
                value={vehicleForm.plate}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, plate: e.target.value })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-md text-xs",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary placeholder-wl-text-tertiary",
                  "focus:outline-none focus:border-wl-primary-400",
                )}
              />
              <select
                value={vehicleForm.type}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, type: e.target.value })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-md text-xs",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary",
                  "focus:outline-none focus:border-wl-primary-400",
                )}
              >
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
              </select>
              <Button
                onClick={handleAddVehicle}
                variant="primary"
                size="sm"
                disabled={
                  !vehicleForm.make || !vehicleForm.model || !vehicleForm.plate
                }
                className="w-full"
              >
                Add Vehicle
              </Button>
            </div>
          )}
        </button>

        {/* Import Vehicles Card */}
        <button
          onClick={() =>
            setExpandedCard(expandedCard === "import" ? null : "import")
          }
          className={cn(
            "relative p-5 rounded-lg border-2 transition-all duration-300",
            "flex flex-col gap-4",
            expandedCard === "import"
              ? "border-wl-success-500 bg-wl-bg-surface/80 shadow-lg"
              : "border-wl-border-default hover:border-wl-border-strong bg-wl-bg-surface/50 hover:bg-wl-bg-surface/70",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  "bg-gradient-to-br from-wl-success-500 to-wl-success-600",
                )}
              >
                <Upload className="w-5 h-5 text-wl-text-inverse" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-wl-text-primary m-0">
                  Import Vehicles
                </h3>
                <p className="text-xs text-wl-text-tertiary m-0 mt-1">
                  Upload CSV file
                </p>
              </div>
            </div>
          </div>

          {csvFileName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-wl-success-500/15 border border-wl-success-500/30">
              <Check className="w-4 h-4 text-wl-success-400" />
              <p className="text-xs text-wl-success-300 m-0 truncate">
                {csvFileName}
              </p>
            </div>
          )}

          {expandedCard === "import" && !csvFileName && (
            <div className="flex flex-col gap-3 pt-2 border-t border-wl-border-subtle">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "p-6 rounded-lg border-2 border-dashed",
                  "bg-wl-bg-overlay/50",
                  "border-wl-border-subtle hover:border-wl-primary-400",
                  "flex flex-col items-center justify-center gap-2",
                  "transition-all duration-200 cursor-pointer",
                )}
              >
                <Upload className="w-5 h-5 text-wl-text-tertiary" />
                <p className="text-xs text-wl-text-secondary m-0">
                  Drag and drop your CSV file here
                </p>
                <label className="cursor-pointer">
                  <span className="text-xs text-wl-primary-400 hover:text-wl-primary-300">
                    or browse files
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-wl-text-tertiary m-0 text-center">
                Expected columns: make, model, year, plate, type
              </p>
            </div>
          )}
        </button>

        {/* Skip Card */}
        <button
          onClick={onSkip}
          className={cn(
            "relative p-5 rounded-lg border-2 transition-all duration-300",
            "flex flex-col gap-4",
            "border-wl-border-subtle bg-wl-bg-surface/30 hover:bg-wl-bg-surface/50",
            "opacity-60 hover:opacity-100",
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                "bg-gradient-to-br from-wl-neutral-600 to-wl-neutral-700",
              )}
            >
              <ArrowRight className="w-5 h-5 text-wl-text-inverse" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-wl-text-primary m-0">
                Skip for Now
              </h3>
              <p className="text-xs text-wl-text-tertiary m-0 mt-1">
                Add data later in dashboard
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Helper Text */}
      <div className="p-4 rounded-lg bg-wl-bg-surface/50 border border-wl-border-subtle">
        <p className="text-xs text-wl-text-tertiary m-0">
          You can always add or import data later. This information helps
          populate your initial dashboard view.
        </p>
      </div>
    </div>
  );
}
