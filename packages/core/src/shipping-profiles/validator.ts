/**
 * Shipping Profile Validator
 * Validates profile completeness, rate coverage, zone overlap detection,
 * calendar rule conflicts, and location attachment validity
 */

import {
  ShippingProfile,
  ShippingRate,
  ShippingZone,
  CalendarProfile,
  LocationAttachment,
  ProfileValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────

/**
 * Add error to results
 */
function addError(
  errors: ValidationError[],
  code: string,
  message: string,
  field?: string,
  context?: Record<string, unknown>
): void {
  errors.push({ code, message, field, context });
}

/**
 * Add warning to results
 */
function addWarning(
  warnings: ValidationWarning[],
  code: string,
  message: string,
  suggestion?: string
): void {
  warnings.push({ code, message, suggestion });
}

// ─── PROFILE COMPLETENESS VALIDATION ──────────────────────────────────────

/**
 * Validate basic profile structure and required fields
 */
export function validateProfileCompleteness(
  profile: ShippingProfile
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Required fields
  if (!profile.id) {
    addError(errors, 'MISSING_ID', 'Profile must have an ID', 'id');
  }

  if (!profile.shopId) {
    addError(errors, 'MISSING_SHOP_ID', 'Profile must be associated with a shop', 'shopId');
  }

  if (!profile.name || profile.name.trim().length === 0) {
    addError(errors, 'MISSING_NAME', 'Profile must have a name', 'name');
  }

  if (!profile.deliveryMethod) {
    addError(
      errors,
      'MISSING_DELIVERY_METHOD',
      'Profile must specify a delivery method',
      'deliveryMethod'
    );
  }

  if (!profile.rateType) {
    addError(errors, 'MISSING_RATE_TYPE', 'Profile must specify a rate type', 'rateType');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate rate configurations
 */
export function validateRates(profile: ShippingProfile): {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!profile.rates || profile.rates.length === 0) {
    addWarning(
      warnings,
      'NO_RATES',
      'Profile has no rates defined',
      'Add at least one rate to enable calculations'
    );
    return { valid: true, errors, warnings };
  }

  for (let i = 0; i < profile.rates.length; i++) {
    const rate = profile.rates[i];

    if (!rate.rateType) {
      addError(
        errors,
        'RATE_MISSING_TYPE',
        `Rate ${i} has no type specified`,
        `rates[${i}].rateType`
      );
      continue;
    }

    // Validate rate type specific fields
    switch (rate.rateType) {
      case 'flat':
        if (rate.flatRate === undefined || rate.flatRate === null) {
          addError(
            errors,
            'FLAT_RATE_MISSING',
            `Flat rate ${i} requires flatRate amount`,
            `rates[${i}].flatRate`
          );
        }
        break;

      case 'weight_based':
        if (!rate.weightTiers || rate.weightTiers.length === 0) {
          addError(
            errors,
            'WEIGHT_TIERS_MISSING',
            `Weight-based rate ${i} requires weight tiers`,
            `rates[${i}].weightTiers`
          );
        } else {
          validateWeightTiers(rate.weightTiers, i, errors);
        }
        break;

      case 'price_based':
        if (!rate.priceTiers || rate.priceTiers.length === 0) {
          addError(
            errors,
            'PRICE_TIERS_MISSING',
            `Price-based rate ${i} requires price tiers`,
            `rates[${i}].priceTiers`
          );
        } else {
          validatePriceTiers(rate.priceTiers, i, errors);
        }
        break;

      case 'distance_based':
        if (!rate.distanceTiers || rate.distanceTiers.length === 0) {
          addError(
            errors,
            'DISTANCE_TIERS_MISSING',
            `Distance-based rate ${i} requires distance tiers`,
            `rates[${i}].distanceTiers`
          );
        } else {
          validateDistanceTiers(rate.distanceTiers, i, errors);
        }
        break;

      case 'tiered':
        if (!rate.tieredRates || rate.tieredRates.length === 0) {
          addError(
            errors,
            'TIERED_RATES_MISSING',
            `Tiered rate ${i} requires tiered rates`,
            `rates[${i}].tieredRates`
          );
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate weight tiers
 */
function validateWeightTiers(tiers: any[], rateIndex: number, errors: ValidationError[]): void {
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];

    if (tier.maxWeight === undefined || tier.maxWeight === null) {
      addError(
        errors,
        'WEIGHT_TIER_NO_MAX',
        `Weight tier ${i} in rate ${rateIndex} has no maxWeight`,
        `rates[${rateIndex}].weightTiers[${i}].maxWeight`
      );
    }

    if (tier.rate === undefined || tier.rate === null) {
      addError(
        errors,
        'WEIGHT_TIER_NO_RATE',
        `Weight tier ${i} in rate ${rateIndex} has no rate`,
        `rates[${rateIndex}].weightTiers[${i}].rate`
      );
    }

    // Check for duplicates
    if (i > 0) {
      const prev = tiers[i - 1];
      if (prev.maxWeight >= tier.maxWeight) {
        addError(
          errors,
          'WEIGHT_TIER_ORDER',
          `Weight tiers must be in ascending order by maxWeight`,
          `rates[${rateIndex}].weightTiers`
        );
      }
    }
  }
}

/**
 * Validate price tiers
 */
function validatePriceTiers(tiers: any[], rateIndex: number, errors: ValidationError[]): void {
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];

    if (tier.orderAmount === undefined || tier.orderAmount === null) {
      addError(
        errors,
        'PRICE_TIER_NO_AMOUNT',
        `Price tier ${i} in rate ${rateIndex} has no orderAmount`,
        `rates[${rateIndex}].priceTiers[${i}].orderAmount`
      );
    }

    if (!tier.freeShipping && (tier.rate === undefined || tier.rate === null)) {
      addError(
        errors,
        'PRICE_TIER_NO_RATE',
        `Price tier ${i} in rate ${rateIndex} has no rate (and is not free shipping)`,
        `rates[${rateIndex}].priceTiers[${i}].rate`
      );
    }
  }
}

/**
 * Validate distance tiers
 */
function validateDistanceTiers(tiers: any[], rateIndex: number, errors: ValidationError[]): void {
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];

    if (tier.maxDistance === undefined || tier.maxDistance === null) {
      addError(
        errors,
        'DISTANCE_TIER_NO_MAX',
        `Distance tier ${i} in rate ${rateIndex} has no maxDistance`,
        `rates[${rateIndex}].distanceTiers[${i}].maxDistance`
      );
    }

    if (tier.baseRate === undefined || tier.baseRate === null) {
      addError(
        errors,
        'DISTANCE_TIER_NO_BASE',
        `Distance tier ${i} in rate ${rateIndex} has no baseRate`,
        `rates[${rateIndex}].distanceTiers[${i}].baseRate`
      );
    }

    if (tier.perKmRate === undefined || tier.perKmRate === null) {
      addError(
        errors,
        'DISTANCE_TIER_NO_PER_KM',
        `Distance tier ${i} in rate ${rateIndex} has no perKmRate`,
        `rates[${rateIndex}].distanceTiers[${i}].perKmRate`
      );
    }
  }
}

