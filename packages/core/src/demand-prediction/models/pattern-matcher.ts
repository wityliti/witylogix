/**
 * Pattern Matching Model
 *
 * Find similar historical days based on day-of-week, weather, events
 * Uses k-nearest neighbors with recency weighting
 */

import type {
  DemandDataPoint,
  PatternFeatures,
  SimilarDay,
  HistoricalDemand,
} from '../types';

/**
 * Calculate Euclidean distance in feature space
 */
function euclideanDistance(features1: PatternFeatures, features2: PatternFeatures): number {
  let distance = 0;

  // Day of week (cyclical, so use sin/cos encoding)
  const dow1sin = Math.sin((features1.dayOfWeek * 2 * Math.PI) / 7);
  const dow1cos = Math.cos((features1.dayOfWeek * 2 * Math.PI) / 7);
  const dow2sin = Math.sin((features2.dayOfWeek * 2 * Math.PI) / 7);
  const dow2cos = Math.cos((features2.dayOfWeek * 2 * Math.PI) / 7);

  distance += Math.pow(dow1sin - dow2sin, 2);
  distance += Math.pow(dow1cos - dow2cos, 2);

  // Hour (cyclical)
  const hour1sin = Math.sin((features1.hour * 2 * Math.PI) / 24);
  const hour1cos = Math.cos((features1.hour * 2 * Math.PI) / 24);
  const hour2sin = Math.sin((features2.hour * 2 * Math.PI) / 24);
  const hour2cos = Math.cos((features2.hour * 2 * Math.PI) / 24);

  distance += Math.pow(hour1sin - hour2sin, 2);
  distance += Math.pow(hour1cos - hour2cos, 2);

  // Holiday (binary)
  distance += Math.pow(features1.holiday - features2.holiday, 2) * 2;

  // Weather (continuous 0-1)
  distance += Math.pow(features1.weather - features2.weather, 2) * 1.5;

  // Trend
  distance += Math.pow(features1.trend - features2.trend, 2);

  // Seasonal components
  distance += Math.pow(features1.seasonal_hour - features2.seasonal_hour, 2);
  distance += Math.pow(features1.seasonal_day - features2.seasonal_day, 2);

  // Event type (categorical) - simple matching
  const eventMatch = features1.eventType === features2.eventType ? 0 : 1;
  distance += eventMatch * 2;

  return Math.sqrt(distance);
}

/**
 * Extract features from a data point
 */
export function extractPatternFeatures(
  data: HistoricalDemand,
  trend: number = 0,
  seasonalHour: number = 0,
  seasonalDay: number = 0,
): PatternFeatures {
  const weatherIntensity = data.weather_intensity ?? 0;

  return {
    dayOfWeek: data.dayOfWeek,
    hour: data.hour,
    holiday: data.isHoliday ? 1 : 0,
    weather: weatherIntensity,
    eventType: data.eventType || 'none',
    trend: trend,
    seasonal_hour: seasonalHour,
    seasonal_day: seasonalDay,
  };
}

/**
 * Recency weight based on time difference
 */
function getRecencyWeight(
  historicalDate: Date,
  referenceDate: Date,
  decayWeeks: number = 26,
): number {
  const ageMs = referenceDate.getTime() - historicalDate.getTime();
  const ageWeeks = ageMs / (1000 * 60 * 60 * 24 * 7);

  if (ageWeeks < 0) return 0; // Future dates get 0 weight

  // Exponential decay: weight = exp(-ageWeeks / decayWeeks)
  return Math.exp(-ageWeeks / decayWeeks);
}

/**
 * Find k-nearest similar historical days
 */
