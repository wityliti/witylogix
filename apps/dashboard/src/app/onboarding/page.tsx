"use client";

import { useState, CSSProperties } from "react";
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

  const containerStyle: CSSProperties = {
    width: "100%",
    maxWidth: "700px",
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
                      : 'bg-slate-700 text-slate-400 border border-slate-600'
                  )}
                  style={{
                    ...(isActive && !isCompleted ? { borderWidth: '2px', borderColor: '#6366f1' } : {})
                  }}
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
            className="h-full bg-indigo-500 transition-all"
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
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
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

              <div
                style={{
                  marginTop: "var(--wl-space-6)",
                  padding: "var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  background: "rgba(108, 99, 255, 0.05)",
                  borderLeft: "3px solid var(--wl-primary)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  This information helps us personalize your Witylogix experience and provide relevant features for your business type.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Shopify Connection */}
          {currentStep === 2 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wl-space-5)",
                flex: 1,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  Shopify Store URL
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--wl-space-2)",
                  }}
                >
                  <input
                    type="text"
                    placeholder="mystore.myshopify.com"
                    value={data.shopifyStoreUrl}
                    onChange={(e) => updateData("shopifyStoreUrl", e.target.value)}
                    style={{
                      flex: 1,
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-border)",
                      background: "var(--wl-surface)",
                      color: "var(--wl-text)",
                      fontSize: "var(--wl-text-sm)",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => {
                      if (data.shopifyStoreUrl.trim()) {
                        updateData("shopifyConnected", true);
                      }
                    }}
                    disabled={!data.shopifyStoreUrl.trim() || data.shopifyConnected}
                    style={{
                      padding: "var(--wl-space-2) var(--wl-space-4)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-primary)",
                      background: data.shopifyConnected
                        ? "var(--wl-primary)"
                        : "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))",
                      color: "var(--wl-text-inverse)",
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: 600,
                      cursor: data.shopifyConnected ? "default" : "pointer",
                      opacity: data.shopifyConnected ? 0.7 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {data.shopifyConnected ? "Connected" : "Connect"}
                  </button>
                </div>
              </div>

              {data.shopifyConnected && (
                <div
                  style={{
                    padding: "var(--wl-space-4)",
                    borderRadius: "var(--wl-radius-md)",
                    background: "rgba(34, 197, 94, 0.05)",
                    borderLeft: "3px solid #22c55e",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--wl-text-sm)",
                      color: "#22c55e",
                      fontWeight: 500,
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    ✓ Store connected successfully!
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--wl-text-xs)",
                      color: "var(--wl-text-muted)",
                    }}
                  >
                    Your Shopify store is now linked to Witylogix. We can now sync your products and orders.
                  </p>
                </div>
              )}

              <div
                style={{
                  marginTop: "auto",
                  padding: "var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  background: "var(--wl-surface)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  We securely connect to your Shopify store to sync products, orders, and customer data. You can skip this for now and connect later from Settings.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Delivery Zones */}
          {currentStep === 3 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wl-space-5)",
                flex: 1,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--wl-space-3)",
                  }}
                >
                  <label
                    style={{
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: 500,
                      color: "var(--wl-text)",
                    }}
                  >
                    Delivery Zones
                  </label>
                  <button
                    onClick={handleAddZone}
                    style={{
                      padding: "var(--wl-space-1) var(--wl-space-3)",
                      borderRadius: "var(--wl-radius-sm)",
                      border: "1px solid var(--wl-primary)",
                      background: "transparent",
                      color: "var(--wl-primary)",
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Add Zone
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--wl-space-4)",
                  }}
                >
                  {data.zones.map((zone) => (
                    <div
                      key={zone.id}
                      style={{
                        padding: "var(--wl-space-4)",
                        borderRadius: "var(--wl-radius-md)",
                        border: "1px solid var(--wl-border)",
                        background: "var(--wl-surface)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr auto",
                          gap: "var(--wl-space-3)",
                          alignItems: "flex-end",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "var(--wl-text-xs)",
                              fontWeight: 500,
                              color: "var(--wl-text-muted)",
                              marginBottom: "var(--wl-space-1)",
                            }}
                          >
                            Zone Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Downtown"
                            value={zone.name}
                            onChange={(e) => updateZone(zone.id, "name", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "var(--wl-space-2) var(--wl-space-3)",
                              borderRadius: "var(--wl-radius-sm)",
                              border: "1px solid var(--wl-border)",
                              background: "var(--wl-bg)",
                              color: "var(--wl-text)",
                              fontSize: "var(--wl-text-sm)",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "var(--wl-text-xs)",
                              fontWeight: 500,
                              color: "var(--wl-text-muted)",
                              marginBottom: "var(--wl-space-1)",
                            }}
                          >
                            Radius (km)
                          </label>
                          <input
                            type="number"
                            placeholder="5"
                            value={zone.radius}
                            onChange={(e) => updateZone(zone.id, "radius", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "var(--wl-space-2) var(--wl-space-3)",
                              borderRadius: "var(--wl-radius-sm)",
                              border: "1px solid var(--wl-border)",
                              background: "var(--wl-bg)",
                              color: "var(--wl-text)",
                              fontSize: "var(--wl-text-sm)",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                        {data.zones.length > 1 && (
                          <button
                            onClick={() => handleRemoveZone(zone.id)}
                            style={{
                              padding: "var(--wl-space-2) var(--wl-space-3)",
                              borderRadius: "var(--wl-radius-sm)",
                              border: "1px solid var(--wl-border)",
                              background: "transparent",
                              color: "var(--wl-text-muted)",
                              fontSize: "var(--wl-text-sm)",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: "auto",
                  padding: "var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  background: "var(--wl-surface)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  Define geographic zones where you'll deliver. You can draw custom service areas later in the map settings.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: First Driver */}
          {currentStep === 4 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wl-space-5)",
                flex: 1,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  Driver Name
                </label>
                <input
                  type="text"
                  placeholder="Enter driver's name"
                  value={data.driverName}
                  onChange={(e) => updateData("driverName", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--wl-space-2) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                    background: "var(--wl-surface)",
                    color: "var(--wl-text)",
                    fontSize: "var(--wl-text-sm)",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={data.driverPhone}
                  onChange={(e) => updateData("driverPhone", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--wl-space-2) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                    background: "var(--wl-surface)",
                    color: "var(--wl-text)",
                    fontSize: "var(--wl-text-sm)",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  Vehicle Type
                </label>
                <select
                  value={data.vehicleType}
                  onChange={(e) => updateData("vehicleType", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--wl-space-2) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                    background: "var(--wl-surface)",
                    color: "var(--wl-text)",
                    fontSize: "var(--wl-text-sm)",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="car">Car</option>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                </select>
              </div>

              <div
                style={{
                  marginTop: "auto",
                  padding: "var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  background: "var(--wl-surface)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  You can add more drivers after onboarding. We'll send a welcome email to your driver with login instructions.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Review & Launch */}
          {currentStep === 5 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wl-space-5)",
                flex: 1,
              }}
            >
              <div
                style={{
                  padding: "var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  background: "rgba(108, 99, 255, 0.05)",
                  borderLeft: "3px solid var(--wl-primary)",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 var(--wl-space-3) 0",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 600,
                    color: "var(--wl-text)",
                  }}
                >
                  Review Your Setup
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  Everything looks good! Review the details below and launch your dashboard.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--wl-space-4)",
                }}
              >
                {/* Business Info */}
                <div
                  style={{
                    padding: "var(--wl-space-4)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 var(--wl-space-2) 0",
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: 600,
                      color: "var(--wl-text)",
                    }}
                  >
                    Business Information
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--wl-space-4)",
                      fontSize: "var(--wl-text-xs)",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        Company
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--wl-text)",
                          fontWeight: 500,
                        }}
                      >
                        {data.companyName}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        Industry
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--wl-text)",
                          fontWeight: 500,
                          textTransform: "capitalize",
                        }}
                      >
                        {data.industry}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        Size
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--wl-text)",
                          fontWeight: 500,
                          textTransform: "capitalize",
                        }}
                      >
                        {data.businessSize}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Zones */}
                <div
                  style={{
                    padding: "var(--wl-space-4)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 var(--wl-space-2) 0",
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: 600,
                      color: "var(--wl-text)",
                    }}
                  >
                    Delivery Zones ({data.zones.length})
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--wl-space-2)",
                      fontSize: "var(--wl-text-xs)",
                    }}
                  >
                    {data.zones.map((zone) => (
                      <div
                        key={zone.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingBottom: "var(--wl-space-2)",
                          borderBottom: "1px solid var(--wl-border)",
                        }}
                      >
                        <span style={{ color: "var(--wl-text)" }}>{zone.name}</span>
                        <span style={{ color: "var(--wl-text-muted)" }}>
                          {zone.radius} km radius
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Driver */}
                <div
                  style={{
                    padding: "var(--wl-space-4)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 var(--wl-space-2) 0",
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: 600,
                      color: "var(--wl-text)",
                    }}
                  >
                    First Driver
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--wl-space-4)",
                      fontSize: "var(--wl-text-xs)",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        Name
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--wl-text)",
                          fontWeight: 500,
                        }}
                      >
                        {data.driverName}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        Phone
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--wl-text)",
                          fontWeight: 500,
                        }}
                      >
                        {data.driverPhone}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        Vehicle
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--wl-text)",
                          fontWeight: 500,
                          textTransform: "capitalize",
                        }}
                      >
                        {data.vehicleType}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "var(--wl-space-6)",
          gap: "var(--wl-space-3)",
        }}
      >
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          style={{
            padding: "var(--wl-space-2) var(--wl-space-4)",
            borderRadius: "var(--wl-radius-md)",
            border: "1px solid var(--wl-border)",
            background: "transparent",
            color: currentStep === 1 ? "var(--wl-text-muted)" : "var(--wl-text)",
            fontSize: "var(--wl-text-sm)",
            fontWeight: 500,
            cursor: currentStep === 1 ? "not-allowed" : "pointer",
            opacity: currentStep === 1 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "var(--wl-space-2)",
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-3)",
          }}
        >
          {currentStep < 5 && (
            <button
              onClick={handleSkip}
              style={{
                padding: "var(--wl-space-2) var(--wl-space-4)",
                borderRadius: "var(--wl-radius-md)",
                border: "1px solid var(--wl-border)",
                background: "transparent",
                color: "var(--wl-text-muted)",
                fontSize: "var(--wl-text-sm)",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Skip
            </button>
          )}

          {currentStep < 5 ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              style={{
                padding: "var(--wl-space-2) var(--wl-space-5)",
                borderRadius: "var(--wl-radius-md)",
                border: "1px solid var(--wl-primary)",
                background: isStepValid()
                  ? "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))"
                  : "var(--wl-surface)",
                color: isStepValid() ? "var(--wl-text-inverse)" : "var(--wl-text-muted)",
                fontSize: "var(--wl-text-sm)",
                fontWeight: 600,
                cursor: isStepValid() ? "pointer" : "not-allowed",
                opacity: isStepValid() ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                gap: "var(--wl-space-2)",
              }}
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              style={{
                padding: "var(--wl-space-2) var(--wl-space-5)",
                borderRadius: "var(--wl-radius-md)",
                border: "1px solid var(--wl-primary)",
                background: "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))",
                color: "var(--wl-text-inverse)",
                fontSize: "var(--wl-text-sm)",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "var(--wl-space-2)",
              }}
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