// ─── ZONE VALIDATION ───────────────────────────────────────────────────────

/**
 * Validate zone coverage (ensure all zones have rates)
 */
export function validateZoneCoverage(profile: ShippingProfile): {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!profile.zones || profile.zones.length === 0) {
    addWarning(
      warnings,
      'NO_ZONES',
      'Profile has no zones defined',
      'Add zones to specify geographic coverage'
    );
    return { valid: true, errors, warnings };
  }

  for (let i = 0; i < profile.zones.length; i++) {
    const zone = profile.zones[i];

    if (!zone.id) {
      addError(errors, 'ZONE_NO_ID', `Zone ${i} has no ID`, `zones[${i}].id`);
    }

    if (!zone.name || zone.name.trim().length === 0) {
      addError(errors, 'ZONE_NO_NAME', `Zone ${i} has no name`, `zones[${i}].name`);
    }

    // Check if zone has no location criteria
    if (
      (!zone.postalCodes || zone.postalCodes.length === 0) &&
      (!zone.cities || zone.cities.length === 0) &&
      (!zone.states || zone.states.length === 0) &&
      (!zone.countries || zone.countries.length === 0)
    ) {
      addWarning(
        warnings,
        'ZONE_NO_CRITERIA',
        `Zone ${i} (${zone.name}) has no location criteria defined`,
        'Add postal codes, cities, states, or countries to define zone boundaries'
      );
    }

    // Check if zone has rates
    if (!zone.rates || zone.rates.length === 0) {
      addError(
        errors,
        'ZONE_NO_RATES',
        `Zone ${i} (${zone.name}) has no rates defined`,
        `zones[${i}].rates`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Detect zone overlaps
 */
export function detectZoneOverlaps(profile: ShippingProfile): {
  overlaps: Array<{ zone1: string; zone2: string; criteria: string[] }>;
} {
  const overlaps: Array<{ zone1: string; zone2: string; criteria: string[] }> = [];

  if (!profile.zones || profile.zones.length < 2) {
    return { overlaps };
  }

  for (let i = 0; i < profile.zones.length; i++) {
    for (let j = i + 1; j < profile.zones.length; j++) {
      const zone1 = profile.zones[i];
      const zone2 = profile.zones[j];

      const sharedCriteria: string[] = [];

      // Check postal code overlap
      if (zone1.postalCodes && zone2.postalCodes) {
        const shared = zone1.postalCodes.filter(pc => zone2.postalCodes!.includes(pc));
        if (shared.length > 0) {
          sharedCriteria.push(`postal codes: ${shared.join(', ')}`);
        }
      }

      // Check city overlap
      if (zone1.cities && zone2.cities) {
        const shared = zone1.cities.filter(c =>
          zone2.cities!.some(z => z.toLowerCase() === c.toLowerCase())
        );
        if (shared.length > 0) {
          sharedCriteria.push(`cities: ${shared.join(', ')}`);
        }
      }

      // Check state overlap
      if (zone1.states && zone2.states) {
        const shared = zone1.states.filter(s =>
          zone2.states!.some(z => z.toLowerCase() === s.toLowerCase())
        );
        if (shared.length > 0) {
          sharedCriteria.push(`states: ${shared.join(', ')}`);
        }
      }

      if (sharedCriteria.length > 0) {
        overlaps.push({
          zone1: zone1.name,
          zone2: zone2.name,
          criteria: sharedCriteria,
        });
      }
    }
  }

  return { overlaps };
}

// ─── CALENDAR VALIDATION ──────────────────────────────────────────────────

/**
 * Validate calendar profiles
 */
export function validateCalendarProfiles(profile: ShippingProfile): {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!profile.calendarProfiles || profile.calendarProfiles.length === 0) {
    addWarning(
      warnings,
      'NO_CALENDAR',
      'Profile has no calendar profiles defined',
      'Add calendar profiles to specify availability'
    );
    return { valid: true, errors, warnings };
  }

  for (let i = 0; i < profile.calendarProfiles.length; i++) {
    const calendar = profile.calendarProfiles[i];

    if (!calendar.operatingHours || !calendar.operatingHours.timezone) {
      addError(
        errors,
        'CALENDAR_NO_TIMEZONE',
        `Calendar ${i} has no timezone`,
        `calendarProfiles[${i}].operatingHours.timezone`
      );
    }

    if (calendar.operatingHours && Object.keys(calendar.operatingHours.byDayOfWeek).length === 0) {
      addWarning(
        warnings,
        'CALENDAR_NO_HOURS',
        `Calendar ${i} has no operating hours defined`,
        'Define operating hours for at least some days'
      );
    }

    if (!calendar.timeSlots || calendar.timeSlots.length === 0) {
      addWarning(
        warnings,
        'CALENDAR_NO_SLOTS',
        `Calendar ${i} has no time slots defined`,
        'Add time slots for customers to select from'
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Detect calendar rule conflicts
 */
export function detectCalendarRuleConflicts(profile: ShippingProfile): {
  conflicts: Array<{ ruleIndexes: number[]; issue: string }>;
} {
  const conflicts: Array<{ ruleIndexes: number[]; issue: string }> = [];

  if (!profile.calendarRules || profile.calendarRules.length < 2) {
    return { conflicts };
  }

  for (let i = 0; i < profile.calendarRules.length; i++) {
    for (let j = i + 1; j < profile.calendarRules.length; j++) {
      const rule1 = profile.calendarRules[i];
      const rule2 = profile.calendarRules[j];

      // Check for same type on same date ranges
      if (rule1.type === rule2.type) {
        const datesOverlap = checkDateRangeOverlap(
          rule1.effectiveFrom,
          rule1.effectiveTo,
          rule2.effectiveFrom,
          rule2.effectiveTo
        );

        if (datesOverlap && rule1.priority === rule2.priority) {
          conflicts.push({
            ruleIndexes: [i, j],
            issue: `Rules ${i} and ${j} have same type and priority on overlapping dates`,
          });
        }
      }
    }
  }

  return { conflicts };
}

/**
 * Check if date ranges overlap
 */
function checkDateRangeOverlap(
  start1: Date | undefined,
  end1: Date | undefined,
  start2: Date | undefined,
  end2: Date | undefined
): boolean {
  // If either range is unbounded, assume overlap
  if (!start1 || !end1 || !start2 || !end2) {
    return true;
  }

  // Check overlap: start1 <= end2 and start2 <= end1
  return start1 <= end2 && start2 <= end1;
}

// ─── LOCATION VALIDATION ──────────────────────────────────────────────────

/**
 * Validate location attachments
 */
export function validateLocationAttachments(profile: ShippingProfile): {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!profile.locations || profile.locations.length === 0) {
    addWarning(
      warnings,
      'NO_LOCATIONS',
      'Profile has no locations attached',
      'Attach at least one location to enable fulfillment'
    );
    return { valid: true, errors, warnings };
  }

  // Check for at least one active location
  const activeLocations = profile.locations.filter(l => l.isActive);
  if (activeLocations.length === 0) {
    addError(
      errors,
      'NO_ACTIVE_LOCATIONS',
      'Profile has no active locations',
      'locations'
    );
  }

  for (let i = 0; i < profile.locations.length; i++) {
    const location = profile.locations[i];

    if (!location.locationId) {
      addError(
        errors,
        'LOCATION_NO_ID',
        `Location ${i} has no locationId`,
        `locations[${i}].locationId`
      );
    }

    if (!location.locationName || location.locationName.trim().length === 0) {
      addError(
        errors,
        'LOCATION_NO_NAME',
        `Location ${i} has no name`,
        `locations[${i}].locationName`
      );
    }

    if (!location.postalCode || location.postalCode.trim().length === 0) {
      addWarning(
        warnings,
        'LOCATION_NO_POSTAL',
        `Location ${i} has no postal code`,
        'Postal code helps with zone matching'
      );
    }

    if (!location.country || location.country.trim().length === 0) {
      addError(
        errors,
        'LOCATION_NO_COUNTRY',
        `Location ${i} has no country`,
        `locations[${i}].country`
      );
    }

    if (!location.defaultDeliveryMethod) {
      addError(
        errors,
        'LOCATION_NO_METHOD',
        `Location ${i} has no default delivery method`,
        `locations[${i}].defaultDeliveryMethod`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── COMPLETE VALIDATION ──────────────────────────────────────────────────

/**
 * Comprehensive validation of entire shipping profile
 */
export function validateShippingProfile(profile: ShippingProfile): ProfileValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];

  // Check completeness
  const completeCheck = validateProfileCompleteness(profile);
  allErrors.push(...completeCheck.errors);

  if (completeCheck.errors.length > 0) {
    // Skip other validations if basic structure is invalid
    return {
      isValid: false,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  // Check rates
  const ratesCheck = validateRates(profile);
  allErrors.push(...ratesCheck.errors);
  allWarnings.push(...ratesCheck.warnings);

  // Check zones
  const zonesCheck = validateZoneCoverage(profile);
  allErrors.push(...zonesCheck.errors);
  allWarnings.push(...zonesCheck.warnings);

  // Detect zone overlaps (warning level)
  const overlapCheck = detectZoneOverlaps(profile);
  if (overlapCheck.overlaps.length > 0) {
    for (const overlap of overlapCheck.overlaps) {
      addWarning(
        allWarnings,
        'ZONE_OVERLAP',
        `Zones "${overlap.zone1}" and "${overlap.zone2}" overlap on: ${overlap.criteria.join(', ')}`,
        'Consider adjusting zone definitions to avoid ambiguous matches'
      );
    }
  }

  // Check calendar
  const calendarCheck = validateCalendarProfiles(profile);
  allErrors.push(...calendarCheck.errors);
  allWarnings.push(...calendarCheck.warnings);

  // Detect calendar conflicts
  const conflictCheck = detectCalendarRuleConflicts(profile);
  if (conflictCheck.conflicts.length > 0) {
    for (const conflict of conflictCheck.conflicts) {
      allErrors.push({
        code: 'CALENDAR_CONFLICT',
        message: conflict.issue,
        field: 'calendarRules',
        context: { ruleIndexes: conflict.ruleIndexes },
      });
    }
  }

  // Check locations
  const locationsCheck = validateLocationAttachments(profile);
  allErrors.push(...locationsCheck.errors);
  allWarnings.push(...locationsCheck.warnings);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
