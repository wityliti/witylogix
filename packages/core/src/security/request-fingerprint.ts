/**
 * Request Fingerprinting — Device and session anomaly detection.
 *
 * Creates cryptographic fingerprints of requests based on:
 * - IP address + User-Agent + Accept-Language
 * - Device characteristics
 * - Detects suspicious patterns (rapid IP changes, TOR exit nodes)
 * - Geo-location anomaly detection (stub for GeoIP integration)
 *
 * Key features:
 * - SHA-256 fingerprint generation
 * - Device fingerprint tracking
 * - Rapid IP change detection
 * - TOR exit node detection (stub)
 * - Geo-location anomaly detection (stub)
 * - Fingerprint comparison and similarity scoring
 *
 * @example
 * const fingerprinter = new RequestFingerprinter();
 * const fingerprint = fingerprinter.generateFingerprint({
 *   ip: "192.168.1.1",
 *   userAgent: "Mozilla/5.0...",
 *   acceptLanguage: "en-US,en;q=0.9",
 * });
 */

/**
 * Request attributes for fingerprinting.
 */
export interface RequestAttributes {
  /** Client IP address */
  ip: string;
  /** User-Agent header */
  userAgent: string;
  /** Accept-Language header */
  acceptLanguage: string;
  /** TLS/SSL fingerprint (optional) */
  tlsFingerprint?: string;
  /** Canvas fingerprint (optional) */
  canvasFingerprint?: string;
  /** WebGL renderer (optional) */
  webglRenderer?: string;
  /** Screen resolution (optional) */
  screenResolution?: string;
}

/**
 * Stored fingerprint record.
 */
export interface StoredFingerprint {
  /** SHA-256 hash of attributes */
  hash: string;
  /** When fingerprint was first seen */
  firstSeenAt: Date;
  /** When fingerprint was last seen */
  lastSeenAt: Date;
  /** Number of times seen */
  count: number;
  /** Associated user ID (optional) */
  userId?: string;
  /** Geographic location */
  location: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  /** Is flagged as suspicious */
  suspicious: boolean;
  /** Reason for suspicion (if flagged) */
  suspiciousReason?: string;
}

/**
 * Anomaly detection result.
 */
export interface AnomalyResult {
  /** Is this request anomalous */
  isAnomaly: boolean;
  /** Anomaly score (0-100) */
  score: number;
  /** Reasons for anomaly */
  reasons: Array<{
    type: "RAPID_IP_CHANGE" | "TOR_EXIT_NODE" | "GEO_ANOMALY" | "NEW_DEVICE";
    severity: "LOW" | "MEDIUM" | "HIGH";
    details: string;
  }>;
  /** Recommended action */
  action: "ALLOW" | "CHALLENGE" | "BLOCK";
}

/**
 * Request fingerprinter for anomaly detection.
 */
export class RequestFingerprinter {
  private fingerprints: Map<string, StoredFingerprint> = new Map();
  private ipHistory: Map<string, Array<{ ip: string; timestamp: Date }>> =
    new Map();
  private geoIpProvider?: (ip: string) => Promise<any>; // Stub for GeoIP service
  private torExitNodes: Set<string> = new Set(); // Stub for TOR exit node list

  /**
   * Initialize request fingerprinter.
   * @param geoIpProvider - Optional GeoIP lookup function
   */
  constructor(
    geoIpProvider?: (ip: string) => Promise<any>
  ) {
    this.geoIpProvider = geoIpProvider;
    this.loadTorExitNodes();
  }

  /**
   * Load TOR exit node list (stub).
   * In production, this would fetch from Tor exit node feeds.
   */
  private loadTorExitNodes(): void {
    // Stub: In production, fetch from:
    // https://check.torproject.org/exit-addresses
    // https://www.dan.me.uk/torlist
  }

  /**
   * Generate SHA-256 hash of request attributes.
   * @param attributes - Request attributes
   * @returns SHA-256 hash in hex
   */
  private generateHash(attributes: RequestAttributes): string {
    const data = [
      attributes.ip,
      attributes.userAgent,
      attributes.acceptLanguage,
      attributes.tlsFingerprint || "",
      attributes.canvasFingerprint || "",
      attributes.webglRenderer || "",
      attributes.screenResolution || "",
    ].join("|");

    // SHA-256 hashing (Node.js crypto module)
    const hash = require("crypto")
      .createHash("sha256")
      .update(data)
      .digest("hex");

    return hash;
  }

