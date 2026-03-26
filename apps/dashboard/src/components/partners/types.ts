/**
 * Partner Management & Logistics Types
 * Type definitions for all partner components
 */

export type PartnerCategory = "same-day" | "scheduled" | "freight";
export type PartnerStatus = "active" | "pending" | "inactive";
export type SLATrend = "up" | "down" | "stable";
export type OnboardingStepStatus = "completed" | "active" | "pending";

/**
 * Courier partner information
 */
export interface CourierPartner {
  id: string;
  name: string;
  category: PartnerCategory;
  logoUrl?: string;
  averageDeliveryTime: number; // minutes
  successRate: number; // 0-100
  activeDeliveries: number;
  rating: number; // 0-5
  totalRatings: number;
  coverageAreas: string[];
  status: PartnerStatus;
}

/**
 * Rate comparison item
 */
export interface RateComparisonItem {
  id: string;
  courierName: string;
  baseRate: number;
  perKmRate: number;
  perKgRate: number;
  minCharge: number;
  estimatedTime: string;
  coverage: string[];
  rating: number;
}

/**
 * Partner SLA data
 */
export interface PartnerSLA {
  partnerId: string;
  partnerName: string;
  onTimePercentage: number; // 0-100
  deliveriesMet: number;
  deliveriesMissed: number;
  trend: SLATrend;
  sparklineData?: number[]; // Last 7 days
}

/**
 * Onboarding step for partner setup
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  status: OnboardingStepStatus;
  icon: "provider" | "credentials" | "configure";
}
