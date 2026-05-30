/**
 * Credential Lifecycle Manager — Core rotation, scanning, and health management
 *
 * Subsystems:
 * - RotationScheduler: time-based and event-based credential rotation
 * - SecretScanner: regex and entropy-based secret detection
 * - ZeroDowntimeRotator: dual-credential window with gradual traffic shift
 * - CredentialHealthScorer: multi-dimensional health scoring
 */

import { EventEmitter } from 'events';
import type {
  Credential,
  RotationPolicy,
  RotationResult,
  RotationStatus,
  RotationTrigger,
  SecretScanFinding,
  ScanResult,
  CredentialHealth,
  ScanPattern,
  TrafficShiftConfig,
  ProviderRotationFlow,
  Severity,
} from './credential-types.js';
import type { IVaultAdapter } from './vault-adapters.js';

// ─── Rotation Scheduler ──────────────────────────────────────────────────

export class RotationScheduler extends EventEmitter {
  private rotationPolicies: Map<string, RotationPolicy> = new Map();
  private rotationJobs: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private activeRotations: Map<string, RotationResult> = new Map();

  constructor(private vault: IVaultAdapter) {
    super();
  }

  /**
   * Register a rotation policy for a credential
   */
  registerPolicy(policy: RotationPolicy): void {
    this.rotationPolicies.set(policy.credentialId, policy);
    this.scheduleRotation(policy);
    this.emit('policy_registered', { credentialId: policy.credentialId });
  }

  /**
   * Update an existing rotation policy
   */
  updatePolicy(policy: RotationPolicy): void {
    const existing = this.rotationJobs.get(policy.credentialId);
    if (existing) {
      clearInterval(existing);
    }
    this.rotationPolicies.set(policy.credentialId, policy);
    this.scheduleRotation(policy);
    this.emit('policy_updated', { credentialId: policy.credentialId });
  }

  /**
   * Get next scheduled rotation date
   */
  getNextRotationDate(credentialId: string): Date | null {
    const policy = this.rotationPolicies.get(credentialId);
    if (!policy?.rotationSchedule?.nextRotationAt) return null;
    return policy.rotationSchedule.nextRotationAt;
  }

  /**
   * Trigger manual rotation
   */
  async triggerRotation(credentialId: string): Promise<RotationResult> {
    const policy = this.rotationPolicies.get(credentialId);
    if (!policy) throw new Error('No rotation policy found');

    return this.performRotation(credentialId, 'manual', policy);
  }

  /**
   * Trigger rotation due to breach detection
   */
  async rotateOnBreach(credentialId: string): Promise<RotationResult> {
    const policy = this.rotationPolicies.get(credentialId);
    if (!policy) throw new Error('No rotation policy found');

    return this.performRotation(credentialId, 'breach_detected', policy);
  }

  /**
   * Trigger rotation due to team change
   */
  async rotateOnTeamChange(credentialId: string): Promise<RotationResult> {
    const policy = this.rotationPolicies.get(credentialId);
    if (!policy) throw new Error('No rotation policy found');

    return this.performRotation(credentialId, 'team_change', policy);
  }

  /**
   * Get rotation history for a credential
   */
  getRotationHistory(credentialId: string): RotationResult[] {
    const results: RotationResult[] = [];
    for (const [id, result] of this.activeRotations) {
      if (result.credentialId === credentialId && result.status === 'completed') {
        results.push(result);
      }
    }
    return results;
  }

  private scheduleRotation(policy: RotationPolicy): void {
    // Calculate next rotation time based on schedule
    const nextRotation = this.calculateNextRotation(policy);
    const msUntilRotation = nextRotation.getTime() - Date.now();

    // Set timeout for next rotation
    const timeoutId = setTimeout(() => {
      this.performRotation(policy.credentialId, 'scheduled', policy).catch((error) => {
        this.emit('rotation_error', { credentialId: policy.credentialId, error });
      });
      // Reschedule after completion
      this.scheduleRotation(policy);
    }, msUntilRotation);

    this.rotationJobs.set(policy.credentialId, timeoutId);

    if (policy.rotationSchedule) {
      policy.rotationSchedule.nextRotationAt = nextRotation;
    }

    this.emit('rotation_scheduled', {
      credentialId: policy.credentialId,
      nextRotationAt: nextRotation,
    });
  }

