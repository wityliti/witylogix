/**
 * Slot Recommender Engine
 *
 * ML-powered delivery slot recommendations that combine:
 * - Demand prediction (will it be busy?)
 * - Driver availability (are drivers available?)
 * - Customer preference (what does the customer like?)
 * - Congestion risk (is the zone congested?)
 * - Weather impact (will weather affect delivery?)
 *
 * Returns top 5 recommended slots ranked by composite score.
 */

import { DemandPredictor } from "./demand-predictor.js";
import {
  DriverAvailabilityPredictor,
  type DriverShift,
} from "./driver-availability.js";
import type {
  ScoredSlot,
  RecommendSlotRequest,
  CustomerPreference,
  ZoneCongestion,
  WeatherImpact,
} from "./types.js";

/**
 * Slot data structure (from database)
 */
export interface TimeSlot {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  zoneId: string;
  isActive: boolean;
  capacity?: number;
}

/**
 * SlotRecommender service
 */
export class SlotRecommender {
  private demandPredictor: DemandPredictor;
  private driverPredictor: DriverAvailabilityPredictor;

  /**
   * Available time slots from database
   */
  private availableSlots: TimeSlot[] = [];

  /**
   * Zone congestion data (cached)
   */
  private congestionData: Map<string, ZoneCongestion> = new Map();

  /**
   * Weather impact data
   */
  private weatherData: Map<string, WeatherImpact> = new Map();

  /**
   * Customer preferences cache
   */
  private customerPreferences: Map<string, CustomerPreference> = new Map();

  /**
   * Weighting factors for scoring
   */
  private readonly WEIGHTS = {
    demand: 0.25, // Low demand = faster delivery
    driverAvailability: 0.25,
    customerPreference: 0.2,
    congestion: 0.15,
    weather: 0.15,
  };

  constructor() {
    this.demandPredictor = new DemandPredictor();
    this.driverPredictor = new DriverAvailabilityPredictor();
  }

  /**
   * Set available time slots
   */
  setAvailableSlots(slots: TimeSlot[]): void {
    this.availableSlots = slots.filter((s) => s.isActive);
  }

  /**
   * Set driver shifts for availability prediction
   */
  setDriverShifts(shifts: DriverShift[]): void {
    this.driverPredictor.addShifts(shifts);
  }

  /**
   * Update congestion data
   */
  setCongestionData(congestionData: ZoneCongestion[]): void {
    congestionData.forEach((c) => {
      this.congestionData.set(`${c.zoneId}-${c.timestamp.toISOString()}`, c);
    });
  }

  /**
   * Update weather data
   */
  setWeatherData(weatherData: WeatherImpact[]): void {
    weatherData.forEach((w) => {
      this.weatherData.set(`${w.zoneId}-${w.date.toISOString()}`, w);
    });
  }

  /**
   * Store customer preference
   */
  setCustomerPreference(preference: CustomerPreference): void {
    this.customerPreferences.set(preference.customerId, preference);
  }

  /**
   * Recommend slots for a customer
   */
  recommendSlots(request: RecommendSlotRequest): ScoredSlot[] {
    const maxSlots = request.maxSlots ?? 5;

    // Get relevant slots for the zone and date
    const relevantSlots = this.availableSlots.filter(
      (slot) =>
        slot.zoneId === request.zoneId &&
        this.isSameDateAndFuture(slot.startTime, request.date),
    );

    if (relevantSlots.length === 0) {
      return [];
    }

    // Score each slot
    const scoredSlots: ScoredSlot[] = relevantSlots.map((slot) =>
      this.scoreSlot(
        slot,
        request.date,
        request.customerId,
        request.customerPreference,
      ),
    );

    // Sort by score (descending) and return top N
    return scoredSlots.sort((a, b) => b.score - a.score).slice(0, maxSlots);
  }

