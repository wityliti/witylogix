"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { ChevronRight, ChevronLeft, Check, MapPin, Users, Truck, Zap } from "lucide-react";

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

interface OnboardingData {
  // Step 1: Business Info
  companyName: string;
  industry: string;
  businessSize: string;

  // Step 2: Shopify
  shopifyStoreUrl: string;
  shopifyConnected: boolean;

  // Step 3: Delivery Zones
  zones: Array<{
    id: string;
    name: string;
    radius: string;
  }>;

  // Step 4: Driver
  driverName: string;
  driverPhone: string;
  vehicleType: string;

  // Step 5: Review
  launchReady: boolean;
}

const stepConfig = [
  {
    number: 1,
    title: "Welcome",
    subtitle: "Tell us about your business",
    icon: Zap,
  },
  {
    number: 2,
    title: "Shopify",
    subtitle: "Connect your store",
    icon: Zap,
  },
  {
    number: 3,
    title: "Zones",
    subtitle: "Configure delivery zones",
    icon: MapPin,
  },
  {
    number: 4,
    title: "Driver",
    subtitle: "Add your first driver",
    icon: Users,
  },
  {
    number: 5,
    title: "Review",
    subtitle: "Launch your dashboard",
    icon: Check,
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [data, setData] = useState<OnboardingData>({
    companyName: "",
    industry: "",
    businessSize: "",
    shopifyStoreUrl: "",
    shopifyConnected: false,
    zones: [{ id: "1", name: "Downtown", radius: "5" }],
    driverName: "",
    driverPhone: "",
    vehicleType: "van",
    launchReady: false,
  });

  const updateData = (field: string, value: any) => {
    setData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddZone = () => {
    const newZone = {
      id: Date.now().toString(),
      name: "",
      radius: "",
    };
    setData((prev) => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
  };

  const handleRemoveZone = (id: string) => {
    setData((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== id),
    }));
  };

  const updateZone = (id: string, field: string, value: string) => {
    setData((prev) => ({
      ...prev,
      zones: prev.zones.map((z) =>
        z.id === id ? { ...z, [field]: value } : z
      ),
    }));
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as OnboardingStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as OnboardingStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSkip = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as OnboardingStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLaunch = () => {
    // In real app, would send data to backend
    console.log("Launching with data:", data);
    // Redirect to dashboard
    window.location.href = "/";
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return data.companyName.trim() && data.industry && data.businessSize;
      case 2:
        return data.shopifyConnected || data.shopifyStoreUrl.trim();
      case 3:
        return data.zones.length > 0 && data.zones.every((z) => z.name && z.radius);
      case 4:
        return data.driverName.trim() && data.driverPhone.trim() && data.vehicleType;
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-4">&nbsp;
          {stepConfig.map((step) => {
            const isCompleted = step.number < currentStep;
            const isActive = step.number === currentStep;

            return (
              <div
                key={step.number}
                className={cn(
                  'flex-1 flex flex-col items-center',
                  step.number < 5 ? 'mr-3' : ''
                )}
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center mb-2 font-semibold',
                    isCompleted || isActive
                      ? 'bg-indigo-500 text-slate-50'
                      : 'bg-slate-700 text-slate-400 border border-slate-600',
                    isActive && !isCompleted && 'border-2 border-indigo-500'
                  )}
                >
                  {isCompleted ? (
                    <Check size={20} />
                  ) : (
                    step.number
                  )}
                </div>
                <div
                  className={cn(
                    'text-xs font-medium text-center',
                    isActive ? 'text-slate-100' : 'text-slate-500'
                  )}
                >
                  {step.title}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Line */}
        <div className="w-full h-0.5 bg-slate-700 rounded overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{
              width: `${((currentStep - 1) / 4) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Step Content */}
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">
            {stepConfig[currentStep - 1].subtitle}
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-96 flex flex-col">&nbsp;
          {/* Step 1: Business Info */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-5 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your company name"
                  value={data.companyName}
                  onChange={(e) => updateData("companyName", e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Industry
                </label>
                <select
                  value={data.industry}
                  onChange={(e) => updateData("industry", e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm"
                >
                  <option value="">Select industry</option>
                  <option value="ecommerce">E-Commerce</option>
                  <option value="saas">SaaS</option>
                  <option value="food">Food & Beverage</option>
                  <option value="retail">Retail</option>
                  <option value="logistics">Logistics</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Business Size
                </label>
                <div className="flex gap-3 flex-wrap">
                  {["startup", "small", "medium", "enterprise"].map((size) => (
                    <button
                      key={size}
                      onClick={() => updateData("businessSize", size)}
                      className={cn(
                        'px-4 py-2 rounded text-sm font-medium cursor-pointer transition-all capitalize',
                        data.businessSize === size
                          ? 'border-2 border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border border-slate-700 bg-slate-900 text-slate-400'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 rounded-md bg-indigo-500/5 border-l-3 border-indigo-500">
                <p className="m-0 text-xs text-slate-400 leading-relaxed">
                  This information helps us personalize your Witylogix experience and provide relevant features for your business type.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Shopify Connection */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-5 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Shopify Store URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="mystore.myshopify.com"
                    value={data.shopifyStoreUrl}
                    onChange={(e) => updateData("shopifyStoreUrl", e.target.value)}
                    className="flex-1 px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (data.shopifyStoreUrl.trim()) {
                        updateData("shopifyConnected", true);
                      }
                    }}
                    disabled={!data.shopifyStoreUrl.trim() || data.shopifyConnected}
                    className={cn(
                      "px-4 py-2 rounded text-sm font-semibold whitespace-nowrap transition-all",
                      data.shopifyConnected
                        ? "border border-indigo-500 bg-indigo-500 text-slate-50 opacity-70 cursor-default"
                        : "border border-indigo-500 bg-gradient-to-r from-indigo-500 to-indigo-600 text-slate-50 cursor-pointer hover:shadow-lg"
                    )}
                  >
                    {data.shopifyConnected ? "Connected" : "Connect"}
                  </button>
                </div>
              </div>

              {data.shopifyConnected && (
                <div className="p-4 rounded-md bg-green-500/5 border-l-3 border-green-500">
                  <p className="m-0 text-sm font-medium text-green-400 mb-2">
                    ✓ Store connected successfully!
                  </p>
                  <p className="m-0 text-xs text-slate-400">
                    Your Shopify store is now linked to Witylogix. We can now sync your products and orders.
                  </p>
                </div>
              )}

              <div className="mt-auto p-4 rounded-md bg-slate-800">
                <p className="m-0 text-xs text-slate-400 leading-relaxed">
                  We securely connect to your Shopify store to sync products, orders, and customer data. You can skip this for now and connect later from Settings.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Delivery Zones */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-5 flex-1">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-medium text-slate-100">
                    Delivery Zones
                  </label>
                  <button
                    onClick={handleAddZone}
                    className="px-3 py-1 rounded text-xs font-semibold border border-indigo-500 bg-transparent text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  >
                    + Add Zone
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {data.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="p-4 rounded-md border border-slate-700 bg-slate-900"
                    >
                      <div className="grid grid-cols-2 gap-3 items-end auto-rows-max">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Zone Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Downtown"
                            value={zone.name}
                            onChange={(e) => updateZone(zone.id, "name", e.target.value)}
                            className="w-full px-3 py-2 rounded text-sm border border-slate-700 bg-slate-800 text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Radius (km)
                          </label>
                          <input
                            type="number"
                            placeholder="5"
                            value={zone.radius}
                            onChange={(e) => updateZone(zone.id, "radius", e.target.value)}
                            className="w-full px-3 py-2 rounded text-sm border border-slate-700 bg-slate-800 text-slate-100"
                          />
                        </div>
                        {data.zones.length > 1 && (
                          <button
                            onClick={() => handleRemoveZone(zone.id)}
                            className="col-span-2 px-3 py-2 rounded text-sm border border-slate-700 bg-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto p-4 rounded-md bg-slate-800">
                <p className="m-0 text-xs text-slate-400 leading-relaxed">
                  Define geographic zones where you'll deliver. You can draw custom service areas later in the map settings.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: First Driver */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-5 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Driver Name
                </label>
                <input
                  type="text"
                  placeholder="Enter driver's name"
                  value={data.driverName}
                  onChange={(e) => updateData("driverName", e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={data.driverPhone}
                  onChange={(e) => updateData("driverPhone", e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-2">
                  Vehicle Type
                </label>
                <select
                  value={data.vehicleType}
                  onChange={(e) => updateData("vehicleType", e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 text-sm"
                >
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="car">Car</option>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                </select>
              </div>

              <div className="mt-auto p-4 rounded-md bg-slate-800">
                <p className="m-0 text-xs text-slate-400 leading-relaxed">
                  You can add more drivers after onboarding. We'll send a welcome email to your driver with login instructions.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Review & Launch */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="p-4 rounded-md bg-indigo-500/5 border-l-3 border-indigo-500">
                <h3 className="m-0 mb-3 text-sm font-semibold text-slate-100">
                  Review Your Setup
                </h3>
                <p className="m-0 text-xs text-slate-400 leading-relaxed">
                  Everything looks good! Review the details below and launch your dashboard.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {/* Business Info */}
                <div className="p-4 rounded-md border border-slate-700">
                  <h4 className="m-0 mb-2 text-sm font-semibold text-slate-100">
                    Business Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="m-0 mb-1 text-slate-400">Company</p>
                      <p className="m-0 text-slate-100 font-medium">{data.companyName}</p>
                    </div>
                    <div>
                      <p className="m-0 mb-1 text-slate-400">Industry</p>
                      <p className="m-0 text-slate-100 font-medium capitalize">{data.industry}</p>
                    </div>
                    <div>
                      <p className="m-0 mb-1 text-slate-400">Size</p>
                      <p className="m-0 text-slate-100 font-medium capitalize">{data.businessSize}</p>
                    </div>
                  </div>
                </div>

                {/* Zones */}
                <div className="p-4 rounded-md border border-slate-700">
                  <h4 className="m-0 mb-2 text-sm font-semibold text-slate-100">
                    Delivery Zones ({data.zones.length})
                  </h4>
                  <div className="flex flex-col gap-2 text-xs">
                    {data.zones.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex justify-between items-center pb-2 border-b border-slate-700"
                      >
                        <span className="text-slate-100">{zone.name}</span>
                        <span className="text-slate-400">
                          {zone.radius} km radius
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Driver */}
                <div className="p-4 rounded-md border border-slate-700">
                  <h4 className="m-0 mb-2 text-sm font-semibold text-slate-100">
                    First Driver
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="m-0 mb-1 text-slate-400">Name</p>
                      <p className="m-0 text-slate-100 font-medium">{data.driverName}</p>
                    </div>
                    <div>
                      <p className="m-0 mb-1 text-slate-400">Phone</p>
                      <p className="m-0 text-slate-100 font-medium">{data.driverPhone}</p>
                    </div>
                    <div>
                      <p className="m-0 mb-1 text-slate-400">Vehicle</p>
                      <p className="m-0 text-slate-100 font-medium capitalize">{data.vehicleType}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6 gap-3">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={cn(
            "px-4 py-2 rounded-md border flex items-center gap-2 text-sm font-medium transition-all",
            currentStep === 1
              ? "border-slate-700 bg-transparent text-slate-400 opacity-50 cursor-not-allowed"
              : "border-slate-700 bg-transparent text-slate-100 hover:border-slate-600 cursor-pointer"
          )}
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div className="flex gap-3">
          {currentStep < 5 && (
            <button
              onClick={handleSkip}
              className="px-4 py-2 rounded-md border border-slate-700 bg-transparent text-slate-400 text-sm font-medium hover:text-slate-200 hover:border-slate-600 transition-all cursor-pointer"
            >
              Skip
            </button>
          )}

          {currentStep < 5 ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className={cn(
                "px-5 py-2 rounded-md border flex items-center gap-2 text-sm font-semibold transition-all",
                isStepValid()
                  ? "border-indigo-500 bg-gradient-to-r from-indigo-500 to-indigo-600 text-slate-50 cursor-pointer hover:shadow-lg"
                  : "border-slate-700 bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed"
              )}
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              className="px-5 py-2 rounded-md border border-indigo-500 bg-gradient-to-r from-indigo-500 to-indigo-600 text-slate-50 text-sm font-semibold flex items-center gap-2 cursor-pointer hover:shadow-lg transition-all"
            >
              <Zap size={16} />
              Launch Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
