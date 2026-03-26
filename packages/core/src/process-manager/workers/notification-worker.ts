/**
 * Notification Worker — processes notification delivery jobs.
 *
 * Job types:
 *   • notification.send — dispatch single notification via messaging dispatcher
 *   • notification.batch — batch send (up to 100 per job)
 *   • notification.retry — retry failed notification with backoff
 *   • notification.digest — compile digest notification for user
 */

import type { JobResult, WorkerConfig } from "../types.js";
import { BaseWorker } from "../manager.js";

interface NotificationJob {
  id: string;
  type:
    | "notification.send"
    | "notification.batch"
    | "notification.retry"
    | "notification.digest";
  payload: Record<string, unknown>;
}

/**
 * NotificationWorker — handles notification delivery across channels.
 */
export class NotificationWorker extends BaseWorker {
  private activeJobs = new Set<string>();
  private retryAttempts = new Map<string, number>();

  constructor(prisma: any, redis: any) {
    const config: Partial<WorkerConfig> = {
      name: "notification-worker",
      concurrency: 10,
      maxRetries: 4,
      retryDelay: 1000,
      timeout: 30000,
      enabled: true,
    };
    super(prisma, redis, config);
  }

  /**
   * Process a notification job.
   */
  async processJob(job: NotificationJob): Promise<JobResult> {
    const startTime = Date.now();
    const jobId = job.id;

    this.activeJobs.add(jobId);

    try {
      if (!job.type || !job.payload) {
        throw new Error("Invalid notification job structure");
      }

      let result: JobResult;

      switch (job.type) {
        case "notification.send":
          result = await this.handleNotificationSend(job.payload);
          break;

        case "notification.batch":
          result = await this.handleNotificationBatch(job.payload);
          break;

        case "notification.retry":
          result = await this.handleNotificationRetry(job.payload);
          break;

        case "notification.digest":
          result = await this.handleNotificationDigest(job.payload);
          break;

        default:
          throw new Error(`Unknown notification job type: ${job.type}`);
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
   * Handle single notification send.
   */
  private async handleNotificationSend(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const notificationId = payload.notificationId as string;
    const channel = payload.channel as string;
    const recipient = payload.recipient as string;

    if (!notificationId || !channel || !recipient) {
      throw new Error("Missing required fields: notificationId, channel, recipient");
    }

    // Fetch notification
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    // Send based on channel
    const sent = await this.dispatchNotification(notification, channel, recipient);

    if (!sent) {
      throw new Error(`Failed to dispatch notification via ${channel}`);
    }

    // Update notification status
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "sent",
        sentAt: new Date(),
        channel,
      },
    });

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        notificationId,
        channel,
        sent: true,
      },
    };
  }

  /**
   * Handle batch notification send.
   */
  private async handleNotificationBatch(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const batchId = payload.batchId as string;
    const templateId = payload.templateId as string;
    const recipients = payload.recipients as Array<{
      id: string;
      address: string;
      data: Record<string, unknown>;
    }>;

    if (!batchId || !templateId || !Array.isArray(recipients)) {
      throw new Error("Missing required fields: batchId, templateId, recipients");
    }

    // Limit batch size
    const limitedRecipients = recipients.slice(0, 100);

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of limitedRecipients) {
      try {
        const sent = await this.dispatchNotification(
          { templateId },
          "email",
          recipient.address,
        );

        if (sent) {
          sentCount++;
          // Create notification record
          await this.prisma.notification.create({
            data: {
              notificationId: `batch_${batchId}_${recipient.id}`,
              templateId,
              recipientId: recipient.id,
              channel: "email",
              status: "sent",
              sentAt: new Date(),
            },
          });
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
      }
    }

    return {
      success: sentCount > 0,
      processingTimeMs: 0,
      data: {
        batchId,
        sentCount,
        failedCount,
        totalCount: limitedRecipients.length,
      },
    };
  }

  /**
   * Handle notification retry.
   */
  private async handleNotificationRetry(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const notificationId = payload.notificationId as string;
    const channel = payload.channel as string;
    const recipient = payload.recipient as string;

    if (!notificationId || !channel || !recipient) {
      throw new Error("Missing required fields");
    }

    // Get retry attempt count
    const attempts = this.retryAttempts.get(notificationId) || 0;

    if (attempts >= this.config.maxRetries) {
      // Max retries exceeded, mark as failed
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "failed",
          failureReason: "Max retries exceeded",
        },
      });

      return {
        success: false,
        processingTimeMs: 0,
        error: {
          message: "Max retries exceeded",
          retriable: false,
        },
      };
    }

    // Attempt to send
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const sent = await this.dispatchNotification(
      notification,
      channel,
      recipient,
    );

    if (sent) {
      this.retryAttempts.delete(notificationId);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });

      return {
        success: true,
        processingTimeMs: 0,
        data: {
          notificationId,
          attempt: attempts + 1,
        },
      };
    } else {
      // Increment retry count and schedule another retry
      this.retryAttempts.set(notificationId, attempts + 1);

      throw new Error(
        `Notification retry failed (attempt ${attempts + 1}/${this.config.maxRetries})`,
      );
    }
  }

  /**
   * Handle digest notification compilation.
   */
  private async handleNotificationDigest(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const userId = payload.userId as string;
    const digestType = payload.digestType as string; // daily, weekly

    if (!userId || !digestType) {
      throw new Error("Missing required fields: userId, digestType");
    }

    // Fetch pending notifications for user
    const pendingNotifications = await this.prisma.notification.findMany({
      where: {
        userId,
        status: "pending",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      take: 50,
    });

    if (pendingNotifications.length === 0) {
      return {
        success: true,
        processingTimeMs: 0,
        data: {
          userId,
          itemCount: 0,
        },
      };
    }

    // Compile digest
    const digest = {
      userId,
      digestType,
      itemCount: pendingNotifications.length,
      items: pendingNotifications.map((n) => ({
        title: n.title,
        content: n.content,
        timestamp: n.createdAt,
      })),
    };

    // Create digest notification
    const digestNotification = await this.prisma.notification.create({
      data: {
        notificationId: `digest_${userId}_${Date.now()}`,
        userId,
        title: `Your ${digestType} digest`,
        content: `You have ${digest.itemCount} notifications`,
        channel: "email",
        status: "pending",
      },
    });

    // Send digest
    const sent = await this.dispatchNotification(
      digestNotification,
      "email",
      "", // Would fetch user email
    );

    if (sent) {
      // Mark original notifications as digested
      await this.prisma.notification.updateMany({
        where: { id: { in: pendingNotifications.map((n) => n.id) } },
        data: { status: "digested" },
      });
    }

    return {
      success: sent,
      processingTimeMs: 0,
      data: {
        userId,
        itemCount: pendingNotifications.length,
        digestSent: sent,
      },
    };
  }

  /**
   * Dispatch notification via channel.
   */
  private async dispatchNotification(
    notification: any,
    channel: string,
    recipient: string,
  ): Promise<boolean> {
    // In production, would integrate with messaging service
    // For now, simulate success with 90% rate
    if (!recipient) {
      return false;
    }

    const success = Math.random() < 0.9;

    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "dispatch",
        channel,
        recipient: recipient.substring(0, 5) + "***",
        success,
        timestamp: new Date().toISOString(),
      }),
    );

    return success;
  }

  /**
   * Drain in-flight jobs during shutdown.
   */
  protected async drainJobs(): Promise<void> {
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
