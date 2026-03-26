/**
 * Shipping Rate Calculation Engine
 * Handles complex rate calculations including weight tiers, price tiers,
 * distance-based rates, surcharges, free shipping thresholds, and currency conversion
 */

import {
  ShippingProfile,
  ShippingRate,
  ShippingZone,
  ZoneRate,
  RateCalculationRequest,
  CalculatedShippingRate,
  SurchargeDetail,
  RateType,
  WeightTier,
  PriceTier,
  DistanceTier,
  LocationAttachment,
} from './types';

// ─── CONVERSION HELPERS ────────────────────────────────────────────────────

/**
 * Convert weight to kilograms
 */
export function convertWeightToKg(weight: number, unit: 'g' | 'kg' | 'oz' | 'lb'): number {
  switch (unit) {
    case 'kg':
      return weight;
    case 'g':
      return weight / 1000;
    case 'lb':
      return weight * 0.453592;
    case 'oz':
      return (weight / 16) * 0.453592;
    default:
      return weight;
  }
}

/**
 * Apply currency exchange rate
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = {}
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Simple exchange rate lookup
  // In production, this would use real-time rates or a service
  const exchangeRates: Record<string, number> = {
    'USD_EUR': 0.92,
    'USD_GBP': 0.79,
    'USD_CAD': 1.36,
    'EUR_USD': 1.09,
    'GBP_USD': 1.27,
    'CAD_USD': 0.74,
    ...rates,
  };

  const key = `${fromCurrency}_${toCurrency}`;
  const rate = exchangeRates[key];

  if (!rate) {
    console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}, returning original`);
    return amount;
  }

  return amount * rate;
}

// ─── ZONE MATCHING ────────────────────────────────────────────────────────

/**
 * Find matching zone for a delivery address
 * Priority: exact postal code match > city match > state match > country match
 */
export function findMatchingZone(
  zones: ShippingZone[],
  address: {
    postalCode: string;
    city: string;
    state?: string;
    country: string;
  }
): ShippingZone | undefined {
  const activeZones = zones.filter(z => z.isActive);

  // Sort by priority (higher first), then by specificity
  const sorted = activeZones.sort((a, b) => {
    // Higher priority first
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    // Compare specificity: postal code > city > state > country
    const aSpecificity = calculateZoneSpecificity(a, address);
    const bSpecificity = calculateZoneSpecificity(b, address);
    return bSpecificity - aSpecificity;
  });

  // Find first matching zone
  for (const zone of sorted) {
    if (matchesZoneCriteria(zone, address)) {
      return zone;
    }
  }

  return undefined;
}

/**
 * Calculate zone specificity score for matching priority
 */
function calculateZoneSpecificity(zone: ShippingZone, address: Record<string, unknown>): number {
  let score = 0;

  if (zone.postalCodes?.length) score += 4;
  if (zone.cities?.length) score += 3;
  if (zone.states?.length) score += 2;
  if (zone.countries?.length) score += 1;

  return score;
}

/**
 * Check if address matches zone criteria
 */
function matchesZoneCriteria(
  zone: ShippingZone,
  address: {
    postalCode: string;
    city: string;
    state?: string;
    country: string;
  }
): boolean {
  // Check postal code
  if (zone.postalCodes?.length) {
    // Normalize and check for prefix or exact match
    const matches = zone.postalCodes.some(pc =>
      address.postalCode.toUpperCase().startsWith(pc.toUpperCase())
    );
    if (matches) return true;
  }

  // Check city
  if (zone.cities?.length) {
    const matches = zone.cities.some(c =>
      c.toLowerCase() === address.city.toLowerCase()
    );
    if (matches) return true;
  }

  // Check state
  if (zone.states?.length) {
    const matches = zone.states.some(s =>
      s.toLowerCase() === (address.state || '').toLowerCase()
    );
    if (matches) return true;
  }

  // Check country (most generic)
  if (zone.countries?.length) {
    const matches = zone.countries.some(c =>
      c.toUpperCase() === address.country.toUpperCase()
    );
    if (matches) return true;
  }

  return false;
}

// ─── RATE CALCULATION ──────────────────────────────────────────────────────

/**
 * Calculate base rate for a single rate definition
 */
