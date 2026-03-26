/**
 * Model Retrainer Tests
 *
 * Tests for model retraining pipeline:
 * - Degradation detection
 * - Training data collection
 * - Model retraining
 * - Model validation and promotion
 * - History tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRetrainer, type TrainingDataPoint, type ModelPerformanceMetrics } from '../model-retrainer';

describe('ModelRetrainer', () => {
  let retrainer: ModelRetrainer;

  beforeEach(() => {
    retrainer = new ModelRetrainer({
      accuracyDegradationThreshold: 10,
      minAccuracyScore: 15,
      minImprovementPercent: 2,
      scheduleIntervalHours: 168,
      minDataDays: 14,
      maxDataDays: 90,
      minSamplesRequired: 100,
      validationSplit: 0.2,
      autoRetrain: true,
      retainPreviousVersions: 3,
    });
  });

  describe('Degradation Detection', () => {
    it('should detect accuracy degradation', () => {
      const zone = 'zone-1';

      // Record baseline accuracy
      retrainer.recordAccuracy(zone, 10.0); // 10% MAPE
      retrainer.recordAccuracy(zone, 10.2);
      retrainer.recordAccuracy(zone, 10.1);

      // Check if degradation is detected
      const currentMetrics: ModelPerformanceMetrics = {
        mae: 8.0,
        rmse: 9.5,
        mape: 12.0, // Degraded (from ~10% to 12%)
        r2Score: 0.85,
        precision: 0.88,
        recall: 0.86,
      };

      const shouldRetrain = retrainer.shouldRetrain(zone, currentMetrics);

      expect(shouldRetrain).toBe(true);
    });

    it('should not trigger retrain for minor changes', () => {
      const zone = 'zone-2';

      // Record baseline
      retrainer.recordAccuracy(zone, 10.0);
      retrainer.recordAccuracy(zone, 10.1);

      // Minor change
      const currentMetrics: ModelPerformanceMetrics = {
        mae: 8.0,
        rmse: 9.5,
        mape: 10.3, // 0.3% change
        r2Score: 0.85,
        precision: 0.88,
        recall: 0.86,
      };

      const shouldRetrain = retrainer.shouldRetrain(zone, currentMetrics);

      expect(shouldRetrain).toBe(false);
    });

    it('should trigger retrain if accuracy below minimum score', () => {
      const zone = 'zone-3';

      retrainer.recordAccuracy(zone, 10.0);

      const currentMetrics: ModelPerformanceMetrics = {
        mae: 10.0,
        rmse: 12.0,
        mape: 18.0, // Above min of 15%
        r2Score: 0.75,
        precision: 0.80,
        recall: 0.78,
      };

      const shouldRetrain = retrainer.shouldRetrain(zone, currentMetrics);

      expect(shouldRetrain).toBe(true);
    });

    it('should return false for zone without baseline', () => {
      const zone = 'new-zone';

      const currentMetrics: ModelPerformanceMetrics = {
        mae: 8.0,
        rmse: 9.5,
        mape: 12.0,
        r2Score: 0.85,
        precision: 0.88,
        recall: 0.86,
      };

      const shouldRetrain = retrainer.shouldRetrain(zone, currentMetrics);

      expect(shouldRetrain).toBe(false);
    });
  });

  describe('Scheduling', () => {
    it('should schedule retrain for new zones', () => {
      const zone = 'new-zone-schedule';

      const isScheduled = retrainer.isScheduledForRetraining(zone);

      expect(isScheduled).toBe(true);
    });

    it('should respect retrain interval', () => {
      const zone = 'zone-schedule-2';

      // Simulate previous retraining
      retrainer['lastRetrainingTime'].set(zone, new Date());

      const isScheduled = retrainer.isScheduledForRetraining(zone);

      expect(isScheduled).toBe(false); // Too soon
    });

    it('should schedule after interval passed', () => {
      const zone = 'zone-schedule-3';

      // Set last retrain to far past
      const oldDate = new Date(Date.now() - 200 * 60 * 60 * 1000);
      retrainer['lastRetrainingTime'].set(zone, oldDate);

      const isScheduled = retrainer.isScheduledForRetraining(zone);

      expect(isScheduled).toBe(true);
    });

    it('should respect autoRetrain config', () => {
      const noAutoRetrainer = new ModelRetrainer({ autoRetrain: false });

      const isScheduled = noAutoRetrainer.isScheduledForRetraining('any-zone');

      expect(isScheduled).toBe(false);
    });
  });

  describe('Data Collection', () => {
    it('should collect training data points', () => {
      const zone = 'zone-data-1';

      const data = retrainer.collectTrainingData(zone, 30);

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(100);

      // Check data structure
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('timestamp');
        expect(data[0]).toHaveProperty('zoneId');
        expect(data[0]).toHaveProperty('features');
        expect(data[0]).toHaveProperty('actualVolume');
      }
    });

    it('should respect maxDataDays config', () => {
      const zone = 'zone-data-2';

      const data = retrainer.collectTrainingData(zone);

      // All data should be within maxDataDays
      const maxDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      expect(data.every((d) => d.timestamp > maxDaysAgo)).toBe(true);
    });

    it('should return sufficient training data', () => {
      const zone = 'zone-data-3';

      const data = retrainer.collectTrainingData(zone);

      expect(data.length).toBeGreaterThanOrEqual(100);
    });

    it('should include feature engineering', () => {
      const zone = 'zone-data-4';

      const data = retrainer.collectTrainingData(zone, 14);

      if (data.length > 0) {
        const features = data[0].features;
        expect(features).toHaveProperty('hour');
        expect(features).toHaveProperty('dayOfWeek');
        expect(features).toHaveProperty('isWeekend');
      }
    });
  });

  describe('Model Retraining', () => {
    it('should retrain model with training data', async () => {
      const zone = 'zone-retrain-1';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'seasonal', data, 'manual');

      expect(job.status).toBe('completed');
      expect(job.zoneId).toBe(zone);
      expect(job.modelType).toBe('seasonal');
      expect(job.newMetrics).toBeDefined();
    });

    it('should reject insufficient training data', async () => {
      const zone = 'zone-retrain-2';
      const insufficientData: TrainingDataPoint[] = [
        {
          timestamp: new Date(),
          zoneId: zone,
          features: { hour: 10, dayOfWeek: 1 },
          actualVolume: 50,
        },
      ];

      try {
        await retrainer.retrain(zone, 'regression', insufficientData, 'manual');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Insufficient training data');
      }
    });

    it('should record retraining reason', async () => {
      const zone = 'zone-retrain-3';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'pattern', data, 'degradation_detected');

      expect(job.reason).toBe('degradation_detected');
    });

    it('should handle retraining completion', async () => {
      const zone = 'zone-retrain-4';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'ensemble', data);

      expect(job.completedAt).toBeDefined();
      expect(job.oldMetrics).toBeDefined();
      expect(job.newMetrics).toBeDefined();
      expect(job.improvementPercent).toBeDefined();
    });
  });

  describe('Model Validation', () => {
    it('should validate retrained model improvement', () => {
      const oldMetrics: ModelPerformanceMetrics = {
        mae: 8.0,
        rmse: 10.0,
        mape: 12.0,
        r2Score: 0.85,
        precision: 0.88,
        recall: 0.86,
      };

      const newMetrics: ModelPerformanceMetrics = {
        mae: 7.8,
        rmse: 9.5,
        mape: 11.5,
        r2Score: 0.86,
        precision: 0.89,
        recall: 0.87,
      };

      const validation = retrainer.validateRetrained('zone-1', oldMetrics, newMetrics);

      expect(validation.isImprovement).toBe(true);
      expect(validation.improvementPercent).toBeGreaterThan(0);
    });

    it('should reject minimal improvement', () => {
      const oldMetrics: ModelPerformanceMetrics = {
        mae: 8.0,
        rmse: 10.0,
        mape: 12.0,
        r2Score: 0.85,
        precision: 0.88,
        recall: 0.86,
      };

      const newMetrics: ModelPerformanceMetrics = {
        mae: 8.0,
        rmse: 10.0,
        mape: 11.99,
        r2Score: 0.85001,
        precision: 0.88001,
        recall: 0.86001,
      };

      const validation = retrainer.validateRetrained('zone-2', oldMetrics, newMetrics);

      expect(validation.isImprovement).toBe(false);
      expect(validation.improvementPercent).toBeLessThan(2);
    });

    it('should include recommendation', () => {
      const oldMetrics: ModelPerformanceMetrics = {
        mae: 8.0,
        rmse: 10.0,
        mape: 12.0,
        r2Score: 0.85,
        precision: 0.88,
        recall: 0.86,
      };

      const newMetrics: ModelPerformanceMetrics = {
        mae: 7.5,
        rmse: 9.0,
        mape: 11.0,
        r2Score: 0.87,
        precision: 0.90,
        recall: 0.88,
      };

      const validation = retrainer.validateRetrained('zone-3', oldMetrics, newMetrics);

      expect(validation.recommendation).toBeDefined();
      expect(validation.recommendation.length).toBeGreaterThan(0);
    });
  });

  describe('Model Promotion', () => {
    it('should promote improved model', async () => {
      const zone = 'zone-promote-1';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'seasonal', data);

      const promoted = retrainer.promoteModel(job.id);

      expect(promoted).toBe(true);

      const activeModel = retrainer.getActiveModel(zone);
      expect(activeModel).toBeDefined();
      expect(activeModel!.active).toBe(true);
    });

    it('should not promote degraded model', () => {
      const jobId = 'non-existent-job';

      const promoted = retrainer.promoteModel(jobId);

      expect(promoted).toBe(false);
    });

    it('should maintain model version history', async () => {
      const zone = 'zone-promote-2';
      const data = retrainer.collectTrainingData(zone, 30);

      // Retrain multiple times
      const job1 = await retrainer.retrain(zone, 'regression', data);
      retrainer.promoteModel(job1.id);

      const job2 = await retrainer.retrain(zone, 'regression', data);
      retrainer.promoteModel(job2.id);

      const versions = retrainer.getModelVersions(zone);

      expect(versions.length).toBeGreaterThan(0);
      expect(versions.filter((v) => v.active).length).toBeLessThanOrEqual(1);
    });

    it('should prune old versions', async () => {
      const smallRetrainer = new ModelRetrainer({
        retainPreviousVersions: 2,
        minSamplesRequired: 100,
      });

      const zone = 'zone-prune';
      const data = smallRetrainer.collectTrainingData(zone, 30);

      // Create 4 versions
      for (let i = 0; i < 4; i++) {
        const job = await smallRetrainer.retrain(zone, 'seasonal', data);
        smallRetrainer.promoteModel(job.id);
      }

      const versions = smallRetrainer.getModelVersions(zone);

      expect(versions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Model Version Management', () => {
    it('should get model versions for zone', async () => {
      const zone = 'zone-version-1';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'seasonal', data);
      retrainer.promoteModel(job.id);

      const versions = retrainer.getModelVersions(zone);

      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBeGreaterThan(0);
    });

    it('should get active model version', async () => {
      const zone = 'zone-active-1';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'pattern', data);
      retrainer.promoteModel(job.id);

      const activeModel = retrainer.getActiveModel(zone);

      expect(activeModel).toBeDefined();
      expect(activeModel!.active).toBe(true);
    });

    it('should return null for zone with no model', () => {
      const zone = 'zone-no-model';

      const activeModel = retrainer.getActiveModel(zone);

      expect(activeModel).toBeNull();
    });
  });

  describe('History & Statistics', () => {
    it('should track retraining history', async () => {
      const zone = 'zone-history-1';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'seasonal', data);
      retrainer.promoteModel(job.id);

      const history = retrainer.getRetrainingHistory(zone);

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].jobId).toBe(job.id);
    });

    it('should filter history by zone', async () => {
      const zone1 = 'zone-history-filter-1';
      const zone2 = 'zone-history-filter-2';
      const data = retrainer.collectTrainingData(zone1, 30);

      const job1 = await retrainer.retrain(zone1, 'seasonal', data);
      retrainer.promoteModel(job1.id);

      const job2 = await retrainer.retrain(zone2, 'seasonal', data);
      retrainer.promoteModel(job2.id);

      const history1 = retrainer.getRetrainingHistory(zone1);

      expect(history1.every((h) => h.zoneId === zone1)).toBe(true);
    });

    it('should limit history results', async () => {
      const zone = 'zone-history-limit';
      const data = retrainer.collectTrainingData(zone, 30);

      const job = await retrainer.retrain(zone, 'seasonal', data);
      retrainer.promoteModel(job.id);

      const history = retrainer.getRetrainingHistory(zone, 5);

      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should provide statistics', () => {
      const stats = retrainer.getStatistics();

      expect(stats).toHaveProperty('totalJobsRun');
      expect(stats).toHaveProperty('successfulJobs');
      expect(stats).toHaveProperty('promotedModels');
      expect(stats).toHaveProperty('averageImprovement');
      expect(stats).toHaveProperty('activeModes');

      expect(typeof stats.totalJobsRun).toBe('number');
      expect(typeof stats.promotedModels).toBe('number');
    });
  });

  describe('Accuracy Recording', () => {
    it('should record accuracy metrics', () => {
      const zone = 'zone-record-1';

      retrainer.recordAccuracy(zone, 10.0);
      retrainer.recordAccuracy(zone, 10.2);
      retrainer.recordAccuracy(zone, 10.1);

      const history = retrainer['accuracyHistory'].get(zone);

      expect(history).toBeDefined();
      expect(history!.length).toBeGreaterThan(0);
    });

    it('should prune old accuracy records', () => {
      const zone = 'zone-record-prune';

      // Add old record
      const history = retrainer['accuracyHistory'].get(zone) || [];
      history.push({
        accuracy: 10.0,
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      });

      retrainer['accuracyHistory'].set(zone, history);

      // Record new
      retrainer.recordAccuracy(zone, 10.5);

      const final = retrainer['accuracyHistory'].get(zone);

      // Should only keep records from last 30 days
      expect(final!.every((r) => r.timestamp > new Date(Date.now() - 31 * 24 * 60 * 60 * 1000))).toBe(true);
    });
  });

  describe('Event Emission', () => {
    it('should emit degradation_detected event', () => {
      let degradationEmitted = false;

      retrainer.on('degradation_detected', () => {
        degradationEmitted = true;
      });

      const zone = 'zone-event-1';
      retrainer.recordAccuracy(zone, 10.0);

      const metrics: ModelPerformanceMetrics = {
        mae: 10.0,
        rmse: 12.0,
        mape: 18.0,
        r2Score: 0.75,
        precision: 0.80,
        recall: 0.78,
      };

      retrainer.shouldRetrain(zone, metrics);

      expect(degradationEmitted).toBe(true);
    });

    it('should emit retraining_completed event', (done) => {
      retrainer.on('retraining_completed', (job) => {
        expect(job.status).toBe('completed');
        done();
      });

      const zone = 'zone-event-2';
      const data = retrainer.collectTrainingData(zone, 30);

      retrainer.retrain(zone, 'seasonal', data);
    });

    it('should emit model_promoted event', (done) => {
      retrainer.on('model_promoted', (event) => {
        expect(event.zoneId).toBeDefined();
        done();
      });

      const zone = 'zone-event-3';
      const data = retrainer.collectTrainingData(zone, 30);

      retrainer.retrain(zone, 'seasonal', data).then((job) => {
        retrainer.promoteModel(job.id);
      });
    });
  });
});