  /**
   * Generate complete fingerprint from request attributes.
   * @param attributes - Request attributes
   * @param userId - Optional user ID
   * @param location - Optional location data
   * @returns Generated fingerprint
   */
  async generateFingerprint(
    attributes: RequestAttributes,
    userId?: string,
    location?: StoredFingerprint["location"]
  ): Promise<StoredFingerprint> {
    const hash = this.generateHash(attributes);
    const now = new Date();

    // Lookup location if GeoIP provider available
    let finalLocation = location || {};
    if (!location && this.geoIpProvider) {
      try {
        finalLocation = await this.geoIpProvider(attributes.ip);
      } catch (err) {
        // Silently fail, use empty location
      }
    }

    // Check if we've seen this fingerprint before
    const existing = this.fingerprints.get(hash);
    if (existing) {
      existing.lastSeenAt = now;
      existing.count++;
      if (userId && !existing.userId) {
        existing.userId = userId;
      }
      return existing;
    }

    // Create new fingerprint
    const fingerprint: StoredFingerprint = {
      hash,
      firstSeenAt: now,
      lastSeenAt: now,
      count: 1,
      userId,
      location: finalLocation,
      suspicious: false,
    };

    this.fingerprints.set(hash, fingerprint);
    return fingerprint;
  }

  /**
   * Track IP address changes for a user.
   * @param userId - User ID
   * @param ip - IP address
   * @param maxEntries - Max history entries to keep
   */
  trackIpAddress(userId: string, ip: string, maxEntries: number = 20): void {
    if (!this.ipHistory.has(userId)) {
      this.ipHistory.set(userId, []);
    }

    const history = this.ipHistory.get(userId)!;
    history.push({ ip, timestamp: new Date() });

    // Keep only recent history
    if (history.length > maxEntries) {
      history.shift();
    }
  }

  /**
   * Detect rapid IP changes (impossible travel).
   * @param userId - User ID
   * @param currentIp - Current IP address
   * @param timezoneOffset - Time zone offset in minutes (for travel checks)
   * @returns Array of anomalies detected
   */
  private detectRapidIpChange(
    userId: string,
    currentIp: string,
    timezoneOffset?: number
  ): AnomalyResult["reasons"] {
    const reasons: AnomalyResult["reasons"] = [];
    const history = this.ipHistory.get(userId);

    if (!history || history.length < 2) {
      return reasons;
    }

    const lastEntry = history[history.length - 2];
    const currentTime = new Date();
    const timeSinceLastRequest =
      (currentTime.getTime() - lastEntry.timestamp.getTime()) / 1000; // seconds

    // If same IP, no anomaly
    if (lastEntry.ip === currentIp) {
      return reasons;
    }

    // Rapid IP change (more than one IP in less than 60 seconds)
    if (timeSinceLastRequest < 60) {
      reasons.push({
        type: "RAPID_IP_CHANGE",
        severity: "HIGH",
        details: `IP changed from ${lastEntry.ip} to ${currentIp} in ${Math.round(timeSinceLastRequest)}s`,
      });
    }

    // Multiple different IPs in short time (impossible travel)
    const recentIps = history
      .filter((h) => currentTime.getTime() - h.timestamp.getTime() < 600000) // 10 minutes
      .map((h) => h.ip);

    if (new Set(recentIps).size > 3) {
      reasons.push({
        type: "RAPID_IP_CHANGE",
        severity: "MEDIUM",
        details: `${recentIps.length} different IPs seen in last 10 minutes`,
      });
    }

    return reasons;
  }

  /**
   * Check if IP is TOR exit node (stub).
   * @param ip - IP address
   * @returns true if IP is TOR exit node
   */
  private isTorExitNode(ip: string): boolean {
    // Stub: In production, check against TOR exit node database
    return this.torExitNodes.has(ip);
  }

  /**
   * Detect TOR/VPN usage.
   * @param ip - IP address
   * @returns Array of anomalies detected
   */
  private detectTorUsage(ip: string): AnomalyResult["reasons"] {
    const reasons: AnomalyResult["reasons"] = [];

    if (this.isTorExitNode(ip)) {
      reasons.push({
        type: "TOR_EXIT_NODE",
        severity: "MEDIUM",
        details: "Request from known TOR exit node",
      });
    }

    return reasons;
  }

