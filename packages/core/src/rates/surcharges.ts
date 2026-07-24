/**
 * Surcharge calculation module
 * Handles fuel, residential, oversize, insurance, and other surcharges
 */

import { Surcharge, RatePackage, CalculatedRate } from "./types";
import { isRemoteArea, getRemoteAreaSurcharge } from "./zones";

// Current fuel surcharge percentages by carrier
const FUEL_SURCHARGES: Record<string, number> = {
  UPS: 0.085, // 8.5%
  FedEx: 0.095, // 9.5%
  USPS: 0.04, // 4%
  DHL: 0.09, // 9%
  OnTrac: 0.07, // 7%
};

// Oversize thresholds by carrier
const OVERSIZE_THRESHOLDS: Record<string, OverSizeThreshold> = {
  UPS: {
    maxLength: 108, // inches
    maxWidth: 108,
    maxHeight: 108,
    maxLengthPlusGirth: 130,
    surcharge: 35.0,
    unitSystem: "imperial",
  },
  FedEx: {
    maxLength: 119,
    maxWidth: 119,
    maxHeight: 119,
    maxLengthPlusGirth: 165,
    surcharge: 39.0,
    unitSystem: "imperial",
  },
  USPS: {
    maxLength: 108,
    maxWidth: 108,
    maxHeight: 108,
    maxLengthPlusGirth: 130,
    surcharge: 0.0, // No separate oversize surcharge
    unitSystem: "imperial",
  },
  DHL: {
    maxLength: 300, // cm
    maxWidth: 300,
    maxHeight: 300,
    maxLengthPlusGirth: 400,
    surcharge: 45.0,
    unitSystem: "metric",
  },
  OnTrac: {
    maxLength: 108,
    maxWidth: 108,
    maxHeight: 108,
    maxLengthPlusGirth: 130,
    surcharge: 20.0,
    unitSystem: "imperial",
  },
};

// Insurance surcharge rates (per $100 of declared value)
const INSURANCE_RATES: Record<string, number> = {
  UPS: 0.02, // $2 per $100
  FedEx: 0.025, // $2.50 per $100
  USPS: 0.015, // $1.50 per $100
  DHL: 0.03, // $3 per $100
  OnTrac: 0.02, // $2 per $100
};

// Signature required surcharge by carrier
const SIGNATURE_SURCHARGES: Record<string, number> = {
  UPS: 3.0,
  FedEx: 4.5,
  USPS: 2.5,
  DHL: 5.0,
  OnTrac: 2.0,
};

// Saturday delivery surcharge by carrier
const SATURDAY_SURCHARGES: Record<string, number> = {
  UPS: 8.0,
  FedEx: 12.0,
  USPS: 0.0, // Not available
  DHL: 10.0,
  OnTrac: 5.0,
};

// Residential delivery surcharge by carrier
const RESIDENTIAL_SURCHARGES: Record<string, number> = {
  UPS: 4.5,
  FedEx: 5.0,
  USPS: 0.0, // No surcharge
  DHL: 6.0,
  OnTrac: 3.0,
};

interface OverSizeThreshold {
  maxLength: number;
  maxWidth: number;
  maxHeight: number;
  maxLengthPlusGirth: number;
  surcharge: number;
  unitSystem: "metric" | "imperial";
}

/**
 * Calculate fuel surcharge based on carrier and base rate
 * Fuel surcharges are typically percentage-based and vary by carrier
 */
export function calculateFuelSurcharge(
  baseRate: number,
  carrier: string,
): Surcharge {
  const percentage = FUEL_SURCHARGES[carrier] || 0.085;
  const amount = baseRate * percentage;

  return {
    type: "fuel",
    description: `Fuel surcharge (${(percentage * 100).toFixed(1)}%)`,
    amount: parseFloat(amount.toFixed(2)),
    percentage,
  };
}

/**
 * Calculate residential delivery surcharge
 * Applied when destination is marked as residential
 */
export function calculateResidentialSurcharge(
  carrier: string,
  isResidential: boolean,
): Surcharge | null {
  if (!isResidential) return null;

  const amount = RESIDENTIAL_SURCHARGES[carrier] || 4.5;

  return {
    type: "residential",
    description: "Residential delivery surcharge",
    amount: parseFloat(amount.toFixed(2)),
  };
}

/**
 * Calculate oversize surcharge
 * Applied when package dimensions exceed carrier thresholds
 */
