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

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);

        // Get POD service from container (in real implementation)
        // const podService = request.server.container.get('podService');
        // const result = await podService.capturePOD(deliveryId, 'photo', imageBuffer);

        // Mock response for now
        const result = {
          success: true,
          data: {
            id: `pod-${deliveryId}-${Date.now()}`,
            deliveryId,
            method: "photo",
            imageUrl: `/uploads/deliveries/${deliveryId}/photos/${Date.now()}.jpg`,
            thumbnailUrl: `/uploads/deliveries/${deliveryId}/photos/${Date.now()}-thumb.jpg`,
            status: "verified",
            capturedAt: new Date().toISOString(),
          },
        };

        return reply.code(201).send(result);
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

        // Get POD service and capture signature
        // const podService = request.server.container.get('podService');
        // const result = await podService.capturePOD(deliveryId, 'signature', payload.signatureData, {
        //   signerName: payload.signerName,
        //   notes: payload.notes,
        // });

        const result = {
          success: true,
          data: {
            id: `pod-sig-${deliveryId}-${Date.now()}`,
            deliveryId,
            method: "signature",
            signerName: payload.signerName,
            signatureUrl: `/uploads/deliveries/${deliveryId}/signatures/${Date.now()}.png`,
            status: "verified",
            signedAt: new Date().toISOString(),
          },
        };

        return reply.code(201).send(result);
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

        // Get POD service and capture QR code
        // const podService = request.server.container.get('podService');
        // const result = await podService.capturePOD(deliveryId, 'qr_scan', payload.scannedData, {
        //   expectedData: payload.expectedData,
        //   fuzzyMatch: payload.fuzzyMatch,
        // });

        const result = {
          success: true,
          data: {
            id: `pod-qr-${deliveryId}-${Date.now()}`,
            deliveryId,
            method: "qr_scan",
            scannedData: payload.scannedData,
            verification: {
              valid:
                payload.scannedData === (payload.expectedData || deliveryId),
              matchPercentage: 100,
            },
            status: "verified",
            scannedAt: new Date().toISOString(),
          },
        };

        return reply.code(201).send(result);
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

        const result = {
          success: true,
          data: {
            id: `pod-barcode-${deliveryId}-${Date.now()}`,
            deliveryId,
            method: "barcode",
            scannedBarcode: payload.scannedBarcode,
            barcodeFormat: payload.format,
            verification: {
              valid:
                payload.scannedBarcode ===
                (payload.expectedBarcode || deliveryId),
            },
            status: "verified",
            scannedAt: new Date().toISOString(),
          },
        };

        return reply.code(201).send(result);
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

        const result = {
          success: true,
          data: {
            id: `pod-manual-${deliveryId}-${Date.now()}`,
            deliveryId,
            method: "manual_confirm",
            confirmedBy: payload.confirmedBy,
            notes: payload.notes,
            status: "verified",
            confirmedAt: new Date().toISOString(),
          },
        };

        return reply.code(201).send(result);
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

        // Get POD service and retrieve records
        // const podService = request.server.container.get('podService');
        // const podRecords = podService.getPOD(deliveryId);

        const podRecords = []; // Mock

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

        // Get timeline service and retrieve events
        // const timelineService = request.server.container.get('deliveryTimelineService');
        // const timeline = timelineService.getTimeline(deliveryId);

        const timeline = []; // Mock

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

        // Get POD service and verify
        // const podService = request.server.container.get('podService');
        // const verification = await podService.verifyPOD(deliveryId);

        const verification = {
          isVerified: true,
          method: "photo",
          verifiedAt: new Date().toISOString(),
          issues: [],
        };

        return reply.code(200).send({
          success: true,
          data: verification,
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
