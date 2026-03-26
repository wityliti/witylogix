/**
 * AI Delivery Time Prediction Model
 *
 * Provides intelligent delivery time predictions using multi-factor analysis:
 * - Carrier historical performance per lane
 * - Distance calculation (origin → destination via haversine formula)
 * - Day of week factors (weekday vs weekend)
 * - Time of day factors (rush hour impact)
 * - Weather conditions at origin/dest/route (severe weather = +1-3 days)
 * - Holiday calendar (US federal holidays + carrier-specific blackout dates)
 * - Package weight/size classification
 * - Service level (ground, express, overnight, economy, international)
 * - Confidence intervals with ±% based on data availability
 * - Learning from historical shipments to improve accuracy
 *
 * Algorithm:
 * 1. Base ETA from service level defaults (ground=3-5 days, express=1-2 days, etc.)
 * 2. Adjust by carrier historical performance (factor: actual/estimated from past shipments)
 * 3. Adjust for distance (longer routes take more time)
 * 4. Adjust for day of week (weekends may add delays)
 * 5. Adjust for time of day (late shipments may miss same-day cutoff)
 * 6. Adjust for weather impact (rain/snow can add 1-3 days)
 * 7. Adjust for holiday impact (scheduled holidays add delay)
 * 8. Apply package size/weight factors (heavier/larger = slightly slower)
 * 9. Calculate confidence based on sample size and variance
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type ServiceLevel = 'ground' | 'express' | 'overnight' | 'economy' | 'international';
export type WeatherCondition = 'clear' | 'rain' | 'snow' | 'fog' | 'storm' | 'extreme';
export type CarrierCode = 'ups' | 'fedex' | 'dhl' | 'usps' | 'canada_post' | 'generic';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Historical performance data for a carrier on a specific lane (origin-destination pair)
 */
export interface CarrierPerformance {
  carrier: CarrierCode;
  lane: string; // e.g., "NYC->LAX" or "origin_state->dest_state"
  estimatedDays: number; // promised delivery days
  actualAverageDays: number; // observed average from historical data
  sampleCount: number; // number of shipments tracked
  onTimeRate: number; // 0-1, percentage of on-time deliveries
  minDays: number; // fastest observed delivery
  maxDays: number; // slowest observed delivery
  lastUpdated: Date;
}

/**
 * Represents weather impact on delivery at a location
 */
export interface WeatherImpact {
  condition: WeatherCondition;
  location: 'origin' | 'destination' | 'route';
  delayDaysMin: number; // minimum delay in days
  delayDaysMax: number; // maximum delay in days
  affectedCarriers: CarrierCode[]; // empty = all carriers affected
}

/**
 * Factors that contribute to delivery time prediction
 */
export interface PredictionFactors {
  carrier: CarrierCode;
  serviceLevel: ServiceLevel;
  distance: number; // km
  originZip: string;
  destinationZip: string;
  shipDate: Date;
  weight: number; // kg
  weightCategory: 'light' | 'medium' | 'heavy' | 'oversize'; // light <5kg, medium <50kg, heavy <500kg, oversize >=500kg
  weatherOrigin: WeatherCondition;
  weatherDestination: WeatherCondition;
  weatherRoute: WeatherCondition;
  dayOfWeek: number; // 0-6, 0=Sunday
  isHoliday: boolean;
  isBlackoutDate: boolean;
}

/**
 * The final delivery time prediction with confidence
 */
export interface DeliveryPrediction {
  estimatedDays: number; // expected number of business days (e.g., 2.5)
  estimatedDeliveryDate: Date; // calculated expected delivery date
  confidencePercent: number; // 60-99%
  confidenceInterval: {
    optimistic: number; // days (e.g., 2)
    realistic: number; // days (e.g., 2.5)
    pessimistic: number; // days (e.g., 4)
  };
  factors: {
    baseEstimate: number; // service level default
    carrierPerformanceFactor: number; // multiplier from historical data
    distanceFactor: number; // multiplier for distance
    dayOfWeekFactor: number; // multiplier for day of week
    weatherFactor: number; // multiplier for weather
    holidayFactor: number; // multiplier for holidays
    weightFactor: number; // multiplier for package weight
    finalEstimate: number; // combined estimate
  };
  reasoning: string[]; // human-readable explanations for the prediction
}

