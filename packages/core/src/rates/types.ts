export interface RateCalculationRequest {
  origin: RateAddress;
  destination: RateAddress;
  packages: RatePackage[];
  shipDate: Date;
  serviceLevel?: ServiceLevel;
  options?: RateOptions;
}

export interface RateAddress {
  postalCode: string;
  city: string;
  state: string;
  country: string;
  residential?: boolean;
}

export interface RatePackage {
  weight: number;
  weightUnit: "g" | "kg" | "oz" | "lb";
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: "cm" | "in";
  declaredValue?: number;
  quantity: number;
}

export type ServiceLevel = "economy" | "ground" | "express" | "overnight" | "same_day";

export interface RateOptions {
  insurance?: boolean;
  signatureRequired?: boolean;
  saturdayDelivery?: boolean;
  returnLabel?: boolean;
  residentialDelivery?: boolean;
}

export interface CalculatedRate {
  carrier: string;
  service: string;
  serviceLevel: ServiceLevel;
  baseRate: number;
  surcharges: Surcharge[];
  discounts: Discount[];
  totalRate: number;
  currency: string;
  estimatedDays: number;
  estimatedDelivery?: Date;
  guaranteed: boolean;
  restrictions?: string[];
}

export interface Surcharge {
  type: string; // "fuel", "residential", "oversize", "remote_area", "insurance", "signature"
  description: string;
  amount: number;
  percentage?: number; // if percentage-based
}

export interface Discount {
  type: string;
  description: string;
  amount: number;
}

export interface RateComparisonResult {
  cheapest: CalculatedRate;
  fastest: CalculatedRate;
  bestValue: CalculatedRate; // balance of speed and cost
  allRates: CalculatedRate[];
  calculatedAt: Date;
}

// Internal shipping profile interface (used by calculator)
export interface ShippingProfile {
  id: string;
  carrier: string;
  service: string;
  serviceLevel: ServiceLevel;
  pricingModel: "flat" | "weight_based" | "distance_based";
  baseFlatRate?: number;
  weightRates?: WeightTier[];
  distanceRates?: DistanceTier[];
  dimensionDivisor: number; // 5000 metric, 139 imperial
  minimumWeight: number;
  maximumWeight?: number;
  oversizeThreshold?: {
    length: number;
    width: number;
    height: number;
    dimensionUnit: "cm" | "in";
    length_plus_girth?: number;
  };
  fuelSurchargePercentage: number;
  estimatedDaysBase: number;
  guaranteedDelivery: boolean;
  supportedCountries: string[];
  restrictions?: string[];
}

export interface WeightTier {
  maxWeight: number;
  rate: number;
}

export interface DistanceTier {
  zone: number;
  baseRate: number;
  weightRate: number; // per lb/kg
}
