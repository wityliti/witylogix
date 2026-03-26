/**
 * BullMQ queue definitions and connection management.
 *
 * All queues share a Redis connection and are tenant-aware:
 * - Each job includes shopId for RLS context
 * - Job groups ensure fair processing across tenants
 *
 * Queues:
 *   notifications  — email, SMS, WhatsApp, push notifications
 *   optimization   — route optimization (CPU-intensive, separate concurrency)
 *   webhooks       — outbound webhook delivery with retries
 *   maintenance    — scheduled cleanup, cache warming, analytics
 */
import { Queue, Worker } from "bullmq";
export declare function getNotificationQueue(): Queue;
export declare function getOptimizationQueue(): Queue;
export declare function getWebhookQueue(): Queue;
export declare function getMaintenanceQueue(): Queue;
export interface NotificationJobData {
    shopId: string;
    orderId: string;
    eventType: string;
    channels: Array<"EMAIL" | "SMS" | "WHATSAPP" | "PUSH">;
    recipient: {
        email?: string;
        phone?: string;
        fcmToken?: string;
    };
    templateData: Record<string, unknown>;
}
export interface OptimizationJobData {
    shopId: string;
    routeId: string;
    depot: {
        lat: number;
        lng: number;
        address?: string;
    };
    orderIds: string[];
    vehicleIds: string[];
    options?: {
        timeLimit?: number;
        returnToDepot?: boolean;
    };
}
export interface WebhookJobData {
    shopId: string;
    url: string;
    topic: string;
    payload: Record<string, unknown>;
}
export declare function registerWorker(worker: Worker): void;
export declare function shutdownQueues(): Promise<void>;
//# sourceMappingURL=queue.d.ts.map