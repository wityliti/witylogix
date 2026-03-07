import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Campaign Manager Tests
 * Tests campaign lifecycle, audience segmentation, pause/resume, metrics aggregation
 */

type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

interface Segment {
  id: string;
  name: string;
  rules: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  segmentIds: string[];
  scheduledFor?: Date;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metrics: {
    sent: number;
    delivered: number;
    clicked: number;
    bounced: number;
  };
  paused: boolean;
  pausedAt?: Date;
  resumedAt?: Date;
}

class CampaignManager {
  private campaigns: Map<string, Campaign> = new Map();
  private segments: Map<string, Segment> = new Map();
  private campaignIdCounter = 0;
  private segmentIdCounter = 0;

  createSegment(name: string, rules: Segment['rules']): Segment {
    const segment: Segment = {
      id: `seg_${++this.segmentIdCounter}`,
      name,
      rules,
    };
    this.segments.set(segment.id, segment);
    return segment;
  }

  getSegment(segmentId: string): Segment | null {
    return this.segments.get(segmentId) || null;
  }

  createCampaign(
    name: string,
    description: string,
    segmentIds: string[]
  ): Campaign {
    // Validate segments exist
    for (const segmentId of segmentIds) {
      if (!this.segments.has(segmentId)) {
        throw new Error(`Segment ${segmentId} not found`);
      }
    }

    const campaign: Campaign = {
      id: `camp_${++this.campaignIdCounter}`,
      name,
      description,
      status: 'draft',
      segmentIds,
      createdAt: new Date(),
      updatedAt: new Date(),
      metrics: {
        sent: 0,
        delivered: 0,
        clicked: 0,
        bounced: 0,
      },
      paused: false,
    };

    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  getCampaign(campaignId: string): Campaign | null {
    return this.campaigns.get(campaignId) || null;
  }

  schedule(campaignId: string, scheduledFor: Date): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'draft') {
      throw new Error(`Cannot schedule campaign with status ${campaign.status}`);
    }

    if (scheduledFor < new Date()) {
      throw new Error('Cannot schedule campaign for past time');
    }

    campaign.status = 'scheduled';
    campaign.scheduledFor = scheduledFor;
    campaign.updatedAt = new Date();

    return campaign;
  }

  execute(campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'scheduled' && campaign.status !== 'paused') {
      throw new Error(
        `Cannot execute campaign with status ${campaign.status}`
      );
    }

    campaign.status = 'running';
    if (!campaign.startedAt) {
      campaign.startedAt = new Date();
    }
    campaign.paused = false;
    delete campaign.pausedAt;
    campaign.updatedAt = new Date();

    return campaign;
  }

  pause(campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'running') {
      throw new Error(
        `Cannot pause campaign with status ${campaign.status}`
      );
    }

    campaign.status = 'paused';
    campaign.paused = true;
    campaign.pausedAt = new Date();
    campaign.updatedAt = new Date();

    return campaign;
  }

  resume(campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'paused') {
      throw new Error(
        `Cannot resume campaign with status ${campaign.status}`
      );
    }

    campaign.status = 'running';
    campaign.paused = false;
    campaign.resumedAt = new Date();
    campaign.updatedAt = new Date();

    return campaign;
  }

  complete(campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'running') {
      throw new Error(
        `Cannot complete campaign with status ${campaign.status}`
      );
    }

    campaign.status = 'completed';
    campaign.endedAt = new Date();
    campaign.updatedAt = new Date();

    return campaign;
  }

  cancel(campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      throw new Error(
        `Cannot cancel campaign with status ${campaign.status}`
      );
    }

    campaign.status = 'cancelled';
    campaign.endedAt = new Date();
    campaign.updatedAt = new Date();

    return campaign;
  }

  recordMetrics(campaignId: string, metrics: Partial<Campaign['metrics']>): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (metrics.sent !== undefined) {
      campaign.metrics.sent += metrics.sent;
    }
    if (metrics.delivered !== undefined) {
      campaign.metrics.delivered += metrics.delivered;
    }
    if (metrics.clicked !== undefined) {
      campaign.metrics.clicked += metrics.clicked;
    }
    if (metrics.bounced !== undefined) {
      campaign.metrics.bounced += metrics.bounced;
    }

    campaign.updatedAt = new Date();
    return campaign;
  }

  getMetrics(campaignId: string): Campaign['metrics'] | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return null;
    }

    return {
      sent: campaign.metrics.sent,
      delivered: campaign.metrics.delivered,
      clicked: campaign.metrics.clicked,
      bounced: campaign.metrics.bounced,
    };
  }

  calculateMetricsStats(campaignId: string): {
    deliveryRate: number;
    clickRate: number;
    bounceRate: number;
  } | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return null;
    }

    const { sent, delivered, clicked, bounced } = campaign.metrics;
    return {
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    };
  }

  getByCampaignIds(campaignIds: string[]): Campaign[] {
    return campaignIds.map(id => this.campaigns.get(id)).filter((c) => c !== undefined) as Campaign[];
  }
}

