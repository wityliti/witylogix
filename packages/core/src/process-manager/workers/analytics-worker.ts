/**
 * Analytics Worker — processes analytics and event tracking jobs.
 *
 * Job types:
 *   • analytics.track — persist tracking event
 *   • analytics.aggregate — run hourly/daily aggregation
 *   • analytics.report — generate scheduled report
 *   • analytics.cleanup — purge old events beyond retention period
 */

import type { JobResult, WorkerConfig } from "../types.js";
import { BaseWorker } from "../manager.js";

interface AnalyticsJob {
  id: string;
  type:
    | "analytics.track"
    | "analytics.aggregate"
    | "analytics.report"
    | "analytics.cleanup";
  payload: Record<string, unknown>;
}

/**
 * AnalyticsWorker — handles event tracking and analytics processing.
 */
export class AnalyticsWorker extends BaseWorker {
  private activeJobs = new Set<string>();
  private eventBuffer: Array<Record<string, unknown>> = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;

  constructor(prisma: any, redis: any) {
    const config: Partial<WorkerConfig> = {
      name: "analytics-worker",
      concurrency: 8,
      maxRetries: 2,
      retryDelay: 1500,
      timeout: 45000,
      enabled: true,
    };
    super(prisma, redis, config);

    // Start buffer flush interval (every 30 seconds)
    if (!this.bufferFlushInterval) {
      this.bufferFlushInterval = setInterval(
        () => this.flushEventBuffer(),
        30000,
      );
    }
  }

