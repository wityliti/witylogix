/**
 * CRM Intelligence Engine
 *
 * Provides intelligent sales operations and customer relationship management:
 * - DealScoringModel: probability of deal closing based on stage, age, activity, contact engagement
 * - LeadScorer: score inbound leads based on firmographic + behavioral signals
 * - ActivityRecommender: suggest next best action per contact (email, call, meeting, demo)
 * - RelationshipStrength: compute strength score based on interaction frequency/recency/sentiment
 * - WinLossAnalyzer: analyze closed-won vs closed-lost patterns
 * - SalesForecaster: predict monthly/quarterly revenue from pipeline
 *
 * All scoring deterministic and explainable with actionable insights.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type DealStage =
  | "lead"
  | "prospect"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed-won"
  | "closed-lost";
export type ActivityType =
  | "email"
  | "call"
  | "meeting"
  | "demo"
  | "proposal"
  | "followup"
  | "other";
export type NextAction =
  | "send_email"
  | "schedule_call"
  | "schedule_meeting"
  | "send_proposal"
  | "negotiate"
  | "close"
  | "nurture";

export interface Deal {
  id: string;
  companyName: string;
  amount: number;
  stage: DealStage;
  createdAt: Date;
  lastActivityAt: Date;
  daysInStage: number;
  contactEngagementScore: number; // 0-100
  emailsSent: number;
  emailsOpened: number;
  callsScheduled: number;
  meetingsAttended: number;
}

export interface Lead {
  id: string;
  companyName: string;
  email: string;
  phone?: string;
  industry: string;
  companySize: "startup" | "small" | "mid" | "enterprise";
  budget?: number;
  purchaseTimeline?: "immediate" | "quarter" | "year" | "exploring";
  source: "inbound" | "outbound" | "referral" | "event" | "content";
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  companyId: string;
  seniority: "c-suite" | "vp" | "manager" | "individual" | "other";
  lastEmailAt?: Date;
  lastCallAt?: Date;
  emailsReceived: number;
  emailsOpened: number;
  emailsClicked: number;
}

export interface DealScore {
  dealId: string;
  closeProbability: number; // 0-1
  expectedClosingMonth: string; // YYYY-MM
  factors: {
    stageScore: number; // how advanced the stage is
    ageScore: number; // how long in current stage
    activityScore: number; // recent engagement
    engagementScore: number; // contact responsiveness
  };
  riskFactors: {
    stagnantDeal: boolean; // no activity in X days
    competitorMention: boolean;
    budgetUncertainty: boolean;
  };
  explanation: string[];
  recommendations: string[];
}

export interface LeadScore {
  leadId: string;
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D"; // A = immediate follow-up, D = nurture
  factors: {
    firmographicScore: number; // company size, industry fit
    behavioralScore: number; // engagement with content
    timelineScore: number; // how ready to buy
    budgetScore: number; // purchasing power
  };
  explanation: string[];
  nextSteps: string[];
}

export interface ActivityRecommendation {
  contactId: string;
  recommendedAction: NextAction;
  actionDetails: {
    type: ActivityType;
    timing: "immediate" | "within_week" | "within_month";
    content?: string;
    priority: "high" | "medium" | "low";
  };
  reasoning: string[];
  estimatedImpact: string; // qualitative impact expectation
}

export interface RelationshipScore {
  contactId: string;
  strength: number; // 0-100
  trustLevel: number; // 0-100
  engagementLevel: number; // 0-100
  factors: {
    interactionFrequency: number; // 0-100
    responseTime: number; // 0-100, higher = faster response
    contentEngagement: number; // 0-100
    recentActivity: boolean;
  };
  recommendations: string[];
}

export interface SalesForecast {
  period: string; // YYYY-MM or YYYY-Q
  forecastedRevenue: number;
  confidence: number; // 0-1
  byStage: {
    stage: DealStage;
    amount: number;
    dealCount: number;
    probability: number;
  }[];
  upside: number; // potential additional revenue
  downside: number; // potential lost revenue
  riskFactors: string[];
}

export interface WinLossAnalysis {
  period: string; // YYYY-MM
  totalWon: number;
  totalLost: number;
  winRate: number; // 0-1
  averageWinSize: number;
  averageLossSize: number;
  commonWinFactors: string[];
  commonLossReasons: string[];
  topCompetitors: { name: string; count: number }[];
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const STAGE_PROGRESSION = {
  lead: 0.1,
  prospect: 0.25,
  qualified: 0.4,
  proposal: 0.65,
  negotiation: 0.85,
  "closed-won": 1.0,
  "closed-lost": 0.0,
};

const ACTIVITY_WEIGHTS = {
  email: 0.3,
  call: 0.4,
  meeting: 0.5,
  demo: 0.6,
  proposal: 0.7,
  followup: 0.2,
  other: 0.1,
};

const DAYS_STAGNANT_THRESHOLD = 14; // 2 weeks without activity = stagnant
const OPTIMAL_RESPONSE_TIME_DAYS = 1; // best response time benchmark

// ─── DEAL SCORING MODEL ────────────────────────────────────────────────────

/**
 * Scores deals based on progression, activity, and engagement
 */
