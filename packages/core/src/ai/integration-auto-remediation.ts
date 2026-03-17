/**
 * Integration Auto-Remediation Engine
 *
 * AI module for automatic remediation of integration anomalies:
 * - RemediationRecommender: Suggest top 3 actions ranked by effectiveness
 * - AutoRemediationEngine: Execute remediation rules with safety guards
 * - RemediationPlaybook: Predefined playbooks per anomaly type
 * - IncidentPredictor: Predict probability of incident in next 1hr/6hr/24hr
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type RemediationActionType =
  | 'circuit_break'
  | 'failover'
  | 'throttle'
  | 'retry_config_change'
  | 'cache_enable'
  | 'alert_ops'
  | 'credential_rotate'
  | 'provider_restart';

export interface RemediationAction {
  actionId: string;
  actionType: RemediationActionType;
  providerId: string;
  description: string;
  estimatedEffectiveness: number; // 0-1
  estimatedImpact: 'low' | 'medium' | 'high'; // impact on system
  executionTime: number; // milliseconds
  isDestructive: boolean;
  rollbackPossible: boolean;
  prerequisites?: string[];
}

export interface RemediationRecommendation {
  anomalyType: string;
  anomalyScore: number;
  recommendedActions: RemediationAction[];
  rationale: string;
  successProbability: number; // 0-1
  estimatedResolutionTime: number; // seconds
}

export interface RemediationRule {
  ruleId: string;
  anomalyType: string;
  anomalyThreshold: number;
  action: RemediationActionType;
  enabled: boolean;
  requiresApproval: boolean;
  maxExecutionsPerHour: number;
}

export interface PlaybookStep {
  stepId: string;
  description: string;
  action: RemediationActionType;
  checkpoint: boolean;
  maxWaitTime: number; // milliseconds
  successCriteria: string;
  rollbackAction?: RemediationActionType;
}

export interface RemediationPlaybook {
  playbookId: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  steps: PlaybookStep[];
  estimatedDuration: number; // seconds
  successRate: number; // historical 0-1
  lastUpdated: Date;
}

export interface RemediationExecution {
  executionId: string;
  action: RemediationAction;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
  error?: string;
  metricsAfter?: Record<string, number>;
  metricsBefore?: Record<string, number>;
}

export interface IncidentPrediction {
  providerId: string;
  incidentProbability: {
    oneHour: number; // 0-1
    sixHours: number;
    twentyFourHours: number;
  };
  confidenceScore: number; // 0-1
  riskFactors: string[];
  suggestedPreventiveActions: string[];
  predictedSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RemediationMetrics {
  totalExecuted: number;
  successCount: number;
  failureCount: number;
  rolledBackCount: number;
  averageResolutionTime: number; // seconds
  avgEffectiveness: number; // 0-1
}

// ─── REMEDIATION RECOMMENDER ────────────────────────────────────────────────

export class RemediationRecommender {
  private actionRepository: Map<string, RemediationAction[]> = new Map();
  private effectivenessHistory: Map<string, number[]> = new Map();

  constructor() {
    this.initializeActionRepository();
  }

  private initializeActionRepository(): void {
    // Latency anomalies
    this.actionRepository.set('latency_spike', [
      {
        actionId: 'cache_enable_latency',
        actionType: 'cache_enable',
        providerId: '',
        description: 'Enable caching for frequently accessed endpoints',
        estimatedEffectiveness: 0.65,
        estimatedImpact: 'low',
        executionTime: 2000,
        isDestructive: false,
        rollbackPossible: true,
      },
      {
        actionId: 'throttle_latency',
        actionType: 'throttle',
        providerId: '',
        description: 'Reduce request rate to reduce provider load',
        estimatedEffectiveness: 0.50,
        estimatedImpact: 'medium',
        executionTime: 1000,
        isDestructive: false,
        rollbackPossible: true,
      },
      {
        actionId: 'alert_ops_latency',
        actionType: 'alert_ops',
        providerId: '',
        description: 'Alert operations team for manual investigation',
        estimatedEffectiveness: 0.40,
        estimatedImpact: 'low',
        executionTime: 500,
        isDestructive: false,
        rollbackPossible: true,
      },
    ]);

    // Error rate anomalies
    this.actionRepository.set('error_burst', [
      {
        actionId: 'circuit_break_error',
        actionType: 'circuit_break',
        providerId: '',
        description: 'Temporarily break circuit to prevent cascading failures',
        estimatedEffectiveness: 0.80,
        estimatedImpact: 'high',
        executionTime: 1000,
        isDestructive: true,
        rollbackPossible: true,
        prerequisites: ['failover_available'],
      },
      {
        actionId: 'failover_error',
        actionType: 'failover',
        providerId: '',
        description: 'Failover to backup provider',
        estimatedEffectiveness: 0.75,
        estimatedImpact: 'medium',
        executionTime: 3000,
        isDestructive: false,
        rollbackPossible: true,
      },
      {
        actionId: 'retry_config_error',
        actionType: 'retry_config_change',
        providerId: '',
        description: 'Adjust retry policy to reduce load',
        estimatedEffectiveness: 0.55,
        estimatedImpact: 'low',
        executionTime: 500,
        isDestructive: false,
        rollbackPossible: true,
      },
    ]);

    // Volume anomalies
    this.actionRepository.set('traffic_spike', [
      {
        actionId: 'throttle_volume',
        actionType: 'throttle',
        providerId: '',
        description: 'Rate limit incoming requests',
        estimatedEffectiveness: 0.70,
        estimatedImpact: 'medium',
        executionTime: 1000,
        isDestructive: false,
        rollbackPossible: true,
      },
      {
        actionId: 'failover_volume',
        actionType: 'failover',
        providerId: '',
        description: 'Distribute load across multiple providers',
        estimatedEffectiveness: 0.65,
        estimatedImpact: 'low',
        executionTime: 2000,
        isDestructive: false,
        rollbackPossible: true,
      },
    ]);

    // Correlated errors
    this.actionRepository.set('correlated_errors', [
      {
        actionId: 'credential_rotate_correlated',
        actionType: 'credential_rotate',
        providerId: '',
        description: 'Rotate credentials to resolve auth issues',
        estimatedEffectiveness: 0.70,
        estimatedImpact: 'medium',
        executionTime: 5000,
        isDestructive: false,
        rollbackPossible: true,
      },
      {
        actionId: 'provider_restart_correlated',
        actionType: 'provider_restart',
        providerId: '',
        description: 'Restart provider connection',
        estimatedEffectiveness: 0.60,
        estimatedImpact: 'high',
        executionTime: 10000,
        isDestructive: false,
        rollbackPossible: true,
      },
    ]);
  }

  recommend(anomalyType: string, score: number, providerId: string): RemediationRecommendation {
    let baseActions = this.actionRepository.get(anomalyType) || [];

    // Clone and customize for provider
    const actions = baseActions.map((a) => ({
      ...a,
      providerId,
      actionId: `${a.actionId}_${providerId}`,
    }));

    // Sort by effectiveness
    actions.sort((a, b) => b.estimatedEffectiveness - a.estimatedEffectiveness);

    // Get top 3
    const top3 = actions.slice(0, 3);

    // Boost effectiveness based on anomaly score
    const avgEffectiveness = top3.length > 0
      ? top3.reduce((sum, a) => sum + a.estimatedEffectiveness, 0) / top3.length
      : 0;

    const successProbability = Math.min(1, avgEffectiveness * (1 + (score / 100) * 0.2));
    const estimatedResolutionTime = Math.ceil(
      top3.reduce((sum, a) => sum + a.executionTime, 0) / 1000
    );

    return {
      anomalyType,
      anomalyScore: score,
      recommendedActions: top3,
      rationale: `Recommended actions to resolve ${anomalyType}. Top action has ${(top3[0]?.estimatedEffectiveness * 100).toFixed(0)}% effectiveness.`,
      successProbability,
      estimatedResolutionTime,
    };
  }

  trackEffectiveness(anomalyType: string, actionType: RemediationActionType, wasSuccessful: boolean): void {
    const key = `${anomalyType}_${actionType}`;
    if (!this.effectivenessHistory.has(key)) {
      this.effectivenessHistory.set(key, []);
    }
    this.effectivenessHistory.get(key)!.push(wasSuccessful ? 1 : 0);
  }
}

// ─── AUTO REMEDIATION ENGINE ────────────────────────────────────────────────

export class AutoRemediationEngine {
  private rules: Map<string, RemediationRule> = new Map();
  private executionHistory: RemediationExecution[] = [];
  private executionCountPerHour: Map<string, number> = new Map();
  private maxActionsPerHour = 10;
  private cascadeDetectionWindow = 60 * 1000; // 1 minute

  registerRule(rule: RemediationRule): void {
    this.rules.set(rule.ruleId, rule);
  }

  async executeAction(
    action: RemediationAction,
    metricsSnapshot?: Record<string, number>
  ): Promise<RemediationExecution> {
    const execution: RemediationExecution = {
      executionId: `exec_${Date.now()}_${Math.random()}`,
      action,
      startTime: new Date(),
      status: 'pending',
      metricsBefore: metricsSnapshot,
    };

    // Safety check: rate limiting
    const hourKey = `${action.providerId}_${new Date().getHours()}`;
    const count = this.executionCountPerHour.get(hourKey) || 0;

    if (count >= this.maxActionsPerHour) {
      execution.status = 'failed';
      execution.error = 'Rate limit exceeded (max ' + this.maxActionsPerHour + ' per hour)';
      this.executionHistory.push(execution);
      return execution;
    }

    // Check for cascade risk
    if (this.detectCascadeRisk(action)) {
      execution.status = 'failed';
      execution.error = 'Cascade risk detected - action blocked';
      this.executionHistory.push(execution);
      return execution;
    }

    // Execute action
    try {
      execution.status = 'in_progress';
      await this.simulateActionExecution(action);
      execution.status = 'success';
      execution.endTime = new Date();

      this.executionCountPerHour.set(hourKey, count + 1);
    } catch (error) {
      execution.status = 'failed';
      execution.error = String(error);
      execution.endTime = new Date();
    }

    this.executionHistory.push(execution);
    return execution;
  }

  async rollbackAction(executionId: string): Promise<boolean> {
    const execution = this.executionHistory.find((e) => e.executionId === executionId);
    if (!execution || !execution.action.rollbackPossible) {
      return false;
    }

    execution.status = 'rolled_back';
    execution.endTime = new Date();
    return true;
  }

  private detectCascadeRisk(action: RemediationAction): boolean {
    // Check if multiple actions executed recently on related providers
    const recentActions = this.executionHistory.filter(
      (e) =>
        e.startTime.getTime() > Date.now() - this.cascadeDetectionWindow &&
        e.status === 'success'
    );

    // If more than 2 destructive actions in cascade window, flag risk
    const destructiveCount = recentActions.filter((e) => e.action.isDestructive).length;
    return destructiveCount >= 2 && action.isDestructive;
  }

  private async simulateActionExecution(action: RemediationAction): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, action.executionTime);
    });
  }

  getMetrics(): RemediationMetrics {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter((e) => e.status === 'success').length;
    const failed = this.executionHistory.filter((e) => e.status === 'failed').length;
    const rolledBack = this.executionHistory.filter((e) => e.status === 'rolled_back').length;

    const resolutionTimes = this.executionHistory
      .filter((e) => e.endTime && e.status === 'success')
      .map((e) => (e.endTime!.getTime() - e.startTime.getTime()) / 1000);

    const avgResolutionTime =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

    return {
      totalExecuted: total,
      successCount: successful,
      failureCount: failed,
      rolledBackCount: rolledBack,
      averageResolutionTime: avgResolutionTime,
      avgEffectiveness: successful > 0 ? successful / total : 0,
    };
  }
}

// ─── REMEDIATION PLAYBOOK ──────────────────────────────────────────────────

export class RemediationPlaybook {
  private playbooks: Map<string, RemediationPlaybook> = new Map();
  private executionTracker: Map<string, number> = new Map(); // playbookId -> success count

  createPlaybook(playbook: RemediationPlaybook): void {
    this.playbooks.set(playbook.playbookId, playbook);
    this.executionTracker.set(playbook.playbookId, 0);
  }

  getPlaybook(anomalyType: string, severity: string): RemediationPlaybook | null {
    for (const [, playbook] of this.playbooks) {
      if (playbook.anomalyType === anomalyType && playbook.severity === severity) {
        return playbook;
      }
    }
    return null;
  }

  async executePlaybook(
    playbook: RemediationPlaybook,
    providerId: string
  ): Promise<{ success: boolean; failedStep?: string; timeElapsed: number }> {
    const startTime = Date.now();
    let lastSuccessfulStep = -1;

    for (let i = 0; i < playbook.steps.length; i++) {
      const step = playbook.steps[i];

      try {
        // Simulate step execution
        await this.executeStep(step, providerId);
        lastSuccessfulStep = i;

        // If checkpoint, wait for validation
        if (step.checkpoint) {
          const isValid = await this.waitForCheckpoint(step, playbook.steps[i + 1]);
          if (!isValid) {
            // Trigger rollback
            for (let j = lastSuccessfulStep; j >= 0; j--) {
              const prevStep = playbook.steps[j];
              if (prevStep.rollbackAction) {
                await this.executeStep({ ...prevStep, action: prevStep.rollbackAction }, providerId);
              }
            }
            return {
              success: false,
              failedStep: step.stepId,
              timeElapsed: Date.now() - startTime,
            };
          }
        }
      } catch (error) {
        return {
          success: false,
          failedStep: step.stepId,
          timeElapsed: Date.now() - startTime,
        };
      }
    }

    // Mark success
    const successCount = (this.executionTracker.get(playbook.playbookId) || 0) + 1;
    const totalExecutions = this.playbooks.size; // simplified
    playbook.successRate = successCount / Math.max(1, totalExecutions);

    return {
      success: true,
      timeElapsed: Date.now() - startTime,
    };
  }

  private async executeStep(step: Partial<PlaybookStep>, providerId: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  private async waitForCheckpoint(
    step: PlaybookStep,
    nextStep?: PlaybookStep
  ): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, Math.min(step.maxWaitTime, 5000));
    });
  }
}

// ─── INCIDENT PREDICTOR ────────────────────────────────────────────────────

export class IncidentPredictor {
  private trendData: Map<string, number[]> = new Map();
  private anomalyHistory: Map<string, Date[]> = new Map();

  recordMetric(providerId: string, value: number): void {
    if (!this.trendData.has(providerId)) {
      this.trendData.set(providerId, []);
    }
    this.trendData.get(providerId)!.push(value);

    // Keep only last 24 hours
    const data = this.trendData.get(providerId)!;
    if (data.length > 1440) {
      this.trendData.set(providerId, data.slice(-1440));
    }
  }

  recordAnomaly(providerId: string): void {
    if (!this.anomalyHistory.has(providerId)) {
      this.anomalyHistory.set(providerId, []);
    }
    this.anomalyHistory.get(providerId)!.push(new Date());
  }

  predict(providerId: string): IncidentPrediction {
    const trends = this.trendData.get(providerId) || [];
    const anomalies = this.anomalyHistory.get(providerId) || [];

    if (trends.length === 0) {
      return {
        providerId,
        incidentProbability: { oneHour: 0.1, sixHours: 0.15, twentyFourHours: 0.2 },
        confidenceScore: 0.3,
        riskFactors: [],
        suggestedPreventiveActions: [],
      };
    }

    const trend = this.calculateTrend(trends);
    const volatility = this.calculateVolatility(trends);
    const anomalyFrequency = anomalies.filter(
      (a) => a.getTime() > Date.now() - 60 * 60 * 1000
    ).length;

    let prob1h = 0.05;
    let prob6h = 0.1;
    let prob24h = 0.15;

    const riskFactors: string[] = [];

    // Trend-based risk
    if (trend > 0.01) {
      prob1h += 0.15;
      prob6h += 0.25;
      prob24h += 0.30;
      riskFactors.push('Increasing error trend');
    }

    // Volatility-based risk
    if (volatility > 0.3) {
      prob1h += 0.10;
      prob6h += 0.15;
      prob24h += 0.15;
      riskFactors.push('High volatility in metrics');
    }

    // Anomaly frequency
    if (anomalyFrequency >= 2) {
      prob1h += 0.20;
      prob6h += 0.20;
      prob24h += 0.20;
      riskFactors.push(`${anomalyFrequency} anomalies detected in last hour`);
    }

    const avgProb = (prob1h + prob6h + prob24h) / 3;
    const confidence = Math.min(1, trends.length / 100);

    const preventiveActions: string[] = [];
    if (trend > 0) preventiveActions.push('Enable proactive caching');
    if (volatility > 0.3) preventiveActions.push('Increase rate limits');
    if (anomalyFrequency >= 2) preventiveActions.push('Route traffic to backup provider');

    return {
      providerId,
      incidentProbability: {
        oneHour: Math.min(1, prob1h),
        sixHours: Math.min(1, prob6h),
        twentyFourHours: Math.min(1, prob24h),
      },
      confidenceScore: confidence,
      riskFactors,
      suggestedPreventiveActions: preventiveActions,
      predictedSeverity: this.predictSeverity(prob1h, riskFactors.length),
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    return slope;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / (mean || 1);
  }

  private predictSeverity(
    prob: number,
    riskFactorCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (prob > 0.5 && riskFactorCount > 2) return 'critical';
    if (prob > 0.4 && riskFactorCount > 1) return 'high';
    if (prob > 0.25 || riskFactorCount > 1) return 'medium';
    return 'low';
  }
}