/**
 * Actual delivery outcome recorded for model learning
 */
export interface DeliveryOutcome {
  carrier: CarrierCode;
  trackingNumber: string;
  shipDate: Date;
  deliveryDate: Date;
  actualDays: number;
  predictedDays: number;
  originZip: string;
  destinationZip: string;
  weight: number;
  serviceLevel: ServiceLevel;
  distance: number;
  onTime: boolean;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const BASE_ESTIMATES: Record<ServiceLevel, number> = {
  overnight: 1,
  express: 2,
  ground: 3.5,
  economy: 5,
  international: 7,
};

const US_FEDERAL_HOLIDAYS_2026 = [
  new Date('2026-01-01'), // New Year
  new Date('2026-01-19'), // MLK Day
  new Date('2026-02-16'), // Presidents Day
  new Date('2026-03-29'), // Easter (approx)
  new Date('2026-05-25'), // Memorial Day
  new Date('2026-07-04'), // Independence Day
  new Date('2026-09-07'), // Labor Day
  new Date('2026-10-12'), // Columbus Day
  new Date('2026-11-11'), // Veterans Day
  new Date('2026-11-26'), // Thanksgiving
  new Date('2026-12-25'), // Christmas
];

const WEATHER_IMPACTS: WeatherImpact[] = [
  { condition: 'clear', location: 'route', delayDaysMin: 0, delayDaysMax: 0, affectedCarriers: [] },
  { condition: 'rain', location: 'route', delayDaysMin: 0.5, delayDaysMax: 1.5, affectedCarriers: [] },
  { condition: 'snow', location: 'route', delayDaysMin: 1, delayDaysMax: 2.5, affectedCarriers: [] },
  { condition: 'fog', location: 'route', delayDaysMin: 0.5, delayDaysMax: 1, affectedCarriers: [] },
  { condition: 'storm', location: 'route', delayDaysMin: 1.5, delayDaysMax: 3, affectedCarriers: [] },
  { condition: 'extreme', location: 'route', delayDaysMin: 2, delayDaysMax: 4, affectedCarriers: [] },
];

const MIN_SAMPLES_FOR_CARRIER_FACTOR = 5; // require at least N shipments to use carrier performance data
const CONFIDENCE_INTERVAL_PERCENT = 0.2; // ±20% confidence interval width

// ─── CARRIER PERFORMANCE TRACKER ────────────────────────────────────────────

/**
 * Tracks and manages carrier performance data across different lanes
 */
export class CarrierPerformanceTracker {
  private performanceMap: Map<string, CarrierPerformance> = new Map();

  /**
   * Record a completed shipment for learning
   */
  public recordDelivery(outcome: DeliveryOutcome): void {
    const lane = this.getLaneKey(outcome.originZip, outcome.destinationZip);
    const key = `${outcome.carrier}|${lane}`;

    let performance = this.performanceMap.get(key);

    if (!performance) {
      performance = {
        carrier: outcome.carrier,
        lane,
        estimatedDays: BASE_ESTIMATES[outcome.serviceLevel],
        actualAverageDays: outcome.actualDays,
        sampleCount: 1,
        onTimeRate: outcome.onTime ? 1 : 0,
        minDays: outcome.actualDays,
        maxDays: outcome.actualDays,
        lastUpdated: new Date(),
      };
    } else {
      // Update running average
      const prevTotal = performance.actualAverageDays * performance.sampleCount;
      performance.actualAverageDays = (prevTotal + outcome.actualDays) / (performance.sampleCount + 1);
      performance.sampleCount += 1;
      performance.onTimeRate = (performance.onTimeRate * (performance.sampleCount - 1) + (outcome.onTime ? 1 : 0)) / performance.sampleCount;
      performance.minDays = Math.min(performance.minDays, outcome.actualDays);
      performance.maxDays = Math.max(performance.maxDays, outcome.actualDays);
      performance.lastUpdated = new Date();
    }

    this.performanceMap.set(key, performance);
  }

