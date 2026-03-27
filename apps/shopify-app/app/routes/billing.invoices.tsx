/**
 * Invoice Detail & History Page
 *
 * Features:
 *   - Invoice list with IndexTable (Date, Amount, Status, Actions)
 *   - Status badges with appropriate tones
 *   - Download PDF button for each invoice
 *   - Summary stats: Total paid, Outstanding, Next invoice date
 *   - Mock data only
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
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
  IndexTable,
} from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  pdfUrl: string;
  dueDate: string;
  description: string;
}

interface InvoiceSummary {
  totalPaid: number;
  outstanding: number;
  nextInvoiceDate: string;
  invoices: Invoice[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  // Mock data only
  const invoiceData: InvoiceSummary = {
    totalPaid: 1196.0,
    outstanding: 0,
    nextInvoiceDate: "2026-04-07",
    invoices: [
      {
        id: "inv-2026-03",
        date: "2026-03-07",
        dueDate: "2026-03-14",
        amount: 299.0,
        status: "paid",
        description: "Professional Plan - March 2026",
        pdfUrl: "/invoices/2026-03.pdf",
      },
      {
        id: "inv-2026-02",
        date: "2026-02-07",
        dueDate: "2026-02-14",
        amount: 299.0,
        status: "paid",
        description: "Professional Plan - February 2026",
        pdfUrl: "/invoices/2026-02.pdf",
      },
      {
        id: "inv-2026-01",
        date: "2026-01-07",
        dueDate: "2026-01-14",
        amount: 299.0,
        status: "paid",
        description: "Professional Plan - January 2026",
        pdfUrl: "/invoices/2026-01.pdf",
      },
      {
        id: "inv-2025-12",
        date: "2025-12-07",
        dueDate: "2025-12-14",
        amount: 299.0,
        status: "paid",
        description: "Professional Plan - December 2025",
        pdfUrl: "/invoices/2025-12.pdf",
      },
      {
        id: "inv-2025-11",
        date: "2025-11-07",
        dueDate: "2025-11-14",
        amount: 0,
        status: "pending",
        description: "Professional Plan - November 2025",
        pdfUrl: "/invoices/2025-11.pdf",
      },
      {
        id: "inv-2025-10",
        date: "2025-10-07",
        dueDate: "2025-10-14",
        amount: 99.0,
        status: "failed",
        description: "Starter Plan - October 2025",
        pdfUrl: "/invoices/2025-10.pdf",
      },
    ],
  };

  return invoiceData;
}

// ─── Component ─────────────────────────────────────────────

export default function BillingInvoices() {
  const { totalPaid, outstanding, nextInvoiceDate, invoices } =
    useLoaderData<InvoiceSummary>();

  return (
    <Page title="Invoices">
      <Layout>
        {/* Summary Stats */}
        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {/* Total Paid */}
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Total Paid
                </Text>
                <Text as="p" variant="headingLg">
                  ${Number(totalPaid).toFixed(2)}
                </Text>
              </BlockStack>
            </Card>

            {/* Outstanding */}
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Outstanding
                </Text>
                <Text as="p" variant="headingLg">
                  ${Number(outstanding).toFixed(2)}
                </Text>
                {outstanding > 0 && (
                  <Badge tone="critical">Action Required</Badge>
                )}
              </BlockStack>
            </Card>

            {/* Next Invoice */}
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Next Invoice Date
                </Text>
                <Text as="p" variant="headingLg">
                  {new Date(nextInvoiceDate).toLocaleDateString()}
                </Text>
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>

        {/* Invoice List */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Invoice History
              </Text>

              <div style={{ overflowX: "auto" }}>
                <IndexTable
                  headings={[
                    { title: "Date" },
                    { title: "Description" },
                    { title: "Amount" },
                    { title: "Status" },
                    { title: "Due Date" },
                    { title: "Action" },
                  ]}
                  itemCount={invoices.length}
                  selectable={false}
                  resourceName={{ singular: "invoice", plural: "invoices" }}
                >
                  {invoices.map((invoice, idx) => (
                    <IndexTable.Row
                      key={invoice.id}
                      id={invoice.id}
                      position={idx}
                    >
                      <IndexTable.Cell>
                        <Text as="p" variant="bodySm">
                          {new Date(invoice.date).toLocaleDateString()}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="p" variant="bodySm">
                          {invoice.description}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="p" variant="bodySm">
                          ${Number(invoice.amount).toFixed(2)}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge
                          tone={
                            invoice.status === "paid"
                              ? "success"
                              : invoice.status === "pending"
                                ? "attention"
                                : "critical"
                          }
                        >
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="p" variant="bodySm">
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <InlineStack gap="200">
                          <Button
                            variant="plain"
                            onClick={() => {
                              // Mock PDF download
                              window.open(invoice.pdfUrl, "_blank");
                            }}
                          >
                            Download
                          </Button>
                          {invoice.status === "failed" && (
                            <Button variant="plain">Retry</Button>
                          )}
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Invoice Payment Methods */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Payment Methods
              </Text>

              <Box padding="300">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm">
                        Visa ending in 4242
                      </Text>
                      <Text as="span" variant="bodySm">
                        Expires 12/2027
                      </Text>
                    </BlockStack>
                    <Badge tone="success">Default</Badge>
                  </InlineStack>

                  <InlineStack gap="200">
                    <Button variant="secondary">Edit</Button>
                    <Button variant="secondary">Remove</Button>
                  </InlineStack>
                </BlockStack>
              </Box>

              <Button variant="plain" onClick={() => {}}>
                Add Payment Method
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Billing Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Billing Settings
              </Text>

              <Box padding="300">
                <BlockStack gap="300">
                  <Box>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm">
                        Billing Email
                      </Text>
                      <Text as="span" variant="bodySm">
                        billing@example.com
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm">
                        Billing Frequency
                      </Text>
                      <Text as="span" variant="bodySm">
                        Monthly
                      </Text>
                    </BlockStack>
                  </Box>

                  <Button variant="secondary">Update Billing Settings</Button>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ─── Error Boundary ────────────────────────────────────────

export function ErrorBoundary() {
  return (
    <Page title="Invoices">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Error Loading Invoices
              </Text>
              <Text as="p" variant="bodySm">
                We encountered an error while loading your invoice data. Please try refreshing the page.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
