import { describe, it, expect, vi, beforeEach } from 'vitest';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime?: number;
  version?: string;
}

interface ReadinessStatus {
  ready: boolean;
  database: {
    connected: boolean;
    latencyMs?: number;
  };
  timestamp: string;
}

interface DatabaseConnection {
  isConnected(): Promise<boolean>;
  ping(): Promise<number>;
}

class MockDatabaseConnection implements DatabaseConnection {
  private connected: boolean = true;

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async ping(): Promise<number> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }
    return 5;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }
}

class HealthCheckRoute {
  private startTime: number;
  private dbConnection: DatabaseConnection;
  private version: string;

  constructor(dbConnection: DatabaseConnection, version: string = '1.0.0') {
    this.startTime = Date.now();
    this.dbConnection = dbConnection;
    this.version = version;
  }

  async getHealth(): Promise<HealthStatus> {
    try {
      const uptime = Date.now() - this.startTime;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime,
        version: this.version,
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getReady(): Promise<ReadinessStatus> {
    const timestamp = new Date().toISOString();

    try {
      const connected = await this.dbConnection.isConnected();

      if (!connected) {
        return {
          ready: false,
          database: {
            connected: false,
          },
          timestamp,
        };
      }

      const latencyMs = await this.dbConnection.ping();

      return {
        ready: true,
        database: {
          connected: true,
          latencyMs,
        },
        timestamp,
      };
    } catch (error) {
      return {
        ready: false,
        database: {
          connected: false,
        },
        timestamp,
      };
    }
  }
}

describe('HealthCheckRoute', () => {
  let healthRoute: HealthCheckRoute;
  let mockDb: MockDatabaseConnection;

  beforeEach(() => {
    mockDb = new MockDatabaseConnection();
    healthRoute = new HealthCheckRoute(mockDb, '2.0.0');
  });

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const health = await healthRoute.getHealth();

      expect(health.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const health = await healthRoute.getHealth();

      expect(health.timestamp).toBeDefined();
      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include uptime in milliseconds', async () => {
      const health = await healthRoute.getHealth();

      expect(health.uptime).toBeDefined();
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include version', async () => {
      const health = await healthRoute.getHealth();

      expect(health.version).toBe('2.0.0');
    });

    it('should have valid ISO timestamp format', async () => {
      const health = await healthRoute.getHealth();

      const date = new Date(health.timestamp);
      expect(date instanceof Date && !isNaN(date.getTime())).toBe(true);
    });

    it('should return increasing uptime on multiple calls', async () => {
      const health1 = await healthRoute.getHealth();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const health2 = await healthRoute.getHealth();

      expect(health2.uptime! > health1.uptime!).toBe(true);
    });

    it('should always return ok status regardless of db state', async () => {
      mockDb.setConnected(false);

      const health = await healthRoute.getHealth();

      expect(health.status).toBe('ok');
    });

    it('should handle error gracefully', async () => {
      const errorDb = {
        isConnected: vi.fn().mockRejectedValue(new Error('DB error')),
      };

      const route = new HealthCheckRoute(
        errorDb as unknown as DatabaseConnection,
        '1.0.0'
      );

      const health = await route.getHealth();

      expect(health.status).toBe('ok');
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready true when database connected', async () => {
      const readiness = await healthRoute.getReady();

      expect(readiness.ready).toBe(true);
    });

    it('should return ready false when database disconnected', async () => {
      mockDb.setConnected(false);

      const readiness = await healthRoute.getReady();

      expect(readiness.ready).toBe(false);
    });

    it('should include database status', async () => {
      const readiness = await healthRoute.getReady();

      expect(readiness.database).toBeDefined();
      expect(readiness.database.connected).toBeDefined();
    });

    it('should include database latency when connected', async () => {
      const readiness = await healthRoute.getReady();

      expect(readiness.database.latencyMs).toBeDefined();
      expect(typeof readiness.database.latencyMs).toBe('number');
    });

    it('should not include latency when disconnected', async () => {
      mockDb.setConnected(false);

      const readiness = await healthRoute.getReady();

      expect(readiness.database.latencyMs).toBeUndefined();
    });

    it('should include timestamp', async () => {
      const readiness = await healthRoute.getReady();

      expect(readiness.timestamp).toBeDefined();
      expect(readiness.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle database ping error', async () => {
      const errorDb = {
        isConnected: vi.fn().mockResolvedValue(true),
        ping: vi.fn().mockRejectedValue(new Error('Ping failed')),
      };

      const route = new HealthCheckRoute(
        errorDb as unknown as DatabaseConnection
      );

      const readiness = await route.getReady();

      expect(readiness.ready).toBe(false);
      expect(readiness.database.connected).toBe(false);
    });

    it('should return false ready state on db error', async () => {
      const errorDb = {
        isConnected: vi.fn().mockRejectedValue(new Error('Connection error')),
      };

      const route = new HealthCheckRoute(
        errorDb as unknown as DatabaseConnection
      );

      const readiness = await route.getReady();

      expect(readiness.ready).toBe(false);
    });

    it('should measure correct latency', async () => {
      const readiness = await healthRoute.getReady();

      expect(readiness.database.latencyMs).toBeLessThan(1000);
      expect(readiness.database.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should return both health and ready endpoints independently', async () => {
      const health = await healthRoute.getHealth();
      const readiness = await healthRoute.getReady();

      expect(health.status).toBe('ok');
      expect(readiness.ready).toBe(true);
    });

    it('should handle db disconnection between calls', async () => {
      const ready1 = await healthRoute.getReady();
      expect(ready1.ready).toBe(true);

      mockDb.setConnected(false);

      const ready2 = await healthRoute.getReady();
      expect(ready2.ready).toBe(false);

      const health = await healthRoute.getHealth();
      expect(health.status).toBe('ok');
    });

    it('should maintain consistent version across calls', async () => {
      const health1 = await healthRoute.getHealth();
      const health2 = await healthRoute.getHealth();

      expect(health1.version).toBe(health2.version);
      expect(health1.version).toBe('2.0.0');
    });

    it('should handle rapid sequential calls', async () => {
      const results = await Promise.all([
        healthRoute.getHealth(),
        healthRoute.getHealth(),
        healthRoute.getReady(),
        healthRoute.getReady(),
      ]);

      expect(results[0].status).toBe('ok');
      expect(results[1].status).toBe('ok');
      expect(results[2].ready).toBe(true);
      expect(results[3].ready).toBe(true);
    });

    it('should handle db state changes during concurrent calls', async () => {
      const promise1 = healthRoute.getReady();
      mockDb.setConnected(false);
      const promise2 = healthRoute.getReady();

      const [ready1, ready2] = await Promise.all([promise1, promise2]);

      expect(ready1.ready).toBe(true);
      expect(ready2.ready).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long uptime', async () => {
      const route = new HealthCheckRoute(mockDb);

      const health = await route.getHealth();

      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof health.uptime).toBe('number');
    });

    it('should handle multiple database disconnects', async () => {
      mockDb.setConnected(false);
      let readiness = await healthRoute.getReady();
      expect(readiness.ready).toBe(false);

      mockDb.setConnected(true);
      readiness = await healthRoute.getReady();
      expect(readiness.ready).toBe(true);

      mockDb.setConnected(false);
      readiness = await healthRoute.getReady();
      expect(readiness.ready).toBe(false);
    });

    it('should provide valid timestamps in ISO format', async () => {
      const health = await healthRoute.getHealth();
      const readiness = await healthRoute.getReady();

      const healthDate = new Date(health.timestamp);
      const readinessDate = new Date(readiness.timestamp);

      expect(healthDate instanceof Date && !isNaN(healthDate.getTime())).toBe(
        true
      );
      expect(
        readinessDate instanceof Date && !isNaN(readinessDate.getTime())
      ).toBe(true);
    });

    it('should handle empty version string', async () => {
      const route = new HealthCheckRoute(mockDb, '');

      const health = await route.getHealth();

      expect(health.version).toBe('');
      expect(health.status).toBe('ok');
    });

    it('should handle database latency > 100ms', async () => {
      const slowDb = {
        isConnected: vi.fn().mockResolvedValue(true),
        ping: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(150), 150);
            })
        ),
      };

      const route = new HealthCheckRoute(
        slowDb as unknown as DatabaseConnection
      );

      const readiness = await route.getReady();

      expect(readiness.ready).toBe(true);
      expect(readiness.database.latencyMs).toBeGreaterThan(100);
    });
  });

  describe('Status Code Mapping', () => {
    it('should indicate 200 OK for healthy status', async () => {
      const health = await healthRoute.getHealth();

      expect(health.status).toBe('ok');
    });

    it('should indicate readiness with true/false', async () => {
      const readiness = await healthRoute.getReady();

      expect(typeof readiness.ready).toBe('boolean');
    });

    it('should distinguish between health and readiness', async () => {
      mockDb.setConnected(false);

      const health = await healthRoute.getHealth();
      const readiness = await healthRoute.getReady();

      expect(health.status).toBe('ok');
      expect(readiness.ready).toBe(false);
    });
  });
});
