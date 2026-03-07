import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Page,
  Layout,
  Card,
  Button,
  Select,
  TextField,
  Box,
  IndexTable,
  Badge,
  InlineStack,
  BlockStack,
  Text,
} from '@shopify/polaris';

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'whatsapp';
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
  createdAt: string;
  sentAt?: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  audienceSize: number;
}

export default function CampaignsIndex() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setLoading(true);
    const mockCampaigns: Campaign[] = [
      {
        id: '1',
        name: 'Spring Sale 2026',
        type: 'email',
        status: 'completed',
        createdAt: '2026-02-15T10:30:00Z',
        sentAt: '2026-03-01T08:00:00Z',
        sent: 8542,
        delivered: 8420,
        opened: 3156,
        clicked: 892,
        bounced: 122,
        audienceSize: 9200,
      },
      {
        id: '2',
        name: 'Abandoned Cart Recovery',
        type: 'email',
        status: 'active',
        createdAt: '2026-02-20T14:20:00Z',
        sent: 2150,
        delivered: 2100,
        opened: 630,
        clicked: 189,
        bounced: 50,
        audienceSize: 5400,
      },
      {
        id: '3',
        name: 'Winter Collection Launch',
        type: 'sms',
        status: 'scheduled',
        createdAt: '2026-02-25T09:15:00Z',
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        audienceSize: 3200,
      },
      {
        id: '4',
        name: 'Customer Anniversary',
        type: 'whatsapp',
        status: 'draft',
        createdAt: '2026-03-04T16:45:00Z',
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        audienceSize: 1500,
      },
    ];

    setTimeout(() => {
      setCampaigns(mockCampaigns);
      setLoading(false);
    }, 500);
  }, []);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || campaign.type === filterType;
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const resourceName = {
    singular: 'campaign',
    plural: 'campaigns',
  };

  const getStatusTone = (status: string): 'success' | 'warning' | 'critical' | 'info' => {
    switch (status) {
      case 'draft':
        return 'info';
      case 'scheduled':
        return 'warning';
      case 'active':
        return 'success';
      case 'completed':
        return 'success';
      case 'paused':
        return 'critical';
      default:
        return 'info';
    }
  };

  const rowMarkup = filteredCampaigns.map(
    ({ id, name, type, status, sent, delivered, opened, clicked, audienceSize }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        position={index}
        onClick={() => navigate(`/app/campaigns/${id}`)}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" fontWeight="semibold">
            {name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">
            {type.toUpperCase()}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={getStatusTone(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {sent.toString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {delivered.toString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {opened.toString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {clicked.toString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {audienceSize.toLocaleString()}
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Campaigns"
      primaryAction={{
        content: 'Create Campaign',
        onAction: () => navigate('/app/campaigns/new'),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" wrap>
                <TextField
                  label="Search campaigns"
                  placeholder="Search by campaign name"
                  value={searchTerm}
                  onChange={setSearchTerm}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearchTerm('')}
                />
                <Select
                  label="Type"
                  options={[
                    { label: 'All Types', value: 'all' },
                    { label: 'Email', value: 'email' },
                    { label: 'SMS', value: 'sms' },
                    { label: 'WhatsApp', value: 'whatsapp' },
                  ]}
                  value={filterType}
                  onChange={setFilterType}
                />
                <Select
                  label="Status"
                  options={[
                    { label: 'All Statuses', value: 'all' },
                    { label: 'Draft', value: 'draft' },
                    { label: 'Scheduled', value: 'scheduled' },
                    { label: 'Active', value: 'active' },
                    { label: 'Completed', value: 'completed' },
                    { label: 'Paused', value: 'paused' },
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
                <Text as="p">Loading campaigns...</Text>
              </Box>
            </Card>
          ) : filteredCampaigns.length === 0 ? (
            <Card>
              <Box padding="400">
                <Text as="p">No campaigns found matching your filters.</Text>
              </Box>
            </Card>
          ) : (
            <Card>
              <IndexTable
                resourceName={resourceName}
                itemCount={filteredCampaigns.length}
                headings={[
                  { title: 'Name' },
                  { title: 'Type' },
                  { title: 'Status' },
                  { title: 'Sent' },
                  { title: 'Delivered' },
                  { title: 'Opened' },
                  { title: 'Clicked' },
                  { title: 'Audience' },
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
