"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Package,
  Truck,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Download,
  Printer,
  Loader,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Step = "package" | "carrier" | "rates" | "review";

interface PackageSize {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
}

interface Address {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
}

interface Package {
  size: string;
  length: number;
  width: number;
  height: number;
  weight: number;
}

interface CarrierRate {
  id: string;
  carrier: string;
  service: string;
  estimatedDays: number;
  price: number;
  logo?: string;
}

const PACKAGE_SIZES: PackageSize[] = [
  { id: "envelope", name: "Envelope", dimensions: { length: 10, width: 5, height: 1 } },
  { id: "small", name: "Small", dimensions: { length: 12, width: 8, height: 6 } },
  { id: "medium", name: "Medium", dimensions: { length: 18, width: 12, height: 8 } },
  { id: "large", name: "Large", dimensions: { length: 24, width: 18, height: 12 } },
  { id: "custom", name: "Custom", dimensions: { length: 0, width: 0, height: 0 } },
];

const MOCK_RATES: CarrierRate[] = [
  { id: "ups-ground", carrier: "UPS", service: "Ground", estimatedDays: 5, price: 12.5 },
  { id: "ups-2day", carrier: "UPS", service: "2nd Day Air", estimatedDays: 2, price: 25.0 },
  { id: "usps-priority", carrier: "USPS", service: "Priority Mail", estimatedDays: 3, price: 8.75 },
  { id: "usps-express", carrier: "USPS", service: "Express Mail", estimatedDays: 1, price: 32.5 },
  { id: "fedex-ground", carrier: "FedEx", service: "Ground", estimatedDays: 5, price: 13.25 },
  { id: "fedex-overnight", carrier: "FedEx", service: "Overnight", estimatedDays: 1, price: 48.0 },
];

