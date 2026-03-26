import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Page,
  Layout,
  Card,
  Button,
  Select,
  TextField,
  IndexTable,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Box,
} from '@shopify/polaris';

interface Template {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  status: 'active' | 'inactive' | 'draft';
  subject?: string;
  body: string;
  lastUpdated: string;
  createdAt: string;
  updatedBy: string;
}

const getChannelColor = (channel: string): 'info' | 'success' | 'warning' | undefined => {
  switch (channel) {
    case 'email':
      return 'info';
    case 'sms':
      return 'success';
    case 'whatsapp':
      return 'success';
    case 'push':
      return 'warning';
    default:
      return undefined;
  }
};

const getStatusTone = (status: string): 'success' | 'warning' | 'critical' | 'info' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'draft':
      return 'info';
    case 'inactive':
      return 'critical';
    default:
      return 'info';
  }
};

const MOCK_TEMPLATES: Template[] = [
  {
    id: '1',
    name: 'Welcome Email',
    channel: 'email',
    status: 'active',
    subject: 'Welcome to {{storeName}}!',
    body: 'Thank you for signing up. We are excited to have you as a member.',
    lastUpdated: '2026-03-05T14:20:00Z',
    createdAt: '2026-01-10T09:00:00Z',
    updatedBy: 'admin@witylogix.com',
  },
  {
    id: '2',
    name: 'Order Confirmation',
    channel: 'email',
    status: 'active',
    subject: 'Order {{orderId}} Confirmed',
    body: 'Your order has been confirmed. Thank you for your purchase!',
    lastUpdated: '2026-03-03T10:15:00Z',
    createdAt: '2026-01-15T11:30:00Z',
    updatedBy: 'admin@witylogix.com',
  },
  {
    id: '3',
    name: 'SMS Order Status',
    channel: 'sms',
    status: 'active',
    body: 'Hi {{firstName}}! Your order {{orderId}} is on the way. Track: {{trackingUrl}}',
    lastUpdated: '2026-03-04T09:00:00Z',
    createdAt: '2026-02-01T08:00:00Z',
    updatedBy: 'support@witylogix.com',
  },
  {
    id: '4',
    name: 'Abandoned Cart Reminder',
    channel: 'email',
    status: 'active',
    subject: 'Did you forget something?',
    body: 'You left some items in your cart. Complete your purchase now!',
    lastUpdated: '2026-02-28T15:45:00Z',
    createdAt: '2026-02-10T10:00:00Z',
    updatedBy: 'marketing@witylogix.com',
  },
  {
    id: '5',
    name: 'WhatsApp Delivery Update',
    channel: 'whatsapp',
    status: 'draft',
    body: 'Your package is being delivered. Driver is {{minutesAway}} minutes away.',
    lastUpdated: '2026-03-06T12:30:00Z',
    createdAt: '2026-03-01T13:00:00Z',
    updatedBy: 'admin@witylogix.com',
  },
  {
    id: '6',
    name: 'Push Notification - Flash Sale',
    channel: 'push',
    status: 'active',
    body: 'Flash sale is live! Save 30% on selected items. Shop now!',
    lastUpdated: '2026-03-02T08:20:00Z',
    createdAt: '2026-02-20T14:00:00Z',
    updatedBy: 'marketing@witylogix.com',
  },
  {
    id: '7',
    name: 'Review Request',
    channel: 'email',
    status: 'inactive',
    subject: 'How was your purchase?',
    body: 'We would love to hear your feedback on your recent purchase.',
    lastUpdated: '2026-02-15T11:00:00Z',
    createdAt: '2026-01-30T09:15:00Z',
    updatedBy: 'admin@witylogix.com',
  },
  {
    id: '8',
    name: 'SMS Referral Bonus',
    channel: 'sms',
    status: 'active',
    body: 'You earned {{bonusAmount}} referral credit! Share your code: {{referralCode}}',
    lastUpdated: '2026-03-01T16:40:00Z',
    createdAt: '2026-02-12T10:30:00Z',
    updatedBy: 'support@witylogix.com',
  },
];

export default function TemplatesIndex() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setTemplates(MOCK_TEMPLATES);
      setLoading(false);
    }, 500);
  }, []);

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel = filterChannel === 'all' || template.channel === filterChannel;
    return matchesSearch && matchesChannel;
  });

  const resourceName = {
    singular: 'template',
    plural: 'templates',
  };

  const rowMarkup = filteredTemplates.map(
    ({ id, name, channel, status, lastUpdated }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        position={index}
        onClick={() => navigate(`/app/templates/${id}`)}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" fontWeight="semibold">
            {name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={getChannelColor(channel)}>
            {channel.charAt(0).toUpperCase() + channel.slice(1)}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={getStatusTone(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(lastUpdated).toLocaleDateString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            variant="plain"
            onClick={() => navigate(`/app/templates/${id}`)}
          >
            Edit
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Message Templates"
      primaryAction={{
        content: 'Create Template',
        onAction: () => navigate('/app/templates/new'),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" wrap>
                <TextField
                  label="Search templates"
                  placeholder="Search by template name"
                  value={searchTerm}
                  onChange={setSearchTerm}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearchTerm('')}
                />
                <Select
                  label="Channel"
                  options={[
                    { label: 'All Channels', value: 'all' },
                    { label: 'Email', value: 'email' },
                    { label: 'SMS', value: 'sms' },
                    { label: 'WhatsApp', value: 'whatsapp' },
                    { label: 'Push', value: 'push' },
                  ]}
                  value={filterChannel}
                  onChange={setFilterChannel}
                />
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card>
              <Box padding="400">
                <Text as="p">Loading templates...</Text>
              </Box>
            </Card>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    No templates found matching your filters.
                  </Text>
                  <Button onClick={() => navigate('/app/templates/new')}>
                    Create your first template
                  </Button>
                </BlockStack>
              </Box>
            </Card>
          ) : (
            <Card>
              <IndexTable
                resourceName={resourceName}
                itemCount={filteredTemplates.length}
                headings={[
                  { title: 'Name' },
                  { title: 'Channel' },
                  { title: 'Status' },
                  { title: 'Last Updated' },
                  { title: 'Actions' },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
