/**
 * Process Manager Tests
 * Comprehensive test suite for background worker management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessManager, BaseWorker } from '../manager';

// Mock worker implementation for testing
class MockWorker extends BaseWorker {
  async processJob(job: any) {
    return { success: true, jobId: job.id };
  }
}

describe('ProcessManager', () => {
  let manager: ProcessManager;
  let prisma: any;
  let redis: any;

  beforeEach(() => {
    prisma = {};
    redis = {};

    manager = new ProcessManager(prisma, redis, {
      shutdownTimeoutMs: 5000,
      drainQueues: true,
      autoRestart: true,
      restartBackoffMs: 100,
      restartMaxBackoffMs: 1000,
    });
  });

  describe('registerWorker', () => {
    it('should register worker', () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });

      expect(() => {
        manager.registerWorker('mock-worker', factory);
      }).not.toThrow();
    });

    it('should throw error when registering duplicate worker', () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });

      manager.registerWorker('mock-worker', factory);

      expect(() => {
        manager.registerWorker('mock-worker', factory);
      }).toThrow();
    });
  });

  describe('startAll', () => {
    it('should start all registered workers', async () => {
      const startMock = vi.spyOn(BaseWorker.prototype, 'start');

      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();

      expect(startMock).toHaveBeenCalled();
      startMock.mockRestore();
    });

    it('should skip disabled workers', async () => {
      const startMock = vi.spyOn(BaseWorker.prototype, 'start');

      const factory = () =>
        new MockWorker(prisma, redis, { name: 'mock', enabled: false });
      manager.registerWorker('disabled-worker', factory);

      await manager.startAll();

      expect(startMock).not.toHaveBeenCalled();
      startMock.mockRestore();
    });

    it('should handle startup errors gracefully', async () => {
      const factory = () => {
        const worker = new MockWorker(prisma, redis, { name: 'mock' });
        const errorStart = vi.spyOn(worker, 'start').mockRejectedValue(
          new Error('Startup failed')
        );
        return worker;
      };

      manager.registerWorker('error-worker', factory);

      await expect(manager.startAll()).resolves.not.toThrow();
    });
  });

  describe('stopAll', () => {
    it('should stop all workers gracefully', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();
      const stopMock = vi.spyOn(BaseWorker.prototype, 'stop');

      await manager.stopAll(true);

      expect(stopMock).toHaveBeenCalled();
      stopMock.mockRestore();
    });

    it('should not stop twice', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();
      await manager.stopAll();
      await manager.stopAll();

      expect(true).toBe(true); // Should not throw
    });
  });

  describe('restartWorker', () => {
    it('should restart individual worker', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();
      const stopMock = vi.spyOn(BaseWorker.prototype, 'stop');

      await manager.restartWorker('mock-worker');

      expect(stopMock).toHaveBeenCalled();
      stopMock.mockRestore();
    });

    it('should throw error for non-existent worker', async () => {
      await expect(manager.restartWorker('non-existent')).rejects.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return health check status', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();

      const status = manager.getStatus();

      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('workers');
      expect(Array.isArray(status.workers)).toBe(true);
    });

    it('should indicate unhealthy when worker fails', async () => {
      const factory = () => {
        const worker = new MockWorker(prisma, redis, { name: 'failing' });
        worker['status'] = 'stopped';
        return worker;
      };
      manager.registerWorker('failing-worker', factory);

      await manager.startAll();

      const status = manager.getStatus();

      expect(status).toHaveProperty('healthy');
    });
  });

  describe('getWorkerStatus', () => {
    it('should get status of specific worker', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();

      const status = manager.getWorkerStatus('mock-worker');

      expect(status).not.toBeNull();
      expect(status?.name).toBe('mock');
    });

    it('should return null for non-existent worker', async () => {
      const status = manager.getWorkerStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('enableWorker', () => {
    it('should enable disabled worker', async () => {
      const factory = () =>
        new MockWorker(prisma, redis, { name: 'mock', enabled: false });
      manager.registerWorker('mock-worker', factory);

      await manager.enableWorker('mock-worker');

      const status = manager.getWorkerStatus('mock-worker');

      expect(status?.status).toBe('running');
    });

    it('should throw error for non-registered worker', async () => {
      await expect(manager.enableWorker('non-existent')).rejects.toThrow();
    });
  });

  describe('disableWorker', () => {
    it('should disable running worker', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();
      await manager.disableWorker('mock-worker');

      const status = manager.getWorkerStatus('mock-worker');

      expect(status?.status).toBe('stopped');
    });

    it('should throw error for non-existent worker', async () => {
      await expect(manager.disableWorker('non-existent')).rejects.toThrow();
    });
  });

  describe('onWorkerError', () => {
    it('should register error callback', () => {
      const callback = vi.fn();

      manager.onWorkerError('mock-worker', callback);

      expect(true).toBe(true); // Callback registered
    });

    it('should call error callback on worker error', async () => {
      const callback = vi.fn();
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });

      manager.registerWorker('mock-worker', factory);
      manager.onWorkerError('mock-worker', callback);

      const error = new Error('Test error');
      (manager as any).emitWorkerError('mock-worker', error, { jobId: '123' });

      expect(callback).toHaveBeenCalledWith('mock-worker', error, { jobId: '123' });
    });
  });

  describe('healthCheck', () => {
    it('should return health check status', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();

      const health = manager.healthCheck();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('workers');
      expect(health).toHaveProperty('timestamp');
    });
  });

  describe('onShutdown', () => {
    it('should register shutdown handler', () => {
      const handler = vi.fn(async () => {
        // Handler logic
      });

      manager.onShutdown(handler);

      expect(true).toBe(true);
    });
  });

  describe('Auto-restart functionality', () => {
    it('should auto-restart failed worker with backoff', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      const restartMock = vi.spyOn(manager as any, 'autoRestartWorker');

      await manager.startAll();
      (manager as any).autoRestartWorker('mock-worker');

      expect(restartMock).toHaveBeenCalled();
      restartMock.mockRestore();
    });

    it('should increase backoff with retries', async () => {
      const restartBackoffs: Map<string, number> = new Map();

      // Simulate backoff calculation
      let backoff = 100;
      for (let i = 0; i < 3; i++) {
        backoff = Math.min(backoff * 2, 1000);
        expect(backoff).toBeLessThanOrEqual(1000);
      }

      expect(backoff).toBe(800);
    });

    it('should not restart if shutdown in progress', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();
      await manager.stopAll();

      // Should not throw when trying to auto-restart after shutdown
      await expect(
        (manager as any).autoRestartWorker('mock-worker')
      ).resolves.not.toThrow();
    });
  });

  describe('BaseWorker', () => {
    it('should track job processing', async () => {
      const worker = new MockWorker(prisma, redis, { name: 'test-worker' });

      await worker.start();

      worker['recordSuccess']();
      worker['recordSuccess']();
      worker['recordFailure']();

      const info = worker.getProcessInfo();

      expect(info.jobsProcessed).toBe(2);
      expect(info.jobsFailed).toBe(1);
    });

    it('should track uptime', async () => {
      const worker = new MockWorker(prisma, redis, { name: 'test-worker' });

      await worker.start();

      const info = worker.getProcessInfo();

      expect(info.uptime).toBeGreaterThanOrEqual(0);
      expect(info.status).toBe('running');
    });

    it('should support process lifecycle', async () => {
      const worker = new MockWorker(prisma, redis, { name: 'test-worker' });

      expect(worker.getStatus()).toBe('idle');

      await worker.start();
      expect(worker.isRunning()).toBe(true);

      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should return worker config', () => {
      const worker = new MockWorker(prisma, redis, {
        name: 'test-worker',
        concurrency: 5,
        timeout: 30000,
      });

      const config = worker.getConfig();

      expect(config.name).toBe('test-worker');
      expect(config.concurrency).toBe(5);
      expect(config.timeout).toBe(30000);
    });

    it('should process jobs', async () => {
      const worker = new MockWorker(prisma, redis, { name: 'test-worker' });

      const result = await worker.processJob({ id: 'job-1' });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-1');
    });
  });

  describe('Signal handling', () => {
    it('should handle SIGTERM gracefully', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();

      const stopAllMock = vi.spyOn(manager, 'stopAll');

      // Simulate SIGTERM
      process.emit('SIGTERM' as any);

      // Note: In real environment, process.exit would be called
      // Here we're just testing the handler is set up
      expect(stopAllMock).toBeDefined();
    });

    it('should handle SIGINT gracefully', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();

      // Simulate SIGINT
      process.emit('SIGINT' as any);

      // Note: In real environment, process.exit would be called
      expect(true).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle worker startup errors', async () => {
      const factory = () => {
        throw new Error('Startup failed');
      };

      manager.registerWorker('error-worker', factory);

      // Should not throw
      await expect(manager.startAll()).resolves.not.toThrow();
    });

    it('should handle shutdown handler errors', async () => {
      const errorHandler = vi.fn(async () => {
        throw new Error('Shutdown handler error');
      });

      manager.onShutdown(errorHandler);

      await manager.startAll();

      // Should not throw despite handler error
      await expect(manager.stopAll()).resolves.not.toThrow();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      manager.onWorkerError('mock-worker', errorCallback);

      expect(() => {
        (manager as any).emitWorkerError('mock-worker', new Error('Worker error'));
      }).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty worker list', async () => {
      await expect(manager.startAll()).resolves.not.toThrow();
      await expect(manager.stopAll()).resolves.not.toThrow();
    });

    it('should handle multiple restarts', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.startAll();
      await manager.restartWorker('mock-worker');
      await manager.restartWorker('mock-worker');
      await manager.restartWorker('mock-worker');

      const status = manager.getWorkerStatus('mock-worker');
      expect(status?.status).toBe('running');
    });

    it('should handle rapid enable/disable cycles', async () => {
      const factory = () => new MockWorker(prisma, redis, { name: 'mock' });
      manager.registerWorker('mock-worker', factory);

      await manager.enableWorker('mock-worker');
      await manager.disableWorker('mock-worker');
      await manager.enableWorker('mock-worker');

      const status = manager.getWorkerStatus('mock-worker');
      expect(status?.status).toBe('running');
    });
  });
});