export default function NewShippingLabelPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("package");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [origin, setOrigin] = useState<Address>({
    name: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    phone: "",
  });

  const [destination, setDestination] = useState<Address>({
    name: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    phone: "",
  });

  const [packageData, setPackageData] = useState<Package>({
    size: "medium",
    length: 18,
    width: 12,
    height: 8,
    weight: 2.0,
  });

  const [selectedCarrier, setSelectedCarrier] = useState<string>("ups-ground");
  const [labelFormat, setLabelFormat] = useState<"PDF" | "ZPL" | "PNG">("PDF");

  // Get selected package size
  const selectedPackageSize = useMemo(
    () => PACKAGE_SIZES.find((p) => p.id === packageData.size),
    [packageData.size]
  );

  // Get selected rate
  const selectedRate = useMemo(
    () => MOCK_RATES.find((r) => r.id === selectedCarrier),
    [selectedCarrier]
  );

  // Validation functions
  const isAddressValid = (addr: Address): boolean => {
    return !!(addr.name && addr.street && addr.city && addr.state && addr.zip && addr.phone);
  };

  const isPackageValid = (): boolean => {
    const dims = packageData.size === "custom"
      ? packageData.length > 0 && packageData.width > 0 && packageData.height > 0
      : true;
    return packageData.weight > 0 && dims;
  };

  const canProceedFromPackage = isAddressValid(origin) && isAddressValid(destination) && isPackageValid();

  // Handle package size change
  const handlePackageSizeChange = (sizeId: string) => {
    const size = PACKAGE_SIZES.find((p) => p.id === sizeId);
    if (size) {
      setPackageData({
        ...packageData,
        size: sizeId,
        length: size.dimensions.length,
        width: size.dimensions.width,
        height: size.dimensions.height,
      });
    }
  };

  // Step navigation
  const goToStep = (step: Step) => {
    setError(null);
    setCurrentStep(step);
  };

  const goNext = useCallback(() => {
    setError(null);

    if (currentStep === "package") {
      if (!canProceedFromPackage) {
        setError("Please fill in all required fields");
        return;
      }
      goToStep("carrier");
    } else if (currentStep === "carrier") {
      goToStep("rates");
    } else if (currentStep === "rates") {
      goToStep("review");
    }
  }, [currentStep, canProceedFromPackage]);

  const goBack = () => {
    setError(null);
    if (currentStep === "carrier") {
      goToStep("package");
    } else if (currentStep === "rates") {
      goToStep("carrier");
    } else if (currentStep === "review") {
      goToStep("rates");
    }
  };

  // Create label
  const createLabel = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock success - redirect to labels page
      router.push("/shipping/labels");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create label";
      setError(message);
      setIsLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case "package":
        return (
          <div className="space-y-8">
            {/* Origin Address */}
            <div>
              <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
                Origin Address
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                  value={origin.name}
                  onChange={(e) =>
                    setOrigin({ ...origin, name: e.target.value })
                  }
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+1-555-0000"
                  value={origin.phone}
                  onChange={(e) =>
                    setOrigin({ ...origin, phone: e.target.value })
                  }
                />
                <Input
                  label="Street Address"
                  placeholder="123 Main St"
                  className="sm:col-span-2"
                  value={origin.street}
                  onChange={(e) =>
                    setOrigin({ ...origin, street: e.target.value })
                  }
                />
                <Input
                  label="City"
                  placeholder="New York"
                  value={origin.city}
                  onChange={(e) =>
                    setOrigin({ ...origin, city: e.target.value })
                  }
                />
                <Input
                  label="State"
                  placeholder="NY"
                  value={origin.state}
                  onChange={(e) =>
                    setOrigin({ ...origin, state: e.target.value })
                  }
                />
                <Input
                  label="ZIP Code"
                  placeholder="10001"
                  value={origin.zip}
                  onChange={(e) => setOrigin({ ...origin, zip: e.target.value })}
                />
              </div>
            </div>

            {/* Destination Address */}
            <div>
              <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
                Destination Address
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="Jane Smith"
                  value={destination.name}
                  onChange={(e) =>
                    setDestination({ ...destination, name: e.target.value })
                  }
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+1-555-0000"
                  value={destination.phone}
                  onChange={(e) =>
                    setDestination({ ...destination, phone: e.target.value })
                  }
                />
                <Input
                  label="Street Address"
                  placeholder="456 Park Ave"
                  className="sm:col-span-2"
                  value={destination.street}
                  onChange={(e) =>
                    setDestination({ ...destination, street: e.target.value })
                  }
                />
                <Input
                  label="City"
                  placeholder="Los Angeles"
                  value={destination.city}
                  onChange={(e) =>
                    setDestination({ ...destination, city: e.target.value })
                  }
                />
                <Input
                  label="State"
                  placeholder="CA"
                  value={destination.state}
                  onChange={(e) =>
                    setDestination({ ...destination, state: e.target.value })
                  }
                />
                <Input
                  label="ZIP Code"
                  placeholder="90001"
                  value={destination.zip}
                  onChange={(e) =>
                    setDestination({ ...destination, zip: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Package Details */}
            <div>
              <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
                Package Details
              </h3>

              {/* Package Sizes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-wl-text-primary mb-3">
                  Package Size
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {PACKAGE_SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => handlePackageSizeChange(size.id)}
                      className={cn(
                        "p-3 rounded-md text-sm font-medium",
                        "border transition-all duration-fast ease-default",
                        packageData.size === size.id
                          ? "border-wl-primary-500 bg-wl-primary-500/10 text-wl-primary-400"
                          : "border-wl-border-default bg-wl-bg-surface text-wl-text-secondary hover:border-wl-primary-400"
                      )}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions and Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Input
                  label="Length (in)"
                  type="number"
                  min="0"
                  step="0.1"
                  value={packageData.length}
                  onChange={(e) =>
                    setPackageData({
                      ...packageData,
                      length: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={packageData.size !== "custom"}
                />
                <Input
                  label="Width (in)"
                  type="number"
                  min="0"
                  step="0.1"
                  value={packageData.width}
                  onChange={(e) =>
                    setPackageData({
                      ...packageData,
                      width: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={packageData.size !== "custom"}
                />
                <Input
                  label="Height (in)"
                  type="number"
                  min="0"
                  step="0.1"
                  value={packageData.height}
                  onChange={(e) =>
                    setPackageData({
                      ...packageData,
                      height: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={packageData.size !== "custom"}
                />
                <Input
                  label="Weight (lbs)"
                  type="number"
                  min="0"
                  step="0.1"
                  value={packageData.weight}
                  onChange={(e) =>
                    setPackageData({
                      ...packageData,
                      weight: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>
        );

      case "carrier":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-wl-text-primary">
              Select Carrier & Service
            </h3>

            {/* Get unique carriers */}
            {Array.from(new Set(MOCK_RATES.map((r) => r.carrier))).map(
              (carrier) => {
                const carrierRates = MOCK_RATES.filter((r) => r.carrier === carrier);
                return (
                  <div key={carrier}>
                    <h4 className="text-sm font-semibold text-wl-text-secondary mb-3">
                      {carrier}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {carrierRates.map((rate) => (
                        <button
                          key={rate.id}
                          onClick={() => setSelectedCarrier(rate.id)}
                          className={cn(
                            "p-4 rounded-lg text-left border",
                            "transition-all duration-fast ease-default",
                            selectedCarrier === rate.id
                              ? "border-wl-primary-500 bg-wl-primary-500/10"
                              : "border-wl-border-default bg-wl-bg-surface hover:border-wl-primary-400"
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-wl-text-primary">
                              {rate.service}
                            </h5>
                            {selectedCarrier === rate.id && (
                              <CheckCircle className="w-5 h-5 text-wl-primary-400" />
                            )}
                          </div>
                          <div className="text-sm text-wl-text-secondary">
                            ~{rate.estimatedDays} business day
                            {rate.estimatedDays !== 1 ? "s" : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        );

      case "rates":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
              Compare Rates
            </h3>

            {/* Rates sorted by price */}
            <div className="space-y-3">
              {MOCK_RATES.sort((a, b) => a.price - b.price).map((rate, index) => {
                const isBestPrice = index === 0;
                const isBestSpeed =
                  rate.estimatedDays === Math.min(...MOCK_RATES.map((r) => r.estimatedDays));
                const isBestValue =
                  rate.price / rate.estimatedDays ===
                  Math.min(...MOCK_RATES.map((r) => r.price / r.estimatedDays));

                return (
                  <div
                    key={rate.id}
                    className={cn(
                      "p-4 rounded-lg border",
                      "transition-all duration-fast ease-default",
                      selectedCarrier === rate.id
                        ? "border-wl-primary-500 bg-wl-primary-500/10"
                        : "border-wl-border-default bg-wl-bg-surface"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-wl-text-primary">
                          {rate.carrier} - {rate.service}
                        </h4>
                        <p className="text-sm text-wl-text-secondary">
                          Estimated delivery: {rate.estimatedDays} business day
                          {rate.estimatedDays !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-wl-primary-400">
                          ${rate.price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Best tags */}
                    <div className="flex flex-wrap gap-2">
                      {isBestPrice && (
                        <Badge variant="success" className="text-xs">
                          Best Price
                        </Badge>
                      )}
                      {isBestSpeed && (
                        <Badge variant="info" className="text-xs">
                          Fastest
                        </Badge>
                      )}
                      {isBestValue && (
                        <Badge variant="primary" className="text-xs">
                          Best Value
                        </Badge>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedCarrier(rate.id)}
                      className={cn(
                        "w-full mt-3 px-3 py-2 rounded text-sm font-medium",
                        "transition-colors duration-fast ease-default",
                        selectedCarrier === rate.id
                          ? "bg-wl-primary-500 text-wl-text-inverse"
                          : "bg-wl-bg-overlay text-wl-text-primary hover:bg-wl-primary-500/20"
                      )}
                    >
                      {selectedCarrier === rate.id ? "Selected" : "Select"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Origin */}
              <div className="p-4 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
                <h4 className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">
                  From
                </h4>
                <p className="font-semibold text-wl-text-primary">{origin.name}</p>
                <p className="text-sm text-wl-text-secondary">{origin.street}</p>
                <p className="text-sm text-wl-text-secondary">
                  {origin.city}, {origin.state} {origin.zip}
                </p>
              </div>

              {/* Package */}
              <div className="p-4 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
                <h4 className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">
                  Package
                </h4>
                <p className="font-semibold text-wl-text-primary mb-1">
                  {selectedPackageSize?.name}
                </p>
                <p className="text-sm text-wl-text-secondary">
                  {packageData.length}" × {packageData.width}" × {packageData.height}"
                </p>
                <p className="text-sm text-wl-text-secondary">
                  Weight: {packageData.weight} lbs
                </p>
              </div>

              {/* Destination */}
              <div className="p-4 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
                <h4 className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">
                  To
                </h4>
                <p className="font-semibold text-wl-text-primary">
                  {destination.name}
                </p>
                <p className="text-sm text-wl-text-secondary">
                  {destination.street}
                </p>
                <p className="text-sm text-wl-text-secondary">
                  {destination.city}, {destination.state} {destination.zip}
                </p>
              </div>
            </div>

            {/* Shipping details */}
            <div className="p-4 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
              <h4 className="text-sm font-semibold text-wl-text-primary mb-3">
                Shipping Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Carrier & Service</p>
                  <p className="font-semibold text-wl-text-primary">
                    {selectedRate?.carrier} - {selectedRate?.service}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Estimated Delivery</p>
                  <p className="font-semibold text-wl-text-primary">
                    {selectedRate?.estimatedDays} business day
                    {selectedRate?.estimatedDays !== 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Total Cost</p>
                  <p className="text-xl font-bold text-wl-primary-400">
                    ${selectedRate?.price.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Label Format */}
            <div>
              <label className="block text-sm font-semibold text-wl-text-primary mb-3">
                Label Format
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["PDF", "ZPL", "PNG"] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setLabelFormat(format)}
                    className={cn(
                      "p-3 rounded-md text-sm font-medium",
                      "border transition-all duration-fast ease-default",
                      labelFormat === format
                        ? "border-wl-primary-500 bg-wl-primary-500/10 text-wl-primary-400"
                        : "border-wl-border-default bg-wl-bg-surface text-wl-text-secondary hover:border-wl-primary-400"
                    )}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("p-6 max-w-4xl mx-auto")}>
      {/* Header */}
      <div className="mb-8">
        <h1 className={cn("text-2xl font-bold text-wl-text-primary mb-2")}>
          Create Shipping Label
        </h1>
        <p className={cn("text-sm text-wl-text-secondary")}>
          Follow the steps to create and print your shipping label
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {(["package", "carrier", "rates", "review"] as Step[]).map(
            (step, index) => {
              const stepLabels: Record<Step, string> = {
                package: "Package",
                carrier: "Carrier",
                rates: "Rates",
                review: "Review",
              };

              const isActive = currentStep === step;
              const isCompleted = ["package", "carrier", "rates", "review"].indexOf(step) <
                ["package", "carrier", "rates", "review"].indexOf(currentStep);

              return (
                <div key={step} className="flex items-center flex-1">
                  <button
                    onClick={() => goToStep(step)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      "text-sm font-semibold transition-all duration-fast ease-default",
                      isActive
                        ? "bg-wl-primary-500 text-wl-text-inverse border-2 border-wl-primary-500"
                        : isCompleted
                          ? "bg-wl-success-500/20 text-wl-success-400 border-2 border-wl-success-400"
                          : "bg-wl-bg-overlay text-wl-text-secondary border-2 border-wl-border-default"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </button>

                  {index < 3 && (
                    <div
                      className={cn(
                        "flex-1 h-1 mx-2 rounded-full",
                        isCompleted || isActive
                          ? "bg-wl-primary-500"
                          : "bg-wl-border-default"
                      )}
                    />
                  )}
                </div>
              );
            }
          )}
        </div>

        <div className="flex justify-between">
          {(["package", "carrier", "rates", "review"] as Step[]).map((step) => {
            const stepLabels: Record<Step, string> = {
              package: "Package",
              carrier: "Carrier",
              rates: "Rates",
              review: "Review",
            };
            return (
              <span
                key={step}
                className={cn(
                  "text-xs font-medium",
                  currentStep === step
                    ? "text-wl-primary-400"
                    : "text-wl-text-secondary"
                )}
              >
                {stepLabels[step]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className={cn(
            "mb-6 p-4 rounded-lg",
            "bg-wl-danger-bg border border-wl-danger-400/30",
            "flex items-start gap-3"
          )}
        >
          <AlertCircle className="w-5 h-5 text-wl-danger-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-wl-danger-400">{error}</span>
        </div>
      )}

      {/* Step content */}
      <div
        className={cn(
          "mb-8 p-6 rounded-lg",
          "bg-wl-bg-elevated border border-wl-border-default"
        )}
      >
        {renderStepContent()}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="md"
          onClick={goBack}
          disabled={currentStep === "package"}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex gap-3">
          {currentStep === "review" ? (
            <>
              <Button
                variant="secondary"
                size="md"
                onClick={() => goToStep("rates")}
              >
                Edit Rates
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={createLabel}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Create & Download Label
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={goNext}
              disabled={
                currentStep === "package" && !canProceedFromPackage
              }
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
