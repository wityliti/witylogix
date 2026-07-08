/**
 * Score Decay
 * Penalizes scores for inactive drivers
 */

/**
 * Default decay rate: 0.02 per day
 * This means a driver loses approximately 50% of their score after 35 days of inactivity
 */
const DEFAULT_DECAY_RATE = 0.02;

/**
 * Calculate exponential decay factor
 * Formula: e^(-rate * days)
 *
 * At rate 0.02 and days 35: e^(-0.7) ≈ 0.497 (loses ~50%)
 */
export function calculateDecayFactor(
  days: number,
  rate: number = DEFAULT_DECAY_RATE,
): number {
  if (days < 0) return 1.0;
  return Math.exp(-rate * days);
}

/**
 * Apply decay to a score based on days since last activity
 * No decay applied for recent activity (< 1 day)
 */
export function applyDecay(
  score: number,
  daysSinceLastDelivery: number,
  decayRate?: number,
): number {
  const rate = decayRate ?? DEFAULT_DECAY_RATE;

  // No decay for very recent activity
  if (daysSinceLastDelivery < 1) {
    return score;
  }

  const decayFactor = calculateDecayFactor(daysSinceLastDelivery, rate);
  const decayedScore = score * decayFactor;

  // Ensure score doesn't go below 0
  return Math.max(0, decayedScore);
}