  /**
   * Score a single slot based on multiple factors
   */
  private scoreSlot(
    slot: TimeSlot,
    date: Date,
    customerId: string,
    customerPref?: CustomerPreference,
  ): ScoredSlot {
    const midHour = Math.floor(
      (slot.startTime.getHours() + slot.endTime.getHours()) / 2,
    );

    // 1. Demand score (lower demand is better: 0-1)
    const demandScore = this.calculateDemandScore(slot.zoneId, date, midHour);

    // 2. Driver availability score (more drivers is better: 0-1)
    const driverScore = this.calculateDriverScore(slot.zoneId, date, midHour);

    // 3. Customer preference score (matches history: 0-1)
    const prefScore = this.calculatePreferenceScore(
      customerId,
      midHour,
      date.getDay(),
      customerPref,
    );

    // 4. Congestion risk (lower is better: 0-1 inverted)
    const congestionScore = this.calculateCongestionScore(
      slot.zoneId,
      date,
      midHour,
    );

    // 5. Weather impact (minimize impact: 0-1)
    const weatherScore = this.calculateWeatherScore(slot.zoneId, date);

    // Weighted composite score (0-100)
    const score =
      (demandScore * this.WEIGHTS.demand +
        driverScore * this.WEIGHTS.driverAvailability +
        prefScore * this.WEIGHTS.customerPreference +
        congestionScore * this.WEIGHTS.congestion +
        weatherScore * this.WEIGHTS.weather) *
      100;

    // Build reasoning
    const reasoning = this.buildReasoning(
      slot,
      demandScore,
      driverScore,
      prefScore,
      congestionScore,
      weatherScore,
    );

    // Get demand forecast
    const demandForecast = this.demandPredictor.predictDemand(
      slot.zoneId,
      date,
      midHour,
    );

    // Get driver forecast
    const driverForecast = this.driverPredictor.predictAvailability(
      date,
      midHour,
    );
    const driverAvailability =
      driverForecast.expectedAvailableDrivers /
        Math.max(driverForecast.totalScheduledDrivers, 1) || 0.5;

    return {
      slotId: slot.id,
      slotName: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      score: Math.round(score),
      reasoning,
      demandForecast,
      driverAvailability,
      congestionRisk: 1 - congestionScore, // Invert for risk
      weatherImpact: this.getWeatherImpactValue(slot.zoneId, date),
      customerPreferenceMatch: prefScore,
    };
  }

  /**
   * Calculate demand score (0-1: lower demand is better)
   */
  private calculateDemandScore(
    zoneId: string,
    date: Date,
    hour: number,
  ): number {
    const forecast = this.demandPredictor.predictDemand(zoneId, date, hour);

    // Assume avg 30 orders per slot at capacity
    // Score: at 0 orders = 1.0, at 30+ = 0.2
    const normalizedDemand = Math.min(forecast.predictedOrders / 30, 1);

    // Higher confidence = we can trust lower demand
    return (1 - normalizedDemand) * (forecast.confidence + 0.5);
  }

  /**
   * Calculate driver availability score (0-1)
   */
  private calculateDriverScore(
    zoneId: string,
    date: Date,
    hour: number,
  ): number {
    const forecast = this.driverPredictor.predictAvailability(date, hour);

    const zoneDrivers = forecast.zoneDistribution[zoneId] ?? 0;
    const totalDrivers = forecast.expectedAvailableDrivers || 1;

    // Assume need 2+ drivers for good service
    const availability = Math.min(zoneDrivers / 2, 1);

    // Reduce score if no-show risk is high
    return availability * (1 - forecast.noShowProbability);
  }

