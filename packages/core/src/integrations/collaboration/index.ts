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

// Base Adapter
export { CollaborationAdapter } from './collaboration-adapter';

// Platform Adapters
export { SlackClient } from './slack-client';
export { TeamsClient } from './teams-client';
export { PusherClient } from './pusher-client';

// Hub
export { CollaborationHub } from './collaboration-hub';
