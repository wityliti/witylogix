/**
 * Holt-Winters Triple Exponential Smoothing for Slot Demand Forecasting
 *
 * Implements the additive Holt-Winters model:
 *   l_t = α(y_t / s_{t-m}) + (1-α)(l_{t-1} + b_{t-1})   [level]
 *   b_t = β(l_t - l_{t-1}) + (1-β)b_{t-1}                [trend]
 *   s_t = γ(y_t / l_t) + (1-γ)s_{t-m}                    [seasonal]
 *   ŷ_{t+h} = (l_t + h*b_t) * s_{t-m+((h-1) mod m)+1}   [forecast]
 *
 * Seasonality period m = 7 (weekly patterns for slot demand).
 */

export interface HoltWintersParams {
  /** Smoothing factor for level [0,1] */
  alpha: number;
  /** Smoothing factor for trend [0,1] */
  beta: number;
  /** Smoothing factor for seasonality [0,1] */
  gamma: number;
  /** Seasonal period (7 = weekly) */
  m: number;
}

export interface HoltWintersForecast {
  /** Point forecast values */
  forecast: number[];
  /** Lower confidence bound (−1σ) */
  lower: number[];
  /** Upper confidence bound (+1σ) */
  upper: number[];
  /** Fitted level components */
  level: number[];
  /** Fitted trend components */
  trend: number[];
  /** Seasonal indices */
  seasonal: number[];
  /** In-sample RMSE */
  rmse: number;
}

export interface HoltWintersState {
  level: number;
  trend: number;
  seasonal: number[];
  lastResiduals: number[];
  params: HoltWintersParams;
  seriesLength: number;
}

const DEFAULT_PARAMS: HoltWintersParams = {
  alpha: 0.3,
  beta: 0.1,
  gamma: 0.4,
  m: 7,
};

/**
 * Initialize seasonal indices using average of first k complete seasonal cycles.
 */
function initSeasonalIndices(series: number[], m: number): number[] {
  const nCycles = Math.floor(series.length / m);
  if (nCycles < 1) {
    return new Array(m).fill(1.0);
  }

  // Average over the first nCycles cycles
  const cycleMeans: number[] = [];
  for (let c = 0; c < nCycles; c++) {
    const slice = series.slice(c * m, (c + 1) * m);
    cycleMeans.push(slice.reduce((a, b) => a + b, 0) / m);
  }

  const seasonalSums = new Array(m).fill(0);
  for (let c = 0; c < nCycles; c++) {
    for (let i = 0; i < m; i++) {
      const val = series[c * m + i];
      seasonalSums[i] += val / (cycleMeans[c] || 1);
    }
  }

  return seasonalSums.map((s) => s / nCycles);
}

/**
 * Fit Holt-Winters to a time series, returning in-sample state.
 */
function fitHoltWinters(
  series: number[],
  params: HoltWintersParams,
): HoltWintersState & { fitted: number[]; residuals: number[] } {
  const { alpha, beta, gamma, m } = params;
  const n = series.length;

  // Initialize
  const seasonal = initSeasonalIndices(series, m);
  let l = series.slice(0, m).reduce((a, b) => a + b, 0) / m;
  let b = 0;
  if (series.length >= 2 * m) {
    const mean2 = series.slice(m, 2 * m).reduce((a, b) => a + b, 0) / m;
    b = (mean2 - l) / m;
  }

  const fitted: number[] = [];
  const residuals: number[] = [];
  const levels: number[] = [];
  const trends: number[] = [];

  for (let t = 0; t < n; t++) {
    const y = series[t];
    const sIdx = t % m;

    // One-step ahead forecast
    const yhat = (l + b) * (seasonal[sIdx] || 1);
    fitted.push(Math.max(0, yhat));
    residuals.push(y - yhat);

    // Update level, trend, seasonal
    const lPrev = l;
    l = alpha * (y / (seasonal[sIdx] || 1)) + (1 - alpha) * (l + b);
    b = beta * (l - lPrev) + (1 - beta) * b;
    seasonal[sIdx] = gamma * (y / (l || 1)) + (1 - gamma) * seasonal[sIdx];

    levels.push(l);
    trends.push(b);
  }

  return {
    level: l,
    trend: b,
    seasonal,
    lastResiduals: residuals.slice(-m),
    params,
    seriesLength: n,
    fitted,
    residuals,
  };
}

/**
 * HoltWintersModel — weekly demand forecasting for delivery slots.
 *
 * Usage:
 *   const model = new HoltWintersModel();
 *   model.fit(dailyOrderCounts);   // Array of daily counts (length ≥ 14)
 *   const fc = model.forecast(7); // Forecast next 7 days
 */
