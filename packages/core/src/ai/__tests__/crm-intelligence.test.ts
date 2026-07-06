/**
 * CRM Intelligence Engine Tests
 *
 * Tests for:
 * - DealScoringModel scoring deals by close probability
 * - LeadScorer evaluating inbound lead quality
 * - ActivityRecommender suggesting next best actions
 * - RelationshipStrengthCalculator computing relationship strength
 * - SalesForecaster predicting revenue from pipeline
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCRMIntelligence,
  getCRMIntelligence,
  DealScoringModel,
  LeadScorer,
  ActivityRecommender,
  RelationshipStrengthCalculator,
  SalesForecaster,
  type Deal,
  type Lead,
  type Contact,
} from "../crm-intelligence.js";

describe("CRM Intelligence Engine", () => {
  let service: ReturnType<typeof createCRMIntelligence>;

  beforeEach(() => {
    service = createCRMIntelligence();
  });

  describe("DealScoringModel", () => {
    it("should score a deal correctly", () => {
      const deal: Deal = {
        id: "deal_123",
        companyName: "Acme Corp",
        amount: 50000,
        stage: "proposal",
        createdAt: new Date("2026-01-15"),
        lastActivityAt: new Date("2026-03-10"),
        daysInStage: 14,
        contactEngagementScore: 75,
        emailsSent: 8,
        emailsOpened: 6,
        callsScheduled: 2,
        meetingsAttended: 1,
      };

      const score = service.dealScorer.scoreDeal(deal);

      expect(score.dealId).toBe("deal_123");
      expect(score.closeProbability).toBeGreaterThanOrEqual(0);
      expect(score.closeProbability).toBeLessThanOrEqual(1);
      expect(score.expectedClosingMonth).toBeDefined();
      expect(score.factors).toBeDefined();
      expect(score.riskFactors).toBeDefined();
      expect(Array.isArray(score.explanation)).toBe(true);
      expect(Array.isArray(score.recommendations)).toBe(true);
    });

    it("should identify stagnant deals", () => {
      const deal: Deal = {
        id: "deal_stagnant",
        companyName: "Old Company",
        amount: 25000,
        stage: "qualified",
        createdAt: new Date("2025-06-01"),
        lastActivityAt: new Date("2026-02-01"), // 45+ days ago
        daysInStage: 120,
        contactEngagementScore: 20,
        emailsSent: 3,
        emailsOpened: 1,
        callsScheduled: 0,
        meetingsAttended: 0,
      };

      const score = service.dealScorer.scoreDeal(deal);

      expect(score.riskFactors.stagnantDeal).toBe(true);
      expect(score.closeProbability).toBeLessThan(0.5);
    });

    it("should score advanced stage deals higher", () => {
      const earlyDeal: Deal = {
        id: "deal_early",
        companyName: "Company A",
        amount: 50000,
        stage: "prospect",
        createdAt: new Date("2026-02-01"),
        lastActivityAt: new Date("2026-03-10"),
        daysInStage: 10,
        contactEngagementScore: 60,
        emailsSent: 2,
        emailsOpened: 1,
        callsScheduled: 1,
        meetingsAttended: 0,
      };

      const lateDeal: Deal = {
        id: "deal_late",
        companyName: "Company B",
        amount: 50000,
        stage: "negotiation",
        createdAt: new Date("2026-01-01"),
        lastActivityAt: new Date("2026-03-10"),
        daysInStage: 10,
        contactEngagementScore: 60,
        emailsSent: 8,
        emailsOpened: 7,
        callsScheduled: 3,
        meetingsAttended: 2,
      };

      const earlyScore = service.dealScorer.scoreDeal(earlyDeal);
      const lateScore = service.dealScorer.scoreDeal(lateDeal);

      expect(lateScore.closeProbability).toBeGreaterThan(
        earlyScore.closeProbability,
      );
    });
  });

  describe("LeadScorer", () => {
    it("should score an inbound lead", () => {
      const lead: Lead = {
        id: "lead_123",
        companyName: "Tech Startup",
        email: "info@techstartup.com",
        industry: "technology",
        companySize: "mid",
        budget: 75000,
        purchaseTimeline: "immediate",
        source: "inbound",
      };

      const score = service.leadScorer.scoreLead(lead);

      expect(score.leadId).toBe("lead_123");
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D"]).toContain(score.grade);
      expect(score.factors).toBeDefined();
      expect(Array.isArray(score.explanation)).toBe(true);
      expect(Array.isArray(score.nextSteps)).toBe(true);
    });

    it("should assign grade A for high-quality leads", () => {
      const lead: Lead = {
        id: "lead_quality",
        companyName: "Enterprise Corp",
        email: "contact@enterprise.com",
        industry: "fintech",
        companySize: "enterprise",
        budget: 500000,
        purchaseTimeline: "immediate",
        source: "inbound",
      };

      const score = service.leadScorer.scoreLead(lead);

      expect(score.grade).toBe("A");
      expect(score.score).toBeGreaterThanOrEqual(80);
    });

    it("should score outbound leads lower than inbound", () => {
      const inboundLead: Lead = {
        id: "inbound",
        companyName: "Company A",
        email: "a@example.com",
        industry: "technology",
        companySize: "small",
        budget: 50000,
        purchaseTimeline: "quarter",
        source: "inbound",
      };

      const outboundLead: Lead = {
        id: "outbound",
        companyName: "Company B",
        email: "b@example.com",
        industry: "technology",
        companySize: "small",
        budget: 50000,
        purchaseTimeline: "quarter",
        source: "outbound",
      };

      const inboundScore = service.leadScorer.scoreLead(inboundLead);
      const outboundScore = service.leadScorer.scoreLead(outboundLead);

      expect(inboundScore.score).toBeGreaterThan(outboundScore.score);
    });

    it("should handle missing budget information", () => {
      const lead: Lead = {
        id: "lead_no_budget",
        companyName: "Unknown Budget Co",
        email: "contact@unknown.com",
        industry: "retail",
        companySize: "startup",
        source: "content",
      };

      const score = service.leadScorer.scoreLead(lead);

      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    });
  });

  describe("ActivityRecommender", () => {
    it("should recommend activity for a contact", () => {
      const contact: Contact = {
        id: "contact_123",
        name: "John Doe",
        title: "CEO",
        email: "john@acme.com",
        companyId: "company_123",
        seniority: "c-suite",
        emailsReceived: 5,
        emailsOpened: 4,
        emailsClicked: 2,
      };

      const recommendation =
        service.activityRecommender.recommendActivity(contact);

      expect(recommendation.contactId).toBe("contact_123");
      expect([
        "send_email",
        "schedule_call",
        "schedule_meeting",
        "send_proposal",
        "negotiate",
        "close",
        "nurture",
      ]).toContain(recommendation.recommendedAction);
      expect(recommendation.actionDetails).toBeDefined();
      expect(["immediate", "within_week", "within_month"]).toContain(
        recommendation.actionDetails.timing,
      );
      expect(["high", "medium", "low"]).toContain(
        recommendation.actionDetails.priority,
      );
      expect(Array.isArray(recommendation.reasoning)).toBe(true);
    });

    it("should recommend call for engaged contact without calls", () => {
      const contact: Contact = {
        id: "contact_no_call",
        name: "Jane Smith",
        title: "VP Sales",
        email: "jane@acme.com",
        companyId: "company_123",
        seniority: "vp",
        lastEmailAt: new Date("2026-03-01"),
        emailsReceived: 10,
        emailsOpened: 9,
        emailsClicked: 7,
      };

      const recommendation =
        service.activityRecommender.recommendActivity(contact);

      expect(recommendation.recommendedAction).toBe("schedule_call");
    });

    it("should prioritize stale contacts", () => {
      const contact: Contact = {
        id: "contact_stale",
        name: "Old Contact",
        title: "Manager",
        email: "old@acme.com",
        companyId: "company_123",
        seniority: "manager",
        lastEmailAt: new Date("2026-01-15"), // 60+ days ago
        emailsReceived: 5,
        emailsOpened: 2,
        emailsClicked: 0,
      };

      const recommendation =
        service.activityRecommender.recommendActivity(contact);

      expect(recommendation.actionDetails.priority).toBe("high");
      expect(["immediate"]).toContain(recommendation.actionDetails.timing);
    });
  });

  describe("RelationshipStrengthCalculator", () => {
    it("should calculate relationship strength", () => {
      const contact: Contact = {
        id: "contact_strong",
        name: "Loyal Customer",
        title: "CFO",
        email: "loyal@company.com",
        companyId: "company_123",
        seniority: "c-suite",
        lastEmailAt: new Date("2026-03-10"),
        lastCallAt: new Date("2026-03-08"),
        emailsReceived: 20,
        emailsOpened: 18,
        emailsClicked: 12,
      };

      const strength =
        service.relationshipCalculator.calculateStrength(contact);

      expect(strength.contactId).toBe("contact_strong");
      expect(strength.strength).toBeGreaterThanOrEqual(0);
      expect(strength.strength).toBeLessThanOrEqual(100);
      expect(strength.trustLevel).toBeGreaterThanOrEqual(0);
      expect(strength.trustLevel).toBeLessThanOrEqual(100);
      expect(strength.engagementLevel).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(strength.recommendations)).toBe(true);
    });

    it("should score new contacts lower", () => {
      const newContact: Contact = {
        id: "contact_new",
        name: "New Contact",
        title: "Manager",
        email: "new@company.com",
        companyId: "company_456",
        seniority: "manager",
        emailsReceived: 1,
        emailsOpened: 0,
        emailsClicked: 0,
      };

      const strength =
        service.relationshipCalculator.calculateStrength(newContact);

      expect(strength.strength).toBeLessThan(50);
    });
  });

  describe("SalesForecaster", () => {
    it("should forecast revenue from pipeline", () => {
      const deals: Deal[] = [
        {
          id: "deal_1",
          companyName: "Company 1",
          amount: 100000,
          stage: "proposal",
          createdAt: new Date("2026-01-01"),
          lastActivityAt: new Date("2026-03-10"),
          daysInStage: 20,
          contactEngagementScore: 80,
          emailsSent: 5,
          emailsOpened: 4,
          callsScheduled: 2,
          meetingsAttended: 1,
        },
        {
          id: "deal_2",
          companyName: "Company 2",
          amount: 50000,
          stage: "qualified",
          createdAt: new Date("2026-01-15"),
          lastActivityAt: new Date("2026-03-12"),
          daysInStage: 15,
          contactEngagementScore: 60,
          emailsSent: 3,
          emailsOpened: 2,
          callsScheduled: 1,
          meetingsAttended: 0,
        },
      ];

      const forecast = service.salesForecaster.forecastRevenue(
        deals,
        "2026-Q2",
      );

      expect(forecast.period).toBe("2026-Q2");
      expect(forecast.forecastedRevenue).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(forecast.byStage)).toBe(true);
      expect(forecast.upside).toBeGreaterThanOrEqual(0);
      expect(forecast.downside).toBeGreaterThanOrEqual(0);
    });

    it("should weight advanced stages higher", () => {
      const dealsEarly: Deal[] = [
        {
          id: "deal_early",
          companyName: "Early Stage",
          amount: 100000,
          stage: "lead",
          createdAt: new Date("2026-01-01"),
          lastActivityAt: new Date("2026-03-10"),
          daysInStage: 5,
          contactEngagementScore: 30,
          emailsSent: 1,
          emailsOpened: 0,
          callsScheduled: 0,
          meetingsAttended: 0,
        },
      ];

      const dealsLate: Deal[] = [
        {
          id: "deal_late",
          companyName: "Late Stage",
          amount: 100000,
          stage: "negotiation",
          createdAt: new Date("2026-01-01"),
          lastActivityAt: new Date("2026-03-10"),
          daysInStage: 20,
          contactEngagementScore: 90,
          emailsSent: 10,
          emailsOpened: 9,
          callsScheduled: 5,
          meetingsAttended: 3,
        },
      ];

      const earlyForecast = service.salesForecaster.forecastRevenue(
        dealsEarly,
        "2026-Q2",
      );
      const lateForecast = service.salesForecaster.forecastRevenue(
        dealsLate,
        "2026-Q2",
      );

      expect(lateForecast.forecastedRevenue).toBeGreaterThan(
        earlyForecast.forecastedRevenue,
      );
    });

    it("should identify risk factors for stagnant deals", () => {
      const stagnantDeals: Deal[] = [
        {
          id: "stagnant_1",
          companyName: "Stagnant Co",
          amount: 150000,
          stage: "proposal",
          createdAt: new Date("2025-09-01"),
          lastActivityAt: new Date("2026-02-01"), // 45+ days ago
          daysInStage: 120,
          contactEngagementScore: 20,
          emailsSent: 2,
          emailsOpened: 0,
          callsScheduled: 0,
          meetingsAttended: 0,
        },
      ];

      const forecast = service.salesForecaster.forecastRevenue(
        stagnantDeals,
        "2026-Q2",
      );

      expect(forecast.riskFactors.length).toBeGreaterThan(0);
      expect(forecast.downside).toBeGreaterThan(0);
    });
  });

  describe("Singleton pattern", () => {
    it("should return same instance for repeated calls", () => {
      const instance1 = getCRMIntelligence();
      const instance2 = getCRMIntelligence();

      expect(instance1).toEqual(instance2);
    });
  });
});