export function findSimilarDays(
  targetDate: Date,
  targetFeatures: PatternFeatures,
  historicalData: HistoricalDemand[],
  k: number = 5,
  maxDaysBack: number = 365,
): SimilarDay[] {
  // Filter historical data within time window
  const minDate = new Date(targetDate);
  minDate.setDate(minDate.getDate() - maxDaysBack);

  const candidates = historicalData.filter((d) => {
    return d.timestamp >= minDate && d.timestamp < targetDate;
  });

  if (candidates.length === 0) {
    return [];
  }

  // Calculate distances and create candidates
  const similarities: Array<{
    data: HistoricalDemand;
    distance: number;
    recencyWeight: number;
  }> = [];

  for (const candidate of candidates) {
    // Group by day and get the daily aggregate
    const candFeatures = extractPatternFeatures(candidate);
    const distance = euclideanDistance(targetFeatures, candFeatures);
    const recencyWeight = getRecencyWeight(candidate.timestamp, targetDate);

    // Skip if too different
    if (distance > 10) continue;

    similarities.push({
      data: candidate,
      distance,
      recencyWeight,
    });
  }

  // Sort by combined score (distance + recency)
  similarities.sort((a, b) => {
    // Lower distance is better, higher recency is better
    const scoreA = a.distance - a.recencyWeight;
    const scoreB = b.distance - b.recencyWeight;
    return scoreA - scoreB;
  });

  // Group by day and get top k
  const dailyData: Map<string, SimilarDay> = new Map();

  for (const sim of similarities) {
    const dayKey = sim.data.timestamp.toISOString().split('T')[0];

    if (!dailyData.has(dayKey) && dailyData.size < k) {
      // Similarity score: inverse of distance, weighted by recency
      const similarity = Math.exp(-sim.distance) * (0.5 + 0.5 * sim.recencyWeight);

      dailyData.set(dayKey, {
        historicalDate: new Date(sim.data.timestamp),
        actualDemand: [sim.data.value], // Will aggregate later
        similarity,
        recencyWeight: sim.recencyWeight,
        features: extractPatternFeatures(sim.data),
      });
    }
  }

  return Array.from(dailyData.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/**
 * Predict using pattern matching with k-nearest historical days
 */
export function predictFromPatterns(
  patterns: SimilarDay[],
  k: number = 5,
): { prediction: number; lower: number; upper: number; confidence: number } {
  if (patterns.length === 0) {
    return { prediction: 0, lower: 0, upper: 0, confidence: 0 };
  }

  // Weight by similarity and recency
  const topPatterns = patterns.slice(0, k);
  const totalWeight = topPatterns.reduce((sum, p) => sum + p.similarity, 0);

  if (totalWeight === 0) {
    return { prediction: 0, lower: 0, upper: 0, confidence: 0 };
  }

  let weightedSum = 0;
  let weightedSquareSum = 0;

  for (const pattern of topPatterns) {
    const weight = pattern.similarity / totalWeight;
    const demand = pattern.actualDemand[0]; // Get first value

    weightedSum += demand * weight;
    weightedSquareSum += Math.pow(demand, 2) * weight;
  }

  const prediction = weightedSum;
  const variance = weightedSquareSum - Math.pow(prediction, 2);
  const stdDev = Math.sqrt(Math.max(0, variance));

  // Confidence based on pattern agreement
  let maxDev = 0;
  for (const pattern of topPatterns) {
    const demand = pattern.actualDemand[0];
    const deviation = Math.abs(demand - prediction);
    maxDev = Math.max(maxDev, deviation);
  }

  const confidence = Math.exp(-maxDev / (prediction || 1));

  return {
    prediction,
    lower: Math.max(0, prediction - 1.96 * stdDev),
    upper: prediction + 1.96 * stdDev,
    confidence: Math.min(1, confidence),
  };
}

/**
 * Holiday pattern matching - compare same holiday across years
 */
export function matchHolidayPattern(
  targetDate: Date,
  historicalData: HistoricalDemand[],
): { prediction: number; confidence: number } {
  // Find same date in previous years
  const yearMatches: Array<{ date: Date; value: number; yearDiff: number }> = [];

  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();
  const currentYear = targetDate.getFullYear();

  for (const d of historicalData) {
    if (d.isHoliday && d.timestamp.getMonth() === targetMonth && d.timestamp.getDate() === targetDay) {
      const yearDiff = currentYear - d.timestamp.getFullYear();
      if (yearDiff > 0 && yearDiff <= 5) {
        // Look back up to 5 years
        yearMatches.push({
          date: d.timestamp,
          value: d.value,
          yearDiff,
        });
      }
    }
  }

  if (yearMatches.length === 0) {
    return { prediction: 0, confidence: 0 };
  }

  // Weight recent years more
  const weights = yearMatches.map((m) => Math.exp(-m.yearDiff / 2));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let prediction = 0;
  for (let i = 0; i < yearMatches.length; i++) {
    prediction += (yearMatches[i].value * weights[i]) / totalWeight;
  }

  // Confidence: high if recent pattern is consistent
  const recentYears = yearMatches.filter((m) => m.yearDiff <= 2);
  const confidence = recentYears.length > 0 ? Math.min(1, recentYears.length / 2) : 0.3;

  return { prediction, confidence };
}

/**
 * Cold start handling: use zone cluster average
 */
export function getClusterAverageFallback(
  historicalData: HistoricalDemand[],
  dayOfWeek: number,
  hour: number,
): number {
  const matches = historicalData.filter((d) => d.dayOfWeek === dayOfWeek && d.hour === hour);

  if (matches.length === 0) {
    return historicalData.reduce((sum, d) => sum + d.value, 0) / Math.max(1, historicalData.length);
  }

  return matches.reduce((sum, d) => sum + d.value, 0) / matches.length;
}

/**
 * Aggregate hourly patterns into daily forecast
 */
export function aggregateToDailyForecast(
  hourlyPredictions: Array<{ prediction: number; confidence: number }>,
): { prediction: number; confidence: number } {
  if (hourlyPredictions.length === 0) {
    return { prediction: 0, confidence: 0 };
  }

  const totalDemand = hourlyPredictions.reduce((sum, p) => sum + p.prediction, 0);
  const avgConfidence =
    hourlyPredictions.reduce((sum, p) => sum + p.confidence, 0) / hourlyPredictions.length;

  return {
    prediction: totalDemand,
    confidence: avgConfidence,
  };
}