export function calculateOversizeSurcharge(
  pkg: RatePackage,
  carrier: string,
): Surcharge | null {
  const threshold = OVERSIZE_THRESHOLDS[carrier];
  if (!threshold || !pkg.length || !pkg.width || !pkg.height) {
    return null;
  }

  let length = pkg.length;
  let width = pkg.width;
  let height = pkg.height;

  // Convert to threshold's unit system
  const currentUnit = pkg.dimensionUnit || "in";
  if (threshold.unitSystem === "metric" && currentUnit === "in") {
    length = length * 2.54;
    width = width * 2.54;
    height = height * 2.54;
  } else if (threshold.unitSystem === "imperial" && currentUnit === "cm") {
    length = length / 2.54;
    width = width / 2.54;
    height = height / 2.54;
  }

  // Check individual dimensions
  if (
    length > threshold.maxLength ||
    width > threshold.maxWidth ||
    height > threshold.maxHeight
  ) {
    return {
      type: "oversize",
      description: "Oversize package surcharge",
      amount: parseFloat(threshold.surcharge.toFixed(2)),
    };
  }

  // Check length + girth
  const girth = (width + height) * 2;
  if (length + girth > threshold.maxLengthPlusGirth) {
    return {
      type: "oversize",
      description: "Oversize package surcharge (length + girth)",
      amount: parseFloat(threshold.surcharge.toFixed(2)),
    };
  }

  return null;
}

/**
 * Calculate insurance surcharge
 * Applied when declared value insurance is requested
 */
export function calculateInsuranceSurcharge(
  declaredValue: number | undefined,
  carrier: string,
): Surcharge | null {
  if (!declaredValue || declaredValue <= 0) return null;

  const ratePerHundred = INSURANCE_RATES[carrier] || 0.02;
  const amount = (declaredValue / 100) * ratePerHundred;

  // Minimum insurance charge is usually $2.50
  const finalAmount = Math.max(amount, 2.5);

  return {
    type: "insurance",
    description: `Declared value insurance (${(ratePerHundred * 100).toFixed(1)}% on $${declaredValue.toFixed(2)})`,
    amount: parseFloat(finalAmount.toFixed(2)),
  };
}

/**
 * Calculate signature required surcharge
 */
export function calculateSignatureSurcharge(carrier: string): Surcharge | null {
  const amount = SIGNATURE_SURCHARGES[carrier];
  if (!amount) return null;

  return {
    type: "signature",
    description: "Signature required",
    amount: parseFloat(amount.toFixed(2)),
  };
}

/**
 * Calculate Saturday delivery surcharge
 */
export function calculateSaturdaySurcharge(carrier: string): Surcharge | null {
  const amount = SATURDAY_SURCHARGES[carrier];
  if (!amount || amount === 0) return null;

  return {
    type: "saturday_delivery",
    description: "Saturday delivery",
    amount: parseFloat(amount.toFixed(2)),
  };
}

/**
 * Calculate remote area surcharge
 * Applied for shipments to remote/rural areas
 */
export function calculateRemoteAreaSurcharge(
  baseRate: number,
  postalCode: string,
  country: string,
  zone: number,
): Surcharge | null {
  if (!isRemoteArea(postalCode, country)) return null;

  const percentage = getRemoteAreaSurcharge(zone);
  const amount = baseRate * percentage;

  return {
    type: "remote_area",
    description: `Remote area surcharge (${(percentage * 100).toFixed(0)}%)`,
    amount: parseFloat(amount.toFixed(2)),
    percentage,
  };
}

/**
 * Calculate all applicable surcharges for a shipment
 */
export function calculateAllSurcharges(
  baseRate: number,
  carrier: string,
  packages: RatePackage[],
  destPostal: string,
  destCountry: string,
  isResidential: boolean,
  zone: number,
  options?: {
    insurance?: boolean;
    signatureRequired?: boolean;
    saturdayDelivery?: boolean;
  },
): Surcharge[] {
  const surcharges: Surcharge[] = [];

  // Fuel surcharge (always applied)
  surcharges.push(calculateFuelSurcharge(baseRate, carrier));

  // Residential delivery
  const residentialSurcharge = calculateResidentialSurcharge(
    carrier,
    isResidential,
  );
  if (residentialSurcharge) surcharges.push(residentialSurcharge);

  // Oversize (per package)
  for (const pkg of packages) {
    const oversizeSurcharge = calculateOversizeSurcharge(pkg, carrier);
    if (oversizeSurcharge) {
      surcharges.push({
        ...oversizeSurcharge,
        amount: oversizeSurcharge.amount * pkg.quantity,
      });
      break; // Only one oversize charge per shipment
    }
  }

  // Remote area
  const remoteSurcharge = calculateRemoteAreaSurcharge(
    baseRate,
    destPostal,
    destCountry,
    zone,
  );
  if (remoteSurcharge) surcharges.push(remoteSurcharge);

  // Optional surcharges
  if (options?.insurance) {
    const totalDeclaredValue = packages.reduce(
      (sum, pkg) => sum + (pkg.declaredValue || 0),
      0,
    );
    const insuranceSurcharge = calculateInsuranceSurcharge(
      totalDeclaredValue,
      carrier,
    );
    if (insuranceSurcharge) surcharges.push(insuranceSurcharge);
  }

  if (options?.signatureRequired) {
    const signatureSurcharge = calculateSignatureSurcharge(carrier);
    if (signatureSurcharge) surcharges.push(signatureSurcharge);
  }

  if (options?.saturdayDelivery) {
    const saturdaySurcharge = calculateSaturdaySurcharge(carrier);
    if (saturdaySurcharge) surcharges.push(saturdaySurcharge);
  }

  return surcharges;
}
