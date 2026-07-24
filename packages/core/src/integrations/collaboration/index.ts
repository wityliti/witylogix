/**
 * Collaboration Integration Exports
 */

// Types
export type {
  CollaborationUser,
  CollaborationChannel,
  CollaborationMessage,
  CollaborationAttachment,
  MentionInfo,
  CollaborationReaction,
  CollaborationPresence,
  CollaborationWebhookEvent,
  CollaborationConfig,
  CollaborationAdapterInterface,
  ChannelType,
  MessageType,
  PresenceStatus,
  ReactionType,
  WebhookEventType,
  ChannelCacheEntry,
  PresenceTracking,
  CircuitBreakerState,
  RateLimitState,
  RetryConfig,
  DeliveryStatus,
  NotificationRule,
  MessageTemplate,
  CrossPlatformPresence,
  CollaborationHubConfig,
} from "./types";

// Unified SDK Types
export {
  CollaborationPlatform,
  platformSchema,
  unifiedMessageSchema,
  unifiedChannelSchema,
  unifiedUserSchema,
} from "./collaboration-sdk-types";
export type {
  UnifiedMessage,
  UnifiedChannel,
  UnifiedUser,
  UnifiedAttachment,
  UnifiedReaction,
  UnifiedMention,
  UnifiedPresence,
  UnifiedWebhookEvent,
  PresenceStatus as UnifiedPresenceStatus,
  WebhookEventType as UnifiedWebhookEventType,
  ConversionOptions,
  CollaborationSDKConfig,
  PaginatedResult,
  OperationResult,
} from "./collaboration-sdk-types";

// SDK Clients
export { SlackSDKClient } from "./slack-sdk-client";
export type {
  SlackOAuth2Token,
  SlackMessage,
  SlackChannel,
  SlackUser,
  SlackFile,
  SlackEvent,
  SlackAttachment,
  SlackBlockElement,
} from "./slack-sdk-client";

export { TeamsSDKClient } from "./teams-sdk-client";
export type {
  TeamsOAuth2Token,
  TeamsTeam,
  TeamsChannel,
  TeamsMessage,
  TeamsChat,
  TeamsUser,
  TeamsAttachment,
  TeamsReaction,
  TeamsPresence,
  TeamsSubscription,
  TeamsChangeNotification,
  TeamsAdaptiveCard,
} from "./teams-sdk-client";

// Base Adapter
export { CollaborationAdapter } from "./collaboration-adapter";

// Platform Adapters
export { SlackClient } from "./slack-client";
export { TeamsClient } from "./teams-client";
export { PusherClient } from "./pusher-client";

// Hub
export { CollaborationHub } from "./collaboration-hub";
