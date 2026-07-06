/**
 * Support System - Barrel Export
 */

export {
  TicketManager,
  ticketManager,
  TicketNotFoundError,
  FeatureRequestNotFoundError,
  TicketError,
} from "./ticket-manager";
export type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  FeatureRequestStatus,
  FeatureRequestCategory,
  SupportTicket,
  SupportMessage,
  SupportTicketWithMessages,
  FeatureRequest,
  CreateTicketRequest,
  UpdateTicketRequest,
  AddMessageRequest,
  CreateFeatureRequestRequest,
  UpdateFeatureRequestRequest,
  TicketFilterOptions,
  FeatureRequestFilterOptions,
  PaginationOptions,
  TicketListResponse,
  FeatureRequestListResponse,
} from "./types";
