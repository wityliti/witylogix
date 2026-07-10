"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Package,
  Lock,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useApiMutation } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';

type PartnerType = "onfleet" | "stuart" | "uber-direct" | "custom";

interface OnboardingData {
  partnerType: PartnerType | "";
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  baseUrl: string;
  serviceAreas: string[];
  defaultSettings: {
    maxDistance: number;
    maxDeliveryTime: number;
    insurance: boolean;
  };
}

const PARTNER_TYPES = [
  {
    id: "onfleet",
    name: "Onfleet",
    description: "Real-time logistics operations platform",
    icon: Package,
  },
  {
    id: "stuart",
    name: "Stuart",
    description: "On-demand same-day delivery service",
    icon: Package,
  },
  {
    id: "uber-direct",
    name: "Uber Direct",
    description: "Uber's delivery platform",
    icon: Package,
  },
  {
    id: "custom",
    name: "Custom Integration",
    description: "Custom API integration",
    icon: Settings,
  },
];

const STEP_CONFIG = [
  { number: 1, title: "Select Partner Type", icon: Package },
  { number: 2, title: "API Credentials", icon: Lock },
  { number: 3, title: "Configuration", icon: Settings },
];

export default function OnboardPage() {
  const router = useRouter();
  const { execute: saveOnboarding } = useApiMutation('POST', '/api/v4/couriers/partners');
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<OnboardingData>({
    partnerType: "",
    apiKey: "",
    apiSecret: "",
    webhookSecret: "",
    baseUrl: "",
    serviceAreas: [],
    defaultSettings: {
      maxDistance: 50,
      maxDeliveryTime: 120,
      insurance: false,
    },
  });

  const [serviceAreaInput, setServiceAreaInput] = useState("");

  const validateStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.partnerType) {
        newErrors.partnerType = "Please select a partner type";
      }
    } else if (step === 2) {
      if (!formData.apiKey.trim()) {
        newErrors.apiKey = "API Key is required";
      }
      if (!formData.apiSecret.trim()) {
        newErrors.apiSecret = "API Secret is required";
      }
      if (!formData.webhookSecret.trim()) {
        newErrors.webhookSecret = "Webhook Secret is required";
      }
      if (!formData.baseUrl.trim()) {
        newErrors.baseUrl = "Base URL is required";
      }
    } else if (step === 3) {
      if (formData.serviceAreas.length === 0) {
        newErrors.serviceAreas = "At least one service area is required";
      }
      if (formData.defaultSettings.maxDistance <= 0) {
        newErrors.maxDistance = "Max distance must be greater than 0";
      }
      if (formData.defaultSettings.maxDeliveryTime <= 0) {
        newErrors.maxDeliveryTime = "Max delivery time must be greater than 0";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [step, formData]);

  const handleNext = useCallback(() => {
    if (validateStep()) {
      setStep(step + 1);
    }
  }, [step, validateStep]);

  const handleBack = useCallback(() => {
    setStep(Math.max(1, step - 1));
  }, [step]);

  const handleComplete = useCallback(async () => {
    if (validateStep()) {
      try {
        const provider = formData.partnerType === "uber-direct" ? "uber_direct" : formData.partnerType;
        await saveOnboarding({
          provider,
          name: PARTNER_TYPES.find((p) => p.id === formData.partnerType)?.name ?? formData.partnerType,
          credentials: {
            apiKey: formData.apiKey,
            apiSecret: formData.apiSecret,
            webhookSecret: formData.webhookSecret,
            baseUrl: formData.baseUrl,
          },
          config: {
            serviceAreas: formData.serviceAreas,
            ...formData.defaultSettings,
          },
        });
        router.push("/dashboard/partners");
      } catch {
        addToast({ type: 'error', title: 'Onboarding failed', message: 'Could not save partner data. Please try again.' });
      }
    }
  }, [formData, validateStep, router, saveOnboarding, addToast]);

  const handleAddServiceArea = useCallback(() => {
    if (serviceAreaInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        serviceAreas: [...prev.serviceAreas, serviceAreaInput],
      }));
      setServiceAreaInput("");
    }
  }, [serviceAreaInput]);

  const handleRemoveServiceArea = useCallback((area: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.filter((a) => a !== area),
    }));
  }, []);

  const stepProgress = ((step - 1) / (STEP_CONFIG.length - 1)) * 100;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="md"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="max-w-2xl mx-auto w-full">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Onboard New Courier Partner
          </h1>
          <p className="text-wl-neutral-300">
            Set up a new delivery partner integration in 3 easy steps
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {STEP_CONFIG.map((config) => {
              const isActive = config.number === step;
              const isCompleted = config.number < step;
              const Icon = config.icon;

              return (
                <div key={config.number} className="flex flex-col items-center gap-2 flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                      isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isActive
                          ? "bg-blue-500/20 text-blue-400 ring-2 ring-blue-400"
                          : "bg-wl-bg-surface text-wl-neutral-300"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-center text-wl-neutral-300">
                    {config.title}
                  </p>
                </div>
              );
            })}
          </div>
          <Progress value={stepProgress} className="h-1" />
        </div>

        {/* Step 1: Partner Type Selection */}
        {step === 1 && (
          <Card className="space-y-6">
            <CardHeader>
              <CardTitle>Select Courier Partner Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PARTNER_TYPES.map((partner) => {
                  const Icon = partner.icon;
                  const isSelected = formData.partnerType === partner.id;

                  return (
                    <button
                      key={partner.id}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          partnerType: partner.id as PartnerType,
                        }))
                      }
                      className={cn(
                        "p-4 rounded-lg border-2 transition-all flex gap-4 items-start",
                        isSelected
                          ? "border-blue-400 bg-blue-500/10"
                          : "border-wl-border-default hover:border-wl-border-default"
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-wl-bg-surface text-wl-neutral-300"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-white">
                          {partner.name}
                        </h3>
                        <p className="text-sm text-wl-neutral-300">
                          {partner.description}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
              {errors.partnerType && (
                <p className="text-sm text-red-400">{errors.partnerType}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: API Credentials */}
        {step === 2 && (
          <Card className="space-y-6">
            <CardHeader>
              <CardTitle>Configure API Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="API Key"
                type="password"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    apiKey: e.currentTarget.value,
                  }))
                }
                placeholder="sk_live_..."
                error={errors.apiKey}
              />

              <Input
                label="API Secret"
                type="password"
                value={formData.apiSecret}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    apiSecret: e.currentTarget.value,
                  }))
                }
                placeholder="secret_..."
                error={errors.apiSecret}
              />

              <Input
                label="Webhook Secret"
                type="password"
                value={formData.webhookSecret}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    webhookSecret: e.currentTarget.value,
                  }))
                }
                placeholder="whsec_..."
                error={errors.webhookSecret}
              />

              <Input
                label="Base URL"
                type="text"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    baseUrl: e.currentTarget.value,
                  }))
                }
                placeholder="https://api.example.com/v1"
                error={errors.baseUrl}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Configuration */}
        {step === 3 && (
          <Card className="space-y-6">
            <CardHeader>
              <CardTitle>Configure Default Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Service Areas */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">
                  Service Areas
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter service area (e.g., NYC Metro)"
                    value={serviceAreaInput}
                    onChange={(e) => setServiceAreaInput(e.currentTarget.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddServiceArea();
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleAddServiceArea}
                  >
                    Add
                  </Button>
                </div>
                {errors.serviceAreas && (
                  <p className="text-sm text-red-400">{errors.serviceAreas}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.serviceAreas.map((area) => (
                    <div
                      key={area}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-blue-500/20 text-blue-400 text-sm"
                    >
                      {area}
                      <button
                        onClick={() => handleRemoveServiceArea(area)}
                        className="hover:text-blue-300 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Max Distance */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  Max Delivery Distance (km)
                </label>
                <Input
                  type="number"
                  value={formData.defaultSettings.maxDistance}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      defaultSettings: {
                        ...prev.defaultSettings,
                        maxDistance: parseInt(e.currentTarget.value) || 0,
                      },
                    }))
                  }
                  error={errors.maxDistance}
                />
              </div>

              {/* Max Delivery Time */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  Max Delivery Time (minutes)
                </label>
                <Input
                  type="number"
                  value={formData.defaultSettings.maxDeliveryTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      defaultSettings: {
                        ...prev.defaultSettings,
                        maxDeliveryTime: parseInt(e.currentTarget.value) || 0,
                      },
                    }))
                  }
                  error={errors.maxDeliveryTime}
                />
              </div>

              {/* Insurance */}
              <Select
                label="Offer Insurance"
                value={formData.defaultSettings.insurance ? "yes" : "no"}
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultSettings: {
                      ...prev.defaultSettings,
                      insurance: e.currentTarget.value === "yes",
                    },
                  }))
                }
              />
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <Button variant="secondary" size="lg" onClick={handleBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          )}

          <div className="flex-1" />

          {step < STEP_CONFIG.length ? (
            <Button variant="primary" size="lg" onClick={handleNext} className="gap-2">
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={handleComplete} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Complete Onboarding
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