export class DealScoringModel {
  /**
   * Score a deal for probability of closing
   *
   * @example
   * const scorer = new DealScoringModel();
   * const score = scorer.scoreDeal(deal);
   */
  public scoreDeal(deal: Deal): DealScore {
    const stageScore = STAGE_PROGRESSION[deal.stage];
    const ageScore = this.calculateAgeScore(deal.daysInStage);
    const activityScore = this.calculateActivityScore(deal);
    const engagementScore = Math.min(100, deal.contactEngagementScore) / 100;

    // Combine scores with weighting
    const closeProbability =
      stageScore * 0.35 +
      ageScore * 0.2 +
      activityScore * 0.25 +
      engagementScore * 0.2;

    // Identify risk factors
    const riskFactors = {
      stagnantDeal: this.isStagnant(deal),
      competitorMention: false, // would need additional data
      budgetUncertainty: false, // would need additional data
    };

    // Expected closing (rough estimate based on stage)
    const expectedClosingMonth = this.estimateClosingMonth(
      deal.stage,
      deal.daysInStage,
    );

    // Generate explanations
    const explanation = this.generateDealExplanations(
      deal,
      stageScore,
      ageScore,
      activityScore,
      engagementScore,
    );

    // Generate recommendations
    const recommendations = this.generateDealRecommendations(
      deal,
      closeProbability,
      riskFactors,
    );

    return {
      dealId: deal.id,
      closeProbability: Math.min(1, Math.max(0, closeProbability)),
      expectedClosingMonth,
      factors: {
        stageScore,
        ageScore,
        activityScore,
        engagementScore,
      },
      riskFactors,
      explanation,
      recommendations,
    };
  }

  private calculateAgeScore(daysInStage: number): number {
    // Optimal is 5-20 days per stage
    // Too quick = unclear if ready, too slow = stagnant
    if (daysInStage < 3) return 0.6; // too rushed
    if (daysInStage < 10) return 0.9;
    if (daysInStage < 20) return 0.95; // optimal range
    if (daysInStage < 30) return 0.8;
    if (daysInStage < 60) return 0.5;
    return 0.2; // very old
  }

