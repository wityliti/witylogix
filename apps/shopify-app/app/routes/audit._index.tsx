import { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  TextField,
  IndexTable,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Box,
  Divider,
  Pagination,
} from '@shopify/polaris';

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: 'create' | 'update' | 'delete' | 'send' | 'export' | 'login' | 'download';
  resource: string;
  resourceType: 'campaign' | 'template' | 'customer' | 'user' | 'system';
  details: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

const getActionTone = (action: string): 'success' | 'warning' | 'critical' | 'info' => {
  switch (action) {
    case 'create':
      return 'success';
    case 'update':
      return 'info';
    case 'delete':
      return 'critical';
    case 'send':
      return 'success';
    case 'export':
      return 'warning';
    case 'login':
      return 'info';
    case 'download':
      return 'info';
    default:
      return 'info';
  }
};

const MOCK_AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: 'audit-001',
    timestamp: '2026-03-07T09:45:30Z',
    user: 'admin@example.com',
    action: 'send',
    resource: 'Spring Sale 2026',
    resourceType: 'campaign',
    details: 'Campaign sent to 8542 recipients',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-002',
    timestamp: '2026-03-07T09:30:15Z',
    user: 'marketing@example.com',
    action: 'update',
    resource: 'Welcome Email',
    resourceType: 'template',
    details: 'Updated template subject line',
    beforeState: { subject: 'Welcome to {{storeName}}' },
    afterState: { subject: 'Welcome to {{storeName}}! Exclusive offer inside' },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-003',
    timestamp: '2026-03-07T08:50:22Z',
    user: 'support@example.com',
    action: 'export',
    resource: 'Customer List',
    resourceType: 'customer',
    details: 'Exported 250 customer records',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-004',
    timestamp: '2026-03-07T08:15:40Z',
    user: 'admin@example.com',
    action: 'create',
    resource: 'Abandoned Cart Recovery',
    resourceType: 'campaign',
    details: 'New campaign created',
    afterState: { status: 'draft', audience: 5400 },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-005',
    timestamp: '2026-03-06T16:30:55Z',
    user: 'marketing@example.com',
    action: 'update',
    resource: 'Push Notification - Flash Sale',
    resourceType: 'template',
    details: 'Updated message body',
    beforeState: { body: 'Flash sale is live!' },
    afterState: { body: 'Flash sale is live! Save 30% on selected items. Shop now!' },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-006',
    timestamp: '2026-03-06T14:20:12Z',
    user: 'admin@example.com',
    action: 'delete',
    resource: 'Old Newsletter Template',
    resourceType: 'template',
    details: 'Template permanently deleted',
    beforeState: { status: 'inactive', createdAt: '2025-06-15' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-007',
    timestamp: '2026-03-06T12:05:33Z',
    user: 'support@example.com',
    action: 'login',
    resource: 'User Session',
    resourceType: 'user',
    details: 'User logged in successfully',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-008',
    timestamp: '2026-03-06T11:45:20Z',
    user: 'marketing@example.com',
    action: 'create',
    resource: 'Review Request',
    resourceType: 'template',
    details: 'New email template created',
    afterState: { channel: 'email', status: 'active' },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-009',
    timestamp: '2026-03-06T10:30:44Z',
    user: 'admin@example.com',
    action: 'download',
    resource: 'Campaign Report',
    resourceType: 'campaign',
    details: 'Downloaded campaign analytics report',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-010',
    timestamp: '2026-03-05T15:20:18Z',
    user: 'support@example.com',
    action: 'update',
    resource: 'Customer Segment',
    resourceType: 'customer',
    details: 'Updated audience filter criteria',
    beforeState: { condition: 'spent > 100' },
    afterState: { condition: 'spent > 50' },
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-011',
    timestamp: '2026-03-05T12:15:50Z',
    user: 'marketing@example.com',
    action: 'send',
    resource: 'SMS Referral Bonus',
    resourceType: 'campaign',
    details: 'Campaign sent to 3500 customers',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-012',
    timestamp: '2026-03-05T10:05:30Z',
    user: 'admin@example.com',
    action: 'create',
    resource: 'Welcome Email',
    resourceType: 'template',
    details: 'Template created for new customer onboarding',
    afterState: { channel: 'email', status: 'active' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-013',
    timestamp: '2026-03-04T16:40:22Z',
    user: 'support@example.com',
    action: 'export',
    resource: 'Event Log',
    resourceType: 'system',
    details: 'Exported system event logs',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-014',
    timestamp: '2026-03-04T14:30:15Z',
    user: 'marketing@example.com',
    action: 'update',
    resource: 'Order Confirmation',
    resourceType: 'template',
    details: 'Updated template variables',
    beforeState: { variables: ['orderId', 'customerName'] },
    afterState: { variables: ['orderId', 'customerName', 'totalPrice'] },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-015',
    timestamp: '2026-03-04T12:20:45Z',
    user: 'admin@example.com',
    action: 'login',
    resource: 'User Session',
    resourceType: 'user',
    details: 'User logged in successfully',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-016',
    timestamp: '2026-03-03T18:50:30Z',
    user: 'support@example.com',
    action: 'delete',
    resource: 'Old Customer Data',
    resourceType: 'customer',
    details: 'Deleted records for inactive customers',
    beforeState: { count: 125 },
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-017',
    timestamp: '2026-03-03T15:35:20Z',
    user: 'marketing@example.com',
    action: 'create',
    resource: 'WhatsApp Delivery Update',
    resourceType: 'template',
    details: 'New WhatsApp template created',
    afterState: { channel: 'whatsapp', status: 'draft' },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-018',
    timestamp: '2026-03-02T11:25:40Z',
    user: 'admin@example.com',
    action: 'send',
    resource: 'Winter Collection Launch',
    resourceType: 'campaign',
    details: 'Campaign scheduled for delivery',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'audit-019',
    timestamp: '2026-03-01T09:15:55Z',
    user: 'support@example.com',
    action: 'download',
    resource: 'Template List',
    resourceType: 'template',
    details: 'Downloaded template inventory',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0',
  },
];