  /**
   * Detect geo-location anomalies (stub).
   * In production, would use actual GeoIP data.
   * @param userId - User ID
   * @param location - Current location
   * @returns Array of anomalies detected
   */
  private detectGeoAnomaly(
    userId: string,
    location?: StoredFingerprint["location"]
  ): AnomalyResult["reasons"] {
    const reasons: AnomalyResult["reasons"] = [];

    if (!location || !location.latitude || !location.longitude) {
      return reasons;
    }

    // Stub: Check against user's typical locations
    // In production, would:
    // 1. Get user's historical locations
    // 2. Calculate distance from typical locations
    // 3. Calculate travel speed needed to reach this location
    // 4. Flag if impossible

    return reasons;
  }

  /**
   * Run comprehensive anomaly detection.
   * @param attributes - Request attributes
   * @param userId - User ID
   * @param thresholdScore - Score threshold for anomaly (0-100, default 50)
   * @returns Anomaly detection result
   */
  async detectAnomalies(
    attributes: RequestAttributes,
    userId?: string,
    thresholdScore: number = 50
  ): Promise<AnomalyResult> {
    const reasons: AnomalyResult["reasons"] = [];
    let score = 0;

    // Detect rapid IP changes
    if (userId) {
      this.trackIpAddress(userId, attributes.ip);
      reasons.push(...this.detectRapidIpChange(userId, attributes.ip));
    }

    // Detect TOR usage
    reasons.push(...this.detectTorUsage(attributes.ip));

    // Detect new device
    const fingerprint = await this.generateFingerprint(attributes, userId);
    if (fingerprint.count === 1) {
      reasons.push({
        type: "NEW_DEVICE",
        severity: "LOW",
        details: "New device fingerprint detected",
      });
    }

    // Calculate anomaly score
    for (const reason of reasons) {
      if (reason.severity === "HIGH") {
        score += 40;
      } else if (reason.severity === "MEDIUM") {
        score += 25;
      } else {
        score += 10;
      }
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine action
    let action: AnomalyResult["action"] = "ALLOW";
    if (score >= 75) {
      action = "BLOCK";
    } else if (score >= thresholdScore) {
      action = "CHALLENGE";
    }

    return {
      isAnomaly: score >= thresholdScore,
      score,
      reasons,
      action,
    };
  }

  /**
   * Compare two fingerprints and return similarity score.
   * @param hash1 - First fingerprint hash
   * @param hash2 - Second fingerprint hash
   * @returns Similarity score (0-100, higher = more similar)
   */
  comparFingerprints(hash1: string, hash2: string): number {
    const fp1 = this.fingerprints.get(hash1);
    const fp2 = this.fingerprints.get(hash2);

    if (!fp1 || !fp2) {
      return 0;
    }

    // Simple comparison: if same hash, 100% similar
    if (hash1 === hash2) {
      return 100;
    }

    // In production, would do more sophisticated comparison
    // like location proximity, device similarity, etc.
    return 0;
  }

  /**
   * Get fingerprint record.
   * @param hash - Fingerprint hash
   * @returns Fingerprint record or undefined
   */
  getFingerprint(hash: string): StoredFingerprint | undefined {
    return this.fingerprints.get(hash);
  }

  /**
   * Mark fingerprint as suspicious.
   * @param hash - Fingerprint hash
   * @param reason - Reason for suspicion
   */
  markSuspicious(hash: string, reason: string): void {
    const fingerprint = this.fingerprints.get(hash);
    if (fingerprint) {
      fingerprint.suspicious = true;
      fingerprint.suspiciousReason = reason;
    }
  }

  /**
   * Clear old fingerprints (older than X days).
   * @param daysOld - Remove fingerprints older than this many days
   * @returns Number of fingerprints removed
   */
  clearOldFingerprints(daysOld: number = 30): number {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    let removed = 0;

    for (const [hash, fp] of this.fingerprints) {
      if (fp.lastSeenAt < cutoff) {
        this.fingerprints.delete(hash);
        removed++;
      }
    }

    return removed;
  }
}