  private calculateActivityScore(deal: Deal): number {
    // Score based on recent engagement
    const now = new Date();
    const daysSinceActivity = Math.floor(
      (now.getTime() - deal.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    let score = 0;

    // Recency
    if (daysSinceActivity <= 1) score += 0.4;
    else if (daysSinceActivity <= 3) score += 0.3;
    else if (daysSinceActivity <= 7) score += 0.2;
    else if (daysSinceActivity <= 14) score += 0.1;

    // Email engagement
    if (deal.emailsOpened > 0) {
      const openRate = deal.emailsOpened / Math.max(1, deal.emailsSent);
      score += Math.min(0.3, openRate * 0.3);
    }

    // Meeting engagement
    if (deal.meetingsAttended > 0) {
      score += 0.3;
    }

    return Math.min(1, score);
  }

  private isStagnant(deal: Deal): boolean {
    const now = new Date();
    const daysSinceActivity = Math.floor(
      (now.getTime() - deal.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSinceActivity > DAYS_STAGNANT_THRESHOLD;
  }

  private estimateClosingMonth(stage: DealStage, daysInStage: number): string {
    // Estimate based on stage and velocity
    const stagesRemaining = {
      lead: 4,
      prospect: 3,
      qualified: 2,
      proposal: 1,
      negotiation: 0.5,
      "closed-won": 0,
      "closed-lost": -1,
    };

    const daysPerStage = 12; // rough average
    const remainingDays = stagesRemaining[stage] * daysPerStage;
    const closingDate = new Date();
    closingDate.setDate(closingDate.getDate() + remainingDays);

    return closingDate.toISOString().slice(0, 7);
  }

  private generateDealExplanations(
    deal: Deal,
    stageScore: number,
    ageScore: number,
    activityScore: number,
    engagementScore: number,
  ): string[] {
    const explanations: string[] = [];

    // Stage insights
    if (deal.stage === "proposal" || deal.stage === "negotiation") {
      explanations.push(
        "Deal is in advanced stage - focus on closing activities",
      );
    } else if (deal.stage === "lead" || deal.stage === "prospect") {
      explanations.push(
        "Deal is early stage - focus on qualification and engagement",
      );
    }

    // Age insights
    if (ageScore < 0.5) {
      explanations.push(
        "Deal is spending significant time in current stage - accelerate or reassess fit",
      );
    }

    // Activity insights
    if (activityScore > 0.7) {
      explanations.push("Strong recent activity - momentum is building");
    } else if (activityScore < 0.3) {
      explanations.push(
        "Low activity level - increase engagement or follow up",
      );
    }

    // Engagement insights
    if (deal.emailsOpened / Math.max(1, deal.emailsSent) > 0.5) {
      explanations.push("Contact is responsive to emails");
    }
    if (deal.meetingsAttended > 0) {
      explanations.push("Contact willing to meet - strong buying signal");
    }

    return explanations;
  }

  private generateDealRecommendations(
    deal: Deal,
    closeProbability: number,
    riskFactors: {
      stagnantDeal: boolean;
      competitorMention: boolean;
      budgetUncertainty: boolean;
    },
  ): string[] {
    const recommendations: string[] = [];

    if (closeProbability > 0.7) {
      recommendations.push(
        "High probability of close - prioritize closing activities",
      );
    } else if (closeProbability < 0.3) {
      recommendations.push(
        "Low probability - consider re-qualification or moving to nurture",
      );
    }

    if (riskFactors.stagnantDeal) {
      recommendations.push(
        "Deal is stagnant - send urgent check-in or re-engage",
      );
    }

    if (deal.stage === "proposal") {
      recommendations.push("Schedule negotiation call to address questions");
    }

    return recommendations;
  }
}

// ─── LEAD SCORER ────────────────────────────────────────────────────────────

/**
 * Scores inbound leads based on fit and readiness
 */
export class LeadScorer {
  /**
   * Score an inbound lead
   *
   * @example
   * const scorer = new LeadScorer();
   * const score = scorer.scoreLead(lead);
   */
  public scoreLead(lead: Lead): LeadScore {
    const firmographicScore = this.calculateFirmographicScore(lead);
    const behavioralScore = this.calculateBehavioralScore(lead);
    const timelineScore = this.calculateTimelineScore(lead);
    const budgetScore = this.calculateBudgetScore(lead);

    const overallScore =
      (firmographicScore + behavioralScore + timelineScore + budgetScore) / 4;
    const grade = this.determineGrade(overallScore);

    const explanation = this.generateLeadExplanations(
      lead,
      firmographicScore,
      behavioralScore,
      timelineScore,
      budgetScore,
    );
    const nextSteps = this.generateLeadNextSteps(lead, grade);

    return {
      leadId: lead.id,
      score: Math.round(overallScore),
      grade,
      factors: {
        firmographicScore,
        behavioralScore,
        timelineScore,
        budgetScore,
      },
      explanation,
      nextSteps,
    };
  }

  private calculateFirmographicScore(lead: Lead): number {
    let score = 0;

    // Company size fit (assuming B2B SaaS target)
    switch (lead.companySize) {
      case "enterprise":
        score += 30;
        break;
      case "mid":
        score += 25;
        break;
      case "small":
        score += 15;
        break;
      case "startup":
        score += 10;
        break;
    }

    // Industry fit (technology-forward industries score higher)
    const techIndustries = [
      "technology",
      "fintech",
      "ecommerce",
      "saas",
      "healthcare",
      "logistics",
    ];
    if (techIndustries.includes(lead.industry.toLowerCase())) {
      score += 40;
    } else {
      score += 20;
    }

    return Math.min(100, score);
  }

  private calculateBehavioralScore(lead: Lead): number {
    // Score based on source (some sources are warmer than others)
    const sourceScores: Record<string, number> = {
      inbound: 100, // best - they came to you
      referral: 85,
      event: 70,
      content: 55,
      outbound: 40,
    };

    return sourceScores[lead.source] || 0;
  }

  private calculateTimelineScore(lead: Lead): number {
    const timelineScores: Record<string, number> = {
      immediate: 100,
      quarter: 75,
      year: 40,
      exploring: 10,
    };

    return timelineScores[lead.purchaseTimeline || "exploring"] || 0;
  }

  private calculateBudgetScore(lead: Lead): number {
    if (!lead.budget) return 20; // unknown budget

    if (lead.budget >= 100000) return 100;
    if (lead.budget >= 50000) return 80;
    if (lead.budget >= 25000) return 60;
    if (lead.budget >= 10000) return 40;
    return 15;
  }

  private determineGrade(score: number): "A" | "B" | "C" | "D" {
    if (score >= 80) return "A";
    if (score >= 65) return "B";
    if (score >= 50) return "C";
    return "D";
  }

  private generateLeadExplanations(
    lead: Lead,
    firmographicScore: number,
    behavioralScore: number,
    timelineScore: number,
    budgetScore: number,
  ): string[] {
    const explanations: string[] = [];

    if (firmographicScore > 70) {
      explanations.push("Strong company fit based on size and industry");
    }

    if (lead.source === "inbound") {
      explanations.push("Inbound lead indicates high intent");
    }

    if (lead.purchaseTimeline === "immediate") {
      explanations.push("Timeline indicates immediate purchase intent");
    }

    if (budgetScore > 30 && lead.budget) {
      explanations.push(`Adequate budget available (${lead.budget})`);
    }

    return explanations;
  }

  private generateLeadNextSteps(lead: Lead, grade: string): string[] {
    const steps: string[] = [];

    if (grade === "A") {
      steps.push("Schedule discovery call immediately");
      steps.push("Prepare detailed product demo");
    } else if (grade === "B") {
      steps.push("Send personalized introduction email");
      steps.push("Schedule call within 3 days");
    } else if (grade === "C") {
      steps.push("Add to nurture campaign");
      steps.push("Share relevant content");
    } else {
      steps.push("Add to long-term nurture list");
      steps.push("Monitor for engagement");
    }

    return steps;
  }
}

// ─── ACTIVITY RECOMMENDER ──────────────────────────────────────────────────

/**
 * Recommends next best action for sales reps
 */
export class ActivityRecommender {
  /**
   * Recommend next best action for a contact
   *
   * @example
   * const recommender = new ActivityRecommender();
   * const action = recommender.recommendActivity(contact, deal);
   */
  public recommendActivity(
    contact: Contact,
    deal?: Deal,
  ): ActivityRecommendation {
    const actionType = this.selectActionType(contact, deal);
    const timing = this.selectTiming(contact, deal);
    const priority = this.calculatePriority(contact, deal);

    const reasoning = this.generateReasoning(contact, deal, actionType);
    const estimatedImpact = this.estimateImpact(actionType);

    return {
      contactId: contact.id,
      recommendedAction: actionType,
      actionDetails: {
        type: this.mapActionToType(actionType),
        timing,
        priority,
      },
      reasoning,
      estimatedImpact,
    };
  }

  private selectActionType(contact: Contact, deal?: Deal): NextAction {
    // If no recent email, send email
    if (!contact.lastEmailAt) {
      return "send_email";
    }

    const daysSinceEmail = Math.floor(
      (Date.now() - (contact.lastEmailAt?.getTime() || 0)) /
        (1000 * 60 * 60 * 24),
    );

    // If email was opened recently but not responded to, send follow-up email
    if (daysSinceEmail <= 3 && contact.emailsOpened > contact.emailsClicked) {
      return "send_email";
    }

    // If no call scheduled, schedule call
    if (!contact.lastCallAt) {
      return "schedule_call";
    }

    // If deal is advanced, send proposal
    if (deal && deal.stage >= "qualified") {
      return "send_proposal";
    }

    // Default to email if unsure
    return "send_email";
  }

  private selectTiming(
    contact: Contact,
    deal?: Deal,
  ): "immediate" | "within_week" | "within_month" {
    if (deal && deal.stage === "proposal") {
      return "immediate";
    }

    const lastActivity = contact.lastEmailAt || contact.lastCallAt;
    if (!lastActivity) {
      return "immediate";
    }

    const daysSinceActivity = Math.floor(
      (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceActivity > 7) {
      return "immediate";
    }
    if (daysSinceActivity > 3) {
      return "within_week";
    }
    return "within_month";
  }

  private calculatePriority(
    contact: Contact,
    deal?: Deal,
  ): "high" | "medium" | "low" {
    if (deal && deal.stage === "proposal") {
      return "high";
    }

    const lastActivity = contact.lastEmailAt || contact.lastCallAt;
    const daysSinceActivity = Math.floor(
      (Date.now() - (lastActivity?.getTime() || 0)) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceActivity > 14) {
      return "high";
    }
    if (daysSinceActivity > 7) {
      return "medium";
    }
    return "low";
  }

  private generateReasoning(
    contact: Contact,
    deal: Deal | undefined,
    action: NextAction,
  ): string[] {
    const reasoning: string[] = [];

    switch (action) {
      case "send_email":
        reasoning.push("Email is the least intrusive way to engage");
        break;
      case "schedule_call":
        reasoning.push("Moving to synchronous communication to build rapport");
        break;
      case "send_proposal":
        reasoning.push("Deal is qualified - proposal will move deal forward");
        break;
    }

    if (contact.seniority === "c-suite") {
      reasoning.push("Contact is at executive level - prioritize");
    }

    if (contact.emailsOpened > contact.emailsReceived * 0.5) {
      reasoning.push("Contact is responsive to email communications");
    }

    return reasoning;
  }

  private estimateImpact(action: NextAction): string {
    const impacts: Record<NextAction, string> = {
      send_email: "Low engagement, wide reach, easy to scale",
      schedule_call: "High engagement, builds relationship, time-intensive",
      schedule_meeting: "Very high engagement, strong buying signal",
      send_proposal: "Deal advancement, creates decision point",
      negotiate: "Final push to close",
      close: "Revenue generation",
      nurture: "Long-term pipeline building",
    };

    return impacts[action] || "Unknown impact";
  }

  private mapActionToType(action: NextAction): ActivityType {
    const mapping: Record<NextAction, ActivityType> = {
      send_email: "email",
      schedule_call: "call",
      schedule_meeting: "meeting",
      send_proposal: "proposal",
      negotiate: "call",
      close: "meeting",
      nurture: "email",
    };

    return mapping[action];
  }
}

// ─── RELATIONSHIP STRENGTH CALCULATOR ───────────────────────────────────────

/**
 * Calculates relationship strength based on interaction patterns
 */
export class RelationshipStrengthCalculator {
  /**
   * Calculate relationship strength with a contact
   *
   * @example
   * const calc = new RelationshipStrengthCalculator();
   * const strength = calc.calculateStrength(contact);
   */
  public calculateStrength(contact: Contact): RelationshipScore {
    const interactionFrequency = this.calculateInteractionFrequency(contact);
    const responseTime = this.calculateResponseTimeFactor(contact);
    const contentEngagement = this.calculateContentEngagement(contact);
    const recentActivity =
      contact.lastEmailAt || contact.lastCallAt ? true : false;

    const strength =
      (interactionFrequency + responseTime + contentEngagement) / 3;
    const trustLevel = Math.min(
      100,
      strength * 0.8 + (recentActivity ? 20 : 0),
    );
    const engagementLevel = contentEngagement;

    const recommendations = this.generateRecommendations(contact, strength);

    return {
      contactId: contact.id,
      strength: Math.round(strength),
      trustLevel: Math.round(trustLevel),
      engagementLevel: Math.round(engagementLevel),
      factors: {
        interactionFrequency,
        responseTime,
        contentEngagement,
        recentActivity,
      },
      recommendations,
    };
  }

  private calculateInteractionFrequency(contact: Contact): number {
    // Score based on total interactions
    const totalInteractions = contact.emailsReceived;

    if (totalInteractions >= 10) return 100;
    if (totalInteractions >= 5) return 80;
    if (totalInteractions >= 3) return 60;
    if (totalInteractions >= 1) return 40;
    return 10;
  }

  private calculateResponseTimeFactor(contact: Contact): number {
    // Score based on responsiveness (opens + clicks)
    const responseRate =
      (contact.emailsOpened + contact.emailsClicked) /
      Math.max(1, contact.emailsReceived);

    return Math.min(100, responseRate * 100);
  }

  private calculateContentEngagement(contact: Contact): number {
    // Score based on clicks vs opens
    if (contact.emailsOpened === 0) return 0;

    const clickThroughRate = contact.emailsClicked / contact.emailsOpened;
    return Math.min(100, clickThroughRate * 100);
  }

  private generateRecommendations(
    contact: Contact,
    strength: number,
  ): string[] {
    const recommendations: string[] = [];

    if (strength < 40) {
      recommendations.push(
        "Relationship is new - focus on building trust with regular contact",
      );
    } else if (strength < 70) {
      recommendations.push(
        "Relationship is developing - increase engagement frequency",
      );
    } else {
      recommendations.push(
        "Strong relationship - explore expansion opportunities",
      );
    }

    if (contact.seniority === "c-suite" && strength > 70) {
      recommendations.push(
        "Leverage this executive relationship for account expansion",
      );
    }

    return recommendations;
  }
}

// ─── SALES FORECASTER ──────────────────────────────────────────────────────

/**
 * Forecasts monthly and quarterly revenue
 */
export class SalesForecaster {
  /**
   * Forecast revenue for a period
   *
   * @example
   * const forecaster = new SalesForecaster();
   * const forecast = forecaster.forecastRevenue(deals, 'Q1');
   */
  public forecastRevenue(deals: Deal[], period: string): SalesForecast {
    let forecastedRevenue = 0;
    let totalConfidence = 0;
    const byStage: SalesForecast["byStage"] = [];

    const stageGroups = this.groupByStage(deals);

    for (const [stage, stageDealas] of Object.entries(stageGroups)) {
      if (stageDealas.length === 0) continue;

      const stageDeals = stageDealas as Deal[];
      const totalAmount = stageDeals.reduce((sum, d) => sum + d.amount, 0);
      const probability = STAGE_PROGRESSION[stage as DealStage];

      const stageRevenue = totalAmount * probability;
      forecastedRevenue += stageRevenue;
      totalConfidence += probability * stageDeals.length;

      byStage.push({
        stage: stage as DealStage,
        amount: stageRevenue,
        dealCount: stageDeals.length,
        probability,
      });
    }

    const confidence = totalConfidence / Math.max(1, deals.length);
    const upside = this.calculateUpside(deals);
    const downside = this.calculateDownside(deals);
    const riskFactors = this.identifyRiskFactors(deals);

    return {
      period,
      forecastedRevenue: Math.round(forecastedRevenue),
      confidence: Math.min(1, confidence),
      byStage,
      upside: Math.round(upside),
      downside: Math.round(downside),
      riskFactors,
    };
  }

  private groupByStage(deals: Deal[]): Record<string, Deal[]> {
    const groups: Record<string, Deal[]> = {};

    for (const deal of deals) {
      if (!groups[deal.stage]) {
        groups[deal.stage] = [];
      }
      groups[deal.stage].push(deal);
    }

    return groups;
  }

  private calculateUpside(deals: Deal[]): number {
    // Upside = deals in proposal/negotiation that could close at full value
    const advancedDeals = deals.filter(
      (d) => d.stage === "proposal" || d.stage === "negotiation",
    );
    return advancedDeals.reduce((sum, d) => sum + d.amount * 0.2, 0); // 20% upside potential
  }

  private calculateDownside(deals: Deal[]): number {
    // Downside = deals at risk of not closing
    const atRiskDeals = deals.filter((d) => {
      const now = new Date();
      const daysSinceActivity = Math.floor(
        (now.getTime() - d.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysSinceActivity > DAYS_STAGNANT_THRESHOLD;
    });

    return atRiskDeals.reduce((sum, d) => sum + d.amount * 0.5, 0); // 50% risk of loss
  }

  private identifyRiskFactors(deals: Deal[]): string[] {
    const risks: string[] = [];

    const stagnantCount = deals.filter((d) => {
      const now = new Date();
      const daysSinceActivity = Math.floor(
        (now.getTime() - d.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysSinceActivity > DAYS_STAGNANT_THRESHOLD;
    }).length;

    if (stagnantCount > 0) {
      risks.push(`${stagnantCount} deals are stagnant and at risk`);
    }

    const avgDealSize =
      deals.reduce((sum, d) => sum + d.amount, 0) / Math.max(1, deals.length);
    const largeDeals = deals.filter((d) => d.amount > avgDealSize * 2);
    if (largeDeals.length > 0) {
      risks.push(
        `${largeDeals.length} large deals could significantly impact forecast if lost`,
      );
    }

    return risks;
  }
}

// ─── FACTORY & SINGLETON ────────────────────────────────────────────────────

/**
 * Create a new CRM intelligence service
 */
export function createCRMIntelligence(): {
  dealScorer: DealScoringModel;
  leadScorer: LeadScorer;
  activityRecommender: ActivityRecommender;
  relationshipCalculator: RelationshipStrengthCalculator;
  salesForecaster: SalesForecaster;
} {
  return {
    dealScorer: new DealScoringModel(),
    leadScorer: new LeadScorer(),
    activityRecommender: new ActivityRecommender(),
    relationshipCalculator: new RelationshipStrengthCalculator(),
    salesForecaster: new SalesForecaster(),
  };
}

let crmIntelligenceInstance: ReturnType<typeof createCRMIntelligence> | null =
  null;

/**
 * Get singleton instance of CRM intelligence
 */
export function getCRMIntelligence(): ReturnType<typeof createCRMIntelligence> {
  if (!crmIntelligenceInstance) {
    crmIntelligenceInstance = createCRMIntelligence();
  }
  return crmIntelligenceInstance;
}
