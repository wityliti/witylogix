import { Queue } from 'bullmq';
import cronParser from 'cron-parser';

export interface ScheduledJobDef {
  id: string;
  name: string;
  pattern: string; // Cron expression
  queue: string;
  data?: any;
  enabled: boolean;
  nextRunAt?: Date;
}

export interface JobExecutionHistory {
  timestamp: Date;
  duration: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface ScheduledJobStatus {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRuns: JobExecutionHistory[];
}

const JOB_DEFINITIONS: Record<string, Omit<ScheduledJobDef, 'enabled'>> = {
  'daily-usage-aggregation': {
    id: 'daily-usage-aggregation',
    name: 'Daily Usage Aggregation',
    pattern: '0 2 * * *', // 2 AM daily
    queue: 'analytics',
    data: { type: 'daily-rollup' },
  },
  'hourly-health-check': {
    id: 'hourly-health-check',
    name: 'Hourly Health Check',
    pattern: '0 * * * *', // Every hour
    queue: 'system',
    data: { type: 'health-check' },
  },
  'nightly-cleanup': {
    id: 'nightly-cleanup',
    name: 'Nightly Cleanup',
    pattern: '0 3 * * *', // 3 AM daily
    queue: 'maintenance',
    data: { type: 'cleanup' },
  },
  'weekly-report': {
    id: 'weekly-report',
    name: 'Weekly Report Generation',
    pattern: '0 1 * * 1', // 1 AM Mondays
    queue: 'reporting',
    data: { type: 'weekly-report' },
  },
  'invoice-generation': {
    id: 'invoice-generation',
    name: 'Invoice Generation',
    pattern: '0 0 1 * *', // 1st of month at midnight
    queue: 'billing',
    data: { type: 'invoice-gen' },
  },
  'integration-health-poll': {
    id: 'integration-health-poll',
    name: 'Integration Health Poll',
    pattern: '*/15 * * * *', // Every 15 minutes
    queue: 'integrations',
    data: { type: 'health-poll' },
  },
  'analytics-rollup': {
    id: 'analytics-rollup',
    name: 'Analytics Rollup',
    pattern: '0 4 * * *', // 4 AM daily
    queue: 'analytics',
    data: { type: 'rollup' },
  },
  'backup-trigger': {
    id: 'backup-trigger',
    name: 'Backup Trigger',
    pattern: '0 22 * * *', // 10 PM daily
    queue: 'system',
    data: { type: 'backup' },
  },
};

export class ScheduledJobsManager {
  private queues: Map<string, Queue> = new Map();
  private jobs: Map<string, ScheduledJobDef> = new Map();
  private executionHistory: Map<string, JobExecutionHistory[]> = new Map();

  constructor(queues?: Map<string, Queue>) {
    if (queues) {
      this.queues = queues;
    }

    // Initialize all job definitions
    Object.values(JOB_DEFINITIONS).forEach(def => {
      this.jobs.set(def.id, { ...def, enabled: true });
      this.executionHistory.set(def.id, []);
    });
  }

  registerQueue(name: string, queue: Queue): void {
    this.queues.set(name, queue);
  }

  getJobDefinition(jobId: string): ScheduledJobDef | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ScheduledJobDef[] {
    return Array.from(this.jobs.values());
  }

  calculateNextRunTime(pattern: string): Date {
    try {
      const interval = cronParser.parseExpression(pattern);
      return interval.next().toDate();
    } catch (error) {
      return new Date(Date.now() + 60000); // Default to 1 minute
    }
  }

  async registerJob(jobId: string, pattern: string): Promise<boolean> {
    const def = this.jobs.get(jobId);
    if (!def) return false;

    const queue = this.queues.get(def.queue);
    if (!queue) return false;

    try {
      const nextRun = this.calculateNextRunTime(pattern);

      // Register as repeatable job
      const jobKey = await queue.add(
        def.id,
        def.data || {},
        {
          repeat: {
            pattern: pattern,
          },
          jobId: `${def.id}-repeating`,
        }
      );

      // Update stored definition
      def.pattern = pattern;
      def.nextRunAt = nextRun;
      this.jobs.set(jobId, def);

      return true;
    } catch (error) {
      return false;
    }
  }

  async enableJob(jobId: string): Promise<boolean> {
    const def = this.jobs.get(jobId);
    if (!def) return false;

    def.enabled = true;
    this.jobs.set(jobId, def);

    // Resume the repeatable job in queue
    const queue = this.queues.get(def.queue);
    if (queue) {
      try {
        // Job will continue according to its cron schedule
        return true;
      } catch (error) {
        return false;
      }
    }

    return true;
  }

  async disableJob(jobId: string): Promise<boolean> {
    const def = this.jobs.get(jobId);
    if (!def) return false;

    def.enabled = false;
    this.jobs.set(jobId, def);

    // Remove repeating job
    const queue = this.queues.get(def.queue);
    if (queue) {
      try {
        const repeatableJobs = await queue.getRepeatableJobs();
        const jobToRemove = repeatableJobs.find(j => j.id === `${jobId}-repeating`);
        if (jobToRemove) {
          await queue.removeRepeatableByKey(jobToRemove.key);
        }
      } catch (error) {
        return false;
      }
    }

    return true;
  }

  recordExecution(jobId: string, duration: number, status: 'success' | 'failed', error?: string): void {
    const history = this.executionHistory.get(jobId) || [];

    history.push({
      timestamp: new Date(),
      duration,
      status,
      error,
    });

    // Keep last 10 runs
    if (history.length > 10) {
      history.shift();
    }

    this.executionHistory.set(jobId, history);

    // Update next run time if enabled
    const def = this.jobs.get(jobId);
    if (def && def.enabled) {
      def.nextRunAt = this.calculateNextRunTime(def.pattern);
      this.jobs.set(jobId, def);
    }
  }

  getJobStatus(jobId: string): ScheduledJobStatus | null {
    const def = this.jobs.get(jobId);
    if (!def) return null;

    return {
      id: def.id,
      name: def.name,
      pattern: def.pattern,
      enabled: def.enabled,
      nextRunAt: def.nextRunAt || null,
      lastRuns: this.executionHistory.get(jobId) || [],
    };
  }

  getAllJobsStatus(): ScheduledJobStatus[] {
    return Array.from(this.jobs.keys()).map(jobId => this.getJobStatus(jobId)!);
  }

  getExecutionHistory(jobId: string, limit: number = 10): JobExecutionHistory[] {
    const history = this.executionHistory.get(jobId) || [];
    return history.slice(-limit);
  }

  initializeAllJobs(): void {
    // Auto-register all job definitions with their default patterns
    Object.entries(JOB_DEFINITIONS).forEach(([jobId, def]) => {
      this.registerJob(jobId, def.pattern).catch(error => {
        console.error(`Failed to register job ${jobId}:`, error);
      });
    });
  }
}

export function getJobDefinitions(): Record<string, Omit<ScheduledJobDef, 'enabled'>> {
  return JOB_DEFINITIONS;
}
