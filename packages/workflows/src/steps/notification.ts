/**
 * Notification Step
 * Sends notifications (email/SMS/push) to customer or driver
 * Compensation: no-op (best effort; can't unsend notifications)
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

export interface SendNotificationInput {
  orderId: string;
  recipientType: "CUSTOMER" | "DRIVER" | "SHOP";
  recipientEmail?: string;
  recipientPhone?: string;
  channels: ("EMAIL" | "SMS" | "PUSH")[];
  templateKey: string;
  templateData?: Record<string, any>;
  subject?: string;
}

export interface NotificationLog {
  logId: string;
  orderId: string;
  recipientType: string;
  channel: string;
  status: string;
  sentAt: Date;
}

export interface SendNotificationOutput {
  notificationLogs: NotificationLog[];
  successful: number;
  failed: number;
}

export const sendNotificationStep: WorkflowStep<
  SendNotificationInput,
  SendNotificationOutput
> = {
  name: "sendNotification",
  description: "Send notification to customer/driver",

  async invoke(
    input: SendNotificationInput,
    context: WorkflowContext
  ): Promise<StepResult<SendNotificationOutput>> {
    const logger = context.logger;
    logger?.info("Sending notifications", {
      orderId: input.orderId,
      recipientType: input.recipientType,
      channels: input.channels,
    });

    try {
      const prisma = (context.prisma as any);
      const notificationLogs: NotificationLog[] = [];
      let successful = 0;
      let failed = 0;

      // ─── Validate Input ────────────────────────────────────────────
      if (!input.channels || input.channels.length === 0) {
        return {
          success: false,
          error: "At least one notification channel must be specified",
          code: "NO_CHANNELS",
        };
      }

      const validChannels = ["EMAIL", "SMS", "PUSH"];
      for (const channel of input.channels) {
        if (!validChannels.includes(channel)) {
          return {
            success: false,
            error: `Invalid channel: ${channel}`,
            code: "INVALID_CHANNEL",
          };
        }
      }

      // ─── Determine Recipient Info ──────────────────────────────────
      let recipientData: {
        email?: string;
        phone?: string;
        name?: string;
      } = {};

      if (input.recipientType === "CUSTOMER") {
        // Fetch customer info from order
        const order = await prisma.order.findUnique({
          where: { id: input.orderId },
          select: {
            customerEmail: true,
            customerPhone: true,
            customerName: true,
          },
        });

        if (order) {
          recipientData = {
            email: order.customerEmail || input.recipientEmail,
            phone: order.customerPhone || input.recipientPhone,
            name: order.customerName,
          };
        }
      } else if (input.recipientType === "DRIVER") {
        // Fetch driver info from order
        const order = await prisma.order.findUnique({
          where: { id: input.orderId },
          include: { driver: true },
        });

        if (order?.driver) {
          recipientData = {
            email: order.driver.email || input.recipientEmail,
            phone: order.driver.phone || input.recipientPhone,
            name: order.driver.name,
          };
        }
      }

      // Override with explicit values if provided
      if (input.recipientEmail) {
        recipientData.email = input.recipientEmail;
      }
      if (input.recipientPhone) {
        recipientData.phone = input.recipientPhone;
      }

      // ─── Send via Each Channel ────────────────────────────────────
      for (const channel of input.channels) {
        try {
          let channelSuccess = false;
          let logMessage = "";

          if (channel === "EMAIL" && recipientData.email) {
            // Send email
            channelSuccess = await sendEmail(
              recipientData.email,
              input.subject || input.templateKey,
              input.templateData || {}
            );
            logMessage = `Email sent to ${recipientData.email}`;
          } else if (channel === "SMS" && recipientData.phone) {
            // Send SMS
            channelSuccess = await sendSMS(
              recipientData.phone,
              input.templateKey,
              input.templateData || {}
            );
            logMessage = `SMS sent to ${recipientData.phone}`;
          } else if (channel === "PUSH") {
            // Send push notification
            // Would require FCM token or similar
            channelSuccess = await sendPushNotification(
              input.orderId,
              input.templateKey,
              input.templateData || {}
            );
            logMessage = `Push notification sent for order ${input.orderId}`;
          } else {
            logMessage = `Channel ${channel} not available for this recipient`;
          }

          if (channelSuccess) {
            successful++;
            logger?.info(`Notification sent via ${channel}`, {
              orderId: input.orderId,
              recipient: recipientData.email || recipientData.phone,
            });
          } else {
            failed++;
            logger?.warn(`Notification failed for ${channel}`, {
              orderId: input.orderId,
            });
          }

          // Create notification log
          const log = await prisma.notificationLog.create({
            data: {
              orderId: input.orderId,
              recipientType: input.recipientType,
              channel,
              status: channelSuccess ? "SENT" : "FAILED",
              recipientEmail:
                channel === "EMAIL"
                  ? recipientData.email
                  : undefined,
              recipientPhone:
                channel === "SMS" ? recipientData.phone : undefined,
              templateKey: input.templateKey,
              message: logMessage,
            },
          });

          notificationLogs.push({
            logId: log.id,
            orderId: input.orderId,
            recipientType: input.recipientType,
            channel,
            status: log.status,
            sentAt: log.createdAt,
          });
        } catch (channelError) {
          failed++;
          logger?.error(`${channel} sending failed`, {
            error: channelError instanceof Error ? channelError.message : String(channelError),
          });
        }
      }

      logger?.info("Notification sending completed", {
        orderId: input.orderId,
        successful,
        failed,
      });

      return {
        success: true,
        data: {
          notificationLogs,
          successful,
          failed,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Notification step failed", { error: errorMsg });
      return {
        success: false,
        error: `Notification error: ${errorMsg}`,
        code: "NOTIFICATION_ERROR",
      };
    }
  },

  // No compensation needed — notifications are best-effort
};

/**
 * Mock email sending (integrate with SendGrid, Mailgun, etc.)
 */
async function sendEmail(
  to: string,
  subject: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    // In production: call SendGrid, Mailgun, or similar
    // For now: simulate with logging
    console.log(`[EMAIL] To: ${to}, Subject: ${subject}`, data);
    return true;
  } catch (error) {
    console.error("[EMAIL] Failed:", error);
    return false;
  }
}

/**
 * Mock SMS sending (integrate with Twilio, etc.)
 */
async function sendSMS(
  phone: string,
  templateKey: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    // In production: call Twilio or similar
    const templates: Record<string, string> = {
      ORDER_CONFIRMED: "Your order has been confirmed.",
      OUT_FOR_DELIVERY: "Your delivery is on the way!",
      DELIVERY_ARRIVED: "Your delivery has arrived.",
      DELIVERED: "Your package has been delivered.",
      DELIVERY_FAILED: "Delivery attempt failed. Please contact us.",
    };

    const message = templates[templateKey] || `Notification: ${templateKey}`;
    console.log(`[SMS] To: ${phone}, Message: ${message}`, data);
    return true;
  } catch (error) {
    console.error("[SMS] Failed:", error);
    return false;
  }
}

/**
 * Mock push notification (integrate with Firebase Cloud Messaging, etc.)
 */
async function sendPushNotification(
  orderId: string,
  templateKey: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    // In production: call Firebase Cloud Messaging or similar
    console.log(`[PUSH] OrderId: ${orderId}, TemplateKey: ${templateKey}`, data);
    return true;
  } catch (error) {
    console.error("[PUSH] Failed:", error);
    return false;
  }
}
