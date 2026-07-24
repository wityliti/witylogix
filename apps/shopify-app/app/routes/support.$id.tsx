/**
 * Support Ticket Detail Page
 *
 * Features:
 *   - Ticket header with subject, status, priority, created date
 *   - Message thread with alternating user/support messages
 *   - Reply form with TextField multiline
 *   - Actions: Resolve, Close, Reopen
 *   - Internal notes section (if admin)
 *   - Mock data only
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useParams } from "react-router";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Text,
  Box,
  TextField,
  Divider,
} from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface Message {
  id: string;
  author: string;
  authorRole: "customer" | "support" | "system";
  content: string;
  createdAt: string;
  attachments?: string[];
}

interface TicketDetail {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  messages: Message[];
  internalNotes: string[];
  isAdmin: boolean;
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;

  // Mock data only
  const ticketData: TicketDetail = {
    id: id || "ticket-001",
    subject: "Integration Setup Help Needed",
    description:
      "Having trouble setting up the Shopify integration with our system.",
    status: "open",
    priority: "high",
    category: "Technical",
    createdAt: "2026-03-05T10:30:00Z",
    updatedAt: "2026-03-06T14:20:00Z",
    createdBy: "john@acmecorp.com",
    isAdmin: false,
    messages: [
      {
        id: "msg-001",
        author: "John Smith",
        authorRole: "customer",
        content:
          "Hi, I'm trying to set up the Shopify integration but I keep getting an authentication error. Can you help?",
        createdAt: "2026-03-05T10:30:00Z",
      },
      {
        id: "msg-002",
        author: "Support Team",
        authorRole: "support",
        content:
          "Hi John! Thanks for contacting us. Can you please provide the following information:\n\n1. Your Shopify store URL\n2. The exact error message you're seeing\n3. Steps you've already tried\n\nThis will help us troubleshoot faster.",
        createdAt: "2026-03-05T11:15:00Z",
      },
      {
        id: "msg-003",
        author: "John Smith",
        authorRole: "customer",
        content:
          "Store URL is acmestore.myshopify.com\nError: 'Invalid OAuth token'\nI've tried re-authorizing twice but same error",
        createdAt: "2026-03-05T12:00:00Z",
      },
      {
        id: "msg-004",
        author: "Sarah Johnson",
        authorRole: "support",
        content:
          "Thank you for that info! The OAuth token issue could be due to the app needing re-installation. Please try these steps:\n\n1. Uninstall the app from your Shopify admin\n2. Wait 5 minutes\n3. Reinstall from the Shopify app store\n4. Complete the OAuth flow again\n\nLet me know if this resolves the issue!",
        createdAt: "2026-03-06T09:00:00Z",
      },
      {
        id: "msg-005",
        author: "John Smith",
        authorRole: "customer",
        content:
          "Perfect! That worked. The app is now connected and working great. Thanks so much!",
        createdAt: "2026-03-06T14:20:00Z",
      },
    ],
    internalNotes: [
      "OAuth token issue - resolved by reinstalling app",
      "Customer very satisfied with quick resolution",
    ],
  };

  return ticketData;
}

// ─── Component ─────────────────────────────────────────────

export default function SupportTicketDetail() {
  const ticket = useLoaderData<TicketDetail>();
  const { id } = useParams();

  const [replyText, setReplyText] = useState("");
  const [showInternalNotes, setShowInternalNotes] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      // Mock submit
      setReplyText("");
    }
  };

  const handleAddInternalNote = () => {
    if (internalNote.trim()) {
      // Mock submit
      setInternalNote("");
    }
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case "open":
        return "info" as const;
      case "in_progress":
        return "attention" as const;
      case "resolved":
        return "success" as const;
      case "closed":
        return "new" as const;
      default:
        return "info" as const;
    }
  };

  const getPriorityTone = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "critical" as const;
      case "high":
        return "warning" as const;
      case "medium":
        return "info" as const;
      case "low":
        return "new" as const;
      default:
        return "info" as const;
    }
  };

  return (
    <Page
      title={ticket.subject}
      backAction={{
        content: "Back to Support",
        onAction: () => window.history.back(),
      }}
    >
      <Layout>
        {/* Ticket Header */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h1" variant="headingLg">
                    {ticket.subject}
                  </Text>
                  <Text as="span" variant="bodySm">
                    Ticket #{ticket.id}
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Badge tone={getStatusTone(ticket.status)}>
                    {ticket.status
                      .replace(/_/g, " ")
                      .split(" ")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </Badge>
                  <Badge tone={getPriorityTone(ticket.priority)}>
                    {ticket.priority.charAt(0).toUpperCase() +
                      ticket.priority.slice(1)}
                  </Badge>
                </InlineStack>
              </InlineStack>

              <Divider />

              <InlineStack gap="400">
                <Box>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm">
                      Category
                    </Text>
                    <Text as="p" variant="bodySm">
                      {ticket.category}
                    </Text>
                  </BlockStack>
                </Box>
                <Box>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm">
                      Created
                    </Text>
                    <Text as="p" variant="bodySm">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                </Box>
                <Box>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm">
                      Last Updated
                    </Text>
                    <Text as="p" variant="bodySm">
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>

              <InlineStack gap="200">
                {ticket.status !== "resolved" && ticket.status !== "closed" && (
                  <>
                    <Button variant="secondary">Resolve</Button>
                    <Button variant="secondary">Close</Button>
                  </>
                )}
                {(ticket.status === "resolved" ||
                  ticket.status === "closed") && (
                  <Button variant="secondary">Reopen</Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Original Description */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Original Description
              </Text>
              <Box padding="300" background="bg-surface-secondary">
                <Text as="p" variant="bodySm">
                  {ticket.description}
                </Text>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Message Thread */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Conversation
              </Text>

              <BlockStack gap="300">
                {ticket.messages.map((message) => (
                  <Box
                    key={message.id}
                    padding="300"
                    background={
                      message.authorRole === "support"
                        ? "bg-surface-secondary"
                        : "bg-surface"
                    }
                    borderRadius="200"
                  >
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" fontWeight="bold">
                            {message.author}
                          </Text>
                          <Text as="span" variant="bodySm">
                            {message.authorRole === "support" && (
                              <Badge tone="info">Support</Badge>
                            )}
                            {message.authorRole === "customer" && (
                              <Badge tone="new">Customer</Badge>
                            )}
                          </Text>
                        </BlockStack>
                        <Text as="span" variant="bodySm">
                          {new Date(message.createdAt).toLocaleDateString()} at{" "}
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </InlineStack>

                      <Box paddingBlockStart="200">
                        <Text as="p" variant="bodySm">
                          {message.content.split("\n").map((line, idx) => (
                            <span key={idx}>
                              {line}
                              <br />
                            </span>
                          ))}
                        </Text>
                      </Box>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Reply Form */}
        {ticket.status !== "closed" && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Add Reply
                </Text>

                <TextField
                  label="Message"
                  value={replyText}
                  onChange={setReplyText}
                  placeholder="Type your reply here..."
                  multiline={4}
                  autoComplete="off"
                />

                <Button
                  variant="primary"
                  onClick={handleSubmitReply}
                  disabled={!replyText.trim()}
                >
                  Send Reply
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Internal Notes */}
        {ticket.isAdmin && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Internal Notes
                  </Text>
                  <Button
                    variant="plain"
                    onClick={() => setShowInternalNotes(!showInternalNotes)}
                  >
                    {showInternalNotes ? "Hide" : "Show"}
                  </Button>
                </InlineStack>

                {showInternalNotes && (
                  <BlockStack gap="200">
                    {ticket.internalNotes.length === 0 ? (
                      <Text as="p" variant="bodySm">
                        No internal notes yet.
                      </Text>
                    ) : (
                      ticket.internalNotes.map((note, idx) => (
                        <Box
                          key={idx}
                          padding="200"
                          background="bg-surface-secondary"
                        >
                          <Text as="p" variant="bodySm">
                            {note}
                          </Text>
                        </Box>
                      ))
                    )}

                    <Divider />

                    <TextField
                      label="Add Note"
                      value={internalNote}
                      onChange={setInternalNote}
                      placeholder="Internal note (visible only to team)"
                      multiline={3}
                      autoComplete="off"
                    />

                    <Button
                      variant="secondary"
                      onClick={handleAddInternalNote}
                      disabled={!internalNote.trim()}
                    >
                      Add Internal Note
                    </Button>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

// ─── Error Boundary ────────────────────────────────────────

export function ErrorBoundary() {
  return (
    <Page
      title="Support Ticket"
      backAction={{
        content: "Back to Support",
        onAction: () => window.history.back(),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Error Loading Ticket
              </Text>
              <Text as="p" variant="bodySm">
                We encountered an error while loading this ticket. Please try
                refreshing the page.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
