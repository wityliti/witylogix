/**
 * Event scheduler consumer — processes scheduled/recurring event triggers.
 *
 * Flow:
 *   1. Validate event trigger configuration
 *   2. Check if trigger conditions are met
 *   3. Execute associated action (notification, report, status update, etc.)
 *   4. Reschedule recurring events for next occurrence
 *   5. Track execution history and outcomes
 */

import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  EventSchedulerJob,
} from "../types.js";
import {
  QueueConsumer,
  QueueValidationError,
  QueueTransientError,
  QueuePermanentError,
} from "../consumer.js";
import type { ConsumerConfig } from "../types.js";

/**
 * Supported action types for scheduled events.
 */
export type ScheduledActionType =
  | "send_notification"
  | "send_sms"
  | "generate_report"
  | "update_status"
  | "cleanup_data"
  | "sync_data"
  | "custom_webhook";

/**
 * Event scheduler consumer implementation.
 */
export class EventSchedulerConsumer extends QueueConsumer {
  constructor(config: ConsumerConfig) {
    super(config);
  }

  /**
   * Validate event scheduler payload.
   *
   * @param job Job payload
   * @throws QueueValidationError if validation fails
   */
  protected async validateJob(job: QueueJobPayload): Promise<void> {
    await super.validateJob(job);

    if (job.type !== "event_scheduler") {
      throw new QueueValidationError(
        `Expected event_scheduler, got ${job.type}`,
      );
    }

    const { data } = job as {
      type: "event_scheduler";
      data: EventSchedulerJob;
    };

    if (!data.eventId || !data.eventType) {
      throw new QueueValidationError(
        "EventSchedulerJob missing eventId or eventType",
      );
    }

    const { payload } = data;
    if (!payload.triggerId || !payload.triggerType || !payload.actionType) {
      throw new QueueValidationError(
        "Payload missing triggerId, triggerType, or actionType",
      );
    }

    // Validate trigger type
    const validTriggers = ["cron", "interval", "at", "once"];
    if (!validTriggers.includes(payload.triggerType)) {
      throw new QueueValidationError(
        `Invalid triggerType: ${payload.triggerType}`,
      );
    }
  }

