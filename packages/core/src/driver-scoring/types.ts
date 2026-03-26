/**
 * Driver Performance Scoring Types
 * Defines all data structures for driver metrics, scores, and leaderboards
 */

export interface DriverMetrics {
  driverId: string;
  tenantId: string;
  totalDeliveries: number;
  onTimeCount: number;
  lateCount: number;
  avgDeliveryMinutes: number;
  customerRatingSum: number;
  customerRatingCount: number;
  podComplianceCount: number;
  podMissedCount: number;
  routeEfficiencySum: number; // sum of actual/optimal distance ratios
  incidentCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface ScoreBreakdown {
  onTimeScore: number;
  customerRatingScore: number;
  podComplianceScore: number;
  routeEfficiencyScore: number;
  reliabilityScore: number;
}

export interface DriverScore {
  driverId: string;
  tenantId: string;
  compositeScore: number; // 0-100
  breakdown: ScoreBreakdown;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  rank: number; // optional rank in leaderboard context
  trend: 'up' | 'down' | 'stable';
  previousScore: number | null;
  calculatedAt: Date;
}

export interface ScoringWeights {
  onTime: number; // default 0.30
  customerRating: number; // default 0.25
  podCompliance: number; // default 0.15
  routeEfficiency: number; // default 0.15
  reliability: number; // default 0.15
}

export interface DriverLeaderboardEntry extends DriverScore {
  driverName: string;
  avatar: string | null;
  deliveriesThisPeriod: number;
}

export type ScoringPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardResponse {
  period: ScoringPeriod;
  tenantId: string;
  generatedAt: Date;
  entries: DriverLeaderboardEntry[];
  totalDrivers: number;
}
