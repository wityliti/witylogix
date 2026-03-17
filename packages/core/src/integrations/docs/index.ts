/**
 * Documentation Engine — Main entry point for auto-generated integration documentation.
 */

export {
  AutoDocGenerator,
  WebhookCatalog,
  RateLimitReference,
  TroubleshootingPlaybooks,
  ConfigurationGuideGenerator,
} from "./documentation-engine";

export type {
  ConfigGuide,
  MethodDoc,
  ParameterDoc,
  PayloadSchema,
  Playbook,
  ProviderDocumentation,
  RateLimitInfo,
  RateLimitReference as RateLimitReferenceType,
  ResponseDoc,
  SDKDocumentation,
  TroubleshootingReference,
  WebhookCatalog as WebhookCatalogType,
  WebhookEventDoc,
  DiagnosticNode,
  PlaybookStep,
  ConfigurationStep,
} from "./docs-types";