export function calculateBaseRate(
  rate: ShippingRate | ZoneRate,
  weight: number,
  orderAmount: number,
  distance?: number
): number {
  const rateType = rate.rateType;

  // Handle missing weight gracefully
  const safeWeight = weight > 0 ? weight : 0.1; // Minimum weight for calculation

  switch (rateType) {
    case 'flat':
      return rate.flatRate || 0;

    case 'weight_based':
      return calculateWeightBasedRate(rate.weightTiers || [], safeWeight);

    case 'price_based':
      return calculatePriceBasedRate(rate.priceTiers || [], orderAmount);

    case 'distance_based':
      if (!distance) {
        console.warn('Distance not provided for distance-based rate calculation');
        return rate.baseRate || 0;
      }
      return calculateDistanceBasedRate(rate.distanceTiers || [], distance);

    case 'tiered':
      return calculateTieredRate(rate.tieredRates || [], safeWeight);

    default:
      return 0;
  }
}

/**
 * Calculate weight-based tiered rate
 */
export function calculateWeightBasedRate(tiers: WeightTier[], weight: number): number {
  if (tiers.length === 0) return 0;

  // Sort by max weight ascending
  const sorted = [...tiers].sort((a, b) => a.maxWeight - b.maxWeight);

  // Find matching tier
  for (const tier of sorted) {
    if (weight <= tier.maxWeight) {
      return tier.rate;
    }
  }

  // If weight exceeds all tiers, use the highest tier rate
  return sorted[sorted.length - 1].rate;
}

/**
 * Calculate price-based rate (for free shipping thresholds, etc)
 */
export function calculatePriceBasedRate(tiers: PriceTier[], orderAmount: number): number {
  if (tiers.length === 0) return 0;

  // Sort by order amount descending
  const sorted = [...tiers].sort((a, b) => b.orderAmount - a.orderAmount);

  // Find matching tier (highest threshold that order amount exceeds)
  for (const tier of sorted) {
    if (orderAmount >= tier.orderAmount) {
      return tier.freeShipping ? 0 : tier.rate;
    }
  }

  // No matching tier, default to 0
  return 0;
}

/**
 * Calculate distance-based rate
 */
export function calculateDistanceBasedRate(tiers: DistanceTier[], distance: number): number {
  if (tiers.length === 0) return 0;

  // Sort by max distance ascending
  const sorted = [...tiers].sort((a, b) => a.maxDistance - b.maxDistance);

  // Find matching tier
  for (const tier of sorted) {
    if (distance <= tier.maxDistance) {
      return tier.baseRate + distance * tier.perKmRate;
    }
  }

  // If distance exceeds all tiers, use highest tier with full calculation
  const lastTier = sorted[sorted.length - 1];
  return lastTier.baseRate + distance * lastTier.perKmRate;
}

/**
 * Calculate tiered rate (bucketed pricing)
 */
export function calculateTieredRate(tiers: any[], weight: number): number {
  if (tiers.length === 0) return 0;

  // Find matching tier
  for (const tier of tiers) {
    if (weight >= tier.minWeight && weight <= tier.maxWeight) {
      return tier.rate;
    }
  }

  // No matching tier, use highest
  return tiers[tiers.length - 1].rate;
}

/**
 * Apply surcharges to a base rate
 */
export function applySurcharges(
  baseRate: number,
  surcharges: any[],
  context: {
    weight?: number;
    distance?: number;
    isResidential?: boolean;
    zone?: ShippingZone;
  } = {}
): SurchargeDetail[] {
  const applied: SurchargeDetail[] = [];

  if (!surcharges) return applied;

  for (const surcharge of surcharges) {
    if (!surcharge.isActive) continue;

    // Check conditions
    if (surcharge.condition && !evaluateSurchargeCondition(surcharge.condition, context)) {
      continue;
    }

    let amount = 0;

    if (surcharge.percentage) {
      amount = baseRate * (surcharge.percentage / 100);
    } else if (surcharge.amount) {
      amount = surcharge.amount;
    }

    applied.push({
      type: surcharge.type,
      description: `${surcharge.type.replace(/_/g, ' ')} surcharge`,
      amount,
      percentage: surcharge.percentage,
    });
  }

  return applied;
}

/**
 * Evaluate if a surcharge condition is met
 */
function evaluateSurchargeCondition(
  condition: any,
  context: Record<string, unknown>
): boolean {
  switch (condition.type) {
    case 'weight_above':
      return (context.weight as number) > (condition.value as number);

    case 'distance_above':
      return (context.distance as number) > (condition.value as number);

    case 'address_type':
      return condition.value === 'residential'
        ? context.isResidential
        : !context.isResidential;

    case 'zone':
      return (context.zone as any)?.id === condition.value;

    case 'custom':
      // Custom conditions handled by application logic
      return true;

    default:
      return true;
  }
}

/**
 * Apply free shipping threshold
 */
