/**
 * API Versioning — Version detection, management, and response transformation.
 *
 * Features:
 * - Multiple version detection strategies (URL path, header, query param)
 * - Version registry with deprecation dates
 * - Per-version response transformers
 * - Deprecation warning headers (Sunset, Deprecation)
 * - Automatic version negotiation
 *
 * Usage:
 *   const versionManager = new ApiVersionManager();
 *   const version = versionManager.detectVersion(req);
 *   const transformed = versionManager.transformResponse(version, data);
 */

interface VersionInfo {
  version: string;
  deprecated?: boolean;
  sunsetDate?: Date;
  deprecatedDate?: Date;
  replacedBy?: string;
}

interface VersionConfig {
  versions: Record<string, VersionInfo>;
  defaultVersion: string;
  minSupportedVersion: string;
  transformers?: Record<string, (data: any) => any>;
}

type VersionDetectionStrategy = "path" | "header" | "query";

/**
 * API version manager with detection and transformation.
 */
export class ApiVersionManager {
  private versions: Map<string, VersionInfo>;
  private defaultVersion: string;
  private minSupportedVersion: string;
  private transformers: Map<string, (data: any) => any>;

  constructor(config: VersionConfig) {
    this.versions = new Map(Object.entries(config.versions));
    this.defaultVersion = config.defaultVersion;
    this.minSupportedVersion = config.minSupportedVersion;
    this.transformers = new Map(Object.entries(config.transformers || {}));

    this.validateConfig();
  }

  /**
   * Validate version configuration.
   */
  private validateConfig(): void {
    if (!this.versions.has(this.defaultVersion)) {
      throw new Error(`Default version ${this.defaultVersion} not found in versions`);
    }

    if (!this.versions.has(this.minSupportedVersion)) {
      throw new Error(`Minimum version ${this.minSupportedVersion} not found`);
    }
  }

  /**
   * Detect API version from request (tries multiple strategies).
   */
  detectVersion(
    request: {
      url?: string;
      path?: string;
      headers?: Record<string, string>;
      query?: Record<string, string | string[]>;
    }
  ): string {
    // Strategy 1: URL path (/v1/... or /v2/...)
    const pathVersion = this.detectPathVersion(request.path || request.url || "");
    if (pathVersion) {
      return pathVersion;
    }

    // Strategy 2: Accept-Version header
    const headerVersion = request.headers?.["accept-version"];
    if (headerVersion) {
      return this.normalizeVersion(headerVersion as string);
    }

    // Strategy 3: X-API-Version header (alternative)
    const headerXVersion = request.headers?.["x-api-version"];
    if (headerXVersion) {
      return this.normalizeVersion(headerXVersion as string);
    }

    // Strategy 4: ?apiVersion query param
    const queryVersion = request.query?.["apiVersion"];
    if (queryVersion) {
      const versionStr = Array.isArray(queryVersion) ? queryVersion[0] : queryVersion;
      return this.normalizeVersion(versionStr);
    }

    // Fall back to default
    return this.defaultVersion;
  }

  /**
   * Extract version from URL path.
   */
  private detectPathVersion(path: string): string | null {
    const match = path.match(/\/v(\d+)/);
    if (match) {
      return this.normalizeVersion(`v${match[1]}`);
    }
    return null;
  }

  /**
   * Normalize version string (v1 → v1, 1 → v1, etc.).
   */
  private normalizeVersion(version: string): string {
    if (!version) return this.defaultVersion;

    const normalized = version.toLowerCase().startsWith("v")
      ? version.toLowerCase()
      : `v${version}`;

    return this.versions.has(normalized) ? normalized : this.defaultVersion;
  }

  /**
   * Check if version is supported.
   */
  isSupported(version: string): boolean {
    if (!this.versions.has(version)) {
      return false;
    }

    // Compare version numbers (e.g., v1, v2, v3)
    const minNum = parseInt(this.minSupportedVersion.slice(1), 10);
    const versionNum = parseInt(version.slice(1), 10);

    return versionNum >= minNum;
  }

  /**
   * Check if version is deprecated.
   */
  isDeprecated(version: string): boolean {
    const info = this.versions.get(version);
    return info?.deprecated ?? false;
  }

  /**
   * Get deprecation info for version.
   */
  getDeprecationInfo(version: string): {
    deprecated: boolean;
    sunsetDate?: Date;
    replacedBy?: string;
    warningHeader?: string;
  } {
    const info = this.versions.get(version);
    if (!info) {
      return { deprecated: false };
    }

    const result = {
      deprecated: info.deprecated ?? false,
      sunsetDate: info.sunsetDate,
      replacedBy: info.replacedBy,
      warningHeader: undefined as string | undefined,
    };

    if (result.deprecated && info.sunsetDate) {
      const date = info.sunsetDate.toUTCString();
      result.warningHeader = `${date}; rel="sunset"`;
    }

    return result;
  }

  /**
   * Transform response data for version (if transformer exists).
   */
  transformResponse(version: string, data: any): any {
    const transformer = this.transformers.get(version);
    if (!transformer) {
      return data;
    }

    return transformer(data);
  }

  /**
   * Get response headers for version (including deprecation warnings).
   */
  getVersionHeaders(version: string): Record<string, string> {
    const headers: Record<string, string> = {
      "API-Version": version,
    };

    const deprecation = this.getDeprecationInfo(version);
    if (deprecation.deprecated) {
      headers["Deprecation"] = "true";

      if (deprecation.warningHeader) {
        headers["Sunset"] = deprecation.warningHeader;
      }

      if (deprecation.replacedBy) {
        headers["Link"] = `</v${deprecation.replacedBy}>; rel="successor-version"`;
      }

      // Warning header (RFC 7234)
      const warnMessage = deprecation.replacedBy
        ? `299 - "Deprecated, use version ${deprecation.replacedBy}"`
        : `299 - "Deprecated API Version"`;
      headers["Warning"] = warnMessage;
    }

    return headers;
  }

  /**
   * Get list of supported versions.
   */
  getSupportedVersions(): string[] {
    return Array.from(this.versions.keys()).filter((v) => this.isSupported(v));
  }

  /**
   * Get all registered versions (including unsupported).
   */
  getAllVersions(): VersionInfo[] {
    return Array.from(this.versions.values());
  }

  /**
   * Register new version at runtime.
   */
  registerVersion(version: string, info: VersionInfo, transformer?: (data: any) => any): void {
    this.versions.set(version, info);
    if (transformer) {
      this.transformers.set(version, transformer);
    }
  }

  /**
   * Deprecate version with sunset date.
   */
  deprecateVersion(version: string, sunsetDate: Date, replacedBy?: string): void {
    const info = this.versions.get(version);
    if (!info) {
      throw new Error(`Version ${version} not found`);
    }

    info.deprecated = true;
    info.sunsetDate = sunsetDate;
    info.deprecatedDate = new Date();
    info.replacedBy = replacedBy;
  }
}

export type { VersionInfo, VersionConfig };
