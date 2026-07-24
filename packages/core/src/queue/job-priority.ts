export enum PriorityLevel {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
  BACKGROUND = 5,
}

export interface PriorityConfig {
  level: PriorityLevel;
  timeout?: number; // ms before escalating priority
  maxEscalations?: number;
}

// Default priority mapping per job type
const JOB_PRIORITY_MAP: Record<string, PriorityLevel> = {
  // Critical jobs
  "payment-processing": PriorityLevel.CRITICAL,
  "emergency-alert": PriorityLevel.CRITICAL,
  "security-incident": PriorityLevel.CRITICAL,

  // High priority
  "invoice-generation": PriorityLevel.HIGH,
  "report-generation": PriorityLevel.HIGH,
  "user-notification": PriorityLevel.HIGH,
  "integration-sync": PriorityLevel.HIGH,

  // Normal priority (default)
  "email-send": PriorityLevel.NORMAL,
  "data-export": PriorityLevel.NORMAL,
  "webhook-delivery": PriorityLevel.NORMAL,

  // Low priority
  "analytics-aggregation": PriorityLevel.LOW,
  cleanup: PriorityLevel.LOW,
  "cache-warm": PriorityLevel.LOW,

  // Background jobs
  backup: PriorityLevel.BACKGROUND,
  optimization: PriorityLevel.BACKGROUND,
  maintenance: PriorityLevel.BACKGROUND,
};

const TIMEOUT_BY_PRIORITY: Record<PriorityLevel, number> = {
  [PriorityLevel.CRITICAL]: 1000, // Escalate after 1 second
  [PriorityLevel.HIGH]: 5000, // Escalate after 5 seconds
  [PriorityLevel.NORMAL]: 30000, // Escalate after 30 seconds
  [PriorityLevel.LOW]: 120000, // Escalate after 2 minutes
  [PriorityLevel.BACKGROUND]: 300000, // Escalate after 5 minutes
};

const STARVATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class JobPriority {
  private priorityMap: Map<string, PriorityLevel>;
  private jobWaitTimes: Map<string, number> = new Map();

  constructor(customPriorityMap?: Record<string, PriorityLevel>) {
    this.priorityMap = new Map(
      Object.entries({
        ...JOB_PRIORITY_MAP,
        ...(customPriorityMap || {}),
      }),
    );
  }

  getPriority(jobType: string): PriorityLevel {
    return this.priorityMap.get(jobType) || PriorityLevel.NORMAL;
  }

  setPriority(jobType: string, priority: PriorityLevel): void {
    this.priorityMap.set(jobType, priority);
  }

  /**
   * Get the current priority for a job, considering escalation
   */
  getCurrentPriority(jobType: string, createdAt: number): PriorityLevel {
    const basePriority = this.getPriority(jobType);
    const waitTimeMs = Date.now() - createdAt;

    // Check if job should be escalated due to starvation prevention
    if (
      basePriority === PriorityLevel.BACKGROUND &&
      waitTimeMs > STARVATION_TIMEOUT_MS
    ) {
      return PriorityLevel.LOW;
    }

    if (
      basePriority === PriorityLevel.LOW &&
      waitTimeMs > STARVATION_TIMEOUT_MS
    ) {
      return PriorityLevel.NORMAL;
    }

    // Dynamic escalation based on wait time
    const timeoutThreshold = TIMEOUT_BY_PRIORITY[basePriority];
    if (waitTimeMs > timeoutThreshold) {
      return this.escalatePriority(basePriority);
    }

    return basePriority;
  }

  /**
   * Escalate priority to next level (lower number = higher priority)
   */
  private escalatePriority(currentPriority: PriorityLevel): PriorityLevel {
    switch (currentPriority) {
      case PriorityLevel.BACKGROUND:
        return PriorityLevel.LOW;
      case PriorityLevel.LOW:
        return PriorityLevel.NORMAL;
      case PriorityLevel.NORMAL:
        return PriorityLevel.HIGH;
      case PriorityLevel.HIGH:
        return PriorityLevel.CRITICAL;
      case PriorityLevel.CRITICAL:
        return PriorityLevel.CRITICAL;
      default:
        return currentPriority;
    }
  }

  /**
   * Track job creation time for starvation prevention
   */
  recordJobCreation(jobId: string, createdAt: number): void {
    this.jobWaitTimes.set(jobId, createdAt);
  }

  /**
   * Remove job from tracking
   */
  removeJobTracking(jobId: string): void {
    this.jobWaitTimes.delete(jobId);
  }

  /**
   * Check if a job is at risk of starvation
   */
  isStarving(jobId: string, jobType: string): boolean {
    const createdAt = this.jobWaitTimes.get(jobId);
    if (!createdAt) return false;

    const waitTimeMs = Date.now() - createdAt;
    return waitTimeMs > STARVATION_TIMEOUT_MS;
  }

  /**
   * Get all jobs at risk of starvation
   */
  getStarvingJobs(jobType: string, threshold?: number): string[] {
    const checkThreshold = threshold || STARVATION_TIMEOUT_MS;
    const starvingJobs: string[] = [];

    for (const [jobId, createdAt] of this.jobWaitTimes.entries()) {
      if (Date.now() - createdAt > checkThreshold) {
        starvingJobs.push(jobId);
      }
    }

    return starvingJobs;
  }

  /**
   * Get priority configuration for job type
   */
  getPriorityConfig(jobType: string): PriorityConfig {
    const level = this.getPriority(jobType);
    return {
      level,
      timeout: TIMEOUT_BY_PRIORITY[level],
      maxEscalations: level === PriorityLevel.CRITICAL ? 0 : 3,
    };
  }

  /**
   * Batch prioritize jobs - sort by current priority
   */
  prioritizeJobs(
    jobs: Array<{ id: string; type: string; createdAt: number }>,
  ): Array<{
    id: string;
    type: string;
    createdAt: number;
    priority: PriorityLevel;
  }> {
    return jobs
      .map((job) => ({
        ...job,
        priority: this.getCurrentPriority(job.type, job.createdAt),
      }))
      .sort((a, b) => a.priority - b.priority); // Lower number = higher priority
  }

  /**
   * Get priority statistics
   */
  getPriorityStats(): Record<PriorityLevel, number> {
    const stats: Record<PriorityLevel, number> = {
      [PriorityLevel.CRITICAL]: 0,
      [PriorityLevel.HIGH]: 0,
      [PriorityLevel.NORMAL]: 0,
      [PriorityLevel.LOW]: 0,
      [PriorityLevel.BACKGROUND]: 0,
    };

    for (const priority of Object.values(this.priorityMap)) {
      stats[priority]++;
    }

    return stats;
  }
}