  /**
   * Process an analytics job.
   */
  async processJob(job: AnalyticsJob): Promise<JobResult> {
    const startTime = Date.now();
    const jobId = job.id;

    this.activeJobs.add(jobId);

    try {
      if (!job.type || !job.payload) {
        throw new Error("Invalid analytics job structure");
      }

      let result: JobResult;

      switch (job.type) {
        case "analytics.track":
          result = await this.handleAnalyticsTrack(job.payload);
          break;

        case "analytics.aggregate":
          result = await this.handleAnalyticsAggregate(job.payload);
          break;

        case "analytics.report":
          result = await this.handleAnalyticsReport(job.payload);
          break;

        case "analytics.cleanup":
          result = await this.handleAnalyticsCleanup(job.payload);
          break;

        default:
          throw new Error(`Unknown analytics job type: ${job.type}`);
      }

      const processingTimeMs = Date.now() - startTime;

      console.log(
        JSON.stringify({
          worker: this.config.name,
          job: job.type,
          jobId,
          status: "completed",
          processingTimeMs,
          timestamp: new Date().toISOString(),
        }),
      );

      this.recordSuccess();
      return {
        ...result,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(
        JSON.stringify({
          worker: this.config.name,
          job: job.type,
          jobId,
          status: "failed",
          error: errorMsg,
          processingTimeMs,
          timestamp: new Date().toISOString(),
        }),
      );

      this.recordFailure();

      return {
        success: false,
        processingTimeMs,
        error: {
          message: errorMsg,
          retriable: true,
        },
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Handle event tracking.
   */
  private async handleAnalyticsTrack(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const eventName = payload.eventName as string;
    const userId = payload.userId as string;
    const properties = payload.properties as Record<string, unknown>;

    if (!eventName) {
      throw new Error("Missing eventName in payload");
    }

    // Create event record
    const event = {
      eventId: `event_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      eventName,
      userId,
      properties: properties || {},
      timestamp: new Date(),
    };

    // Buffer event for batch persistence
    this.eventBuffer.push(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= 100) {
      await this.flushEventBuffer();
    }

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        eventId: event.eventId,
        eventName,
      },
    };
  }

  /**
   * Handle analytics aggregation (hourly/daily).
   */
  private async handleAnalyticsAggregate(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const aggregationType = payload.aggregationType as string; // hourly, daily
    const shopId = payload.shopId as string;

    if (!aggregationType) {
      throw new Error("Missing aggregationType in payload");
    }

    // Determine time window
    const now = new Date();
    let startTime: Date;

    if (aggregationType === "hourly") {
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
    } else if (aggregationType === "daily") {
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else {
      throw new Error(`Unknown aggregation type: ${aggregationType}`);
    }

    // Fetch events in time window
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        ...(shopId && { shopId }),
        timestamp: {
          gte: startTime,
          lt: now,
        },
      },
    });

    // Aggregate by event name
    const aggregates: Record<string, number> = {};
    for (const event of events) {
      aggregates[event.eventName] =
        (aggregates[event.eventName] || 0) + 1;
    }

    // Store aggregation
    const aggregation = await this.prisma.analyticsAggregation.create({
      data: {
        shopId: shopId || "global",
        aggregationType,
        period: startTime.toISOString(),
        data: aggregates,
        eventCount: events.length,
      },
    });

    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "aggregate",
        aggregationType,
        eventCount: events.length,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        aggregationType,
        eventCount: events.length,
        aggregateId: aggregation.id,
      },
    };
  }

  /**
   * Handle report generation.
   */
  private async handleAnalyticsReport(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const reportType = payload.reportType as string;
    const shopId = payload.shopId as string;
    const period = payload.period as string; // daily, weekly, monthly

    if (!reportType || !period) {
      throw new Error("Missing reportType or period in payload");
    }

    // Determine time window
    const now = new Date();
    let startTime: Date;

    if (period === "daily") {
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === "weekly") {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "monthly") {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      throw new Error(`Unknown period: ${period}`);
    }

    // Fetch aggregated data
    const aggregations = await this.prisma.analyticsAggregation.findMany({
      where: {
        ...(shopId && { shopId }),
        period: {
          gte: startTime.toISOString(),
        },
      },
    });

    // Compile report metrics
    const totalEvents = aggregations.reduce((sum, a) => sum + a.eventCount, 0);
    const uniqueEventTypes = new Set<string>();

    for (const agg of aggregations) {
      Object.keys(agg.data).forEach((key) =>
        uniqueEventTypes.add(key),
      );
    }

    // Create report
    const report = await this.prisma.analyticsReport.create({
      data: {
        shopId: shopId || "global",
        reportType,
        period,
        startDate: startTime,
        endDate: now,
        totalEvents,
        uniqueEventTypes: Array.from(uniqueEventTypes),
        data: {
          aggregations: aggregations.map((a) => ({
            period: a.period,
            data: a.data,
          })),
        },
      },
    });

    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "report",
        reportType,
        period,
        totalEvents,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        reportId: report.id,
        reportType,
        totalEvents,
      },
    };
  }

  /**
   * Handle old event cleanup.
   */
  private async handleAnalyticsCleanup(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const retentionDays = (payload.retentionDays as number) || 90;

    if (retentionDays < 1) {
      throw new Error("Retention period must be at least 1 day");
    }

    // Calculate cutoff date
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    // Delete old events
    const deletedEvents = await this.prisma.analyticsEvent.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    // Delete old aggregations
    const deletedAggregations = await this.prisma.analyticsAggregation.deleteMany({
      where: {
        period: {
          lt: cutoffDate.toISOString(),
        },
      },
    });

    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "cleanup",
        deletedEvents: deletedEvents.count,
        deletedAggregations: deletedAggregations.count,
        retentionDays,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        deletedEvents: deletedEvents.count,
        deletedAggregations: deletedAggregations.count,
        retentionDays,
      },
    };
  }

  /**
   * Flush buffered events to database.
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // Batch insert events
      await this.prisma.analyticsEvent.createMany({
        data: eventsToFlush.map((event) => ({
          eventId: event.eventId,
          eventName: event.eventName,
          userId: event.userId,
          properties: event.properties,
          timestamp: event.timestamp,
        })),
        skipDuplicates: true,
      });

      console.log(
        JSON.stringify({
          worker: this.config.name,
          action: "flushBuffer",
          eventCount: eventsToFlush.length,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      // Put events back in buffer if flush fails
      this.eventBuffer = [...eventsToFlush, ...this.eventBuffer];

      console.error(
        JSON.stringify({
          worker: this.config.name,
          action: "flushBuffer",
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  /**
   * Drain in-flight jobs and flush buffer during shutdown.
   */
  protected async drainJobs(): Promise<void> {
    // Flush remaining buffered events
    await this.flushEventBuffer();

    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }

    if (this.activeJobs.size > 0) {
      console.log(
        JSON.stringify({
          worker: this.config.name,
          action: "drain",
          activeJobs: this.activeJobs.size,
          timestamp: new Date().toISOString(),
        }),
      );

      const startTime = Date.now();
      while (
        this.activeJobs.size > 0 &&
        Date.now() - startTime < 5000
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (this.activeJobs.size > 0) {
        console.warn(
          JSON.stringify({
            worker: this.config.name,
            action: "drain",
            remainingJobs: this.activeJobs.size,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  }
}
