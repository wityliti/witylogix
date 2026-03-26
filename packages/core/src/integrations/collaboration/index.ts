/**
 * Collaboration Integration Exports
 */

// Types
export {
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
} from './types';

// Unified SDK Types
export {
  CollaborationPlatform,
  UnifiedMessage,
  UnifiedChannel,
  UnifiedUser,
  UnifiedAttachment,
  UnifiedReaction,
  UnifiedMention,
  UnifiedPresence,
  UnifiedWebhookEvent,
  PresenceStatus as UnifiedPresenceStatus,
  type WebhookEventType as UnifiedWebhookEventType,
  type ConversionOptions,
  type CollaborationSDKConfig,
  type PaginatedResult,
  type OperationResult,
  platformSchema,
  unifiedMessageSchema,
  unifiedChannelSchema,
  unifiedUserSchema,
} from './collaboration-sdk-types';

// SDK Clients
export {
  SlackSDKClient,
  type SlackOAuth2Token,
  type SlackMessage,
  type SlackChannel,
  type SlackUser,
  type SlackFile,
  type SlackEvent,
  type SlackAttachment,
  type SlackBlockElement,
} from './slack-sdk-client';

export {
  TeamsSDKClient,
  type TeamsOAuth2Token,
  type TeamsTeam,
  type TeamsChannel,
  type TeamsMessage,
  type TeamsChat,
  type TeamsUser,
  type TeamsAttachment,
  type TeamsReaction,
  type TeamsPresence,
  type TeamsSubscription,
  type TeamsChangeNotification,
  type TeamsAdaptiveCard,
} from './teams-sdk-client';

// Base Adapter
export { CollaborationAdapter } from './collaboration-adapter';

// Platform Adapters
export { SlackClient } from './slack-client';
export { TeamsClient } from './teams-client';
export { PusherClient } from './pusher-client';

// Hub
export { CollaborationHub } from './collaboration-hub';
