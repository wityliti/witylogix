/**
 * Campaign Worker — processes campaign execution jobs.
 *
 * Job types:
 *   • campaign.start — begin sending a scheduled campaign
 *   • campaign.batch — process a batch of recipients
 *   • campaign.complete — finalize campaign and compute stats
 *   • campaign.cancel — abort in-progress campaign
 */

import type { JobResult, WorkerConfig } from "../types.js";
import { BaseWorker } from "../manager.js";

interface CampaignJob {
  id: string;
  type:
    | "campaign.start"
    | "campaign.batch"
    | "campaign.complete"
    | "campaign.cancel";
  payload: Record<string, unknown>;
}

/**
 * CampaignWorker — handles campaign execution and delivery.
 */
export class CampaignWorker extends BaseWorker {
  private activeJobs = new Set<string>();
  private batchProcessing = new Map<string, boolean>();

  constructor(prisma: any, redis: any) {
    const config: Partial<WorkerConfig> = {
      name: "campaign-worker",
      concurrency: 3,
      maxRetries: 2,
      retryDelay: 3000,
      timeout: 60000,
      enabled: true,
    };
    super(prisma, redis, config);
  }

  /**
   * Process a campaign job.
   */
  async processJob(job: CampaignJob): Promise<JobResult> {
    const startTime = Date.now();
    const jobId = job.id;

    this.activeJobs.add(jobId);

    try {
      if (!job.type || !job.payload) {
        throw new Error("Invalid campaign job structure");
      }

      let result: JobResult;

      switch (job.type) {
        case "campaign.start":
          result = await this.handleCampaignStart(job.payload);
          break;

        case "campaign.batch":
          result = await this.handleCampaignBatch(job.payload);
          break;

        case "campaign.complete":
          result = await this.handleCampaignComplete(job.payload);
          break;

        case "campaign.cancel":
          result = await this.handleCampaignCancel(job.payload);
          break;

        default:
          throw new Error(`Unknown campaign job type: ${job.type}`);
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
   * Handle campaign start.
   */
  private async handleCampaignStart(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const campaignId = payload.campaignId as string;

    if (!campaignId) {
      throw new Error("Missing campaignId in payload");
    }

    // Fetch campaign
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Update campaign status
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "running",
        startedAt: new Date(),
        sentCount: 0,
        failedCount: 0,
      },
    });

    // Fetch recipients for this campaign
    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { id: true, email: true, phone: true, data: true },
    });

    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "campaignStart",
        campaignId,
        recipientCount: recipients.length,
        timestamp: new Date().toISOString(),
      }),
    );

    // Queue batches for processing
    const batchSize = 100;
    const batchCount = Math.ceil(recipients.length / batchSize);

    for (let i = 0; i < batchCount; i++) {
      const batchId = `${campaignId}_batch_${i}`;
      // In production, would queue batch jobs to message queue
      console.log(
        JSON.stringify({
          worker: this.config.name,
          action: "queueBatch",
          campaignId,
          batchId,
          batchIndex: i,
          batchSize,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        campaignId,
        recipientCount: recipients.length,
        batchCount,
      },
    };
  }

  /**
   * Handle campaign batch processing.
   */
  private async handleCampaignBatch(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const campaignId = payload.campaignId as string;
    const batchIndex = payload.batchIndex as number;

    if (!campaignId || batchIndex === undefined) {
      throw new Error("Missing campaignId or batchIndex in payload");
    }

    const batchId = `${campaignId}_batch_${batchIndex}`;

    // Prevent concurrent batch processing of same batch
    if (this.batchProcessing.has(batchId)) {
      throw new Error(`Batch ${batchId} already being processed`);
    }

    this.batchProcessing.set(batchId, true);

    try {
      // Fetch campaign and recipients for this batch
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const batchSize = 100;
      const skip = batchIndex * batchSize;

      const recipients = await this.prisma.campaignRecipient.findMany({
        where: { campaignId },
        skip,
        take: batchSize,
        select: { id: true, email: true, phone: true, data: true },
      });

      let sentCount = 0;
      let failedCount = 0;

      // Send to each recipient
      for (const recipient of recipients) {
        try {
          // Route based on campaign channel
          const sent = await this.sendCampaignMessage(campaign, recipient);

          if (sent) {
            sentCount++;
            await this.prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "sent", sentAt: new Date() },
            });
          } else {
            failedCount++;
            await this.prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "failed" },
            });
          }
        } catch (error) {
          failedCount++;
        }
      }

      // Update campaign stats
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: sentCount },
          failedCount: { increment: failedCount },
        },
      });

      return {
        success: true,
        processingTimeMs: 0,
        data: {
          campaignId,
          batchId,
          sentCount,
          failedCount,
        },
      };
    } finally {
      this.batchProcessing.delete(batchId);
    }
  }

  /**
   * Handle campaign completion.
   */
  private async handleCampaignComplete(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const campaignId = payload.campaignId as string;

    if (!campaignId) {
      throw new Error("Missing campaignId in payload");
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Calculate final stats
    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId },
    });

    const sentCount = recipients.filter((r) => r.status === "sent").length;
    const failedCount = recipients.filter((r) => r.status === "failed").length;
    const openCount = recipients.filter((r) => r.opened).length;
    const clickCount = recipients.filter((r) => r.clicked).length;

    const openRate = sentCount > 0 ? (openCount / sentCount) * 100 : 0;
    const clickRate = sentCount > 0 ? (clickCount / sentCount) * 100 : 0;

    // Update campaign with final stats
    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "completed",
        completedAt: new Date(),
        sentCount,
        failedCount,
        openCount,
        clickCount,
        openRate,
        clickRate,
      },
    });

    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "campaignComplete",
        campaignId,
        sentCount,
        failedCount,
        openRate,
        clickRate,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        campaignId,
        sentCount,
        failedCount,
        openRate,
        clickRate,
      },
    };
  }

  /**
   * Handle campaign cancellation.
   */
  private async handleCampaignCancel(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const campaignId = payload.campaignId as string;

    if (!campaignId) {
      throw new Error("Missing campaignId in payload");
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Cancel the campaign
    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
      },
    });

    // Mark unsent recipients as cancelled
    await this.prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: { in: ["pending", "queued"] },
      },
      data: {
        status: "cancelled",
      },
    });

    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "campaignCancel",
        campaignId,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        campaignId,
        action: "cancelled",
      },
    };
  }

  /**
   * Send campaign message to a recipient (stub).
   */
  private async sendCampaignMessage(
    campaign: any,
    recipient: any,
  ): Promise<boolean> {
    // In production, would integrate with messaging service
    // For now, simulate success with 95% rate
    return Math.random() < 0.95;
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
      while (this.activeJobs.size > 0 && Date.now() - startTime < 5000) {
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
