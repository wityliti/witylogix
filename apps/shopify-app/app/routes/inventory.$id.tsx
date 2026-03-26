import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
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
} from '@shopify/polaris';

interface InventoryItem {
  id: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  barcode: string;
  quantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  supplier: string;
  lastRestockDate: string;
  location: string;
}

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    setLoading(true);
    const mockInventory: InventoryItem = {
      id: id || '1',
      productTitle: 'Classic T-Shirt',
      variantTitle: 'Blue - Size M',
      sku: 'TSH-001-BLU-M',
      barcode: '123456789012',
      quantity: 245,
      reorderPoint: 50,
      reorderQuantity: 100,
      supplier: 'Supplier ABC',
      lastRestockDate: '2026-02-28T10:00:00Z',
      location: 'Warehouse A - Rack 3',
    };
    setTimeout(() => {
      setInventory(mockInventory);
      setLoading(false);
    }, 400);
  }, [id]);

  if (loading || !inventory) {
    return (
      <Page title="Loading...">
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text as="p">Loading inventory details...</Text>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const handleAdjustment = () => {
    if (adjustmentQuantity && adjustmentReason) {
      console.log('Adjustment:', {
        type: adjustmentType,
        quantity: adjustmentQuantity,
        reason: adjustmentReason,
      });
      setAdjustmentQuantity('');
      setAdjustmentReason('');
      setAdjustmentType('increase');
    }
  };

  return (
    <Page title={inventory.productTitle} subtitle={inventory.variantTitle} backAction={{ onAction: () => navigate('/app/inventory') }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Current Stock Level
              </Text>
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm">SKU:</Text>
                  <Text as="p" variant="headingMd">{inventory.sku}</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm">Quantity on Hand:</Text>
                  <Text as="p" variant="headingMd">{inventory.quantity}</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm">Location:</Text>
                  <Text as="p" variant="bodyMd">{inventory.location}</Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Stock Level Adjustment
              </Text>
              <Box padding="400">
                <BlockStack gap="400">
                  <div>
                    <Button
                      variant={adjustmentType === 'increase' ? 'primary' : 'secondary'}
                      onClick={() => setAdjustmentType('increase')}
                    >
                      Increase Stock
                    </Button>
                    <Button
                      variant={adjustmentType === 'decrease' ? 'primary' : 'secondary'}
                      onClick={() => setAdjustmentType('decrease')}
                    >
                      Decrease Stock
                    </Button>
                  </div>
                  <TextField
                    label="Quantity"
                    type="number"
                    value={adjustmentQuantity}
                    onChange={setAdjustmentQuantity}
                    placeholder="Enter quantity"
                    autoComplete="off"
                  />
                  <TextField
                    label="Reason"
                    value={adjustmentReason}
                    onChange={setAdjustmentReason}
                    placeholder="e.g., Restock, Damage, Count Adjustment"
                    autoComplete="off"
                  />
                  <Button onClick={handleAdjustment} variant="primary">
                    Apply Adjustment
                  </Button>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Reorder Settings
              </Text>
              <Box padding="400">
                <BlockStack gap="300">
                  <TextField
                    label="Reorder Point"
                    type="number"
                    value={inventory.reorderPoint.toString()}
                    onChange={() => {}}
                    helpText="Alert when stock falls below this level"
                    autoComplete="off"
                  />
                  <TextField
                    label="Reorder Quantity"
                    type="number"
                    value={inventory.reorderQuantity.toString()}
                    onChange={() => {}}
                    helpText="Quantity to order when reorder point is reached"
                    autoComplete="off"
                  />
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Transfer to Another Location
              </Text>
              <Box padding="400">
                <BlockStack gap="300">
                  <TextField
                    label="Quantity to Transfer"
                    type="number"
                    value={adjustmentQuantity}
                    onChange={setAdjustmentQuantity}
                    placeholder="Enter quantity"
                    autoComplete="off"
                  />
                  <TextField
                    label="Destination Location"
                    value={adjustmentReason}
                    onChange={setAdjustmentReason}
                    placeholder="Select or enter location"
                    autoComplete="off"
                  />
                  <Button onClick={handleAdjustment} variant="primary">
                    Transfer Inventory
                  </Button>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Movement History
              </Text>
              <DataTable
                columnContentTypes={['text', 'numeric', 'text', 'text']}
                headings={['Type', 'Quantity', 'Reason', 'Date']}
                rows={[
                  ['Restock', '100', 'Regular reorder', '2026-02-28'],
                  ['Adjustment', '-5', 'Damaged items', '2026-02-25'],
                  ['Transfer', '25', 'Location A to B', '2026-02-20'],
                ]}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