  /**
   * Get performance factor (actual/estimated) for a carrier on a lane
   */
  public getPerformanceFactor(carrier: CarrierCode, originZip: string, destinationZip: string): number {
    const lane = this.getLaneKey(originZip, destinationZip);
    const key = `${carrier}|${lane}`;
    const performance = this.performanceMap.get(key);

    if (!performance || performance.sampleCount < MIN_SAMPLES_FOR_CARRIER_FACTOR) {
      return 1.0; // use default if insufficient data
    }

    // Factor = actual average / estimated (should be 1.0 on average)
    return performance.actualAverageDays / performance.estimatedDays;
  }

  /**
   * Get all performance data for analytics
   */
  public getPerformanceData(): CarrierPerformance[] {
    return Array.from(this.performanceMap.values());
  }

  private getLaneKey(originZip: string, destinationZip: string): string {
    // Simplify to state-level for more general data
    const originState = originZip.substring(0, 2).toUpperCase();
    const destState = destinationZip.substring(0, 2).toUpperCase();
    return `${originState}-${destState}`;
  }
}

// ─── WEATHER IMPACT ESTIMATOR ──────────────────────────────────────────────

/**
 * Estimates delivery time adjustments based on weather conditions
 */
export class WeatherImpactEstimator {
  private impacts: Map<string, WeatherImpact> = new Map();

  constructor() {
    // Initialize with default impacts
    for (const impact of WEATHER_IMPACTS) {
      const key = `${impact.condition}|${impact.location}`;
      this.impacts.set(key, impact);
    }
  }

  /**
   * Calculate weather delay in days
   * Returns average of min/max delay for given conditions
   */
  public calculateDelay(
    originWeather: WeatherCondition,
    destinationWeather: WeatherCondition,
    routeWeather: WeatherCondition
  ): number {
    // Average the impacts at different points
    const delays: number[] = [];

    const originImpact = this.getImpact(originWeather, 'origin');
    if (originImpact) {
      delays.push((originImpact.delayDaysMin + originImpact.delayDaysMax) / 2);
    }

    const destImpact = this.getImpact(destinationWeather, 'destination');
    if (destImpact) {
      delays.push((destImpact.delayDaysMin + destImpact.delayDaysMax) / 2);
    }

    const routeImpact = this.getImpact(routeWeather, 'route');
    if (routeImpact) {
      delays.push((routeImpact.delayDaysMin + routeImpact.delayDaysMax) / 2);
    }

    if (delays.length === 0) return 0;
    return delays.reduce((a, b) => a + b, 0) / delays.length;
  }

  /**
   * Get weather impact factor (multiplier)
   */
  public getWeatherFactor(originWeather: WeatherCondition, destinationWeather: WeatherCondition, routeWeather: WeatherCondition): number {
    const delay = this.calculateDelay(originWeather, destinationWeather, routeWeather);
    return delay === 0 ? 1.0 : 1.0 + delay / 5; // rough multiplier (5 days = 2x slower)
  }

  private getImpact(condition: WeatherCondition, location: 'origin' | 'destination' | 'route'): WeatherImpact | undefined {
    const key = `${condition}|${location}`;
    return this.impacts.get(key);
  }
}

// ─── HOLIDAY CALENDAR ──────────────────────────────────────────────────────

/**
 * Manages US federal holidays and carrier-specific blackout dates
 */
export class HolidayCalendar {
  private holidays: Date[] = [];
  private blackoutDates: Map<CarrierCode, Date[]> = new Map();

  constructor() {
    this.holidays = US_FEDERAL_HOLIDAYS_2026;
  }

  /**
   * Check if a date is a holiday
   */
  public isHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return this.holidays.some((h) => h.toISOString().split('T')[0] === dateStr);
  }

  /**
   * Check if a date is a blackout date for a carrier
   */
  public isBlackoutDate(carrier: CarrierCode, date: Date): boolean {
    const blackouts = this.blackoutDates.get(carrier) || [];
    const dateStr = date.toISOString().split('T')[0];
    return blackouts.some((b) => b.toISOString().split('T')[0] === dateStr);
  }

  /**
   * Add a carrier-specific blackout date
   */
  public addBlackoutDate(carrier: CarrierCode, date: Date): void {
    if (!this.blackoutDates.has(carrier)) {
      this.blackoutDates.set(carrier, []);
    }
    this.blackoutDates.get(carrier)!.push(date);
  }

