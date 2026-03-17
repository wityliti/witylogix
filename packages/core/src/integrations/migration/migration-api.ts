/**
 * Migration API — REST endpoints for managing migrations, shadow mode, and documentation.
 *
 * Provides 12+ endpoints for migration management, validation, docs access, and troubleshooting.
 */

import { Router } from "express";
import { z } from "zod";
import {
  DataMapperService,
  MigrationTracker,
  MigrationValidator,
  ProviderSwapEngine,
  RollbackManager,
  ShadowModeRunner,
} from "./migration-toolkit";
import {
  AutoDocGenerator,
  ConfigurationGuideGenerator,
  RateLimitReference,
  TroubleshootingPlaybooks,
  WebhookCatalog,
} from "../docs/documentation-engine";

// ─── Zod Schemas for Validation ─────────────────────────────────

const CreateMigrationSchema = z.object({
  sourceProvider: z.string().min(1, "Source provider required"),
  targetProvider: z.string().min(1, "Target provider required"),
  targetCredentials: z.record(z.unknown()).optional(),
});

const FieldMappingSchema = z.object({
  sourceField: z.string(),
  targetField: z.string(),
  sourceType: z.string(),
  targetType: z.string(),
  required: z.boolean().default(true),
  transform: z.string().optional(),
});

const ShadowModeConfigSchema = z.object({
  trafficPercentage: z.number().min(1).max(100),
  durationMs: z.number().positive().optional(),
  maxRequests: z.number().positive().optional(),
  acceptableMatchRate: z.number().min(0).max(100).default(95),
  acceptableLatencyDeltaMs: z.number().positive().default(500),
});

const CutoverSchema = z.object({
  migrationId: z.string(),
  dryRun: z.boolean().default(false),
});

const RollbackSchema = z.object({
  migrationId: z.string(),
  partialEndpoints: z.array(z.string()).optional(),
});

const ValidationSchema = z.object({
  migrationId: z.string(),
  stage: z.enum(["pre", "during", "post"]),
});

// ─── API Router ────────────────────────────────────────────────

