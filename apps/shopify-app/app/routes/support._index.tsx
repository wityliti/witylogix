/**
 * Support Center — Ticket management with creation form and list
 *
 * Features:
 *   - Create ticket form with subject, description, priority, category
 *   - Ticket list with IndexTable
 *   - Status badges: open=info, in_progress=attention, resolved=success, closed=new
 *   - Priority badges: urgent=critical, high=warning, medium=info, low=new
 *   - View ticket link to ticket detail page
 *   - Mock data only
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
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
  Select,
  Modal,
  IndexTable,
} from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface SupportPageData {
  tickets: SupportTicket[];
  openTicketCount: number;
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  // Mock data only
  const supportData: SupportPageData = {
    openTicketCount: 3,
    tickets: [
      {
        id: "ticket-001",
        subject: "Integration Setup Help Needed",
        description: "Having trouble setting up the Shopify integration with our system.",
        status: "open",
        priority: "high",
        category: "Technical",
        createdAt: "2026-03-05T10:30:00Z",
        updatedAt: "2026-03-05T10:30:00Z",
        messageCount: 2,
      },
      {
        id: "ticket-002",
        subject: "API Rate Limit Issues",
        description: "Experiencing rate limiting on API calls during peak hours.",
        status: "in_progress",
        priority: "urgent",
        category: "Technical",
        createdAt: "2026-03-04T14:15:00Z",
        updatedAt: "2026-03-06T09:00:00Z",
        messageCount: 5,
      },
      {
        id: "ticket-003",
        subject: "Billing Question",
        description: "Can I upgrade my plan mid-month and pro-rata the charges?",
        status: "open",
        priority: "medium",
        category: "Billing",
        createdAt: "2026-03-03T16:45:00Z",
        updatedAt: "2026-03-03T16:45:00Z",
        messageCount: 1,
      },
      {
        id: "ticket-004",
        subject: "Feature Request: Bulk Export",
        description: "Would love to see bulk export functionality for orders and shipments.",
        status: "resolved",
        priority: "low",
        category: "Feature Request",
        createdAt: "2026-02-28T11:20:00Z",
        updatedAt: "2026-03-01T13:00:00Z",
        messageCount: 3,
      },
      {
        id: "ticket-005",
        subject: "Dashboard Performance",
        description: "Dashboard is loading slowly when viewing large order lists.",
        status: "in_progress",
        priority: "high",
        category: "Performance",
        createdAt: "2026-02-25T09:10:00Z",
        updatedAt: "2026-03-02T15:30:00Z",
        messageCount: 4,
      },
    ],
  };

  return supportData;
}

// ─── Component ─────────────────────────────────────────────

export default function SupportIndex() {
  const { tickets, openTicketCount } = useLoaderData<SupportPageData>();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("technical");

  const handleCreateTicket = () => {
    if (subject && description) {
      // Mock submit
      setShowCreateModal(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
      setCategory("technical");
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
    <Page title="Support Center">
      <Layout>
        {/* Support Overview */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Support Overview
              </Text>
              <InlineStack gap="400">
                <Box>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm">
                      Open Tickets
                    </Text>
                    <Text as="p" variant="headingMd">
                      {openTicketCount}
                    </Text>
                  </BlockStack>
                </Box>
                <Box>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm">
                      Total Tickets
                    </Text>
                    <Text as="p" variant="headingMd">
                      {tickets.length}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Create Support Ticket
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Ticket List */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Support Tickets
              </Text>

              <div style={{ overflowX: "auto" }}>
                <IndexTable
                  headings={[
                    { title: "Subject" },
                    { title: "Status" },
                    { title: "Priority" },
                    { title: "Created" },
                    { title: "Messages" },
                    { title: "Action" },
                  ]}
                  itemCount={tickets.length}
                  selectable={false}
                  resourceName={{ singular: "ticket", plural: "tickets" }}
                >
                  {tickets.map((ticket, idx) => (
                    <IndexTable.Row
                      key={ticket.id}
                      id={ticket.id}
                      position={idx}
                    >
                      <IndexTable.Cell>
                        <Text as="p" variant="bodySm">
                          {ticket.subject}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={getStatusTone(ticket.status)}>
                          {ticket.status
                            .replace(/_/g, " ")
                            .split(" ")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={getPriorityTone(ticket.priority)}>
                          {ticket.priority.charAt(0).toUpperCase() +
                            ticket.priority.slice(1)}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="p" variant="bodySm">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="p" variant="bodySm">
                          {ticket.messageCount}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Link to={`/support/${ticket.id}`}>
                          <Button variant="plain">View</Button>
                        </Link>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* FAQ Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Frequently Asked Questions
              </Text>

              <BlockStack gap="300">
                <Box padding="300">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">
                      What's the average response time for support tickets?
                    </Text>
                    <Text as="p" variant="bodySm">
                      For urgent issues, we typically respond within 1 hour. High priority
                      tickets usually get a response within 4 hours. Other priorities within
                      24 hours.
                    </Text>
                  </BlockStack>
                </Box>

                <Box padding="300">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">
                      How do I contact support directly?
                    </Text>
                    <Text as="p" variant="bodySm">
                      You can create a support ticket here, email support@witylogix.com,
                      or call us at 1-800-WITY-LOG (1-800-948-9564) for urgent issues.
                    </Text>
                  </BlockStack>
                </Box>

                <Box padding="300">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">
                      What documentation is available?
                    </Text>
                    <Text as="p" variant="bodySm">
                      Check out our Knowledge Base and API Documentation in the help section.
                      We also have video tutorials for common setup tasks.
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Create Ticket Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Support Ticket"
        primaryAction={{
          content: "Submit",
          onAction: handleCreateTicket,
          disabled: !subject || !description,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowCreateModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Subject"
              value={subject}
              onChange={setSubject}
              placeholder="Brief description of your issue"
              autoComplete="off"
            />

            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Provide detailed information about your issue"
              multiline={4}
              autoComplete="off"
            />

            <Select
              label="Category"
              options={[
                { label: "Technical", value: "technical" },
                { label: "Billing", value: "billing" },
                { label: "Feature Request", value: "feature" },
                { label: "Account", value: "account" },
                { label: "Other", value: "other" },
              ]}
              value={category}
              onChange={setCategory}
            />

            <Select
              label="Priority"
              options={[
                { label: "Low", value: "low" },
                { label: "Medium", value: "medium" },
                { label: "High", value: "high" },
                { label: "Urgent", value: "urgent" },
              ]}
              value={priority}
              onChange={setPriority}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

// ─── Error Boundary ────────────────────────────────────────

export function ErrorBoundary() {
  return (
    <Page title="Support Center">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Error Loading Support Tickets
              </Text>
              <Text as="p" variant="bodySm">
                We encountered an error while loading the support tickets. Please try refreshing the page.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
