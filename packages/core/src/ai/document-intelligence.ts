/**
 * Document Intelligence
 *
 * AI module for legal document analysis:
 * - DocumentClassifier: Identify contract type (contract/NDA/SOW/amendment/addendum)
 * - FieldExtractor: Extract party names, dates, amounts, terms, obligations
 * - RiskAnalyzer: Identify unusual clauses, missing standard clauses, liability gaps
 * - CompletionPredictor: Predict signing time based on doc complexity and signer count
 * - SignatureReadinessScorer: Rate document completeness and compliance
 * - VersionComparator: Diff versions and highlight risk delta
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface DocumentAnalysis {
  documentId: string;
  classification: DocumentClassification;
  extractedFields: ExtractedFields;
  riskAssessment: RiskAssessment;
  signingTimeEstimate: SigningTimeEstimate;
  readinessScore: ReadinessScore;
}

export interface DocumentClassification {
  type:
    | "contract"
    | "nda"
    | "statement_of_work"
    | "amendment"
    | "addendum"
    | "unknown";
  confidence: number; // 0-1
  indicators: string[]; // Features that determined classification
}

export interface ExtractedFields {
  parties: PartyInfo[];
  effectiveDate?: Date;
  expirationDate?: Date;
  terminationDate?: Date;
  amounts: AmountInfo[];
  obligations: Obligation[];
  keyTerms: Map<string, string>;
}

export interface PartyInfo {
  role: "provider" | "customer" | "beneficiary" | "guarantor" | "unknown";
  name: string;
  legalEntity?: string;
  jurisdiction?: string;
  confidence: number;
}

export interface AmountInfo {
  type: "payment" | "penalty" | "insurance" | "indemnity" | "limit";
  value: number;
  currency: string;
  context: string;
}

export interface Obligation {
  party: string;
  description: string;
  type:
    | "performance"
    | "payment"
    | "confidentiality"
    | "indemnity"
    | "insurance";
  dueDate?: Date;
  mandatory: boolean;
  confidence?: number;
}

export interface RiskAssessment {
  overallRiskScore: number; // 0-100, higher = riskier
  riskLevel: "low" | "medium" | "high" | "critical";
  unusualClauses: RiskClause[];
  missingClauses: string[];
  liabilityGaps: LiabilityGap[];
  nonCompeteScope: string | null;
  indemnificationGaps: string[];
  recommendations: string[];
}

export interface RiskClause {
  text: string;
  severity: "low" | "medium" | "high";
  reason: string;
  suggestedRevision?: string;
}

export interface LiabilityGap {
  description: string;
  exposure: "unlimited" | "capped" | "excluded";
  suggestedCap?: number;
}

export interface SigningTimeEstimate {
  estimatedDaysToSign: number;
  confidence: number; // 0-1
  factors: {
    documentComplexity: string;
    numberOfSigners: number;
    missingFieldsCount: number;
    unusualClausesCount: number;
  };
}

export interface ReadinessScore {
  score: number; // 0-100
  completeness: number; // 0-100
  fieldPlacement: number; // 0-100
  signerInfoQuality: number; // 0-100
  templateCompliance: number; // 0-100
  issues: ReadinessIssue[];
}

export interface ReadinessIssue {
  severity: "warning" | "error";
  field: string;
  message: string;
}

export interface VersionDifference {
  section: string;
  previousText: string;
  currentText: string;
  changeType: "added" | "removed" | "modified";
  riskDelta: number; // -100 to 100, positive = riskier
}

export interface VersionComparisonResult {
  differences: VersionDifference[];
  overallRiskDelta: number;
  summary: string;
}

// ─── DOCUMENT CLASSIFIER ────────────────────────────────────────────────────

export class DocumentClassifier {
  private classificationPatterns: Map<
    DocumentClassification["type"],
    { keywords: string[]; weight: number }
  > = new Map([
    [
      "contract",
      {
        keywords: [
          "agreement",
          "contract",
          "terms and conditions",
          "purchase agreement",
          "service agreement",
        ],
        weight: 1.0,
      },
    ],
    [
      "nda",
      {
        keywords: [
          "confidential",
          "proprietary",
          "non-disclosure",
          "secret",
          "confidentiality agreement",
        ],
        weight: 1.1,
      },
    ],
    [
      "statement_of_work",
      {
        keywords: [
          "statement of work",
          "sow",
          "deliverables",
          "scope of work",
          "project plan",
        ],
        weight: 1.0,
      },
    ],
    [
      "amendment",
      {
        keywords: [
          "amendment",
          "modification",
          "amend",
          "hereby amended",
          "in modification",
        ],
        weight: 1.2,
      },
    ],
    [
      "addendum",
      {
        keywords: [
          "addendum",
          "exhibit",
          "appendix",
          "schedule",
          "attached as",
        ],
        weight: 1.0,
      },
    ],
  ]);

  classify(documentContent: string): DocumentClassification {
    const contentLower = documentContent.toLowerCase();
    const scores: Record<string, number> = {};

    this.classificationPatterns.forEach((pattern, type) => {
      let score = 0;
      pattern.keywords.forEach((keyword) => {
        const matches = (contentLower.match(new RegExp(keyword, "gi")) || [])
          .length;
        score += matches * pattern.weight;
      });
      scores[type] = score;
    });

    const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const [topType, topScore] = entries[0] || ["unknown", 0];
    const secondScore = entries[1]?.[1] || 0;

    const confidence = Math.min(1, topScore / (topScore + secondScore + 1));

    return {
      type: (topType === "unknown"
        ? "unknown"
        : topType) as DocumentClassification["type"],
      confidence,
      indicators: this.extractIndicators(contentLower),
    };
  }

  private extractIndicators(contentLower: string): string[] {
    const indicators: string[] = [];

    if (
      contentLower.includes("nda") ||
      contentLower.includes("confidentiality")
    ) {
      indicators.push("NDA language detected");
    }
    if (
      contentLower.includes("deliverables") ||
      contentLower.includes("scope of work")
    ) {
      indicators.push("SOW deliverables found");
    }
    if (
      contentLower.includes("hereby amended") ||
      contentLower.includes("amendment")
    ) {
      indicators.push("Amendment language detected");
    }
    if (contentLower.includes("exhibit") || contentLower.includes("appendix")) {
      indicators.push("Exhibit/Appendix structure");
    }

    return indicators;
  }
}

// ─── FIELD EXTRACTOR ────────────────────────────────────────────────────────

export class FieldExtractor {
  extractFields(documentContent: string): ExtractedFields {
    const parties = this.extractParties(documentContent);
    const dates = this.extractDates(documentContent);
    const amounts = this.extractAmounts(documentContent);
    const obligations = this.extractObligations(documentContent);
    const keyTerms = this.extractKeyTerms(documentContent);

    return {
      parties,
      effectiveDate: dates.effective,
      expirationDate: dates.expiration,
      terminationDate: dates.termination,
      amounts,
      obligations,
      keyTerms,
    };
  }

  private extractParties(content: string): PartyInfo[] {
    const parties: PartyInfo[] = [];
    const providerPatterns = [
      /(?:Provider|Vendor|Supplier|Service Provider)[\s:]+([A-Z][^\n,]+)/gi,
      /(?:This Agreement is between|By and between)\s+([A-Z][^,]+?)\s+and/gi,
    ];

    const customerPatterns = [
      /(?:Customer|Client|Buyer)[\s:]+([A-Z][^\n,]+)/gi,
      /and\s+([A-Z][^\n,\.]+)(?:\s|,|\.)/gi,
    ];

    const allMatches = new Set<string>();

    [...providerPatterns, ...customerPatterns].forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) allMatches.add(match[1].trim());
      }
    });

    let isProvider = true;
    allMatches.forEach((name) => {
      if (name && name.length > 0) {
        parties.push({
          role: isProvider ? "provider" : "customer",
          name,
          confidence: 0.7,
        });
        isProvider = false;
      }
    });

    return parties.slice(0, 5); // Limit to 5 parties
  }

  private extractDates(content: string): {
    effective?: Date;
    expiration?: Date;
    termination?: Date;
  } {
    const datePattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g;
    const dateMatches = content.match(datePattern) || [];

    const dates: { effective?: Date; expiration?: Date; termination?: Date } =
      {};

    const effectiveRegex =
      /(?:effective|commencement)\s+(?:date)?[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/gi;
    const expirationRegex =
      /(?:expiration|term)\s+(?:date)?[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/gi;
    const terminationRegex =
      /(?:termination|end)\s+(?:date)?[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/gi;

    const effectiveMatch = content.match(effectiveRegex);
    if (effectiveMatch) dates.effective = this.parseDate(effectiveMatch[0]);

    const expirationMatch = content.match(expirationRegex);
    if (expirationMatch) dates.expiration = this.parseDate(expirationMatch[0]);

    const terminationMatch = content.match(terminationRegex);
    if (terminationMatch)
      dates.termination = this.parseDate(terminationMatch[0]);

    if (!dates.effective && dateMatches.length > 0) {
      dates.effective = this.parseDate(dateMatches[0] || "");
    }

    return dates;
  }

  private parseDate(dateStr: string): Date {
    const cleaned = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (!cleaned) return new Date();

    const [, month, day, year] = cleaned;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  private extractAmounts(content: string): AmountInfo[] {
    const amounts: AmountInfo[] = [];
    const currencyPattern = /[$€£¥]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g;

    const seen = new Set<string>();
    let match;

    while ((match = currencyPattern.exec(content)) !== null) {
      const value = parseFloat(match[1].replace(/,/g, ""));
      if (value > 100 && !seen.has(match[0])) {
        const startIdx = Math.max(0, (match.index || 0) - 50);
        const endIdx = Math.min(content.length, (match.index || 0) + 50);
        const context = content.substring(startIdx, endIdx);

        let type: AmountInfo["type"] = "payment";
        if (context.toLowerCase().includes("penalty")) type = "penalty";
        if (context.toLowerCase().includes("insurance")) type = "insurance";
        if (context.toLowerCase().includes("indemnif")) type = "indemnity";
        if (context.toLowerCase().includes("limit")) type = "limit";

        amounts.push({
          type,
          value,
          currency: match[0].match(/[$€£¥]/)?.[0] || "USD",
          context: context.trim(),
        });

        seen.add(match[0]);
      }
    }

    return amounts.slice(0, 10);
  }

  private extractObligations(content: string): Obligation[] {
    const obligations: Obligation[] = [];
    const obligationPatterns = [
      /([A-Z][a-z]+)\s+shall\s+([^.]+)\./gi,
      /([A-Z][a-z]+)\s+must\s+([^.]+)\./gi,
      /([A-Z][a-z]+)\s+(?:agrees?|is responsible for)\s+([^.]+)\./gi,
    ];

    let count = 0;
    obligationPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null && count < 15) {
        const party = match[1];
        const description = match[2];

        let type: Obligation["type"] = "performance";
        if (description.toLowerCase().includes("pay")) type = "payment";
        if (description.toLowerCase().includes("confidential"))
          type = "confidentiality";
        if (description.toLowerCase().includes("indemnif")) type = "indemnity";

        obligations.push({
          party,
          description: description.substring(0, 200),
          type,
          mandatory: true,
          confidence: 0.8,
        });
        count++;
      }
    });

    return obligations;
  }

  private extractKeyTerms(content: string): Map<string, string> {
    const keyTerms = new Map<string, string>();
    const termPatterns = [
      /(?:Definition|Defined Term)[\s:]+(?:"?([^"\.]+)"?)/gi,
      /(?:"([^"]+)"\s+(?:means|is defined as|shall mean))\s+([^.]+)\./gi,
    ];

    termPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && match[2]) {
          keyTerms.set(match[1], match[2].substring(0, 200));
        } else if (match[1]) {
          keyTerms.set(match[1], "See document for definition");
        }
      }
    });

    return keyTerms;
  }
}

// ─── RISK ANALYZER ──────────────────────────────────────────────────────────

export class RiskAnalyzer {
  private standardClauses = [
    "limitation of liability",
    "indemnification",
    "confidentiality",
    "termination",
    "force majeure",
    "governing law",
    "dispute resolution",
    "insurance",
  ];

  analyzeRisk(
    documentContent: string,
    extractedFields: ExtractedFields,
  ): RiskAssessment {
    const contentLower = documentContent.toLowerCase();
    const unusualClauses = this.findUnusualClauses(documentContent);
    const missingClauses = this.findMissingClauses(contentLower);
    const liabilityGaps = this.analyzeLibilityCaps(documentContent);
    const nonCompeteScope = this.extractNonCompeteScope(documentContent);
    const indemnificationGaps = this.analyzeIndemnification(documentContent);

    const riskScore = this.calculateRiskScore(
      unusualClauses,
      missingClauses,
      liabilityGaps,
      indemnificationGaps,
    );

    return {
      overallRiskScore: riskScore,
      riskLevel:
        riskScore > 70
          ? "critical"
          : riskScore > 50
            ? "high"
            : riskScore > 30
              ? "medium"
              : "low",
      unusualClauses,
      missingClauses,
      liabilityGaps,
      nonCompeteScope,
      indemnificationGaps,
      recommendations: this.generateRecommendations(
        riskScore,
        unusualClauses,
        missingClauses,
      ),
    };
  }

  private findUnusualClauses(content: string): RiskClause[] {
    const clauses: RiskClause[] = [];

    const problematicPatterns: Array<
      [RegExp, string, "high" | "medium" | "low"]
    > = [
      [/unlimited\s+liability/gi, "Unlimited liability exposure", "high"],
      [
        /indemnify.*entire\s+liability/gi,
        "Broad indemnification scope",
        "high",
      ],
      [/no\s+warranty/gi, "No warranty provided", "medium"],
      [/material\s+breach[^.]+30\s+days/gi, "Extended cure period", "low"],
      [
        /sole\s+and\s+exclusive\s+remedy/gi,
        "Exclusive remedy clause",
        "medium",
      ],
      [/non-compete[^.]+perpetual/gi, "Perpetual non-compete", "high"],
      [/automatic\s+renewal/gi, "Auto-renewal clause", "medium"],
    ];

    problematicPatterns.forEach(([pattern, reason, severity]) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        clauses.push({
          text: match[0],
          severity,
          reason,
        });
      }
    });

    return clauses.slice(0, 10);
  }

  private findMissingClauses(contentLower: string): string[] {
    return this.standardClauses.filter(
      (clause) => !contentLower.includes(clause),
    );
  }

  private analyzeLibilityCaps(content: string): LiabilityGap[] {
    const gaps: LiabilityGap[] = [];

    const capPattern =
      /(?:limitation of|cap on).*liability.*(?:to\s+)?(?:[$])?(\d+(?:,\d{3})*)/gi;

    let foundCap = false;
    let match;
    while ((match = capPattern.exec(content)) !== null) {
      foundCap = true;
      const cap = parseFloat(match[1].replace(/,/g, ""));
      if (cap < 100000) {
        gaps.push({
          description: "Liability cap may be inadequate for contract value",
          exposure: "capped",
          suggestedCap: cap * 2,
        });
      }
    }

    if (!foundCap && content.toLowerCase().includes("liability")) {
      gaps.push({
        description: "No explicit liability cap found",
        exposure: "unlimited",
        suggestedCap: 1000000,
      });
    }

    return gaps;
  }

  private extractNonCompeteScope(content: string): string | null {
    const ncPattern =
      /non-?compete[^.]*(?:for\s+)?(\d+)\s+(?:months?|years?)[^.]*(?:within\s+)?([^\.]*)(?:\.|[,\)])/gi;
    const match = ncPattern.exec(content);
    return match ? `${match[1]} ${match[2]}` : null;
  }

  private analyzeIndemnification(content: string): string[] {
    const gaps: string[] = [];
    const contentLower = content.toLowerCase();

    if (!contentLower.includes("indemnif")) {
      gaps.push("No indemnification clause present");
    } else if (
      !contentLower.includes("breach") ||
      !contentLower.includes("third party")
    ) {
      gaps.push("Indemnification scope may be incomplete");
    }

    if (
      !contentLower.includes("defend") ||
      !contentLower.includes("hold harmless")
    ) {
      gaps.push("Missing defense and hold harmless obligations");
    }

    return gaps;
  }

  private calculateRiskScore(
    unusualClauses: RiskClause[],
    missingClauses: string[],
    liabilityGaps: LiabilityGap[],
    indemnificationGaps: string[],
  ): number {
    let score = 0;

    const highSeverityClauses = unusualClauses.filter(
      (c) => c.severity === "high",
    ).length;
    score += highSeverityClauses * 15;

    score += unusualClauses.filter((c) => c.severity === "medium").length * 8;

    score += missingClauses.length * 5;
    score +=
      liabilityGaps.filter((g) => g.exposure === "unlimited").length * 20;
    score += indemnificationGaps.length * 10;

    return Math.min(100, score);
  }

  private generateRecommendations(
    riskScore: number,
    unusualClauses: RiskClause[],
    missingClauses: string[],
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore > 70) {
      recommendations.push("Critical: Seek legal review before signing");
    }

    unusualClauses.slice(0, 3).forEach((clause) => {
      recommendations.push(`Review: ${clause.reason}`);
    });

    if (missingClauses.length > 3) {
      recommendations.push(
        `Add missing standard clauses: ${missingClauses.slice(0, 3).join(", ")}`,
      );
    }

    return recommendations;
  }
}

// ─── COMPLETION PREDICTOR ───────────────────────────────────────────────────

export class CompletionPredictor {
  predictSigningTime(
    documentContent: string,
    signerCount: number,
    fields: ExtractedFields,
  ): SigningTimeEstimate {
    const complexity = this.calculateComplexity(documentContent);
    const missingFieldsCount = this.estimateMissingFields(fields);
    const unusualClausesCount = this.countUnusualClauses(documentContent);

    const baselineDays = 3;
    const complexityFactor = complexity / 100;
    const signerFactor = (signerCount - 1) * 0.5;
    const missingFieldsFactor = missingFieldsCount * 0.3;
    const unusualClausesFactor = unusualClausesCount * 0.2;

    const estimatedDays = Math.round(
      baselineDays +
        baselineDays * complexityFactor +
        signerFactor +
        missingFieldsFactor +
        unusualClausesFactor,
    );

    return {
      estimatedDaysToSign: Math.max(1, estimatedDays),
      confidence: Math.max(0.5, 1 - unusualClausesCount * 0.1),
      factors: {
        documentComplexity:
          complexity > 70 ? "high" : complexity > 40 ? "medium" : "low",
        numberOfSigners: signerCount,
        missingFieldsCount,
        unusualClausesCount,
      },
    };
  }

  private calculateComplexity(content: string): number {
    const pageEstimate = Math.ceil(content.length / 3000);
    const clauseCount = (content.match(/\bsection\b|\bclauses?\b/gi) || [])
      .length;
    const definitionCount = (content.match(/\bdefined\s+as\b/gi) || []).length;

    return Math.min(
      100,
      (pageEstimate * 10 + clauseCount + definitionCount) / 1.5,
    );
  }

  private estimateMissingFields(fields: ExtractedFields): number {
    let missing = 0;
    if (!fields.effectiveDate) missing++;
    if (!fields.expirationDate) missing++;
    if (fields.parties.length < 2) missing++;
    if (fields.amounts.length === 0) missing++;
    if (fields.obligations.length === 0) missing++;
    return missing;
  }

  private countUnusualClauses(content: string): number {
    const problematicPatterns = [
      /unlimited\s+liability/gi,
      /perpetual/gi,
      /sole\s+and\s+exclusive/gi,
      /no\s+warranty/gi,
      /automatic\s+renewal/gi,
    ];

    return problematicPatterns.reduce((count, pattern) => {
      return count + (content.match(pattern) || []).length;
    }, 0);
  }
}

// ─── SIGNATURE READINESS SCORER ──────────────────────────────────────────────

export class SignatureReadinessScorer {
  scoreReadiness(
    documentContent: string,
    fields: ExtractedFields,
  ): ReadinessScore {
    const issues: ReadinessIssue[] = [];
    const completeness = this.scoreCompleteness(fields, issues);
    const fieldPlacement = this.scoreFieldPlacement(documentContent, issues);
    const signerInfo = this.scoreSignerInfo(fields, issues);
    const templateCompliance = this.scoreTemplateCompliance(
      documentContent,
      issues,
    );

    const score =
      (completeness + fieldPlacement + signerInfo + templateCompliance) / 4;

    return {
      score: Math.round(score),
      completeness,
      fieldPlacement,
      signerInfoQuality: signerInfo,
      templateCompliance,
      issues,
    };
  }

  private scoreCompleteness(
    fields: ExtractedFields,
    issues: ReadinessIssue[],
  ): number {
    let score = 100;

    if (!fields.effectiveDate) {
      score -= 15;
      issues.push({
        severity: "error",
        field: "effectiveDate",
        message: "Missing effective date",
      });
    }

    if (fields.parties.length < 2) {
      score -= 20;
      issues.push({
        severity: "error",
        field: "parties",
        message: `Missing parties (found ${fields.parties.length}, need 2+)`,
      });
    }

    if (fields.obligations.length === 0) {
      score -= 10;
      issues.push({
        severity: "warning",
        field: "obligations",
        message: "No obligations detected",
      });
    }

    return Math.max(0, score);
  }

  private scoreFieldPlacement(
    content: string,
    issues: ReadinessIssue[],
  ): number {
    let score = 100;

    if (!content.includes("signature") && !content.includes("sign")) {
      score -= 20;
      issues.push({
        severity: "error",
        field: "signature_section",
        message: "Signature section not found",
      });
    }

    if (!content.includes("date")) {
      score -= 10;
      issues.push({
        severity: "warning",
        field: "date_field",
        message: "No date field found",
      });
    }

    if (!content.includes("print")) {
      score -= 5;
      issues.push({
        severity: "warning",
        field: "print_name",
        message: 'No "print name" field found',
      });
    }

    return Math.max(0, score);
  }

  private scoreSignerInfo(
    fields: ExtractedFields,
    issues: ReadinessIssue[],
  ): number {
    let score = 100;

    fields.parties.forEach((party) => {
      if (!party.legalEntity) {
        score -= 5;
      }
    });

    if (fields.parties.some((p) => !p.jurisdiction)) {
      score -= 10;
      issues.push({
        severity: "warning",
        field: "jurisdiction",
        message: "Jurisdiction not specified for all parties",
      });
    }

    return Math.max(0, score);
  }

  private scoreTemplateCompliance(
    content: string,
    issues: ReadinessIssue[],
  ): number {
    const contentLower = content.toLowerCase();
    let score = 100;

    const requiredSections = ["terms", "conditions", "payment", "termination"];
    requiredSections.forEach((section) => {
      if (!contentLower.includes(section)) {
        score -= 10;
      }
    });

    if (!contentLower.includes("hereby")) {
      score -= 5;
      issues.push({
        severity: "warning",
        field: "template",
        message: "Document may not follow standard template format",
      });
    }

    return Math.max(0, score);
  }
}

// ─── VERSION COMPARATOR ──────────────────────────────────────────────────────

export class VersionComparator {
  compareVersions(
    previousContent: string,
    currentContent: string,
  ): VersionComparisonResult {
    const differences = this.identifyDifferences(
      previousContent,
      currentContent,
    );
    const overallRiskDelta = differences.reduce(
      (sum, d) => sum + d.riskDelta,
      0,
    );

    return {
      differences,
      overallRiskDelta,
      summary: this.generateSummary(differences, overallRiskDelta),
    };
  }

  private identifyDifferences(prev: string, curr: string): VersionDifference[] {
    const differences: VersionDifference[] = [];

    const sections = this.extractSections(curr);
    sections.forEach((section, title) => {
      const prevSection = this.extractSection(prev, title);

      if (!prevSection) {
        differences.push({
          section: title,
          previousText: "",
          currentText: section.substring(0, 200),
          changeType: "added",
          riskDelta: this.calculateRiskDelta("added", section),
        });
      } else if (prevSection !== section) {
        differences.push({
          section: title,
          previousText: prevSection.substring(0, 200),
          currentText: section.substring(0, 200),
          changeType: "modified",
          riskDelta: this.calculateRiskDelta("modified", section),
        });
      }
    });

    return differences.slice(0, 20);
  }

  private extractSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const sectionPattern =
      /(?:section|article|clause|schedule)\s+([^:]+):\s*([^]*?)(?=(?:section|article|clause|schedule)\s+|$)/gi;

    let match;
    while ((match = sectionPattern.exec(content)) !== null) {
      sections.set(match[1].trim(), match[2].trim());
    }

    return sections;
  }

  private extractSection(content: string, title: string): string | null {
    const pattern = new RegExp(
      `(?:section|article|clause|schedule)\\s+${title}:\\s*([^]*?)(?=(?:section|article|clause|schedule)\\s+|$)`,
      "i",
    );
    const match = pattern.exec(content);
    return match ? match[1].trim() : null;
  }

  private calculateRiskDelta(
    changeType: string,
    sectionContent: string,
  ): number {
    const contentLower = sectionContent.toLowerCase();
    let delta = 0;

    const riskIndicators = [
      ["unlimited liability", 40],
      ["indemnif", 30],
      ["no warranty", 25],
      ["automatic renewal", 20],
      ["perpetual", 35],
    ] as const;

    riskIndicators.forEach(([indicator, weight]) => {
      if (contentLower.includes(indicator)) {
        delta +=
          changeType === "added"
            ? weight
            : changeType === "removed"
              ? -weight
              : weight / 2;
      }
    });

    return Math.max(-100, Math.min(100, delta));
  }

  private generateSummary(
    differences: VersionDifference[],
    riskDelta: number,
  ): string {
    const addedCount = differences.filter(
      (d) => d.changeType === "added",
    ).length;
    const removedCount = differences.filter(
      (d) => d.changeType === "removed",
    ).length;
    const modifiedCount = differences.filter(
      (d) => d.changeType === "modified",
    ).length;

    let summary = `${addedCount} sections added, ${removedCount} removed, ${modifiedCount} modified. `;

    if (riskDelta > 20) {
      summary += "Overall risk increased significantly.";
    } else if (riskDelta < -20) {
      summary += "Overall risk decreased.";
    } else {
      summary += "Overall risk profile relatively unchanged.";
    }

    return summary;
  }
}

// ─── FACTORY EXPORTS ────────────────────────────────────────────────────────

export function createDocumentIntelligence() {
  const classifier = new DocumentClassifier();
  const extractor = new FieldExtractor();
  const analyzer = new RiskAnalyzer();
  const predictor = new CompletionPredictor();
  const scorer = new SignatureReadinessScorer();
  const comparator = new VersionComparator();

  return {
    classifier,
    extractor,
    analyzer,
    predictor,
    scorer,
    comparator,

    analyzeDocument(content: string): DocumentAnalysis {
      const classification = classifier.classify(content);
      const extractedFields = extractor.extractFields(content);
      const riskAssessment = analyzer.analyzeRisk(content, extractedFields);
      const readinessScore = scorer.scoreReadiness(content, extractedFields);

      const signingTimeEstimate = predictor.predictSigningTime(
        content,
        extractedFields.parties.length,
        extractedFields,
      );

      return {
        documentId: `doc_${Date.now()}`,
        classification,
        extractedFields,
        riskAssessment,
        signingTimeEstimate,
        readinessScore,
      };
    },

    compareVersions(prev: string, curr: string): VersionComparisonResult {
      return comparator.compareVersions(prev, curr);
    },
  };
}
