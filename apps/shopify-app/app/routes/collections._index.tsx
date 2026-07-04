/**
 * Collections Management Page
 *
 * Features:
 *   - IndexTable with columns: Title, Type, Products, Status, Updated
 *   - Create collection modal (TextField for title, Select for type)
 *   - Type badges: manual=info, auto=attention
 *   - Product count display
 *   - Search/filter by type and status
 *   - Mock data only
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
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
  EmptyState,
} from "@shopify/polaris";
// @ts-ignore - polaris-icons types
import { PlusIcon } from "@shopify/polaris-icons";

// ─── Types ─────────────────────────────────────────────────

interface Collection {
  id: string;
  title: string;
  type: "manual" | "auto";
  productCount: number;
  status: "active" | "inactive" | "archived";
  description: string;
  updatedAt: string;
  createdAt: string;
}

interface CollectionsPageData {
  collections: Collection[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  // Mock data only
  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type") ?? "";
  const statusFilter = url.searchParams.get("status") ?? "";

  const allCollections: Collection[] = [
    {
      id: "coll-001",
      title: "Summer Collection",
      type: "manual",
      productCount: 47,
      status: "active",
      description: "Handpicked items for the summer season",
      updatedAt: "2026-03-06T14:30:00Z",
      createdAt: "2026-02-15T10:00:00Z",
    },
    {
      id: "coll-002",
      title: "Best Sellers",
      type: "auto",
      productCount: 156,
      status: "active",
      description: "Top performing products",
      updatedAt: "2026-03-05T16:45:00Z",
      createdAt: "2026-01-10T09:00:00Z",
    },
    {
      id: "coll-003",
      title: "New Arrivals",
      type: "auto",
      productCount: 89,
      status: "active",
      description: "Products added in the last 30 days",
      updatedAt: "2026-03-04T11:20:00Z",
      createdAt: "2025-12-01T12:00:00Z",
    },
    {
      id: "coll-004",
      title: "Clearance Sale",
      type: "manual",
      productCount: 23,
      status: "active",
      description: "Discounted items on clearance",
      updatedAt: "2026-03-03T09:15:00Z",
      createdAt: "2026-02-28T14:30:00Z",
    },
    {
      id: "coll-005",
      title: "Featured Items",
      type: "manual",
      productCount: 12,
      status: "active",
      description: "Curated featured products",
      updatedAt: "2026-02-28T15:00:00Z",
      createdAt: "2026-02-01T08:00:00Z",
    },
    {
      id: "coll-006",
      title: "Winter Collection",
      type: "manual",
      productCount: 34,
      status: "inactive",
      description: "Winter season items (currently inactive)",
      updatedAt: "2026-02-20T10:30:00Z",
      createdAt: "2025-10-15T12:00:00Z",
    },
    {
      id: "coll-007",
      title: "Out of Stock Items",
      type: "auto",
      productCount: 67,
      status: "inactive",
      description: "Automatically shows products with low inventory",
      updatedAt: "2026-02-15T13:45:00Z",
      createdAt: "2025-09-20T09:00:00Z",
    },
  ];

  // Apply filters
  let filtered = allCollections;
  if (typeFilter) {
    filtered = filtered.filter((c) => c.type === typeFilter);
  }
  if (statusFilter) {
    filtered = filtered.filter((c) => c.status === statusFilter);
  }

  const meta = {
    total: filtered.length,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  return { collections: filtered, meta };
}

// ─── Component ─────────────────────────────────────────────

export default function CollectionsIndex() {
  const { collections, meta } = useLoaderData<CollectionsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("manual");
  const [description, setDescription] = useState("");

  const currentTypeFilter = searchParams.get("type") ?? "";
  const currentStatusFilter = searchParams.get("status") ?? "";

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  }

  const handleCreateCollection = () => {
    if (title && type) {
      // Mock submit
      setShowCreateModal(false);
      setTitle("");
      setType("manual");
      setDescription("");
    }
  };

  const getTypeTone = (type: string) => {
    return type === "manual" ? ("info" as const) : ("attention" as const);
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "inactive":
        return "warning" as const;
      case "archived":
        return "new" as const;
      default:
        return "info" as const;
    }
  };

  return (
    <Page
      title="Collections"
      primaryAction={{
        content: "Create Collection",
        onAction: () => setShowCreateModal(true),
        icon: PlusIcon,
      }}
    >
      <Layout>
        {/* Filters */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodySm">
                Filter collections
              </Text>
              <InlineStack gap="200">
                <Select
                  label="Type"
                  options={[
                    { label: "All Types", value: "" },
                    { label: "Manual", value: "manual" },
                    { label: "Automatic", value: "auto" },
                  ]}
                  value={currentTypeFilter}
                  onChange={(value) => updateFilter("type", value)}
                />

                <Select
                  label="Status"
                  options={[
                    { label: "All Status", value: "" },
                    { label: "Active", value: "active" },
                    { label: "Inactive", value: "inactive" },
                    { label: "Archived", value: "archived" },
                  ]}
                  value={currentStatusFilter}
                  onChange={(value) => updateFilter("status", value)}
                />

                {(currentTypeFilter || currentStatusFilter) && (
                  <Button
                    variant="secondary"
                    onClick={() => setSearchParams("")}
                  >
                    Clear Filters
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Collections List */}
        <Layout.Section>
          {collections.length === 0 ? (
            <Card>
              <EmptyState
                heading="No collections found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create a new collection to get started.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Collections ({meta.total})
                  </Text>
                </InlineStack>

                <div style={{ overflowX: "auto" }}>
                  <IndexTable
                    headings={[
                      { title: "Title" },
                      { title: "Type" },
                      { title: "Products" },
                      { title: "Status" },
                      { title: "Updated" },
                      { title: "Action" },
                    ]}
                    itemCount={collections.length}
                    selectable={false}
                    resourceName={{
                      singular: "collection",
                      plural: "collections",
                    }}
                  >
                    {collections.map((collection, idx) => (
                      <IndexTable.Row
                        key={collection.id}
                        id={collection.id}
                        position={idx}
                      >
                        <IndexTable.Cell>
                          <Text as="p" variant="bodySm" fontWeight="bold">
                            {collection.title}
                          </Text>
                          <Text as="span" variant="bodySm">
                            {collection.description}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={getTypeTone(collection.type)}>
                            {collection.type === "manual"
                              ? "Manual"
                              : "Automatic"}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="p" variant="bodySm">
                            {collection.productCount}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={getStatusTone(collection.status)}>
                            {collection.status.charAt(0).toUpperCase() +
                              collection.status.slice(1)}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="p" variant="bodySm">
                            {new Date(
                              collection.updatedAt,
                            ).toLocaleDateString()}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Link to={`/collections/${collection.id}`}>
                            <Button variant="plain">Edit</Button>
                          </Link>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                </div>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        {/* Collection Stats */}
        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Total Collections
                </Text>
                <Text as="p" variant="headingMd">
                  {meta.total}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Active Collections
                </Text>
                <Text as="p" variant="headingMd">
                  {collections.filter((c) => c.status === "active").length}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Manual Collections
                </Text>
                <Text as="p" variant="headingMd">
                  {collections.filter((c) => c.type === "manual").length}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Total Products
                </Text>
                <Text as="p" variant="headingMd">
                  {collections.reduce((sum, c) => sum + c.productCount, 0)}
                </Text>
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
      </Layout>

      {/* Create Collection Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Collection"
        primaryAction={{
          content: "Create",
          onAction: handleCreateCollection,
          disabled: !title || !type,
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
              label="Title"
              value={title}
              onChange={setTitle}
              placeholder="Collection name"
              autoComplete="off"
            />

            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Optional description"
              multiline={3}
              autoComplete="off"
            />

            <Select
              label="Type"
              options={[
                { label: "Manual", value: "manual" },
                { label: "Automatic", value: "auto" },
              ]}
              value={type}
              onChange={setType}
              helpText="Manual: you add products manually. Automatic: products match conditions you set."
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
    <Page title="Collections">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Error Loading Collections
              </Text>
              <Text as="p" variant="bodySm">
                We encountered an error while loading your collections. Please
                try refreshing the page.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
