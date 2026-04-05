/**
 * Failed Delivery Worker (WIT-141)
 *
 * Processes auto-return jobs enqueued when a shipment exhausts its
 * maximum delivery attempts.
 *
 * Job: auto-return
 *   1. Guard: skip if shipment is no longer in FAILED state (idempotency)
 *   2. Create a return shipment with number `RET-<originalNumber>`
 *   3. Mark the original shipment as RETURNED atomically
 */

import { Worker } from 'bullmq';
import { prisma } from '@witylogix/db';
import { getQueueConnection, registerWorker } from '../lib/queue.js';
import type { FailedDeliveryJobData } from '../lib/queue.js';

async function processAutoReturn(data: FailedDeliveryJobData): Promise<{ skipped?: boolean; returned?: boolean; returnNumber?: string }> {
  const { shipmentId } = data;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      status: true,
      shipmentNumber: true,
      orderId: true,
      shopId: true,
    },
  });

  if (!shipment) {
    return { skipped: true };
  }

  // Idempotency: if already returned or not in FAILED, skip
  if (shipment.status !== 'FAILED') {
    return { skipped: true };
  }

  const returnNumber = `RET-${shipment.shipmentNumber}`;

  await prisma.$transaction([
    prisma.shipment.create({
      data: {
        shopId: shipment.shopId,
        orderId: shipment.orderId,
        shipmentNumber: returnNumber,
        status: 'RETURNED',
        deliveryMethod: 'LOCAL_DELIVERY',
        metadata: {
          returnedFrom: shipmentId,
          autoReturn: true,
        },
      },
    }),
    prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'RETURNED' },
    }),
  ]);

  return { returned: true, returnNumber };
}

export function startFailedDeliveryWorker(): void {
  const worker = new Worker<FailedDeliveryJobData>(
    'failed-deliveries',
    async (job) => {
      return processAutoReturn(job.data);
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    },
  );

  registerWorker(worker);
}
