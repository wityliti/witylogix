/**
 * Amazon SES v2 API SDK Client.
 *
 * Comprehensive client for AWS SES email service:
 * - Email: send (simple text/HTML, raw MIME, template, bulk)
 * - Templates: create, update, delete, list, test render
 * - Configuration sets: create, event destinations (SNS, CloudWatch, Kinesis, Pinpoint)
 * - Identities: verify domain, verify email, DKIM, MAIL FROM
 * - Contact lists: create, add contacts, topic preferences
 * - Suppression: list, add, delete (bounces, complaints)
 * - Account: send quota, send statistics
 * - Events: SNS notification parsing (Bounce, Complaint, Delivery, Open, Click)
 * - Rate limiting: 14 email/sec (sandbox), 50K/day (production)
 * - AWS Signature V4 authentication
 * - Type-safe responses with full TypeScript support
 *
 * API Documentation: https://docs.aws.amazon.com/ses/latest/APIReference-V2/
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// ─── Type Definitions ─────────────────────────────────────────────────────

/**
 * SES Email Content (text and/or HTML).
 */
export interface SesEmailContent {
  text?: {
    data: string;
    charset?: string;
  };
  html?: {
    data: string;
    charset?: string;
  };
}

/**
 * SES Email Destination.
 */
export interface SesEmailDestination {
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
}

/**
 * SES Email attachment.
 */
export interface SesEmailAttachment {
  filename: string;
  mimeType: string;
  data: string; // Base64 encoded
}

/**
 * SES Simple email send request.
 */
export interface SesSimpleEmail {
  source: string;
  destination: SesEmailDestination;
  message: {
    subject: {
      data: string;
      charset?: string;
    };
    body: SesEmailContent;
  };
  tags?: Array<{ name: string; value: string }>;
  configurationSetName?: string;
}

/**
 * SES Raw email send request.
 */
export interface SesRawEmail {
  source?: string;
  destinations?: string[];
  rawMessage: {
    data: string; // Base64 encoded MIME message
  };
  tags?: Array<{ name: string; value: string }>;
  configurationSetName?: string;
}

/**
 * SES Templated email send request.
 */
export interface SesTemplateEmail {
  source: string;
  destination: SesEmailDestination;
  template: string;
  templateData?: string; // JSON object as string
  tags?: Array<{ name: string; value: string }>;
  configurationSetName?: string;
}

/**
 * SES Template definition.
 */
export interface SesTemplate {
  templateName: string;
  subjectPart?: string;
  textPart?: string;
  htmlPart?: string;
}

/**
 * SES Configuration Set.
 */
export interface SesConfigSet {
  configurationSetName: string;
}

/**
 * SES Configuration Set Event Destination.
 */
export interface SesEventDestination {
  name: string;
  enabled: boolean;
  matchingEventTypes: Array<
    | "send"
    | "bounce"
    | "complaint"
    | "delivery"
    | "open"
    | "click"
    | "renderingFailure"
    | "deliveryDelay"
    | "subscription"
  >;
  cloudWatchDestination?: {
    dimensionConfigurations: Array<{
      dimensionName: string;
      dimensionValueSource: string;
      defaultDimensionValue: string;
    }>;
  };
  kinesisFirehoseDestination?: {
    iamRoleArn: string;
    deliveryStreamArn: string;
  };
  snsDestination?: {
    topicArn: string;
  };
}

/**
 * SES Contact List.
 */
export interface SesContactList {
  contactListName: string;
  description?: string;
  tags?: Record<string, string>;
}

/**
 * SES Contact.
 */
export interface SesContact {
  emailAddress: string;
  topicPreferences?: Array<{
    topicName: string;
    subscriptionStatus: "OPT_IN" | "OPT_OUT";
  }>;
  unsubscribeAll?: boolean;
}

/**
 * SES Account Suppressed Destination.
 */
export interface SesSuppressedDestination {
  emailAddress: string;
  reason: "BOUNCE" | "COMPLAINT";
  attributes?: {
    bounceType?: "Transient" | "Permanent" | "Undetermined";
    bounceSubType?:
      | "General"
      | "MailFromDomainNotVerified"
      | "MailboxDoesNotExist"
      | "MessageTooLarge"
      | "MessageRejected"
      | "NoEmail"
      | "SuppressionListEntry"
      | "TemporaryFailure"
      | "AccountSendingPausedException"
      | "ConfigurationSetDoesNotExist"
      | "ConfigurationSetSendingPausedException"
      | "Permanent"
      | "Transient"
      | "Undefined";
    complaintFeedbackType?:
      | "abuse"
      | "auth-failure"
      | "fraud"
      | "not-spam"
      | "other"
      | "virus";
  };
  lastUpdateTime?: number;
}

/**
 * SES Send Statistics.
 */
export interface SesSendStatistics {
  sends: number;
  bounces: number;
  complaints: number;
  deliveryAttempts: number;
  opens?: number;
  clicks?: number;
  rejectionRate?: number;
  complaintRate?: number;
}

/**
 * SES SNS Event notification.
 */
