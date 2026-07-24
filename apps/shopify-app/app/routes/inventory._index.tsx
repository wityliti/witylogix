import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Box,
  BlockStack,
  InlineStack,
  Text,
  DataTable,
  Badge,
  Select,
} from "@shopify/polaris";

interface InventoryItem {
  id: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  quantity: number;
  reorderPoint: number;
  status: "in-stock" | "low-stock" | "out-of-stock";
  lastRestockDate: string;
}

export default function InventoryIndex() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    setLoading(true);
    const mockItems: InventoryItem[] = [
      {
        id: "1",
        productTitle: "Classic T-Shirt",
        variantTitle: "Blue - Size M",
        sku: "TSH-001-BLU-M",
        quantity: 245,
        reorderPoint: 50,
        status: "in-stock",
        lastRestockDate: "2026-02-28T10:00:00Z",
      },
      {
        id: "2",
        productTitle: "Classic T-Shirt",
        variantTitle: "Red - Size L",
        sku: "TSH-001-RED-L",
        quantity: 32,
        reorderPoint: 50,
        status: "low-stock",
        lastRestockDate: "2026-02-15T10:00:00Z",
      },
      {
        id: "3",
        productTitle: "Denim Jeans",
        variantTitle: "Black - Size 32",
        sku: "DNM-001-BLK-32",
        quantity: 0,
        reorderPoint: 20,
        status: "out-of-stock",
        lastRestockDate: "2026-01-30T10:00:00Z",
      },
    ];
    setTimeout(() => {
      setItems(mockItems);
      setLoading(false);
    }, 500);
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const rows = filteredItems.map((item) => [
    item.productTitle,
    item.variantTitle,
    item.sku,
    item.quantity.toString(),
    item.reorderPoint.toString(),
    item.status,
  ]);

  const getStatusColor = (
    status: string,
  ): "success" | "warning" | "critical" | undefined => {
    switch (status) {
      case "in-stock":
        return "success";
      case "low-stock":
        return "warning";
      case "out-of-stock":
        return "critical";
      default:
        return undefined;
    }
  };

  return (
    <Page
      title="Inventory"
      primaryAction={{
        content: "Adjust Stock",
        onAction: () => navigate("/app/inventory/new"),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" wrap>
                <TextField
                  label="Search inventory"
                  placeholder="Search by product name or SKU"
                  value={searchTerm}
                  onChange={setSearchTerm}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearchTerm("")}
                />
                <Select
                  label="Status"
                  options={[
                    { label: "All Statuses", value: "all" },
                    { label: "In Stock", value: "in-stock" },
                    { label: "Low Stock", value: "low-stock" },
                    { label: "Out of Stock", value: "out-of-stock" },
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                />
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card>
              <Box padding="400">
                <Text as="p">Loading inventory...</Text>
              </Box>
            </Card>
          ) : filteredItems.length === 0 ? (
            <Card>
              <Box padding="400">
                <Text as="p">No items found matching your search.</Text>
              </Box>
            </Card>
          ) : (
            <Card>
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "numeric",
                  "numeric",
                  "text",
                ]}
                headings={[
                  "Product",
                  "Variant",
                  "SKU",
                  "Quantity",
                  "Reorder Point",
                  "Status",
                ]}
                rows={rows.map((row) => [
                  ...row.slice(0, -1),
                  <Badge key={row[5]} tone={getStatusColor(row[5])}>
                    {row[5]}
                  </Badge>,
                ])}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