const ITEMS_PER_PAGE = 10;

export default function AuditIndex() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setEntries(MOCK_AUDIT_ENTRIES);
      setLoading(false);
    }, 500);
  }, []);

  const filteredEntries = entries.filter((entry) => {
    const matchesAction = filterAction === 'all' || entry.action === filterAction;
    const matchesUser = filterUser === '' || entry.user.toLowerCase().includes(filterUser.toLowerCase());
    return matchesAction && matchesUser;
  });

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const resourceName = {
    singular: 'entry',
    plural: 'entries',
  };

  const rowMarkup = paginatedEntries.map(({ id, timestamp, user, action, resource, resourceType }, index) => (
    <IndexTable.Row
      id={id}
      key={id}
      position={index}
      onClick={() =>
        setExpandedEntryId(expandedEntryId === id ? null : id)
      }
    >
      <IndexTable.Cell>
        {new Date(timestamp).toLocaleString()}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {user}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={getActionTone(action)}>
          {action.charAt(0).toUpperCase() + action.slice(1)}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {resource}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="info">
          {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const expandedEntry = entries.find((e) => e.id === expandedEntryId);

  return (
    <Page title="Activity Log">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" wrap>
                <Select
                  label="Action Type"
                  options={[
                    { label: 'All Actions', value: 'all' },
                    { label: 'Create', value: 'create' },
                    { label: 'Update', value: 'update' },
                    { label: 'Delete', value: 'delete' },
                    { label: 'Send', value: 'send' },
                    { label: 'Export', value: 'export' },
                    { label: 'Login', value: 'login' },
                    { label: 'Download', value: 'download' },
                  ]}
                  value={filterAction}
                  onChange={setFilterAction}
                />
                <TextField
                  label="Filter by User"
                  placeholder="Search user email"
                  value={filterUser}
                  onChange={setFilterUser}
                  autoComplete="off"
                />
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card>
              <Box padding="400">
                <Text as="p">Loading activity log...</Text>
              </Box>
            </Card>
          ) : paginatedEntries.length === 0 ? (
            <Card>
              <Box padding="400">
                <Text as="p">No audit entries found matching your filters.</Text>
              </Box>
            </Card>
          ) : (
            <>
              <Card>
                <IndexTable
                  resourceName={resourceName}
                  itemCount={paginatedEntries.length}
                  headings={[
                    { title: 'Timestamp' },
                    { title: 'User' },
                    { title: 'Action' },
                    { title: 'Resource' },
                    { title: 'Type' },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              </Card>

              {expandedEntry && (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">
                      Entry Details: {expandedEntry.resource}
                    </Text>
                    <Divider />
                    <InlineStack gap="400" wrap>
                      <BlockStack gap="100">
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          Timestamp:
                        </Text>
                        <Text as="p" variant="bodyMd">
                          {new Date(expandedEntry.timestamp).toLocaleString()}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="100">
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          User:
                        </Text>
                        <Text as="p" variant="bodyMd">
                          {expandedEntry.user}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="100">
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          IP Address:
                        </Text>
                        <Text as="p" variant="bodyMd">
                          {expandedEntry.ipAddress}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <Divider />
                    <Text as="p" variant="bodyMd">
                      {expandedEntry.details}
                    </Text>
                    {expandedEntry.beforeState && (
                      <>
                        <Divider />
                        <BlockStack gap="200">
                          <Text as="h4" variant="headingSm" fontWeight="semibold">
                            Before:
                          </Text>
                          <Box padding="300">
                            <Text as="p" variant="bodySm">
                              {JSON.stringify(expandedEntry.beforeState, null, 2)}
                            </Text>
                          </Box>
                        </BlockStack>
                      </>
                    )}
                    {expandedEntry.afterState && (
                      <>
                        <Divider />
                        <BlockStack gap="200">
                          <Text as="h4" variant="headingSm" fontWeight="semibold">
                            After:
                          </Text>
                          <Box padding="300">
                            <Text as="p" variant="bodySm">
                              {JSON.stringify(expandedEntry.afterState, null, 2)}
                            </Text>
                          </Box>
                        </BlockStack>
                      </>
                    )}
                  </BlockStack>
                </Card>
              )}

              <Card>
                <Box padding="300">
                  <Pagination
                    hasPrevious={currentPage > 1}
                    onPrevious={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    hasNext={currentPage < totalPages}
                    onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    label={`Page ${currentPage} of ${totalPages}`}
                  />
                </Box>
              </Card>
            </>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