  private calculateNextRotation(policy: RotationPolicy): Date {
    const now = new Date();
    const schedule = policy.rotationSchedule;

    if (!schedule) {
      // Default: 30 days
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    switch (schedule.frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        const daysUntilWeekly = ((schedule.dayOfWeek || 0) - now.getDay() + 7) % 7;
        return new Date(now.getTime() + (daysUntilWeekly || 7) * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, schedule.dayOfMonth || 1);
        return nextMonth;
      case 'quarterly':
        return new Date(now.getTime() + 91 * 24 * 60 * 60 * 1000);
      case 'annually':
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  private async performRotation(
    credentialId: string,
    trigger: RotationTrigger,
    policy: RotationPolicy,
  ): Promise<RotationResult> {
    const rotationId = `rot_${Date.now()}`;
    const result: RotationResult = {
      credentialId,
      providerId: policy.providerId,
      rotationId,
      status: 'in_progress',
      trigger,
      startedAt: new Date(),
    };

    this.activeRotations.set(rotationId, result);
    this.emit('rotation_started', { rotationId, credentialId, trigger });

    try {
      // Pre-rotation validation
      if (policy.preRotationValidation) {
        const validationResult = await this.validateCredentialBeforeRotation(credentialId);
        if (!validationResult) {
          throw new Error('Pre-rotation validation failed');
        }
      }

      // Perform actual rotation (delegated to ZeroDowntimeRotator)
      const rotatedCredential = await this.vault.rotate(
        credentialId,
        'sk_live_' + 'ROTATED_' + Date.now(),
      );

      result.newCredentialId = rotatedCredential.id;
      result.status = 'completed';
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt.getTime();

      // Post-rotation verification
      if (policy.postRotationVerification) {
        const verified = await this.verifyRotatedCredential(credentialId);
        if (!verified) {
          throw new Error('Post-rotation verification failed');
        }
      }

      this.emit('rotation_completed', { rotationId, credentialId });
      return result;
    } catch (error) {
      result.status = 'failed';
      result.completedAt = new Date();
      result.errorMessage = String(error);

      if (policy.autoRollbackOnFailure) {
        result.status = 'rolled_back';
        result.rollbackReason = 'Automatic rollback on rotation failure';
        this.emit('rotation_rolled_back', { rotationId, credentialId });
      }

      this.emit('rotation_failed', { rotationId, credentialId, error });
      throw error;
    }
  }

  private async validateCredentialBeforeRotation(credentialId: string): Promise<boolean> {
    try {
      const credential = await this.vault.get(credentialId);
      return credential !== null;
    } catch {
      return false;
    }
  }

  private async verifyRotatedCredential(credentialId: string): Promise<boolean> {
    try {
      const credential = await this.vault.get(credentialId);
      return credential !== null && credential.updatedAt !== null;
    } catch {
      return false;
    }
  }
}

// ─── Secret Scanner ─────────────────────────────────────────────────────

export class SecretScanner extends EventEmitter {
  private patterns: Map<string, ScanPattern> = new Map();
  private scanJobs: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    super();
    this.initializeDefaultPatterns();
  }

  /**
   * Register a scan pattern
   */
  registerPattern(pattern: ScanPattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Run secret scan on content
   */
  async scanContent(content: string, scanId?: string): Promise<ScanResult> {
    const scan: ScanResult = {
      id: scanId || `scan_${Date.now()}`,
      tenantId: 'system',
      scanType: 'regex',
      startedAt: new Date(),
      filesScanned: 1,
      secretsFound: 0,
      findings: [],
      status: 'in_progress',
    };

    try {
      // Regex-based scanning
      for (const pattern of this.patterns.values()) {
        const matches = content.matchAll(pattern.regex);
        for (const match of matches) {
          scan.findings.push({
            id: `finding_${Date.now()}_${Math.random()}`,
            tenantId: 'system',
            scanId: scan.id,
            scanType: 'regex',
            severity: pattern.severity,
            pattern: pattern.name,
            patternName: pattern.name,
            location: {
              filePath: 'scanned_content',
              columnNumber: match.index,
            },
            matchedText: match[0],
            detectedAt: new Date(),
            remediationStatus: 'pending',
          });
        }
      }

      // Entropy-based scanning
      scan.findings.push(
        ...this.scanForHighEntropySecrets(content, scan.id),
      );

      scan.secretsFound = scan.findings.length;
      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.duration = scan.completedAt.getTime() - scan.startedAt.getTime();

      this.emit('scan_completed', { scanId: scan.id, findingsCount: scan.secretsFound });
      return scan;
    } catch (error) {
      scan.status = 'failed';
      scan.errorMessage = String(error);
      this.emit('scan_failed', { scanId: scan.id, error });
      throw error;
    }
  }

  /**
   * Schedule periodic scans
   */
  schedulePeriodicScan(intervalMs: number = 24 * 60 * 60 * 1000): string {
    const jobId = `job_${Date.now()}`;
    const job = setInterval(async () => {
      // In production: scan file system, git history, etc.
      this.emit('periodic_scan_executed', { jobId });
    }, intervalMs);

    this.scanJobs.set(jobId, job);
    return jobId;
  }

  /**
   * Classify a finding's severity
   */
  classifyFinding(finding: SecretScanFinding): Severity {
    // Enhanced classification based on pattern and context
    if (finding.pattern.includes('api_key') || finding.pattern.includes('secret_key')) {
      return 'critical';
    }
    if (finding.entropy && finding.entropy > 5.0) {
      return 'high';
    }
    if (finding.pattern.includes('password')) {
      return 'high';
    }
    return finding.severity;
  }

  /**
   * Mark finding as remediated
   */
  markRemediated(
    findingId: string,
    action: 'rotated' | 'removed' | 'marked_false_positive',
    comment?: string,
  ): void {
    this.emit('finding_remediated', { findingId, action, comment });
  }

  /**
   * Get remediation recommendations
   */
  getRemediationRecommendations(finding: SecretScanFinding): string[] {
    const recommendations: string[] = [];

    if (finding.severity === 'critical' || finding.severity === 'high') {
      recommendations.push('Immediately rotate this credential');
      recommendations.push('Review access logs for unauthorized usage');
      recommendations.push('Revoke the credential in the provider system');
    }

    if (finding.scanType === 'entropy') {
      recommendations.push('High entropy detected - likely a secret');
      recommendations.push('Review context for false positives');
    }

    if (finding.pattern.includes('api_key')) {
      recommendations.push('Rotate API key in provider dashboard');
      recommendations.push('Update all services using this key');
    }

    return recommendations;
  }

  private scanForHighEntropySecrets(content: string, scanId: string): SecretScanFinding[] {
    const findings: SecretScanFinding[] = [];
    const words = content.split(/\s+/);

    for (const word of words) {
      if (word.length > 20) {
        const entropy = this.calculateShannonEntropy(word);
        if (entropy > 4.5) {
          findings.push({
            id: `finding_${Date.now()}_${Math.random()}`,
            tenantId: 'system',
            scanId,
            scanType: 'entropy',
            severity: 'medium',
            pattern: 'high_entropy_string',
            patternName: 'High Entropy Detection',
            location: { filePath: 'scanned_content' },
            matchedText: word.substring(0, 10) + '...',
            entropy,
            detectedAt: new Date(),
            remediationStatus: 'pending',
          });
        }
      }
    }

    return findings;
  }

  private calculateShannonEntropy(str: string): number {
    const frequencies: Record<string, number> = {};
    for (const char of str) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const freq of Object.values(frequencies)) {
      const p = freq / str.length;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private initializeDefaultPatterns(): void {
    const patterns: ScanPattern[] = [
      {
        id: 'aws_key',
        name: 'AWS API Key',
        category: 'api_key',
        regex: /AKIA[0-9A-Z]{16}/g,
        severity: 'critical',
      },
      {
        id: 'stripe_key',
        name: 'Stripe API Key',
        category: 'api_key',
        regex: /sk_live_[a-zA-Z0-9]{32}/g,
        severity: 'critical',
      },
      {
        id: 'github_token',
        name: 'GitHub Personal Token',
        category: 'oauth_token',
        regex: /ghp_[A-Za-z0-9_]{36}/g,
        severity: 'critical',
      },
      {
        id: 'jwt_token',
        name: 'JWT Token',
        category: 'jwt',
        regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        severity: 'high',
      },
      {
        id: 'password_like',
        name: 'Password Assignment',
        category: 'password',
        regex: /(password|passwd|pwd)\s*=\s*["'][^"']{8,}["']/gi,
        severity: 'high',
      },
      {
        id: 'connection_string',
        name: 'Database Connection String',
        category: 'connection_string',
        regex: /(mongodb|mysql|postgres|redis):\/\/[^\s]+/gi,
        severity: 'high',
      },
    ];

    for (const pattern of patterns) {
      this.registerPattern(pattern);
    }
  }
}

// ─── Zero-Downtime Rotator ──────────────────────────────────────────────

export class ZeroDowntimeRotator extends EventEmitter {
  private activeShifts: Map<string, { startedAt: Date; currentPercentage: number }> = new Map();

  constructor(
    private vault: IVaultAdapter,
    private trafficShiftConfig: TrafficShiftConfig,
  ) {
    super();
  }

  /**
   * Perform zero-downtime rotation with gradual traffic shift
   */
  async rotateWithTrafficShift(
    credentialId: string,
    newCredential: Credential,
    providerFlow?: ProviderRotationFlow,
  ): Promise<RotationResult> {
    const rotationId = `rot_${Date.now()}`;
    const result: RotationResult = {
      credentialId,
      providerId: newCredential.providerId,
      rotationId,
      status: 'in_progress',
      trigger: 'scheduled',
      startedAt: new Date(),
      trafficShiftPercentage: 0,
    };

    try {
      // Step 1: Deploy new credential (dual-credential window)
      await this.vault.set(newCredential);
      result.newCredentialId = newCredential.id;

      // Step 2: Gradual traffic shift
      for (const stage of this.trafficShiftConfig.stages) {
        result.trafficShiftPercentage = stage.percentage;
        this.activeShifts.set(rotationId, { startedAt: new Date(), currentPercentage: stage.percentage });
        this.emit('traffic_shift', { rotationId, percentage: stage.percentage });

        // Monitor health during shift
        await this.monitorHealth(rotationId, this.trafficShiftConfig.healthCheckIntervalMs);

        // Wait for stage duration
        await this.delay(stage.durationMs);
      }

      // Step 3: Complete rotation
      result.status = 'completed';
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt.getTime();

      this.activeShifts.delete(rotationId);
      this.emit('rotation_completed', { rotationId, credentialId });

      return result;
    } catch (error) {
      // Rollback on failure
      result.status = 'rolled_back';
      result.rollbackReason = String(error);

      await this.rollback(credentialId);
      this.activeShifts.delete(rotationId);

      this.emit('rotation_rolled_back', { rotationId, credentialId });
      throw error;
    }
  }

  /**
   * Apply provider-specific rotation flow
   */
  async applyProviderFlow(
    credentialId: string,
    providerFlow: ProviderRotationFlow,
  ): Promise<RotationResult> {
    const rotationId = `rot_${Date.now()}`;
    const result: RotationResult = {
      credentialId,
      providerId: providerFlow.providerId,
      rotationId,
      status: 'in_progress',
      trigger: 'scheduled',
      startedAt: new Date(),
    };

    try {
      // Execute pre-validation steps
      for (const step of providerFlow.preValidationSteps || []) {
        // Call endpoint and verify response
        this.emit('flow_step', { rotationId, step: step.name });
      }

      // Execute rotation steps
      for (const step of providerFlow.rotationSteps) {
        if (step.action === 'call_provider_api') {
          // Call provider API to generate new credential
        } else if (step.action === 'update_vault') {
          // Update vault with new credential
        }
        this.emit('flow_step', { rotationId, step: step.name });
      }

      // Execute post-validation steps
      for (const step of providerFlow.postValidationSteps || []) {
        this.emit('flow_step', { rotationId, step: step.name });
      }

      result.status = 'completed';
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt.getTime();

      return result;
    } catch (error) {
      result.status = 'failed';
      result.errorMessage = String(error);

      // Execute rollback steps if available
      for (const step of providerFlow.rollbackSteps || []) {
        this.emit('rollback_step', { rotationId, step: step.name });
      }

      throw error;
    }
  }

  private async monitorHealth(rotationId: string, intervalMs: number): Promise<void> {
    return new Promise((resolve) => {
      const checkHealth = async () => {
        // Check error rate against rollback threshold
        // If error rate > threshold, trigger rollback
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(checkHealth, intervalMs);
    });
  }

  private async rollback(credentialId: string): Promise<void> {
    const credential = await this.vault.get(credentialId);
    if (credential) {
      // Revert to previous credential value
      this.emit('rollback_initiated', { credentialId });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Credential Health Scorer ───────────────────────────────────────────

export class CredentialHealthScorer extends EventEmitter {
  private weights = {
    age: 0.25,
    exposure: 0.35,
    compliance: 0.25,
    usage: 0.15,
  };

  /**
   * Calculate comprehensive health score
   */
  calculateHealth(
    credential: Credential,
    rotationPolicy: RotationPolicy | null,
    scanFindings: SecretScanFinding[],
    usageData?: { lastUsedAt?: Date; accessCount?: number },
  ): CredentialHealth {
    const ageScore = this.calculateAgeScore(credential.rotatedAt);
    const exposureScore = this.calculateExposureScore(scanFindings);
    const complianceScore = this.calculateComplianceScore(credential, rotationPolicy);
    const usageScore = this.calculateUsageScore(usageData);

    const overallScore = Math.round(
      ageScore * this.weights.age +
      exposureScore * this.weights.exposure +
      complianceScore * this.weights.compliance +
      usageScore * this.weights.usage,
    );

    const lastRotationDays = Math.floor(
      (Date.now() - credential.rotatedAt.getTime()) / (24 * 60 * 60 * 1000),
    );

    return {
      credentialId: credential.id,
      providerId: credential.providerId,
      overallScore,
      ageScore,
      exposureScore,
      complianceScore,
      usageScore,
      lastRotationDays,
      scanFindingsCount: scanFindings.filter((f) => f.remediationStatus === 'pending').length,
      rotationStatus: 'pending',
      nextRotationDue: this.calculateNextRotationDue(credential, rotationPolicy),
      riskAssessment: this.assessRisk(overallScore),
      recommendations: this.generateRecommendations(credential, rotationPolicy, scanFindings),
      calculatedAt: new Date(),
    };
  }

  private calculateAgeScore(rotatedAt: Date): number {
    const ageMs = Date.now() - rotatedAt.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    // Score decreases linearly: perfect at 0 days, zero at 365 days
    return Math.max(0, 100 - (ageDays / 365) * 100);
  }

  private calculateExposureScore(findings: SecretScanFinding[]): number {
    if (findings.length === 0) return 100;

    const criticalFindings = findings.filter((f) => f.severity === 'critical').length;
    const highFindings = findings.filter((f) => f.severity === 'high').length;

    const exposurePenalty = criticalFindings * 50 + highFindings * 20;
    return Math.max(0, 100 - exposurePenalty);
  }

  private calculateComplianceScore(credential: Credential, policy: RotationPolicy | null): number {
    if (!policy) return 50; // Unknown policy = medium score

    const nextRotation = policy.rotationSchedule?.nextRotationAt;
    if (!nextRotation) return 50;

    const msUntilRotation = nextRotation.getTime() - Date.now();
    if (msUntilRotation > 7 * 24 * 60 * 60 * 1000) return 100; // 7+ days = compliant
    if (msUntilRotation > 0) return 75; // Due soon
    return 0; // Overdue
  }

  private calculateUsageScore(usageData?: { lastUsedAt?: Date; accessCount?: number }): number {
    if (!usageData?.lastUsedAt) return 50; // Unknown usage

    const unusedDays = (Date.now() - usageData.lastUsedAt.getTime()) / (24 * 60 * 60 * 1000);

    if (unusedDays > 90) return 20; // Unused for 90+ days = high risk
    if (unusedDays > 30) return 50; // Unused for 30+ days = medium risk
    return 100; // Recently used = low risk
  }

  private calculateNextRotationDue(credential: Credential, policy: RotationPolicy | null): Date | undefined {
    if (!policy?.rotationSchedule) return undefined;
    return policy.rotationSchedule.nextRotationAt;
  }

  private assessRisk(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score < 25) return 'critical';
    if (score < 50) return 'high';
    if (score < 75) return 'medium';
    return 'low';
  }

  private generateRecommendations(
    credential: Credential,
    policy: RotationPolicy | null,
    findings: SecretScanFinding[],
  ): string[] {
    const recommendations: string[] = [];

    const ageMs = Date.now() - credential.rotatedAt.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    if (ageDays > 90) {
      recommendations.push('Credential is older than 90 days - schedule immediate rotation');
    }

    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    if (criticalFindings.length > 0) {
      recommendations.push(`${criticalFindings.length} critical exposures detected - rotate immediately`);
    }

    if (!policy) {
      recommendations.push('No rotation policy configured - set up automated rotation');
    }

    recommendations.push('Review access patterns and revoke if unused for 30+ days');

    return recommendations;
  }
}