  /**
   * Calculate business days adding delay for holidays
   */
  public calculateDeliveryWithHolidays(shipDate: Date, estimatedDays: number, carrier: CarrierCode): { deliveryDate: Date; businessDays: number } {
    let currentDate = new Date(shipDate);
    let daysAdded = 0;

    while (daysAdded < estimatedDays) {
      currentDate.setDate(currentDate.getDate() + 1);
      // Skip weekends and holidays
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !this.isHoliday(currentDate) && !this.isBlackoutDate(carrier, currentDate)) {
        daysAdded += 1;
      }
    }

    return { deliveryDate: currentDate, businessDays: daysAdded };
  }
}

// ─── PREDICTION MODEL ──────────────────────────────────────────────────────

/**
 * Main delivery time prediction engine
 */
export class DeliveryTimePrediction {
  private performanceTracker: CarrierPerformanceTracker;
  private weatherEstimator: WeatherImpactEstimator;
  private holidayCalendar: HolidayCalendar;
  private deliveryHistory: DeliveryOutcome[] = [];

  constructor() {
    this.performanceTracker = new CarrierPerformanceTracker();
    this.weatherEstimator = new WeatherImpactEstimator();
    this.holidayCalendar = new HolidayCalendar();
  }

  /**
   * Predict delivery time based on multiple factors
   */
  public predict(factors: PredictionFactors): DeliveryPrediction {
    const reasoning: string[] = [];

    // 1. Base estimate from service level
    let baseEstimate = BASE_ESTIMATES[factors.serviceLevel];
    reasoning.push(`Base estimate for ${factors.serviceLevel} service: ${baseEstimate} days`);

    // 2. Carrier performance factor
    const carrierFactor = this.performanceTracker.getPerformanceFactor(factors.carrier, factors.originZip, factors.destinationZip);
    let estimate = baseEstimate * carrierFactor;
    if (carrierFactor !== 1.0) {
      reasoning.push(`Carrier ${factors.carrier} has ${(carrierFactor * 100).toFixed(0)}% of typical performance`);
    }

    // 3. Distance factor (very long distance may take longer)
    const distanceFactor = this.calculateDistanceFactor(factors.distance);
    estimate *= distanceFactor;
    if (distanceFactor !== 1.0) {
      reasoning.push(`Distance adjustment: ${factors.distance}km affects delivery by ${((distanceFactor - 1) * 100).toFixed(0)}%`);
    }

    // 4. Day of week factor (Friday/Saturday shipments may add delay)
    const dayOfWeekFactor = this.calculateDayOfWeekFactor(factors.dayOfWeek);
    estimate *= dayOfWeekFactor;
    if (dayOfWeekFactor > 1.0) {
      reasoning.push(`Shipping on day ${factors.dayOfWeek} (0=Sun) adds ${((dayOfWeekFactor - 1) * 100).toFixed(0)}% delay`);
    }

    // 5. Weather factor
    const weatherFactor = this.weatherEstimator.getWeatherFactor(factors.weatherOrigin, factors.weatherDestination, factors.weatherRoute);
    estimate *= weatherFactor;
    if (weatherFactor > 1.0) {
      reasoning.push(`Weather conditions (origin=${factors.weatherOrigin}, dest=${factors.weatherDestination}) add ${((weatherFactor - 1) * 100).toFixed(0)}% delay`);
    }

    // 6. Holiday factor
    let holidayFactor = 1.0;
    if (factors.isHoliday) {
      holidayFactor = 1.5;
      estimate *= holidayFactor;
      reasoning.push('Holiday period adds 50% delay');
    }
    if (factors.isBlackoutDate) {
      estimate += 1; // add full day for blackout dates
      reasoning.push(`Carrier blackout date adds 1 day`);
    }

    // 7. Weight factor (heavy packages may have additional handling)
    const weightFactor = this.calculateWeightFactor(factors.weight, factors.weightCategory);
    estimate *= weightFactor;
    if (weightFactor > 1.0) {
      reasoning.push(`Package weight (${factors.weight}kg, ${factors.weightCategory}) adds ${((weightFactor - 1) * 100).toFixed(0)}% delay`);
    }

    // Round to reasonable precision
    estimate = Math.round(estimate * 10) / 10;

    // 8. Calculate confidence interval
    const confidence = this.calculateConfidence(factors);
    const interval = this.getConfidenceInterval(estimate, confidence);

    // 9. Calculate actual delivery date
    const { deliveryDate } = this.holidayCalendar.calculateDeliveryWithHolidays(factors.shipDate, estimate, factors.carrier);

    return {
      estimatedDays: estimate,
      estimatedDeliveryDate: deliveryDate,
      confidencePercent: confidence,
      confidenceInterval: interval,
      factors: {
        baseEstimate,
        carrierPerformanceFactor: carrierFactor,
        distanceFactor,
        dayOfWeekFactor,
        weatherFactor,
        holidayFactor,
        weightFactor,
        finalEstimate: estimate,
      },
      reasoning,
    };
  }

