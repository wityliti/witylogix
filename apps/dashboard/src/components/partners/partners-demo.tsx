"use client";

import { CourierPartnerCard } from "./courier-partner-card";
import { RateComparisonTable } from "./rate-comparison-table";
import { PartnerSLAIndicator } from "./partner-sla-indicator";
import { PartnerOnboardingSteps } from "./partner-onboarding-steps";
import { Card } from "@/components/ui/card";

/**
 * Partner Components Demo Page
 * Showcases all partner management components with sample data
 */
export function PartnersDemo() {
  // Sample courier partners
  const samplePartners = [
    {
      id: "PARTNER-001",
      name: "Swift Courier",
      category: "same-day" as const,
      logoUrl: undefined,
      averageDeliveryTime: 45,
      successRate: 98,
      activeDeliveries: 12,
      rating: 4.8,
      totalRatings: 234,
      coverageAreas: ["Delhi", "NCR", "Noida"],
    },
    {
      id: "PARTNER-002",
      name: "Express Logistics",
      category: "scheduled" as const,
      logoUrl: undefined,
      averageDeliveryTime: 120,
      successRate: 95,
      activeDeliveries: 28,
      rating: 4.5,
      totalRatings: 412,
      coverageAreas: ["Delhi", "Haryana", "Rajasthan", "Uttarakhand"],
    },
    {
      id: "PARTNER-003",
      name: "Heavy Haul Inc",
      category: "freight" as const,
      logoUrl: undefined,
      averageDeliveryTime: 240,
      successRate: 92,
      activeDeliveries: 5,
      rating: 4.3,
      totalRatings: 89,
      coverageAreas: ["India-wide"],
    },
  ];

  // Sample rate comparison data
  const rateComparisonData = [
    {
      id: "RATE-001",
      courierName: "Swift Courier",
      baseRate: 50,
      perKmRate: 2.5,
      perKgRate: 3,
      minCharge: 100,
      estimatedTime: "2 hours",
      coverage: ["Delhi", "NCR"],
      rating: 4.8,
    },
    {
      id: "RATE-002",
      courierName: "Express Logistics",
      baseRate: 75,
      perKmRate: 2.0,
      perKgRate: 2.5,
      minCharge: 150,
      estimatedTime: "24 hours",
      coverage: ["Delhi", "Haryana", "Rajasthan"],
      rating: 4.5,
    },
    {
      id: "RATE-003",
      courierName: "Budget Carriers",
      baseRate: 40,
      perKmRate: 3.0,
      perKgRate: 3.5,
      minCharge: 80,
      estimatedTime: "36 hours",
      coverage: ["Delhi", "NCR"],
      rating: 4.0,
    },
    {
      id: "RATE-004",
      courierName: "Premium Services",
      baseRate: 100,
      perKmRate: 2.0,
      perKgRate: 2.0,
      minCharge: 200,
      estimatedTime: "1 hour",
      coverage: ["Delhi", "NCR", "Noida"],
      rating: 4.9,
    },
  ];

  // Sample SLA data
  const slaData = [
    {
      partnerName: "Swift Courier",
      onTimePercentage: 98,
      deliveriesMet: 245,
      deliveriesMissed: 5,
      trend: "up" as const,
    },
    {
      partnerName: "Express Logistics",
      onTimePercentage: 91,
      deliveriesMet: 182,
      deliveriesMissed: 18,
      trend: "down" as const,
    },
    {
      partnerName: "Budget Carriers",
      onTimePercentage: 87,
      deliveriesMet: 87,
      deliveriesMissed: 13,
      trend: "stable" as const,
    },
  ];

  // Sample onboarding steps
  const onboardingSteps = [
    {
      id: "step-1",
      title: "Select Provider",
      description: "Choose your preferred courier partner",
      status: "completed" as const,
      icon: "provider" as const,
    },
    {
      id: "step-2",
      title: "Credentials",
      description: "Set up API keys and authentication",
      status: "active" as const,
      icon: "credentials" as const,
    },
    {
      id: "step-3",
      title: "Configure",
      description: "Set rates, coverage areas, and preferences",
      status: "pending" as const,
      icon: "configure" as const,
    },
  ];

  return (
    <div className="w-full space-y-8 p-6 bg-wl-bg-surface min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-wl-text-primary mb-2">
          Partner Management Components
        </h1>
        <p className="text-wl-text-secondary">
          Comprehensive showcase of courier partner and logistics management
          components
        </p>
      </div>

      {/* Courier Partner Cards */}
      <div>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Courier Partner Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {samplePartners.map((partner) => (
            <CourierPartnerCard
              key={partner.id}
              {...partner}
              onView={(id) => console.log("View partner:", id)}
              onDispatch={(id) => console.log("Dispatch to:", id)}
            />
          ))}
        </div>
      </div>

      {/* Rate Comparison Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Rate Comparison Analysis
        </h2>
        <RateComparisonTable items={rateComparisonData} />
      </Card>

      {/* SLA Indicators */}
      <div>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Partner SLA Compliance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slaData.map((sla) => (
            <PartnerSLAIndicator
              key={sla.partnerName}
              partnerName={sla.partnerName}
              onTimePercentage={sla.onTimePercentage}
              deliveriesMet={sla.deliveriesMet}
              deliveriesMissed={sla.deliveriesMissed}
              trend={sla.trend}
            />
          ))}
        </div>
      </div>

      {/* Onboarding Steps */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Partner Onboarding Process
        </h2>
        <PartnerOnboardingSteps
          steps={onboardingSteps}
          currentStep={1}
          isCompact={false}
        />
      </Card>

      {/* Info Section */}
      <Card className="p-6 border-wl-primary-400/30 bg-wl-primary-500/5">
        <h3 className="text-sm font-semibold text-wl-primary-400 mb-2">
          Component Features
        </h3>
        <ul className="text-sm text-wl-text-secondary space-y-1">
          <li>✓ Responsive grid layouts for different screen sizes</li>
          <li>✓ Real-time SLA tracking and trend indicators</li>
          <li>✓ Interactive rate comparison with best value highlighting</li>
          <li>✓ Step-by-step onboarding workflow visualization</li>
          <li>✓ Seamless partner management and dispatch capabilities</li>
        </ul>
      </Card>
    </div>
  );
}