export function applyFreeShippingThreshold(
  rate: number,
  orderAmount: number,
  threshold?: number
): { rate: number; isFree: boolean } {
  if (!threshold || orderAmount < threshold) {
    return { rate, isFree: false };
  }

  return { rate: 0, isFree: true };
}

/**
 * Calculate complete shipping rate with all components
 */
export async function calculateRate(
  profile: ShippingProfile,
  request: RateCalculationRequest,
  exchangeRates?: Record<string, number>
): Promise<CalculatedShippingRate> {
  // Normalize weight
  const weight = request.weight
    ? convertWeightToKg(request.weight, request.weightUnit || 'kg')
    : 0;

  const orderAmount = request.orderAmount || 0;
  const distance = request.distance || 0;

  // Find matching zone
  const zone = findMatchingZone(profile.zones, request.recipientAddress);

  if (!zone) {
    throw new Error(
      `No matching zone found for address: ${request.recipientAddress.city}, ${request.recipientAddress.country}`
    );
  }

  // Find matching rate within zone
  const zoneRate = zone.rates.find(r => r.isActive);
  if (!zoneRate) {
    throw new Error(`No active rate found in zone: ${zone.name}`);
  }

  // Calculate base rate
  const baseRate = calculateBaseRate(zoneRate, weight, orderAmount, distance);

  // Apply surcharges from rate definition
  const rateSurcharges = applySurcharges((profile.rates[0] as any)?.surcharges || [], {
    weight,
    distance,
    isResidential: request.recipientAddress.isResidential,
    zone,
  });

  // Calculate surcharge total
  const surchargeTotal = rateSurcharges.reduce((sum, s) => sum + s.amount, 0);

  // Apply free shipping threshold
  const finalRate = baseRate + surchargeTotal;
  const { rate: rateAfterFreeShip, isFree } = applyFreeShippingThreshold(
    finalRate,
    orderAmount,
    profile.freeShippingThreshold
  );

  // Get delivery method config for estimated days
  const methodConfig = getDeliveryMethodConfig(profile.deliveryMethod);

  // Currency conversion
  const currency = request.currency || 'USD';
  const convertedRate = convertCurrency(
    rateAfterFreeShip,
    'USD',
    currency,
    exchangeRates
  );

  return {
    shippingProfileId: profile.id,
    deliveryMethod: profile.deliveryMethod,
    baseRate,
    surcharges: rateSurcharges,
    totalRate: convertedRate,
    currency,
    estimatedDeliveryDays: {
      min: methodConfig.estimatedDaysMin,
      max: methodConfig.estimatedDaysMax,
    },
    zone,
    calculationDetails: {
      rateType: zoneRate.rateType,
      appliedRules: [
        `zone:${zone.name}`,
        isFree ? 'free_shipping_applied' : 'standard_rate',
        ...rateSurcharges.map(s => `surcharge:${s.type}`),
      ],
      conditions: {
        weight,
        orderAmount,
        distance,
        isResidential: request.recipientAddress.isResidential,
      },
    },
  };
}

/**
 * Get delivery method configuration
 */
function getDeliveryMethodConfig(method: string) {
  const configs: Record<string, { estimatedDaysMin: number; estimatedDaysMax: number }> = {
    local: { estimatedDaysMin: 0, estimatedDaysMax: 1 },
    standard: { estimatedDaysMin: 2, estimatedDaysMax: 5 },
    express: { estimatedDaysMin: 1, estimatedDaysMax: 2 },
    pickup: { estimatedDaysMin: 0, estimatedDaysMax: 0 },
  };

  return configs[method] || configs.standard;
}

/**
 * Batch calculate rates for multiple requests
 */
export async function calculateRatesBatch(
  profile: ShippingProfile,
  requests: RateCalculationRequest[],
  exchangeRates?: Record<string, number>
): Promise<CalculatedShippingRate[]> {
  return Promise.all(
    requests.map(req => calculateRate(profile, req, exchangeRates))
  );
}

/**
 * Find best rate among location attachments
 */
export function selectBestLocation(
  locations: LocationAttachment[],
  address: { postalCode: string; city: string; state?: string; country: string }
): LocationAttachment | undefined {
  const active = locations.filter(l => l.isActive);

  if (active.length === 0) return undefined;

  // Sort by priority (higher first)
  active.sort((a, b) => b.priority - a.priority);

  // Prefer postal code match, then city, then any active location
  for (const loc of active) {
    if (loc.postalCode && address.postalCode.startsWith(loc.postalCode)) {
      return loc;
    }
  }

  for (const loc of active) {
    if (loc.city.toLowerCase() === address.city.toLowerCase()) {
      return loc;
    }
  }

  return active[0];
}