  /**
   * Process scheduled event — execute action and reschedule if needed.
   *
   * @param job Event scheduler job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  async process(
    job: QueueJobPayload,
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job as {
      type: "event_scheduler";
      data: EventSchedulerJob;
    };
    const { companyId, eventId, eventType, payload } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[EventSchedulerConsumer] Processing scheduled event ${eventId} (${eventType})`,
      );

      // Step 1: Check trigger conditions
      const shouldExecute = await this.checkTriggerConditions(
        eventId,
        payload,
      );

      if (!shouldExecute) {
        console.log(
          `[EventSchedulerConsumer] Event ${eventId} trigger conditions not met`,
        );
        const processingTimeMs = Date.now() - metadata.processingStartedAt!;
        return {
          success: true,
          jobId,
          processingTimeMs,
          data: { eventId, skipped: true },
        };
      }

      // Step 2: Execute the associated action
      const actionResult = await this.executeAction(
        companyId,
        eventType,
        payload,
      );

      // Step 3: Record execution in history
      await this.recordExecution(eventId, actionResult);

      // Step 4: Reschedule if recurring
      if (
        payload.triggerType !== "once" &&
        payload.recurrence
      ) {
        await this.rescheduleEvent(
          companyId,
          eventId,
          payload,
        );
      }

      // Calculate processing time
      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          eventId,
          actionType: payload.actionType,
          executed: true,
          result: actionResult,
        },
      };
    } catch (error) {
      if (error instanceof QueueValidationError) {
        throw new QueuePermanentError(
          `Invalid event configuration: ${error.message}`,
          { eventId },
        );
      }

      if (
        error instanceof Error &&
        error.message.includes("execution")
      ) {
        // Transient execution errors should be retried
        throw new QueueTransientError(
          `Error executing action: ${error.message}`,
          { eventId, actionType: payload.actionType },
        );
      }

      throw new QueueTransientError(
        `Error processing event: ${error instanceof Error ? error.message : String(error)}`,
        { eventId },
      );
    }
  }

  /**
   * Check if event trigger conditions are met.
   *
   * @param eventId Event identifier
   * @param payload Event payload
   * @returns True if trigger should fire
   */
  private async checkTriggerConditions(
    eventId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<boolean> {
    try {
      console.log(
        `[EventSchedulerConsumer] Checking trigger conditions for ${eventId}`,
      );

      // TODO: Fetch trigger configuration from database
      // const trigger = await prisma.eventTrigger.findUnique({
      //   where: { id: payload.triggerId },
      // });
      //
      // if (!trigger) {
      //   throw new QueueValidationError("Trigger not found");
      // }
      //
      // Evaluate trigger conditions based on trigger type
      // For now, always return true
      await this.simulateAsyncOperation(20);

      return true;
    } catch (error) {
      if (error instanceof QueueValidationError) {
        throw error;
      }

      throw new QueueTransientError(
        `Error checking trigger conditions: ${error instanceof Error ? error.message : String(error)}`,
        { eventId, triggerId: payload.triggerId },
      );
    }
  }

  /**
   * Execute the scheduled action.
   *
   * @param companyId Company identifier
   * @param eventType Event type
   * @param payload Event payload
   * @returns Action execution result
   */
  private async executeAction(
    companyId: string,
    eventType: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    try {
      console.log(
        `[EventSchedulerConsumer] Executing action: ${payload.actionType}`,
      );

      const actionType = payload.actionType as ScheduledActionType;

      switch (actionType) {
        case "send_notification":
          return await this.executeSendNotification(
            companyId,
            payload,
          );

        case "send_sms":
          return await this.executeSendSMS(companyId, payload);

        case "generate_report":
          return await this.executeGenerateReport(
            companyId,
            payload,
          );

        case "update_status":
          return await this.executeUpdateStatus(
            companyId,
            payload,
          );

        case "cleanup_data":
          return await this.executeCleanupData(companyId, payload);

        case "sync_data":
          return await this.executeSyncData(companyId, payload);

        case "custom_webhook":
          return await this.executeCustomWebhook(
            companyId,
            payload,
          );

        default:
          throw new QueuePermanentError(
            `Unknown action type: ${actionType}`,
          );
      }
    } catch (error) {
      throw new QueueTransientError(
        `Action execution failed: ${error instanceof Error ? error.message : String(error)}`,
        { actionType: payload.actionType },
      );
    }
  }

  /**
   * Execute send notification action.
   */
  private async executeSendNotification(
    companyId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    console.log(
      `[EventSchedulerConsumer] Sending notification for company ${companyId}`,
    );

    // TODO: Queue notification job
    // const notificationPayload = payload.actionPayload as {
    //   templateId: string;
    //   recipientIds: string[];
    //   templateData: Record<string, unknown>;
    // };
    //
    // for (const recipientId of notificationPayload.recipientIds) {
    //   await notificationQueue.add({
    //     type: "notification",
    //     data: {
    //       shopId: companyId,
    //       channel: "email",
    //       payload: {
    //         templateId: notificationPayload.templateId,
    //         recipientId,
    //         templateData: notificationPayload.templateData,
    //       },
    //     },
    //   });
    // }

    await this.simulateAsyncOperation(40);

    return { sent: true, recipients: 0 };
  }

  /**
   * Execute send SMS action.
   */
  private async executeSendSMS(
    companyId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    console.log(
      `[EventSchedulerConsumer] Sending SMS for company ${companyId}`,
    );

    // TODO: Send SMS via notification service
    await this.simulateAsyncOperation(35);

    return { sent: true, messageCount: 0 };
  }

  /**
   * Execute generate report action.
   */
  private async executeGenerateReport(
    companyId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    console.log(
      `[EventSchedulerConsumer] Generating report for company ${companyId}`,
    );

    // TODO: Generate report and store/send
    // const reportConfig = payload.actionPayload as {
    //   reportType: string;
    //   dateRange: { start: string; end: string };
    //   recipients?: string[];
    // };
    //
    // const reportData = await generateReport(
    //   companyId,
    //   reportConfig.reportType,
    //   reportConfig.dateRange,
    // );
    //
    // const savedReport = await prisma.report.create({
    //   data: {
    //     companyId,
    //     type: reportConfig.reportType,
    //     data: reportData,
    //     generatedAt: new Date(),
    //   },
    // });

    await this.simulateAsyncOperation(60);

    return { generated: true, reportId: "rpt_123" };
  }

  /**
   * Execute update status action.
   */
  private async executeUpdateStatus(
    companyId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    console.log(
      `[EventSchedulerConsumer] Updating status for company ${companyId}`,
    );

    // TODO: Update entity status based on configuration
    // const statusConfig = payload.actionPayload as {
    //   entityType: string;
    //   query: Record<string, unknown>;
    //   newStatus: string;
    // };

    await this.simulateAsyncOperation(30);

    return { updated: true, count: 0 };
  }

  /**
   * Execute cleanup data action.
   */
  private async executeCleanupData(
    companyId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    console.log(
      `[EventSchedulerConsumer] Cleaning up data for company ${companyId}`,
    );

    // TODO: Execute data cleanup based on retention policies
    // const cleanupConfig = payload.actionPayload as {
    //   dataType: string;
    //   olderThanDays: number;
    // };

    await this.simulateAsyncOperation(45);

    return { cleaned: true, recordsDeleted: 0 };
  }

  /**
   * Execute sync data action.
   */
  private async executeSyncData(
    companyId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    console.log(
      `[EventSchedulerConsumer] Syncing data for company ${companyId}`,
    );

    // TODO: Trigger data sync with external systems
    await this.simulateAsyncOperation(55);

    return { synced: true, recordsProcessed: 0 };
  }

  /**
   * Execute custom webhook action.
   */
  private async executeCustomWebhook(
    companyId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<Record<string, unknown>> {
    console.log(
      `[EventSchedulerConsumer] Calling custom webhook for company ${companyId}`,
    );

    // TODO: Call customer webhook with event payload
    // const webhookConfig = payload.actionPayload as {
    //   url: string;
    //   method: "GET" | "POST" | "PUT";
    //   headers?: Record<string, string>;
    //   body?: Record<string, unknown>;
    // };
    //
    // const response = await fetch(webhookConfig.url, {
    //   method: webhookConfig.method,
    //   headers: webhookConfig.headers,
    //   body: JSON.stringify(webhookConfig.body),
    // });

    await this.simulateAsyncOperation(50);

    return { called: true, statusCode: 200 };
  }

  /**
   * Record execution in event history for audit trail.
   *
   * @param eventId Event identifier
   * @param result Action execution result
   */
  private async recordExecution(
    eventId: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    try {
      console.log(
        `[EventSchedulerConsumer] Recording execution for event ${eventId}`,
      );

      // TODO: Store execution record in database
      // await prisma.eventExecution.create({
      //   data: {
      //     eventId,
      //     executedAt: new Date(),
      //     result,
      //     status: "success",
      //   },
      // });

      await this.simulateAsyncOperation(15);
    } catch (error) {
      console.error(
        `[EventSchedulerConsumer] Error recording execution:`,
        error,
      );
      // Don't fail the job for execution recording errors
    }
  }

  /**
   * Reschedule recurring event for next occurrence.
   *
   * @param companyId Company identifier
   * @param eventId Event identifier
   * @param payload Event payload
   */
  private async rescheduleEvent(
    companyId: string,
    eventId: string,
    payload: EventSchedulerJob["payload"],
  ): Promise<void> {
    try {
      if (!payload.recurrence) {
        return;
      }

      console.log(
        `[EventSchedulerConsumer] Rescheduling event ${eventId}`,
      );

      const nextExecution = this.calculateNextExecution(payload);

      // TODO: Queue next occurrence
      // await schedulerQueue.add(
      //   {
      //     eventId,
      //     eventType: "scheduled",
      //     payload,
      //   },
      //   {
      //     delay: nextExecution.getTime() - Date.now(),
      //   },
      // );

      console.log(
        `[EventSchedulerConsumer] Event ${eventId} rescheduled for ${nextExecution.toISOString()}`,
      );

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[EventSchedulerConsumer] Error rescheduling event:`,
        error,
      );
      // Don't fail the job for rescheduling errors
    }
  }

  /**
   * Calculate next execution time for recurring event.
   *
   * @param payload Event payload
   * @returns Next execution date
   */
  private calculateNextExecution(
    payload: EventSchedulerJob["payload"],
  ): Date {
    if (!payload.recurrence) {
      return new Date();
    }

    const now = new Date();
    const interval = payload.recurrence.interval || 1;

    let nextExecution: Date;

    switch (payload.recurrence.unit) {
      case "minutes":
        nextExecution = new Date(
          now.getTime() + interval * 60 * 1000,
        );
        break;

      case "hours":
        nextExecution = new Date(
          now.getTime() + interval * 60 * 60 * 1000,
        );
        break;

      case "days":
        nextExecution = new Date(
          now.getTime() + interval * 24 * 60 * 60 * 1000,
        );
        break;

      case "weeks":
        nextExecution = new Date(
          now.getTime() + interval * 7 * 24 * 60 * 60 * 1000,
        );
        break;

      default:
        nextExecution = new Date(
          now.getTime() + interval * 60 * 1000,
        );
    }

    // Check if next execution exceeds end date
    if (
      payload.recurrence.endDate &&
      nextExecution >
        new Date(payload.recurrence.endDate)
    ) {
      nextExecution = new Date(payload.recurrence.endDate);
    }

    return nextExecution;
  }

  /**
   * Simulate async operation for testing (remove in production).
   *
   * @param ms Milliseconds to wait
   */
  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
