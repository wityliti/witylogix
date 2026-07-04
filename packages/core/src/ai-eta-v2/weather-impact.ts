/**
 * Weather Impact on ETA
 *
 * Calculates how different weather conditions affect delivery times.
 * Uses configurable factors per weather type.
 * Future: Can integrate with weather APIs.
 * Currently: Uses manual weather condition input.
 *
 * Impact factors:
 * - Rain: +15-25% delay
 * - Snow: +30-50% delay
 * - Fog: +10-20% delay
 * - Extreme heat: +5-10% delay
 * - Wind: +5-15% delay
 */

/**
 * Weather condition type
 */
export type WeatherCondition =
  | "clear"
  | "rain"
  | "snow"
  | "fog"
  | "extreme_heat"
  | "wind";

/**
 * Weather severity
 */
export type WeatherSeverity = "light" | "moderate" | "heavy";

/**
 * Weather input
 */
export interface WeatherInput {
  condition: WeatherCondition;
  severity?: WeatherSeverity;
  temperature?: number; // Celsius
  windSpeed?: number; // km/h
  visibility?: number; // meters
  precipitation?: number; // mm/hour
}

/**
 * Weather impact result
 */
export interface WeatherImpactResult {
  condition: WeatherCondition;
  severity: WeatherSeverity;
  delayFactor: number; // 1.0 = no delay, 1.25 = 25% delay
  delayMinutes: number;
  confidence: number; // 0-1
  reasoning: string;
}

/**
 * Weather Impact Calculator
 */
export class WeatherImpact {
  private impactFactors: Map<WeatherCondition, Map<WeatherSeverity, number>>;

  constructor() {
    // Initialize impact factors
    this.impactFactors = new Map();

    // Rain: +15-25% delay based on severity
    this.impactFactors.set(
      "rain",
      new Map([
        ["light", 1.15],
        ["moderate", 1.2],
        ["heavy", 1.25],
      ]),
    );

    // Snow: +30-50% delay (much more impact than rain)
    this.impactFactors.set(
      "snow",
      new Map([
        ["light", 1.3],
        ["moderate", 1.4],
        ["heavy", 1.5],
      ]),
    );

    // Fog: +10-20% delay (reduced visibility)
    this.impactFactors.set(
      "fog",
      new Map([
        ["light", 1.1],
        ["moderate", 1.15],
        ["heavy", 1.2],
      ]),
    );

    // Extreme heat: +5-10% delay (slower driving, vehicle issues)
    this.impactFactors.set(
      "extreme_heat",
      new Map([
        ["light", 1.05],
        ["moderate", 1.075],
        ["heavy", 1.1],
      ]),
    );

    // Wind: +5-15% delay (gusty winds affect driving)
    this.impactFactors.set(
      "wind",
      new Map([
        ["light", 1.05],
        ["moderate", 1.1],
        ["heavy", 1.15],
      ]),
    );

    // Clear: no impact
    this.impactFactors.set(
      "clear",
      new Map([
        ["light", 1.0],
        ["moderate", 1.0],
        ["heavy", 1.0],
      ]),
    );
  }

  /**
   * Determine weather severity from measured values
   *
   * Uses precipitation, visibility, wind speed to infer severity
   */
  determineSeverity(weather: WeatherInput): WeatherSeverity {
    // If severity is explicitly provided, use it
    if (weather.severity) {
      return weather.severity;
    }

    // Infer from precipitation (for rain/snow)
    if (
      (weather.condition === "rain" || weather.condition === "snow") &&
      weather.precipitation !== undefined
    ) {
      if (weather.precipitation < 2.5) return "light";
      if (weather.precipitation < 10) return "moderate";
      return "heavy";
    }

    // Infer from visibility (for fog)
    if (weather.condition === "fog" && weather.visibility !== undefined) {
      if (weather.visibility > 500) return "light";
      if (weather.visibility > 100) return "moderate";
      return "heavy";
    }

    // Infer from wind speed
    if (weather.condition === "wind" && weather.windSpeed !== undefined) {
      if (weather.windSpeed < 20) return "light";
      if (weather.windSpeed < 40) return "moderate";
      return "heavy";
    }

    // Infer from temperature (for extreme heat)
    if (
      weather.condition === "extreme_heat" &&
      weather.temperature !== undefined
    ) {
      if (weather.temperature < 35) return "light";
      if (weather.temperature < 40) return "moderate";
      return "heavy";
    }

    // Default to moderate if condition requires it
    return weather.condition === "clear" ? "light" : "moderate";
  }

  /**
   * Calculate weather impact on ETA
   *
   * @param baseDurationMin Base delivery time without weather impact
   * @param weather Weather conditions
   * @returns Weather impact result with delay factor and minutes
   */
  calculateImpact(
    baseDurationMin: number,
    weather: WeatherInput,
  ): WeatherImpactResult {
    const severity = this.determineSeverity(weather);
    const factor =
      this.impactFactors.get(weather.condition)?.get(severity) || 1.0;
    const delayMinutes = baseDurationMin * (factor - 1.0);

    const reasoning = this.generateReasoning(weather, severity, factor);

    return {
      condition: weather.condition,
      severity,
      delayFactor: factor,
      delayMinutes,
      confidence: this.calculateConfidence(weather),
      reasoning,
    };
  }