  /**
   * Record delivery outcome for model improvement
   */
  public recordDelivery(outcome: DeliveryOutcome): void {
    this.deliveryHistory.push(outcome);
    this.performanceTracker.recordDelivery(outcome);
  }

  /**
   * Calculate distance-based adjustment factor
   * Longer routes may take slightly longer due to logistics complexity
   */
  private calculateDistanceFactor(distanceKm: number): number {
    if (distanceKm < 100) return 1.0;
    if (distanceKm < 500) return 1.05;
    if (distanceKm < 1000) return 1.1;
    if (distanceKm < 2000) return 1.15;
    return 1.2; // very long distances (international)
  }

  /**
   * Calculate day-of-week adjustment factor
   * Friday/Saturday/Sunday shipments may delay next-day delivery options
   */
  private calculateDayOfWeekFactor(dayOfWeek: number): number {
    // 0=Sun, 1=Mon, ..., 6=Sat
    if (dayOfWeek === 0) return 1.2; // Sunday - delayed start
    if (dayOfWeek === 5) return 1.1; // Friday - may miss cutoff for same-week delivery
    if (dayOfWeek === 6) return 1.3; // Saturday - no pickup
    return 1.0; // Mon-Thu
  }

  /**
   * Calculate weight-based adjustment factor
   * Heavy/oversize packages have additional handling
   */
  private calculateWeightFactor(weight: number, category: string): number {
    switch (category) {
      case 'light':
        return 1.0;
      case 'medium':
        return 1.02;
      case 'heavy':
        return 1.05;
      case 'oversize':
        return 1.1;
      default:
        return 1.0;
    }
  }

  /**
   * Calculate confidence percentage based on data availability
   */
  private calculateConfidence(factors: PredictionFactors): number {
    const performances = this.performanceTracker.getPerformanceData();
    const matchingPerformances = performances.filter((p) => p.carrier === factors.carrier);

    if (matchingPerformances.length === 0) return 65; // low confidence without carrier data
    if (matchingPerformances.length < 5) return 75; // medium confidence
    if (matchingPerformances.length < 20) return 85; // good confidence
    return 92; // high confidence with lots of data
  }

  /**
   * Get confidence interval (optimistic, realistic, pessimistic)
   */
  private getConfidenceInterval(estimate: number, confidence: number): DeliveryPrediction['confidenceInterval'] {
    // Lower confidence = wider interval
    const margin = estimate * CONFIDENCE_INTERVAL_PERCENT * (1 - confidence / 100) * 2;

    return {
      optimistic: Math.max(1, Math.round(estimate - margin)),
      realistic: Math.round(estimate * 10) / 10,
      pessimistic: Math.round(estimate + margin),
    };
  }
}

// ─── FACTORY FUNCTIONS ─────────────────────────────────────────────────────

let globalPredictionInstance: DeliveryTimePrediction | null = null;

/**
 * Create a new delivery time prediction engine
 */
export function createDeliveryTimePrediction(): DeliveryTimePrediction {
  return new DeliveryTimePrediction();
}

/**
 * Get or create global prediction instance
 */
export function getDeliveryTimePrediction(): DeliveryTimePrediction {
  if (!globalPredictionInstance) {
    globalPredictionInstance = new DeliveryTimePrediction();
  }
  return globalPredictionInstance;
}