export class HoltWintersModel {
  private state: HoltWintersState | null = null;
  private inSampleRmse = 0;
  private readonly params: HoltWintersParams;

  constructor(params: Partial<HoltWintersParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  /**
   * Fit model to a time series of daily delivery counts.
   * Minimum length: 2 * seasonality period (14 for weekly).
   */
  fit(series: number[]): void {
    if (series.length < this.params.m * 2) {
      return; // Not enough data
    }

    // Guard against all-zero series
    const hasNonZero = series.some((v) => v > 0);
    if (!hasNonZero) return;

    const result = fitHoltWinters(series, this.params);
    this.state = {
      level: result.level,
      trend: result.trend,
      seasonal: result.seasonal,
      lastResiduals: result.lastResiduals,
      params: this.params,
      seriesLength: series.length,
    };

    // In-sample RMSE
    const n = result.residuals.length;
    this.inSampleRmse = Math.sqrt(
      result.residuals.reduce((s, r) => s + r * r, 0) / n,
    );
  }

  /**
   * Forecast h steps ahead.
   */
  forecast(h: number): HoltWintersForecast {
    if (!this.state) {
      return this.emptyForecast(h);
    }

    const { level, trend, seasonal, params: { m } } = this.state;
    const forecast: number[] = [];
    const lower: number[] = [];
    const upper: number[] = [];

    // σ grows with horizon (uncertainty increases)
    const sigma = this.inSampleRmse;

    for (let step = 1; step <= h; step++) {
      const sIdx = (this.state.seriesLength + step - 1) % m;
      const sVal = seasonal[sIdx] || 1;

      const point = Math.max(0, (level + step * trend) * sVal);
      const halfWidth = sigma * Math.sqrt(step); // Proportional uncertainty

      forecast.push(point);
      lower.push(Math.max(0, point - halfWidth));
      upper.push(point + halfWidth);
    }

    return {
      forecast,
      lower,
      upper,
      level: [this.state.level],
      trend: [this.state.trend],
      seasonal: [...this.state.seasonal],
      rmse: this.inSampleRmse,
    };
  }

  /**
   * Forecast demand by hour-of-day for a given date horizon.
   * Distributes daily forecasts across 24 hours using an hourly profile.
   *
   * @param dailySeries - One count per day (historical)
   * @param hourlyProfile - Fraction of daily demand per hour (length 24, sums to 1)
   * @param daysAhead - How many days to forecast
   */
  forecastHourly(
    dailySeries: number[],
    hourlyProfile: number[],
    daysAhead: number,
  ): number[][] {
    this.fit(dailySeries);

    if (!this.state) {
      // Return flat fallback
      const daily = dailySeries.length > 0
        ? dailySeries.reduce((a, b) => a + b, 0) / dailySeries.length
        : 10;
      return Array.from({ length: daysAhead }, () =>
        hourlyProfile.map((p) => daily * p),
      );
    }

    const dailyFc = this.forecast(daysAhead).forecast;

    return dailyFc.map((dayTotal) =>
      hourlyProfile.map((fraction) => dayTotal * fraction),
    );
  }

  get trained(): boolean {
    return this.state !== null;
  }

  get rmse(): number {
    return this.inSampleRmse;
  }

  get seasonalIndices(): number[] {
    return this.state ? [...this.state.seasonal] : [];
  }

  private emptyForecast(h: number): HoltWintersForecast {
    const empty = new Array(h).fill(0);
    return {
      forecast: empty,
      lower: empty,
      upper: empty,
      level: [],
      trend: [],
      seasonal: [],
      rmse: 0,
    };
  }
}

/**
 * Default hourly delivery profile (fraction of daily demand per hour).
 * Peaks at morning (9-10) and evening (17-19) windows.
 */
export const DEFAULT_HOURLY_PROFILE: number[] = [
  0.005, 0.003, 0.002, 0.002, 0.003, 0.008, // 00-05 (night)
  0.020, 0.045, 0.065, 0.075, 0.070, 0.060, // 06-11 (morning peak)
  0.055, 0.055, 0.055, 0.050, 0.045, 0.065, // 12-17 (midday)
  0.075, 0.070, 0.055, 0.040, 0.025, 0.012, // 18-23 (evening peak)
];

// Normalize to sum to 1
const profileSum = DEFAULT_HOURLY_PROFILE.reduce((a, b) => a + b, 0);
for (let i = 0; i < DEFAULT_HOURLY_PROFILE.length; i++) {
  DEFAULT_HOURLY_PROFILE[i] /= profileSum;
}
