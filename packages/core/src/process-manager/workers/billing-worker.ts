/**
 * Billing Worker — processes billing-related background jobs.
 *
 * Job types:
 *   • subscription.renew — auto-renew subscription, generate invoice
 *   • subscription.trial_expired — convert or expire trial subscriptions
 *   • invoice.finalize — finalize invoice and attempt payment
 *   • quota.reset — reset monthly quota usage
 *   • invoice.overdue — mark overdue and send reminder
 */

import type { JobResult, WorkerConfig } from "../types.js";
import { BaseWorker } from "../manager.js";

interface BillingJob {
  id: string;
  type:
    | "subscription.renew"
    | "subscription.trial_expired"
    | "invoice.finalize"
    | "quota.reset"
    | "invoice.overdue";
  payload: Record<string, unknown>;
}

/**
 * BillingWorker — handles all billing operations.
 */
export class BillingWorker extends BaseWorker {
  private activeJobs = new Set<string>();

  constructor(prisma: any, redis: any) {
    const config: Partial<WorkerConfig> = {
      name: "billing-worker",
      concurrency: 5,
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 45000,
      enabled: true,
    };
    super(prisma, redis, config);
  }

  /**
   * Process a billing job.
   */
  async processJob(job: BillingJob): Promise<JobResult> {
    const startTime = Date.now();
    const jobId = job.id;

    this.activeJobs.add(jobId);

    try {
      // Validate job structure
      if (!job.type || !job.payload) {
        throw new Error("Invalid billing job structure");
      }

      let result: JobResult;

      switch (job.type) {
        case "subscription.renew":
          result = await this.handleSubscriptionRenew(job.payload);
          break;

        case "subscription.trial_expired":
          result = await this.handleTrialExpired(job.payload);
          break;

        case "invoice.finalize":
          result = await this.handleInvoiceFinalize(job.payload);
          break;

        case "quota.reset":
          result = await this.handleQuotaReset(job.payload);
          break;

        case "invoice.overdue":
          result = await this.handleInvoiceOverdue(job.payload);
          break;

        default:
          throw new Error(`Unknown billing job type: ${job.type}`);
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
   * Handle subscription renewal.
   */
  private async handleSubscriptionRenew(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const subscriptionId = payload.subscriptionId as string;

    if (!subscriptionId) {
      throw new Error("Missing subscriptionId in payload");
    }

    // Fetch subscription from database
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    // Auto-renew logic
    const renewalDate = new Date();
    const newExpiryDate = new Date(renewalDate);

    // Calculate next expiry based on billing cycle
    if (subscription.billingCycle === "monthly") {
      newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
    } else if (subscription.billingCycle === "yearly") {
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
    }

    // Update subscription
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        expiryDate: newExpiryDate,
        renewalCount: { increment: 1 },
        lastRenewalDate: renewalDate,
      },
    });

    // Generate invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        subscriptionId,
        shopId: subscription.shopId,
        amount: subscription.planPrice,
        currency: subscription.currency || "USD",
        status: "generated",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        issuedDate: renewalDate,
      },
    });

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        subscriptionId,
        invoiceId: invoice.id,
        newExpiryDate,
      },
    };
  }

  /**
   * Handle trial expiration.
   */
  private async handleTrialExpired(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const subscriptionId = payload.subscriptionId as string;

    if (!subscriptionId) {
      throw new Error("Missing subscriptionId in payload");
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    // Check conversion preference
    const shouldConvert = payload.autoConvert === true;

    if (shouldConvert) {
      // Auto-convert to paid plan
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "active",
          trialEndDate: new Date(),
          expiryDate,
          planTier: subscription.nextPlanTier || "pro",
        },
      });

      // Create first invoice for converted subscription
      await this.prisma.invoice.create({
        data: {
          subscriptionId,
          shopId: subscription.shopId,
          amount: subscription.planPrice,
          currency: subscription.currency || "USD",
          status: "generated",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          issuedDate: new Date(),
        },
      });

      return {
        success: true,
        processingTimeMs: 0,
        data: {
          subscriptionId,
          action: "converted",
        },
      };
    } else {
      // Expire the trial subscription
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "expired",
          trialEndDate: new Date(),
        },
      });

      return {
        success: true,
        processingTimeMs: 0,
        data: {
          subscriptionId,
          action: "expired",
        },
      };
    }
  }

  /**
   * Handle invoice finalization and payment.
   */
  private async handleInvoiceFinalize(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const invoiceId = payload.invoiceId as string;

    if (!invoiceId) {
      throw new Error("Missing invoiceId in payload");
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // Update invoice status
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "finalized",
        finalizedDate: new Date(),
      },
    });

    // Attempt payment (would integrate with payment processor)
    const paymentAttempted = await this.attemptPayment(invoice);

    return {
      success: paymentAttempted,
      processingTimeMs: 0,
      data: {
        invoiceId,
        paymentAttempted,
      },
    };
  }

  /**
   * Handle monthly quota reset.
   */
  private async handleQuotaReset(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const shopId = payload.shopId as string;

    if (!shopId) {
      throw new Error("Missing shopId in payload");
    }

    // Reset all quota counters for the shop
    const updated = await this.prisma.usageQuota.updateMany({
      where: { shopId },
      data: {
        used: 0,
        resetDate: new Date(),
      },
    });

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        shopId,
        quotasReset: updated.count,
      },
    };
  }

  /**
   * Handle overdue invoices.
   */
  private async handleInvoiceOverdue(
    payload: Record<string, unknown>,
  ): Promise<JobResult> {
    const invoiceId = payload.invoiceId as string;

    if (!invoiceId) {
      throw new Error("Missing invoiceId in payload");
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // Mark as overdue
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "overdue",
        overdueDate: new Date(),
        overdueNotificationsSent: { increment: 1 },
      },
    });

    // Send notification (would use notification service)
    console.log(
      JSON.stringify({
        worker: this.config.name,
        action: "sendOverdueNotification",
        invoiceId,
        shopId: invoice.shopId,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: true,
      processingTimeMs: 0,
      data: {
        invoiceId,
        notificationSent: true,
      },
    };
  }

  /**
   * Attempt payment for an invoice (stub).
   */
  private async attemptPayment(invoice: any): Promise<boolean> {
    // In production, this would call a payment processor
    // For now, simulate success
    return true;
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

      // Wait up to 5 seconds for active jobs to complete
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