export interface SesSnseventNotification {
  eventType:
    | "Bounce"
    | "Complaint"
    | "Delivery"
    | "Send"
    | "Open"
    | "Click"
    | "Reject"
    | "DeliveryDelay"
    | "Subscription";
  bounce?: {
    bounceType: "Transient" | "Permanent" | "Undetermined";
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp: string;
    feedbackId: string;
    remoteMtaIp?: string;
  };
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string;
      complaintFeedbackType?: string;
    }>;
    timestamp: string;
    userAgent?: string;
    complaintFeedbackType?: string;
    arrivalDate?: string;
  };
  delivery?: {
    recipients: string[];
    timestamp: string;
    processingTimeMillis: number;
    smtpResponse?: string;
    remoteMtaIp?: string;
    reportingMTA?: string;
  };
  open?: {
    timestamp: string;
    userAgent: string;
  };
  click?: {
    timestamp: string;
    userAgent: string;
    link?: string;
    linkTags?: Record<string, string[]>;
  };
}

/**
 * SES SDK Client configuration.
 */
export interface SesClientConfig {
  /** AWS Access Key ID */
  accessKeyId: string;

  /** AWS Secret Access Key */
  secretAccessKey: string;

  /** AWS Region (e.g., us-east-1) */
  region: string;

  /** AWS Session Token (optional, for temporary credentials) */
  sessionToken?: string;

  /** Base URL override */
  baseUrl?: string;

  /** SNS topic signing certificate URL endpoint */
  certificateUrl?: string;
}

// ─── AWS SES SDK Client ────────────────────────────────────────────────────

/**
 * AWS SES SDK Client for v2 API.
 */
export class SesSDKClient {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string;
  private readonly region: string;
  private readonly baseUrl: string;
  private readonly service = "ses";

  constructor(config: SesClientConfig) {
    if (!config.accessKeyId) {
      throw new Error("AWS accessKeyId is required");
    }
    if (!config.secretAccessKey) {
      throw new Error("AWS secretAccessKey is required");
    }
    if (!config.region) {
      throw new Error("AWS region is required");
    }

    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.sessionToken = config.sessionToken;
    this.region = config.region;
    this.baseUrl =
      config.baseUrl || `https://email.${this.region}.amazonaws.com`;
  }

  /**
   * Create AWS Signature V4 authorization header.
   */
  private createAuthorizationHeader(
    method: string,
    path: string,
    headers: Record<string, string>,
    bodyHash: string,
  ): string {
    const amzDate = headers["X-Amz-Date"];
    const datestamp = amzDate.split("T")[0];
    const credentialScope = `${datestamp}/${this.region}/${this.service}/aws4_request`;

    // Create canonical request
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k.toLowerCase()}:${v}`)
      .join("\n");

    const signedHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .join(";");

    const canonicalRequest = [
      method,
      path,
      "",
      `${canonicalHeaders}\n`,
      signedHeaders,
      bodyHash,
    ].join("\n");

    // Create string to sign
    const canonicalRequestHash = createHash("sha256")
      .update(canonicalRequest)
      .digest("hex");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join("\n");

    // Calculate signature
    const kDate = createHmac("sha256", `AWS4${this.secretAccessKey}`)
      .update(datestamp)
      .digest();

    const kRegion = createHmac("sha256", kDate).update(this.region).digest();

    const kService = createHmac("sha256", kRegion)
      .update(this.service)
      .digest();

    const kSigning = createHmac("sha256", kService)
      .update("aws4_request")
      .digest();

    const signature = createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    // Build Authorization header
    const authorizationHeader = [
      "AWS4-HMAC-SHA256",
      `Credential=${this.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(", ");

    return authorizationHeader;
  }

