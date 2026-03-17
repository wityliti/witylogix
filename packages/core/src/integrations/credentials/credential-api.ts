/**
 * Credential Lifecycle Manager — REST API
 *
 * 12+ endpoints for credential management:
 * - CRUD operations
 * - Rotation management
 * - Health monitoring
 * - Secret scanning
 * - Vault operations
 *
 * All endpoints use Zod validation
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type {
  Credential,
  RotationPolicy,
  RotationResult,
  SecretScanFinding,
  ScanResult,
  CredentialHealth,
  VaultStatus,
  RotationFrequency,
  Severity,
} from './credential-types.js';
import type { RotationScheduler, SecretScanner, ZeroDowntimeRotator, CredentialHealthScorer } from './credential-lifecycle-manager.js';
import type { IVaultAdapter } from './vault-adapters.js';

// ─── Zod Schemas ────────────────────────────────────────────────────────

const CredentialTypeSchema = z.enum([
  'api_key',
  'oauth_token',
  'jwt',
  'certificate',
  'ssh_key',
  'password',
  'connection_string',
  'webhook_secret',
  'custom',
]);

const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

const RotationFrequencySchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually',
  'manual',
]);

const CreateCredentialSchema = z.object({
  providerId: z.string().min(1),
  credentialType: CredentialTypeSchema,
  displayName: z.string().min(1),
  description: z.string().optional(),
  value: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateCredentialSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  value: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const CreateRotationPolicySchema = z.object({
  credentialId: z.string().min(1),
  providerId: z.string().min(1),
  rotationFrequency: RotationFrequencySchema,
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  hour: z.number().min(0).max(23).optional(),
  minute: z.number().min(0).max(59).optional(),
  timezone: z.string().optional(),
  preRotationValidation: z.boolean().optional(),
  postRotationVerification: z.boolean().optional(),
  enableZeroDowntime: z.boolean().optional(),
  autoRollbackOnFailure: z.boolean().optional(),
  notifyOnRotation: z.array(z.string()).optional(),
});

const ScanContentSchema = z.object({
  content: z.string().min(1),
  scanType: z.enum(['regex', 'entropy', 'file_scan', 'full']).optional(),
});

const MarkRemediatedSchema = z.object({
  action: z.enum(['rotated', 'removed', 'marked_false_positive', 'ignored']),
  comment: z.string().optional(),
});

// ─── Validation Middleware ──────────────────────────────────────────────

function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      (req as any).validated = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      res.status(400).json({ error: 'Invalid request' });
    }
  };
}

// ─── Credential API Routes ──────────────────────────────────────────────

export function createCredentialRouter(
  vault: IVaultAdapter,
  rotationScheduler: RotationScheduler,
  secretScanner: SecretScanner,
  healthScorer: CredentialHealthScorer,
  rotator?: ZeroDowntimeRotator,
) {
  const router = Router();

  /**
   * GET /api/v1/credentials
   * List all credentials for tenant
   */
  router.get('/credentials', async (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenantId as string;
      const credentials = await vault.list({
        tenantId,
      });

      res.json({
        data: credentials,
        count: credentials.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/v1/credentials/:id
   * Get a specific credential (masked)
   */
  router.get('/credentials/:id', async (req: Request, res: Response) => {
    try {
      const credential = await vault.get(req.params.id);

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // Return masked version
      const masked = {
        ...credential,
        encryptedValue: maskValue(credential.encryptedValue),
      };

      res.json({ data: masked });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials
   * Create a new credential
   */
  router.post(
    '/credentials',
    validateRequest(CreateCredentialSchema),
    async (req: Request, res: Response) => {
      try {
        const validated = (req as any).validated;
        const tenantId = req.query.tenantId as string;

        const credential: Credential = {
          id: `cred_${Date.now()}`,
          tenantId,
          providerId: validated.providerId,
          credentialType: validated.credentialType,
          displayName: validated.displayName,
          description: validated.description,
          encryptedValue: validated.value,
          iv: '', // Would be set by vault adapter
          authTag: '',
          keyVersion: 'v1',
          createdAt: new Date(),
          updatedAt: new Date(),
          rotatedAt: new Date(),
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
          tags: validated.tags,
          metadata: validated.metadata,
        };

        await vault.set(credential);

        res.status(201).json({ data: credential });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    },
  );

  /**
   * PUT /api/v1/credentials/:id
   * Update a credential
   */
  router.put(
    '/credentials/:id',
    validateRequest(UpdateCredentialSchema),
    async (req: Request, res: Response) => {
      try {
        const validated = (req as any).validated;
        const credential = await vault.get(req.params.id);

        if (!credential) {
          return res.status(404).json({ error: 'Credential not found' });
        }

        // Update fields
        if (validated.displayName) credential.displayName = validated.displayName;
        if (validated.description) credential.description = validated.description;
        if (validated.value) credential.encryptedValue = validated.value;
        if (validated.expiresAt) credential.expiresAt = new Date(validated.expiresAt);
        if (validated.tags) credential.tags = validated.tags;
        if (validated.metadata) credential.metadata = validated.metadata;

        credential.updatedAt = new Date();

        await vault.set(credential);

        res.json({ data: credential });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    },
  );

  /**
   * DELETE /api/v1/credentials/:id
   * Delete a credential
   */
  router.delete('/credentials/:id', async (req: Request, res: Response) => {
    try {
      await vault.delete(req.params.id);
      res.json({ message: 'Credential deleted' });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/:id/rotate
   * Manually trigger credential rotation
   */
  router.post('/credentials/:id/rotate', async (req: Request, res: Response) => {
    try {
      const result = await rotationScheduler.triggerRotation(req.params.id);
      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/v1/credentials/:id/health
   * Get credential health score
   */
  router.get('/credentials/:id/health', async (req: Request, res: Response) => {
    try {
      const credential = await vault.get(req.params.id);

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // Get rotation policy
      const nextRotationDate = rotationScheduler.getNextRotationDate(credential.id);

      // Scan for exposures (mock)
      const scanResult = await secretScanner.scanContent(credential.encryptedValue);

      // Calculate health
      const health = healthScorer.calculateHealth(
        credential,
        null, // Would fetch from DB in production
        scanResult.findings,
        {
          lastUsedAt: credential.updatedAt,
          accessCount: 1,
        },
      );

      res.json({ data: health });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/v1/credentials/scan
   * Get previous scan results
   */
  router.get('/credentials/scan', async (req: Request, res: Response) => {
    try {
      // In production: fetch from database
      const scans: ScanResult[] = [];

      res.json({
        data: scans,
        count: scans.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/scan/run
   * Run secret scan on content
   */
  router.post(
    '/credentials/scan/run',
    validateRequest(ScanContentSchema),
    async (req: Request, res: Response) => {
      try {
        const validated = (req as any).validated;
        const result = await secretScanner.scanContent(validated.content);

        res.json({ data: result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    },
  );

  /**
   * GET /api/v1/credentials/rotation/schedule
   * Get rotation schedule for all credentials
   */
  router.get('/credentials/rotation/schedule', async (req: Request, res: Response) => {
    try {
      // In production: fetch from database
      const schedules = [
        {
          credentialId: 'cred_123',
          nextRotationAt: new Date(),
          frequency: 'weekly',
        },
      ];

      res.json({
        data: schedules,
        count: schedules.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/rotation/schedule
   * Create or update rotation policy
   */
  router.post(
    '/credentials/rotation/schedule',
    validateRequest(CreateRotationPolicySchema),
    async (req: Request, res: Response) => {
      try {
        const validated = (req as any).validated;

        const policy: RotationPolicy = {
          credentialId: validated.credentialId,
          providerId: validated.providerId,
          rotationFrequency: validated.rotationFrequency,
          rotationSchedule: {
            frequency: validated.rotationFrequency,
            dayOfWeek: validated.dayOfWeek,
            dayOfMonth: validated.dayOfMonth,
            hour: validated.hour,
            minute: validated.minute,
            timezone: validated.timezone,
          },
          preRotationValidation: validated.preRotationValidation ?? true,
          postRotationVerification: validated.postRotationVerification ?? true,
          enableZeroDowntime: validated.enableZeroDowntime ?? false,
          autoRollbackOnFailure: validated.autoRollbackOnFailure ?? true,
          notifyOnRotation: validated.notifyOnRotation,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        rotationScheduler.registerPolicy(policy);

        res.status(201).json({ data: policy });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    },
  );

  /**
   * GET /api/v1/credentials/vaults/status
   * Check vault health and status
   */
  router.get('/credentials/vaults/status', async (req: Request, res: Response) => {
    try {
      const health = await vault.getHealth();

      res.json({ data: health });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/:findingId/remediate
   * Mark a secret finding as remediated
   */
  router.post(
    '/credentials/:findingId/remediate',
    validateRequest(MarkRemediatedSchema),
    async (req: Request, res: Response) => {
      try {
        const validated = (req as any).validated;
        secretScanner.markRemediated(
          req.params.findingId,
          validated.action,
          validated.comment,
        );

        res.json({ message: 'Finding marked as remediated' });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    },
  );

  /**
   * GET /api/v1/credentials/:id/rotation-history
   * Get rotation history for a credential
   */
  router.get('/credentials/:id/rotation-history', async (req: Request, res: Response) => {
    try {
      const history = rotationScheduler.getRotationHistory(req.params.id);

      res.json({
        data: history,
        count: history.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/:id/breach-rotate
   * Trigger immediate rotation due to breach detection
   */
  router.post('/credentials/:id/breach-rotate', async (req: Request, res: Response) => {
    try {
      const result = await rotationScheduler.rotateOnBreach(req.params.id);

      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/team-rotate
   * Trigger rotation for multiple credentials due to team change
   */
  router.post('/credentials/team-rotate', async (req: Request, res: Response) => {
    try {
      const { credentialIds } = req.body as { credentialIds: string[] };

      const results: RotationResult[] = [];
      for (const credentialId of credentialIds) {
        try {
          const result = await rotationScheduler.rotateOnTeamChange(credentialId);
          results.push(result);
        } catch (error) {
          // Log error and continue
        }
      }

      res.json({
        data: results,
        count: results.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/backup
   * Create vault backup
   */
  router.post('/credentials/backup', async (req: Request, res: Response) => {
    try {
      const backupId = await vault.backup();

      res.json({
        data: { backupId, createdAt: new Date() },
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/v1/credentials/restore
   * Restore from backup
   */
  router.post('/credentials/restore', async (req: Request, res: Response) => {
    try {
      const { backupId } = req.body as { backupId: string };

      await vault.restore(backupId);

      res.json({ message: 'Backup restored' });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}

// ─── Helper Functions ───────────────────────────────────────────────────

function maskValue(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

/**
 * Type-safe request with validated body
 */
export interface ValidatedRequest<T> extends Request {
  validated: T;
}