describe('CampaignManager', () => {
  let manager: CampaignManager;
  let segment1: Segment;
  let segment2: Segment;

  beforeEach(() => {
    manager = new CampaignManager();
    segment1 = manager.createSegment('Premium Users', [
      { field: 'tier', operator: 'eq', value: 'premium' },
    ]);
    segment2 = manager.createSegment('High Value', [
      { field: 'lifetime_value', operator: 'gte', value: 1000 },
    ]);
  });

  describe('Campaign Lifecycle', () => {
    it('should create a campaign in draft status', () => {
      const campaign = manager.createCampaign(
        'Summer Sale',
        'End of summer promotion',
        [segment1.id]
      );
      expect(campaign.status).toBe('draft');
      expect(campaign.name).toBe('Summer Sale');
      expect(campaign.segmentIds).toContain(segment1.id);
    });

    it('should schedule a campaign', () => {
      const campaign = manager.createCampaign(
        'Summer Sale',
        'End of summer promotion',
        [segment1.id]
      );
      const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const scheduled = manager.schedule(campaign.id, scheduledTime);
      expect(scheduled.status).toBe('scheduled');
      expect(scheduled.scheduledFor).toEqual(scheduledTime);
    });

    it('should execute a scheduled campaign', () => {
      const campaign = manager.createCampaign(
        'Summer Sale',
        'Promotion',
        [segment1.id]
      );
      const scheduledTime = new Date(Date.now() + 1000);
      manager.schedule(campaign.id, scheduledTime);
      const executed = manager.execute(campaign.id);
      expect(executed.status).toBe('running');
      expect(executed.startedAt).toBeDefined();
    });

    it('should complete a running campaign', () => {
      const campaign = manager.createCampaign(
        'Summer Sale',
        'Promotion',
        [segment1.id]
      );
      const scheduledTime = new Date(Date.now() + 1000);
      manager.schedule(campaign.id, scheduledTime);
      manager.execute(campaign.id);
      const completed = manager.complete(campaign.id);
      expect(completed.status).toBe('completed');
      expect(completed.endedAt).toBeDefined();
    });

    it('should cancel a draft campaign', () => {
      const campaign = manager.createCampaign(
        'Summer Sale',
        'Promotion',
        [segment1.id]
      );
      const cancelled = manager.cancel(campaign.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should not allow scheduling past dates', () => {
      const campaign = manager.createCampaign(
        'Summer Sale',
        'Promotion',
        [segment1.id]
      );
      const pastTime = new Date(Date.now() - 1000);
      expect(() =>
        manager.schedule(campaign.id, pastTime)
      ).toThrow('Cannot schedule campaign for past time');
    });

    it('should not allow scheduling non-draft campaigns', () => {
      const campaign = manager.createCampaign(
        'Summer Sale',
        'Promotion',
        [segment1.id]
      );
      const futureTime = new Date(Date.now() + 60000);
      manager.schedule(campaign.id, futureTime);
      expect(() =>
        manager.schedule(campaign.id, futureTime)
      ).toThrow('Cannot schedule campaign with status scheduled');
    });
  });

  describe('Pause and Resume', () => {
    let campaign: Campaign;

    beforeEach(() => {
      campaign = manager.createCampaign('Test Campaign', 'Test', [segment1.id]);
      const futureTime = new Date(Date.now() + 1000);
      manager.schedule(campaign.id, futureTime);
      manager.execute(campaign.id);
    });

    it('should pause a running campaign', () => {
      const paused = manager.pause(campaign.id);
      expect(paused.status).toBe('paused');
      expect(paused.paused).toBe(true);
      expect(paused.pausedAt).toBeDefined();
    });

    it('should resume a paused campaign', () => {
      manager.pause(campaign.id);
      const resumed = manager.resume(campaign.id);
      expect(resumed.status).toBe('running');
      expect(resumed.paused).toBe(false);
      expect(resumed.resumedAt).toBeDefined();
    });

    it('should not pause non-running campaigns', () => {
      manager.pause(campaign.id);
      expect(() =>
        manager.pause(campaign.id)
      ).toThrow('Cannot pause campaign with status paused');
    });

    it('should not resume non-paused campaigns', () => {
      expect(() =>
        manager.resume(campaign.id)
      ).toThrow('Cannot resume campaign with status running');
    });
  });

  describe('Audience Segmentation', () => {
    it('should create campaign with multiple segments', () => {
      const campaign = manager.createCampaign(
        'Multi-segment Campaign',
        'Targets multiple segments',
        [segment1.id, segment2.id]
      );
      expect(campaign.segmentIds).toHaveLength(2);
      expect(campaign.segmentIds).toContain(segment1.id);
      expect(campaign.segmentIds).toContain(segment2.id);
    });

    it('should validate segments exist', () => {
      expect(() =>
        manager.createCampaign('Invalid Campaign', 'Has invalid segment', [
          'seg_invalid',
        ])
      ).toThrow('Segment seg_invalid not found');
    });

    it('should support empty segment list', () => {
      const campaign = manager.createCampaign(
        'Empty Segment Campaign',
        'Test',
        []
      );
      expect(campaign.segmentIds).toHaveLength(0);
    });

    it('should retrieve segment details', () => {
      const retrieved = manager.getSegment(segment1.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Premium Users');
      expect(retrieved?.rules).toHaveLength(1);
    });
  });

  describe('Metrics Aggregation', () => {
    let campaign: Campaign;

    beforeEach(() => {
      campaign = manager.createCampaign('Metrics Test', 'Test metrics', [segment1.id]);
      const futureTime = new Date(Date.now() + 1000);
      manager.schedule(campaign.id, futureTime);
      manager.execute(campaign.id);
    });

    it('should record sent metric', () => {
      manager.recordMetrics(campaign.id, { sent: 1000 });
      const metrics = manager.getMetrics(campaign.id);
      expect(metrics?.sent).toBe(1000);
    });

    it('should record delivered metric', () => {
      manager.recordMetrics(campaign.id, { sent: 1000, delivered: 950 });
      const metrics = manager.getMetrics(campaign.id);
      expect(metrics?.delivered).toBe(950);
    });

    it('should accumulate metrics', () => {
      manager.recordMetrics(campaign.id, { sent: 500, delivered: 490 });
      manager.recordMetrics(campaign.id, { sent: 500, delivered: 480 });
      const metrics = manager.getMetrics(campaign.id);
      expect(metrics?.sent).toBe(1000);
      expect(metrics?.delivered).toBe(970);
    });

    it('should track clicks', () => {
      manager.recordMetrics(campaign.id, {
        sent: 1000,
        delivered: 950,
        clicked: 95,
      });
      const metrics = manager.getMetrics(campaign.id);
      expect(metrics?.clicked).toBe(95);
    });

    it('should track bounces', () => {
      manager.recordMetrics(campaign.id, {
        sent: 1000,
        bounced: 50,
      });
      const metrics = manager.getMetrics(campaign.id);
      expect(metrics?.bounced).toBe(50);
    });

    it('should calculate delivery rate', () => {
      manager.recordMetrics(campaign.id, { sent: 1000, delivered: 950 });
      const stats = manager.calculateMetricsStats(campaign.id);
      expect(stats?.deliveryRate).toBe(95);
    });

    it('should calculate click rate', () => {
      manager.recordMetrics(campaign.id, {
        sent: 1000,
        delivered: 1000,
        clicked: 100,
      });
      const stats = manager.calculateMetricsStats(campaign.id);
      expect(stats?.clickRate).toBe(10);
    });

    it('should calculate bounce rate', () => {
      manager.recordMetrics(campaign.id, { sent: 1000, bounced: 50 });
      const stats = manager.calculateMetricsStats(campaign.id);
      expect(stats?.bounceRate).toBe(5);
    });

    it('should handle zero metrics in calculations', () => {
      const stats = manager.calculateMetricsStats(campaign.id);
      expect(stats?.deliveryRate).toBe(0);
      expect(stats?.clickRate).toBe(0);
      expect(stats?.bounceRate).toBe(0);
    });

    it('should return null metrics for non-existent campaign', () => {
      const metrics = manager.getMetrics('nonexistent');
      expect(metrics).toBeNull();
    });
  });

  describe('Campaign Retrieval', () => {
    it('should get campaign by ID', () => {
      const campaign = manager.createCampaign('Test', 'Test', [segment1.id]);
      const retrieved = manager.getCampaign(campaign.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(campaign.id);
    });

    it('should return null for non-existent campaign', () => {
      const campaign = manager.getCampaign('nonexistent');
      expect(campaign).toBeNull();
    });

    it('should get multiple campaigns by IDs', () => {
      const c1 = manager.createCampaign('Campaign 1', 'Test', [segment1.id]);
      const c2 = manager.createCampaign('Campaign 2', 'Test', [segment1.id]);
      const c3 = manager.createCampaign('Campaign 3', 'Test', [segment1.id]);

      const retrieved = manager.getByCampaignIds([c1.id, c3.id]);
      expect(retrieved).toHaveLength(2);
      expect(retrieved.map(c => c.id)).toContain(c1.id);
      expect(retrieved.map(c => c.id)).toContain(c3.id);
      expect(retrieved.map(c => c.id)).not.toContain(c2.id);
    });
  });

  describe('Edge Cases', () => {
    it('should prevent completion of already completed campaign', () => {
      const campaign = manager.createCampaign('Test', 'Test', [segment1.id]);
      const futureTime = new Date(Date.now() + 1000);
      manager.schedule(campaign.id, futureTime);
      manager.execute(campaign.id);
      manager.complete(campaign.id);

      expect(() =>
        manager.complete(campaign.id)
      ).toThrow('Cannot complete campaign with status completed');
    });

    it('should prevent cancellation of completed campaign', () => {
      const campaign = manager.createCampaign('Test', 'Test', [segment1.id]);
      const futureTime = new Date(Date.now() + 1000);
      manager.schedule(campaign.id, futureTime);
      manager.execute(campaign.id);
      manager.complete(campaign.id);

      expect(() =>
        manager.cancel(campaign.id)
      ).toThrow('Cannot cancel campaign with status completed');
    });

    it('should handle campaign not found errors', () => {
      expect(() =>
        manager.execute('nonexistent')
      ).toThrow('Campaign nonexistent not found');
    });
  });
});