  /**
   * Calculate customer preference match (0-1)
   */
  private calculatePreferenceScore(
    customerId: string,
    hour: number,
    dayOfWeek: number,
    customerPref?: CustomerPreference,
  ): number {
    const pref = customerPref || this.customerPreferences.get(customerId);

    if (!pref) {
      return 0.5; // Neutral score for unknown customers
    }

    let score = 0.5;

    // Check if hour matches preferred hours
    if (pref.preferredHours.includes(hour)) {
      score += 0.3;
    }

    // Check if day matches preferred days
    if (pref.preferredDays.includes(dayOfWeek)) {
      score += 0.2;
    }

    // Factor in customer's success rate
    score *= pref.successRate;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate congestion score (0-1: lower congestion is better)
   */
  private calculateCongestionScore(
    zoneId: string,
    date: Date,
    hour: number,
  ): number {
    const timestamp = new Date(date);
    timestamp.setHours(hour);

    const key = `${zoneId}-${timestamp.toISOString()}`;
    const congestion = this.congestionData.get(key);

    if (!congestion) {
      return 0.7; // Assume moderate if no data
    }

    // Map congestion level to score
    const congestionScores = {
      light: 1.0,
      moderate: 0.7,
      heavy: 0.3,
    };

    return congestionScores[congestion.congestionLevel] ?? 0.7;
  }

  /**
   * Calculate weather impact score (0-1: less impact is better)
   */
  private calculateWeatherScore(zoneId: string, date: Date): number {
    const key = `${zoneId}-${date.toISOString()}`;
    const weather = this.weatherData.get(key);

    if (!weather) {
      return 0.8; // Assume minor impact if no data
    }

    // Weather conditions and their impact
    const impacts = {
      sunny: 1.0,
      cloudy: 0.95,
      rainy: 0.7,
      stormy: 0.4,
      snowy: 0.3,
      foggy: 0.6,
    };

    const baseScore = impacts[weather.condition as keyof typeof impacts] ?? 0.8;

    // Apply delay factor (1.0 = normal, 1.5 = 50% slower)
    const delayAdjustment = 1 / weather.deliveryDelayFactor;

    return baseScore * delayAdjustment;
  }

  /**
   * Get weather impact value for display
   */
  private getWeatherImpactValue(zoneId: string, date: Date): number {
    const key = `${zoneId}-${date.toISOString()}`;
    const weather = this.weatherData.get(key);

    if (!weather) {
      return 0;
    }

    // Return delay factor as percentage: 0 = no impact, 0.5 = 50% slower
    return weather.deliveryDelayFactor - 1;
  }

  /**
   * Build human-readable reasoning
   */
  private buildReasoning(
    slot: TimeSlot,
    demandScore: number,
    driverScore: number,
    prefScore: number,
    congestionScore: number,
    weatherScore: number,
  ): string {
    const reasons: string[] = [];

    // Find highest scoring factor
    const scores = [
      { label: "Low demand", score: demandScore },
      { label: "Available drivers", score: driverScore },
      { label: "Your preference", score: prefScore },
      { label: "Light congestion", score: congestionScore },
      { label: "Good weather", score: weatherScore },
    ];

    scores.sort((a, b) => b.score - a.score);

    reasons.push(scores[0]!.label);

    if (scores[1]!.score > 0.6) {
      reasons.push(scores[1]!.label);
    }

    if (demandScore < 0.3) {
      reasons.push("High demand period");
    }

    if (driverScore > 0.8) {
      reasons.push("Excellent driver availability");
    }

    return `${slot.name}: ${reasons.join(", ")}`;
  }

  /**
   * Check if slot is on the same date and in the future
   */
  private isSameDateAndFuture(slotTime: Date, targetDate: Date): boolean {
    const slotDate = new Date(slotTime).toDateString();
    const targetDateStr = new Date(targetDate).toDateString();

    return slotDate === targetDateStr;
  }

  /**
   * Get top recommendation for a customer
   */
  getTopRecommendation(request: RecommendSlotRequest): ScoredSlot | null {
    const recommendations = this.recommendSlots(request);
    return recommendations.length > 0 ? recommendations[0]! : null;
  }

  /**
   * Update demand predictor with new data
   */
  updateDemandData(historicalData: any[]): void {
    this.demandPredictor.addHistoricalData(historicalData);
  }

  /**
   * Clear all caches (useful for testing)
   */
  clear(): void {
    this.congestionData.clear();
    this.weatherData.clear();
    this.customerPreferences.clear();
  }
}

/**
 * Singleton instance for global use
 */
export const slotRecommender = new SlotRecommender();