export function createMigrationAPI(): Router {
  const router = Router();

  // Initialize services
  const swapEngine = new ProviderSwapEngine();
  const dataMapper = new DataMapperService();
  const shadowMode = new ShadowModeRunner();
  const rollback = new RollbackManager();
  const validator = new MigrationValidator();
  const tracker = new MigrationTracker();

  // Documentation services
  const docGenerator = new AutoDocGenerator();
  const webhookCatalog = new WebhookCatalog();
  const rateLimits = new RateLimitReference();
  const troubleshooting = new TroubleshootingPlaybooks();
  const configGuide = new ConfigurationGuideGenerator();

  // Store migrations in memory (in real impl, use database)
  const migrations: Map<string, any> = new Map();

  // ─── Migration Management ──────────────────────────────────

  /**
   * POST /migrations
   * Create a new migration
   */
  router.post("/migrations", async (req, res) => {
    try {
      const input = CreateMigrationSchema.parse(req.body);

      // Validate compatibility
      const compat = swapEngine.validateCompatibility(
        input.sourceProvider,
        input.targetProvider
      );

      if (!compat.compatible) {
        return res.status(400).json({
          error: "Incompatible providers",
          missingCapabilities: compat.missingCapabilities,
          warnings: compat.warnings,
        });
      }

      // Define mapping
      const mapping = swapEngine.defineMapping(
        input.sourceProvider,
        input.targetProvider
      );

      // Check prerequisites
      const prereqs = swapEngine.checkPrerequisites(
        mapping,
        input.targetCredentials || {}
      );

      if (!prereqs.valid) {
        return res.status(400).json({
          error: "Prerequisites not met",
          errors: prereqs.errors,
        });
      }

      // Initialize tracker
      const migrationTracker = tracker.initializeTracker(
        mapping.migrationId,
        mapping
      );

      migrations.set(mapping.migrationId, {
        mapping,
        tracker: migrationTracker,
        shadowMode: shadowMode,
        validator: validator,
      });

      res.status(201).json({
        migrationId: mapping.migrationId,
        sourceProvider: input.sourceProvider,
        targetProvider: input.targetProvider,
        status: "PLANNED",
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /migrations
   * List all migrations
   */
  router.get("/migrations", (req, res) => {
    const migrationsList = Array.from(migrations.values()).map((m) => ({
      migrationId: m.mapping.migrationId,
      sourceProvider: m.mapping.sourceProvider,
      targetProvider: m.mapping.targetProvider,
      status: m.tracker.status,
      createdAt: m.tracker.createdAt.toISOString(),
      progress: {
        totalRequests: m.tracker.metrics.totalRequests,
        successfulRequests: m.tracker.metrics.successfulRequests,
        errorRate: m.tracker.metrics.errorRate,
      },
    }));

    res.json({
      total: migrationsList.length,
      migrations: migrationsList,
    });
  });

  /**
   * GET /migrations/:id
   * Get migration details
   */
  router.get("/migrations/:id", (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    const trackerState = migration.tracker.getTracker();

    res.json({
      migrationId: migration.mapping.migrationId,
      sourceProvider: migration.mapping.sourceProvider,
      targetProvider: migration.mapping.targetProvider,
      status: trackerState?.status,
      metrics: trackerState?.metrics,
      events: trackerState?.events.slice(-10),
      createdAt: trackerState?.createdAt.toISOString(),
      updatedAt: trackerState?.updatedAt.toISOString(),
    });
  });

  /**
   * PUT /migrations/:id
   * Update migration (e.g., add field mappings)
   */
  router.put("/migrations/:id", async (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    try {
      const { fieldMappings } = req.body;

      if (fieldMappings && Array.isArray(fieldMappings)) {
        const mappings = fieldMappings.map((fm: any) =>
          FieldMappingSchema.parse(fm)
        );

        const dataMapperConfig = dataMapper.generateDataMapper(
          migration.mapping.migrationId,
          migration.mapping,
          mappings
        );

        migration.tracker.dataMapper = dataMapperConfig;
        migration.tracker.transitionStatus("MAPPING", {
          fieldCount: mappings.length,
          schemaValid: dataMapperConfig.schemaValid,
        });

        const diff = dataMapper.generateDiff(dataMapperConfig);

        res.json({
          migrationId: migration.mapping.migrationId,
          mappingSummary: {
            mappedFields: mappings.length,
            unmappedFields: diff.unmappedFields,
            typeConflicts: diff.typeConflicts,
            schemaValid: dataMapperConfig.schemaValid,
          },
        });
      } else {
        res.status(400).json({ error: "Invalid request format" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: String(error) });
    }
  });

  // ─── Shadow Mode ────────────────────────────────────────

  /**
   * POST /migrations/:id/shadow/start
   * Start shadow mode execution
   */
  router.post("/migrations/:id/shadow/start", async (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    try {
      const config = ShadowModeConfigSchema.parse(req.body);

      migration.tracker.transitionStatus("SHADOW", {
        config,
      });

      // In real implementation, start async shadow mode execution
      // For now, just confirm it started
      res.json({
        migrationId: migration.mapping.migrationId,
        status: "SHADOW",
        config,
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /migrations/:id/shadow/stop
   * Stop shadow mode execution
   */
  router.post("/migrations/:id/shadow/stop", (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    migration.tracker.transitionStatus("CUTOVER", {
      shadowComplete: true,
    });

    res.json({
      migrationId: migration.mapping.migrationId,
      status: "CUTOVER",
      stoppedAt: new Date().toISOString(),
    });
  });

  /**
   * GET /migrations/:id/shadow/results
   * Get shadow mode comparison results
   */
  router.get("/migrations/:id/shadow/results", (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    const results = migration.shadowMode.getShadowResults();

    res.json({
      migrationId: migration.mapping.migrationId,
      shadowResults: {
        totalComparisons: results.totalComparisons,
        passingComparisons: results.passingComparisons,
        passRate: results.totalComparisons > 0
          ? (results.passingComparisons / results.totalComparisons) * 100
          : 0,
        avgMatchRate: results.avgMatchRate,
        avgSourceLatency: results.avgSourceLatency,
        avgTargetLatency: results.avgTargetLatency,
        criticalDifferences: results.criticalDifferences,
      },
    });
  });

  // ─── Cutover & Rollback ────────────────────────────────

  /**
   * POST /migrations/:id/cutover
   * Execute cutover to target provider
   */
  router.post("/migrations/:id/cutover", async (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    try {
      const input = CutoverSchema.parse(req.body);

      // Create rollback snapshot before cutover
      const snapshot = rollback.createSnapshot(
        input.migrationId,
        {},
        {},
        {}
      );

      migration.tracker.rollbackSnapshot = snapshot;
      migration.tracker.transitionStatus("CUTOVER", {
        snapshotCreated: true,
      });

      // Execute cutover
      const result = await swapEngine.executeCutover(
        migration.mapping,
        snapshot
      );

      if (result.success) {
        migration.tracker.transitionStatus("COMPLETED", {
          cutoverSuccess: true,
        });
        migration.tracker.updateMetrics({
          totalRequests: migration.tracker.metrics.totalRequests,
          successfulRequests: migration.tracker.metrics.successfulRequests,
          failedRequests: 0,
        });
      } else {
        migration.tracker.transitionStatus("FAILED", {
          cutoverErrors: result.errors,
        });
      }

      res.json({
        migrationId: input.migrationId,
        status: result.success ? "COMPLETED" : "FAILED",
        success: result.success,
        errors: result.errors,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /migrations/:id/rollback
   * Execute rollback to source provider
   */
  router.post("/migrations/:id/rollback", async (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    try {
      const input = RollbackSchema.parse(req.body);

      if (!migration.tracker.rollbackSnapshot) {
        return res.status(400).json({
          error: "No rollback snapshot available",
        });
      }

      const result = input.partialEndpoints
        ? await rollback.executePartialRollback(
            migration.tracker.rollbackSnapshot,
            migration.mapping.sourceProvider,
            input.partialEndpoints
          )
        : await rollback.executeRollback(
            migration.tracker.rollbackSnapshot,
            migration.mapping.sourceProvider
          );

      migration.tracker.transitionStatus("ROLLED_BACK", {
        rollbackSuccess: result.success,
        endpoints: input.partialEndpoints,
      });

      res.json({
        migrationId: input.migrationId,
        success: result.success,
        restoredProvider: result.restoredProvider,
        rollbackedEndpoints: result.rollbackEndpoints,
        errors: result.errors,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: String(error) });
    }
  });

  // ─── Validation ────────────────────────────────────────

  /**
   * POST /migrations/:id/validate
   * Run validation checks
   */
  router.post("/migrations/:id/validate", async (req, res) => {
    const migration = migrations.get(req.params.id);
    if (!migration) {
      return res.status(404).json({ error: "Migration not found" });
    }

    try {
      const input = ValidationSchema.parse(req.body);

      let validationResult;

      if (input.stage === "pre") {
        const preMigration = await validator.validatePreMigration(
          migration.mapping.sourceProvider,
          migration.mapping.targetProvider
        );
        validationResult = validator.generateValidationReport(
          input.migrationId,
          preMigration
        );
      } else if (input.stage === "during") {
        const duringMigration = await validator.validateDuringMigration(
          migration.mapping.sourceProvider,
          migration.mapping.targetProvider
        );
        const preMigration = await validator.validatePreMigration(
          migration.mapping.sourceProvider,
          migration.mapping.targetProvider
        );
        validationResult = validator.generateValidationReport(
          input.migrationId,
          preMigration,
          duringMigration
        );
      } else {
        const postMigration = await validator.validatePostMigration(
          migration.mapping.targetProvider
        );
        const preMigration = await validator.validatePreMigration(
          migration.mapping.sourceProvider,
          migration.mapping.targetProvider
        );
        validationResult = validator.generateValidationReport(
          input.migrationId,
          preMigration,
          undefined,
          postMigration
        );
      }

      migration.tracker.validationResults.push(validationResult);

      res.json({
        migrationId: input.migrationId,
        stage: input.stage,
        passed: validationResult.passed,
        timestamp: validationResult.timestamp.toISOString(),
        validation: {
          preMigration: validationResult.preMigration,
          duringMigration: validationResult.duringMigration,
          postMigration: validationResult.postMigration,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: String(error) });
    }
  });

  // ─── Documentation Endpoints ───────────────────────────

  /**
   * GET /docs/sdks
   * List all available SDK documentation
   */
  router.get("/docs/sdks", (req, res) => {
    const providers = [
      "stripe",
      "paypal",
      "square",
      "google",
      "amazon",
    ];

    const docs = providers.map((provider) => ({
      provider,
      name: docGenerator["getProviderDisplayName"](provider),
      documentation: `/docs/sdks/${provider}`,
    }));

    res.json({
      total: docs.length,
      sdks: docs,
    });
  });

  /**
   * GET /docs/sdks/:providerId
   * Get SDK documentation for a specific provider
   */
  router.get("/docs/sdks/:providerId", (req, res) => {
    const { providerId } = req.params;

    // In real implementation, fetch actual SDK class
    const mockSDKClass = { name: "MockSDK", description: "Mock SDK client" };

    const documentation = docGenerator.generateSDKDocumentation(
      providerId,
      `${providerId.charAt(0).toUpperCase()}${providerId.slice(1)}Client`,
      mockSDKClass
    );

    res.json(documentation);
  });

  /**
   * GET /docs/webhooks
   * List all webhook documentation
   */
  router.get("/docs/webhooks", (req, res) => {
    const providers = ["stripe", "paypal", "square"];

    const webhooks = providers.map((provider) => ({
      provider,
      documentation: `/docs/webhooks/${provider}`,
    }));

    res.json({
      total: webhooks.length,
      webhooks,
    });
  });

  /**
   * GET /docs/webhooks/:providerId
   * Get webhook documentation for a provider
   */
  router.get("/docs/webhooks/:providerId", (req, res) => {
    const { providerId } = req.params;
    const catalog = webhookCatalog.generateWebhookCatalog(providerId);
    res.json(catalog);
  });

  /**
   * GET /docs/rate-limits
   * Get aggregated rate limits for all providers
   */
  router.get("/docs/rate-limits", (req, res) => {
    const providers = [
      "stripe",
      "paypal",
      "square",
      "google",
      "amazon",
    ];

    const rateLimitRefs = providers.map((provider) =>
      rateLimits.generateRateLimitReference(provider)
    );

    res.json({
      total: rateLimitRefs.length,
      providers: rateLimitRefs.map((ref) => ({
        provider: ref.provider,
        limits: ref.limits.length,
        documentation: `/docs/rate-limits/${ref.provider}`,
      })),
      rateLimits: rateLimitRefs,
    });
  });

  /**
   * GET /docs/rate-limits/:providerId
   * Get rate limits for a specific provider
   */
  router.get("/docs/rate-limits/:providerId", (req, res) => {
    const { providerId } = req.params;
    const reference = rateLimits.generateRateLimitReference(providerId);
    res.json(reference);
  });

  /**
   * GET /docs/troubleshooting
   * Get troubleshooting documentation for all providers
   */
  router.get("/docs/troubleshooting", (req, res) => {
    const providers = ["stripe", "paypal", "square"];

    const troubleshootingRefs = providers.map((provider) =>
      troubleshooting.generateTroubleshootingReference(provider)
    );

    res.json({
      total: troubleshootingRefs.length,
      providers: troubleshootingRefs.map((ref) => ({
        provider: ref.provider,
        errorCategories: ref.errorCategories,
        documentation: `/docs/troubleshooting/${ref.provider}`,
      })),
    });
  });

  /**
   * GET /docs/troubleshooting/:providerId
   * Get troubleshooting playbooks for a provider
   */
  router.get("/docs/troubleshooting/:providerId", (req, res) => {
    const { providerId } = req.params;
    const reference = troubleshooting.generateTroubleshootingReference(
      providerId
    );
    res.json(reference);
  });

  /**
   * GET /docs/troubleshooting/:providerId/:errorCode
   * Get specific playbook for an error
   */
  router.get(
    "/docs/troubleshooting/:providerId/:errorCode",
    (req, res) => {
      const { providerId, errorCode } = req.params;
      const playbook = troubleshooting.getPlaybookForError(
        providerId,
        errorCode
      );

      if (!playbook) {
        return res.status(404).json({
          error: "Playbook not found",
          provider: providerId,
          errorCode,
        });
      }

      res.json(playbook);
    }
  );

  /**
   * GET /docs/config/:providerId
   * Get configuration guide for a provider
   */
  router.get("/docs/config/:providerId", (req, res) => {
    const { providerId } = req.params;
    const guide = configGuide.generateConfigGuide(providerId);
    res.json(guide);
  });

  return router;
}

// ─── Export for mounting ───────────────────────────────────────

export { ProviderSwapEngine, ShadowModeRunner, RollbackManager, MigrationValidator, MigrationTracker, DataMapperService } from "./migration-toolkit";

export { AutoDocGenerator, WebhookCatalog, RateLimitReference, TroubleshootingPlaybooks, ConfigurationGuideGenerator } from "../docs/documentation-engine";
