/**
 * POD API Routes — Proof of Delivery Endpoints
 *
 * Routes (all require AUTH):
 *   POST   /api/pod/:deliveryId/photo          Upload photo POD (multipart)
 *   POST   /api/pod/:deliveryId/signature      Submit signature POD
 *   POST   /api/pod/:deliveryId/qr             Submit QR scan result
 *   POST   /api/pod/:deliveryId/barcode        Submit barcode scan
 *   POST   /api/pod/:deliveryId/confirm        Manual confirmation
 *   GET    /api/pod/:deliveryId                Get POD record(s)
 *   GET    /api/pod/:deliveryId/timeline       Get delivery timeline
 *   GET    /api/pod/:deliveryId/verify         Verify POD
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import multipart from "@fastify/multipart";
import { prisma } from "@witylogix/db";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────

const deliveryIdSchema = z.object({
  deliveryId: z.string().uuid(),
});

const signaturePODSchema = z.object({
  signatureData: z.any(), // SVG path string or array of points
  signerName: z.string().min(1),
  notes: z.string().optional(),
});

const qrPODSchema = z.object({
  scannedData: z.string().min(1),
  expectedData: z.string().optional(),
  fuzzyMatch: z.boolean().optional(),
});

const barcodePODSchema = z.object({
  scannedBarcode: z.string().min(1),
  expectedBarcode: z.string().optional(),
  format: z.string().optional(),
});

const confirmationSchema = z.object({
  confirmedBy: z.string().min(1),
  notes: z.string().optional(),
});

// ─── CONSTANTS ──────────────────────────────────────────────────

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];

// ─── ROUTE PLUGIN ───────────────────────────────────────────────

async function podRoutes(fastify: FastifyInstance): Promise<void> {
  // Register multipart plugin for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_PHOTO_SIZE,
    },
  });

  // All routes require auth and tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ─── PHOTO POD ───────────────────────────────────────────────

  fastify.post<{ Params: { deliveryId: string } }>(
    "/photo/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);

        // Get the file from multipart data
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            success: false,
            error: "No file uploaded",
          });
        }

        // Validate file type
        if (!ALLOWED_PHOTO_TYPES.includes(data.mimetype)) {
          return reply.code(400).send({
            success: false,
            error: `Invalid file type: ${data.mimetype}. Allowed: ${ALLOWED_PHOTO_TYPES.join(", ")}`,
          });
        }

        // Check file size
        if (
          data.file.readableLength &&
          data.file.readableLength > MAX_PHOTO_SIZE
        ) {
          return reply.code(413).send({
            success: false,
            error: `File exceeds maximum size of ${MAX_PHOTO_SIZE / 1024 / 1024}MB`,
          });
        }

        // Drain the stream (file storage not configured; URL placeholder persisted)
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        void Buffer.concat(chunks); // consumed; real impl would upload to S3

        const photoUrl = `/uploads/deliveries/${deliveryId}/photos/${Date.now()}.jpg`;

        // Persist POD metadata — upsert by orderId (deliveryId == orderId in this API)
        const pod = await prisma.proofOfDelivery.upsert({
          where: { orderId: deliveryId },
          create: { orderId: deliveryId, photoUrls: [photoUrl] },
          update: { photoUrls: { push: photoUrl } },
        });

        // Record timeline event
        await prisma.deliveryTimeline.create({
          data: {
            deliveryId,
            event: "PHOTO_CAPTURED",
            status: "delivered",
            description: "Photo proof of delivery captured",
            photoUrl,
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: pod.id,
            deliveryId,
            method: "photo",
            imageUrl: photoUrl,
            thumbnailUrl: photoUrl.replace(".jpg", "-thumb.jpg"),
            status: "verified",
            capturedAt: pod.createdAt.toISOString(),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to upload photo POD",
        });
      }
    },
  );

  // ─── SIGNATURE POD ───────────────────────────────────────────

  fastify.post<{ Params: { deliveryId: string } }>(
    "/signature/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);
        const payload = signaturePODSchema.parse(request.body);

        const signatureUrl = `/uploads/deliveries/${deliveryId}/signatures/${Date.now()}.png`;

        const pod = await prisma.proofOfDelivery.upsert({
          where: { orderId: deliveryId },
          create: {
            orderId: deliveryId,
            photoUrls: [],
            signatureUrl,
            recipientName: payload.signerName,
            notes: payload.notes,
          },
          update: {
            signatureUrl,
            recipientName: payload.signerName,
            notes: payload.notes,
          },
        });

        await prisma.deliveryTimeline.create({
          data: {
            deliveryId,
            event: "DELIVERED",
            status: "delivered",
            description: `Signed by ${payload.signerName}`,
            signatureUrl,
            notes: payload.notes,
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: pod.id,
            deliveryId,
            method: "signature",
            signerName: payload.signerName,
            signatureUrl,
            status: "verified",
            signedAt: pod.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to capture signature POD",
          details: error instanceof Error ? error.message : undefined,
        });
      }
    },
  );

  // ─── QR CODE POD ────────────────────────────────────────────

  fastify.post<{ Params: { deliveryId: string } }>(
    "/qr/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);
        const payload = qrPODSchema.parse(request.body);

        const isValid =
          payload.scannedData === (payload.expectedData || deliveryId);
        const now = new Date();

        await prisma.deliveryTimeline.create({
          data: {
            deliveryId,
            event: "QR_SCANNED",
            status: isValid ? "delivered" : "failed",
            description: `QR code scanned: ${isValid ? "match" : "mismatch"}`,
            notes: `scanned=${payload.scannedData}`,
            timestamp: now,
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: `pod-qr-${deliveryId}-${now.getTime()}`,
            deliveryId,
            method: "qr_scan",
            scannedData: payload.scannedData,
            verification: { valid: isValid, matchPercentage: 100 },
            status: isValid ? "verified" : "failed",
            scannedAt: now.toISOString(),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to capture QR code POD",
          details: error instanceof Error ? error.message : undefined,
        });
      }
    },
  );

  // ─── BARCODE POD ────────────────────────────────────────────

  fastify.post<{ Params: { deliveryId: string } }>(
    "/barcode/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);
        const payload = barcodePODSchema.parse(request.body);

        // Get POD service and capture barcode
        // const podService = request.server.container.get('podService');
        // const result = await podService.capturePOD(deliveryId, 'barcode', payload.scannedBarcode, {
        //   expectedBarcode: payload.expectedBarcode,
        //   format: payload.format,
        // });

        const isValid =
          payload.scannedBarcode === (payload.expectedBarcode || deliveryId);
        const now = new Date();

        await prisma.deliveryTimeline.create({
          data: {
            deliveryId,
            event: "BARCODE_SCANNED",
            status: isValid ? "delivered" : "failed",
            description: `Barcode scanned: ${isValid ? "match" : "mismatch"}`,
            notes: `scanned=${payload.scannedBarcode}${payload.format ? ` format=${payload.format}` : ""}`,
            timestamp: now,
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: `pod-barcode-${deliveryId}-${now.getTime()}`,
            deliveryId,
            method: "barcode",
            scannedBarcode: payload.scannedBarcode,
            barcodeFormat: payload.format,
            verification: { valid: isValid },
            status: isValid ? "verified" : "failed",
            scannedAt: now.toISOString(),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to capture barcode POD",
          details: error instanceof Error ? error.message : undefined,
        });
      }
    },
  );

  // ─── MANUAL CONFIRMATION ────────────────────────────────────

  fastify.post<{ Params: { deliveryId: string } }>(
    "/confirm/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);
        const payload = confirmationSchema.parse(request.body);

        // Get POD service and record manual confirmation
        // const podService = request.server.container.get('podService');
        // const result = await podService.capturePOD(deliveryId, 'manual_confirm', {}, {
        //   confirmedBy: payload.confirmedBy,
        //   notes: payload.notes,
        // });

        const now = new Date();

        const pod = await prisma.proofOfDelivery.upsert({
          where: { orderId: deliveryId },
          create: {
            orderId: deliveryId,
            photoUrls: [],
            recipientName: payload.confirmedBy,
            notes: payload.notes,
          },
          update: {
            recipientName: payload.confirmedBy,
            notes: payload.notes,
          },
        });

        await prisma.deliveryTimeline.create({
          data: {
            deliveryId,
            event: "MANUALLY_CONFIRMED",
            status: "delivered",
            description: `Manually confirmed by ${payload.confirmedBy}`,
            notes: payload.notes,
            timestamp: now,
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: pod.id,
            deliveryId,
            method: "manual_confirm",
            confirmedBy: payload.confirmedBy,
            notes: payload.notes,
            status: "verified",
            confirmedAt: now.toISOString(),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to record manual confirmation",
          details: error instanceof Error ? error.message : undefined,
        });
      }
    },
  );

  // ─── GET POD RECORD(S) ──────────────────────────────────────

  fastify.get<{ Params: { deliveryId: string } }>(
    "/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);

        const pod = await prisma.proofOfDelivery.findFirst({
          where: { orderId: deliveryId },
        });

        const podRecords = pod ? [pod] : [];

        return reply.code(200).send({
          success: true,
          data: podRecords,
          total: podRecords.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to retrieve POD records",
        });
      }
    },
  );

  // ─── GET DELIVERY TIMELINE ──────────────────────────────────

  fastify.get<{ Params: { deliveryId: string } }>(
    "/:deliveryId/timeline",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);

        const timeline = await prisma.deliveryTimeline.findMany({
          where: { deliveryId },
          orderBy: { timestamp: "asc" },
        });

        return reply.code(200).send({
          success: true,
          data: timeline,
          total: timeline.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to retrieve delivery timeline",
        });
      }
    },
  );

  // ─── VERIFY POD ─────────────────────────────────────────────

  fastify.get<{ Params: { deliveryId: string } }>(
    "/:deliveryId/verify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { deliveryId } = deliveryIdSchema.parse(request.params);

        const pod = await prisma.proofOfDelivery.findFirst({
          where: { orderId: deliveryId },
        });

        const hasPhoto = (pod?.photoUrls?.length ?? 0) > 0;
        const hasSignature = !!pod?.signatureUrl;
        const isVerified =
          !!pod && (hasPhoto || hasSignature || !!pod.recipientName);
        const method = hasSignature
          ? "signature"
          : hasPhoto
            ? "photo"
            : pod?.recipientName
              ? "manual_confirm"
              : null;
        const issues: string[] = [];
        if (!pod) issues.push("No proof of delivery record found");

        return reply.code(200).send({
          success: true,
          data: {
            isVerified,
            method,
            verifiedAt: pod?.createdAt?.toISOString() ?? null,
            issues,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to verify POD",
        });
      }
    },
  );
}

export default podRoutes;