  /**
   * Calculate confidence in weather impact estimate
   *
   * Higher confidence when weather parameters are explicitly provided
   */
  private calculateConfidence(weather: WeatherInput): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence if specific measurements provided
    if (weather.precipitation !== undefined) confidence += 0.1;
    if (weather.visibility !== undefined) confidence += 0.1;
    if (weather.windSpeed !== undefined) confidence += 0.1;
    if (weather.temperature !== undefined) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  /**
   * Generate reasoning for the impact
   */
  private generateReasoning(
    weather: WeatherInput,
    severity: WeatherSeverity,
    factor: number,
  ): string {
    const impactPercent = ((factor - 1.0) * 100).toFixed(0);

    if (weather.condition === "clear") {
      return "Clear weather - no impact on delivery time";
    }

    if (weather.condition === "rain") {
      const precipStr = weather.precipitation
        ? ` (${weather.precipitation.toFixed(1)} mm/h)`
        : "";
      return `${severity} rain${precipStr} increases delivery time by ${impactPercent}%`;
    }

    if (weather.condition === "snow") {
      const precipStr = weather.precipitation
        ? ` (${weather.precipitation.toFixed(1)} mm/h)`
        : "";
      return `${severity} snow${precipStr} increases delivery time by ${impactPercent}%`;
    }

    if (weather.condition === "fog") {
      const visStr = weather.visibility
        ? ` (${weather.visibility}m visibility)`
        : "";
      return `${severity} fog${visStr} reduces visibility and increases delivery time by ${impactPercent}%`;
    }

    if (weather.condition === "extreme_heat") {
      const tempStr = weather.temperature ? ` (${weather.temperature}°C)` : "";
      return `Extreme heat${tempStr} affects driving and increases delivery time by ${impactPercent}%`;
    }

    if (weather.condition === "wind") {
      const windStr = weather.windSpeed ? ` (${weather.windSpeed} km/h)` : "";
      return `${severity} wind${windStr} affects vehicle handling and increases delivery time by ${impactPercent}%`;
    }

    return `${weather.condition} weather increases delivery time by ${impactPercent}%`;
  }

  /**
   * Set custom impact factor for a weather condition
   *
   * @param condition Weather condition
   * @param severity Weather severity
   * @param factor Impact factor (1.0 = no impact)
   */
  setImpactFactor(
    condition: WeatherCondition,
    severity: WeatherSeverity,
    factor: number,
  ): void {
    let conditionMap = this.impactFactors.get(condition);
    if (!conditionMap) {
      conditionMap = new Map();
      this.impactFactors.set(condition, conditionMap);
    }
    conditionMap.set(severity, factor);
  }

  /**
   * Get impact factor for a weather condition
   */
  getImpactFactor(
    condition: WeatherCondition,
    severity: WeatherSeverity,
  ): number {
    return this.impactFactors.get(condition)?.get(severity) ?? 1.0;
  }

  /**
   * Reset all impact factors to defaults
   */
  resetDefaults(): void {
    this.impactFactors.clear();

    // Re-initialize with defaults
    this.impactFactors.set(
      "rain",
      new Map([
        ["light", 1.15],
        ["moderate", 1.2],
        ["heavy", 1.25],
      ]),
    );

    this.impactFactors.set(
      "snow",
      new Map([
        ["light", 1.3],
        ["moderate", 1.4],
        ["heavy", 1.5],
      ]),
    );

    this.impactFactors.set(
      "fog",
      new Map([
        ["light", 1.1],
        ["moderate", 1.15],
        ["heavy", 1.2],
      ]),
    );

    this.impactFactors.set(
      "extreme_heat",
      new Map([
        ["light", 1.05],
        ["moderate", 1.075],
        ["heavy", 1.1],
      ]),
    );

    this.impactFactors.set(
      "wind",
      new Map([
        ["light", 1.05],
        ["moderate", 1.1],
        ["heavy", 1.15],
      ]),
    );

    this.impactFactors.set(
      "clear",
      new Map([
        ["light", 1.0],
        ["moderate", 1.0],
        ["heavy", 1.0],
      ]),
    );
  }

  /**
   * Get all configured conditions
   */
  getConfiguredConditions(): WeatherCondition[] {
    return Array.from(this.impactFactors.keys());
  }

  /**
   * Combine multiple weather impacts
   *
   * When multiple weather conditions exist (e.g., rain + wind),
   * combine factors multiplicatively
   */
  combineImpacts(impacts: WeatherImpactResult[]): {
    combinedFactor: number;
    totalDelayMinutes: number;
    reasoning: string;
  } {
    if (impacts.length === 0) {
      return {
        combinedFactor: 1.0,
        totalDelayMinutes: 0,
        reasoning: "No weather impacts",
      };
    }

    if (impacts.length === 1) {
      return {
        combinedFactor: impacts[0].delayFactor,
        totalDelayMinutes: impacts[0].delayMinutes,
        reasoning: impacts[0].reasoning,
      };
    }

    // Combine factors multiplicatively (rough approximation)
    const combinedFactor = impacts.reduce(
      (acc, impact) => acc * impact.delayFactor,
      1.0,
    );
    const baseDuration = impacts[0].delayMinutes / (impacts[0].delayFactor - 1);
    const totalDelayMinutes = baseDuration * (combinedFactor - 1.0);

    const conditions = impacts.map((i) => i.condition).join(", ");
    const reasoning = `Combined impact of ${conditions}: ${((combinedFactor - 1.0) * 100).toFixed(0)}% delay`;

    return {
      combinedFactor,
      totalDelayMinutes,
      reasoning,
    };
  }
}