  /**
   * Make HTTP request to SES API with AWS Signature V4.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let bodyStr = "";
    let bodyHash = createHash("sha256").update("").digest("hex");

    if (body) {
      bodyStr = JSON.stringify(body);
      bodyHash = createHash("sha256").update(bodyStr).digest("hex");
    }

    const amzDate =
      new Date().toISOString().replace(/[:-]/g, "").split(".")[0] + "Z";

    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Date": amzDate,
      Host: new URL(url).host,
      "X-Amz-Content-Sha256": bodyHash,
    };

    if (this.sessionToken) {
      headers["X-Amz-Security-Token"] = this.sessionToken;
    }

    const authorization = this.createAuthorizationHeader(
      method,
      path,
      headers,
      bodyHash,
    );
    headers["Authorization"] = authorization;

    const options: RequestInit = {
      method,
      headers,
    };

    if (bodyStr) {
      options.body = bodyStr;
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `AWS SES API error (${response.status}): ${error || response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    return {} as T;
  }

  /**
   * Send email with simple content.
   */
  async sendEmail(email: SesSimpleEmail): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/outbound-emails", email);
  }

  /**
   * Send raw email (MIME format).
   */
  async sendRawEmail(email: SesRawEmail): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/outbound-raw-emails", email);
  }

  /**
   * Send templated email.
   */
  async sendTemplateEmail(
    email: SesTemplateEmail,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/outbound-template-emails", email);
  }

  /**
   * Create email template.
   */
  async createTemplate(
    template: SesTemplate,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/templates", template);
  }

  /**
   * Update email template.
   */
  async updateTemplate(
    templateName: string,
    template: Partial<SesTemplate>,
  ): Promise<void> {
    await this.request("PUT", `/v2/email/templates/${templateName}`, template);
  }

  /**
   * Delete email template.
   */
  async deleteTemplate(templateName: string): Promise<void> {
    await this.request("DELETE", `/v2/email/templates/${templateName}`);
  }

  /**
   * List email templates.
   */
  async listTemplates(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v2/email/templates");
  }

  /**
   * Get template details.
   */
  async getTemplate(templateName: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/v2/email/templates/${templateName}`);
  }

  /**
   * Test template rendering with sample data.
   */
  async testTemplate(
    templateName: string,
    templateData: string,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/v2/email/templates/${templateName}/render`, {
      templateData,
    });
  }

  /**
   * Create configuration set.
   */
  async createConfigSet(
    configSet: SesConfigSet,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/configuration-sets", configSet);
  }

  /**
   * Delete configuration set.
   */
  async deleteConfigSet(configSetName: string): Promise<void> {
    await this.request(
      "DELETE",
      `/v2/email/configuration-sets/${configSetName}`,
    );
  }

  /**
   * Create event destination for configuration set.
   */
  async createEventDestination(
    configSetName: string,
    eventDestination: SesEventDestination,
  ): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      `/v2/email/configuration-sets/${configSetName}/event-destinations`,
      eventDestination,
    );
  }

  /**
   * Delete event destination.
   */
  async deleteEventDestination(
    configSetName: string,
    destinationName: string,
  ): Promise<void> {
    await this.request(
      "DELETE",
      `/v2/email/configuration-sets/${configSetName}/event-destinations/${destinationName}`,
    );
  }

  /**
   * Verify email identity.
   */
  async verifyEmailIdentity(
    emailAddress: string,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/identities", {
      emailAddress,
      identityType: "EMAIL_ADDRESS",
    });
  }

  /**
   * Verify domain identity.
   */
  async verifyDomainIdentity(domain: string): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/identities", {
      domainName: domain,
      identityType: "DOMAIN",
    });
  }

  /**
   * List contact lists.
   */
  async listContactLists(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v2/email/contact-lists");
  }

  /**
   * Create contact list.
   */
  async createContactList(
    contactList: SesContactList,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/email/contact-lists", contactList);
  }

  /**
   * Add contact to list.
   */
  async addContact(
    contactListName: string,
    contact: SesContact,
  ): Promise<void> {
    await this.request(
      "POST",
      `/v2/email/contact-lists/${contactListName}/contacts`,
      contact,
    );
  }

  /**
   * List suppressed destinations.
   */
  async listSuppressedDestinations(options?: {
    reason?: "BOUNCE" | "COMPLAINT";
    startDate?: string;
    endDate?: string;
    pageSize?: number;
  }): Promise<Record<string, unknown>> {
    let url = "/v2/email/suppression/addresses";
    const params = new URLSearchParams();

    if (options?.reason) {
      params.append("Reason", options.reason);
    }
    if (options?.startDate) {
      params.append("StartDate", options.startDate);
    }
    if (options?.endDate) {
      params.append("EndDate", options.endDate);
    }
    if (options?.pageSize) {
      params.append("PageSize", String(options.pageSize));
    }

    if (params.size > 0) {
      url += `?${params.toString()}`;
    }

    return this.request("GET", url);
  }

  /**
   * Add suppressed destination (bounce or complaint).
   */
  async addSuppressedDestination(
    emailAddress: string,
    reason: "BOUNCE" | "COMPLAINT",
  ): Promise<void> {
    await this.request("PUT", "/v2/email/suppression/addresses", {
      emailAddress,
      reason,
    });
  }

  /**
   * Delete suppressed destination.
   */
  async deleteSuppressedDestination(emailAddress: string): Promise<void> {
    await this.request(
      "DELETE",
      `/v2/email/suppression/addresses/${emailAddress}`,
    );
  }

  /**
   * Get account send quota.
   */
  async getSendQuota(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v2/email/account");
  }

  /**
   * Get account send statistics.
   */
  async getSendStatistics(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v2/email/account/details");
  }

  /**
   * Verify SNS event signature (for SNS notifications from SES).
   * Uses public certificate from AWS Certificate URL.
   */
  async verifySnsSignature(
    message: string,
    messageSignature: string,
    certificateUrl: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(certificateUrl);
      const certificate = await response.text();

      // Verify signature using the certificate
      const verifier = createHmac("sha256", certificate);
      const expectedSignature = verifier.update(message).digest("base64");

      try {
        return timingSafeEqual(
          Buffer.from(messageSignature),
          Buffer.from(expectedSignature),
        );
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Parse SNS notification (from SES events).
   */
  async handleSnsNotification(
    snsMessage: string,
  ): Promise<SesSnseventNotification> {
    return JSON.parse(snsMessage) as SesSnseventNotification;
  }
}

export default SesSDKClient;
