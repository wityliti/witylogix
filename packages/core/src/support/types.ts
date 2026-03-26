/**
 * Support System Types
 * Defines types for support tickets, messages, and feature requests
 */

/**
 * Support ticket status
 */
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

/**
 * Support ticket priority
 */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Support ticket category
 */
export type TicketCategory = 'billing' | 'technical' | 'feature' | 'other';

/**
 * Feature request status
 */
export type FeatureRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'declined';

/**
 * Feature request category
 */
export type FeatureRequestCategory = 'delivery' | 'tracking' | 'billing' | 'integration' | 'other';

/**
 * Support ticket interface
 */
export interface SupportTicket {
  id: string;
  shopId: string;
  userId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: TicketCategory;
  assigneeId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Support message interface
 */
export interface SupportMessage {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  isInternal: boolean;
  attachments: string[];
  createdAt: Date;
}

/**
 * Support ticket with messages
 */
export interface SupportTicketWithMessages extends SupportTicket {
  messages: SupportMessage[];
}

/**
 * Feature request interface
 */
export interface FeatureRequest {
  id: string;
  shopId: string;
  userId: string;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  category?: FeatureRequestCategory;
  votes: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to create support ticket
 */
export interface CreateTicketRequest {
  subject: string;
  description: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  tags?: string[];
}

/**
 * Request to update support ticket
 */
export interface UpdateTicketRequest {
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assigneeId?: string;
  tags?: string[];
}

/**
 * Request to add message to ticket
 */
export interface AddMessageRequest {
  content: string;
  isInternal?: boolean;
  attachments?: string[];
}

/**
 * Request to create feature request
 */
export interface CreateFeatureRequestRequest {
  title: string;
  description: string;
  category?: FeatureRequestCategory;
}

/**
 * Request to update feature request
 */
export interface UpdateFeatureRequestRequest {
  title?: string;
  description?: string;
  status?: FeatureRequestStatus;
  category?: FeatureRequestCategory;
}

/**
 * Ticket filter options
 */
export interface TicketFilterOptions {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assigneeId?: string;
  tags?: string[];
  searchTerm?: string;
}

/**
 * Feature request filter options
 */
export interface FeatureRequestFilterOptions {
  status?: FeatureRequestStatus;
  category?: FeatureRequestCategory;
  searchTerm?: string;
  minVotes?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Ticket list response
 */
export interface TicketListResponse {
  tickets: SupportTicket[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Feature request list response
 */
export interface FeatureRequestListResponse {
  requests: FeatureRequest[];
  total: number;
  limit: number;
  offset: number;
}
