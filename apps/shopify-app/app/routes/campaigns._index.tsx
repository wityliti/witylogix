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
  DataTable,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Icon,
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

const getStatusColor = (status: string): 'critical' | 'success' | 'warning' | undefined => {
  switch (status) {
    case 'draft':
      return undefined;
    case 'scheduled':
      return 'warning';
    case 'active':
      return 'success';
    case 'completed':
      return undefined;
    case 'paused':
      return 'critical';
    default:
      return undefined;
  }
};

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

  const rows = filteredCampaigns.map((campaign) => [
    campaign.name,
    campaign.type.toUpperCase(),
    campaign.status,
    campaign.sent.toString(),
    campaign.delivered.toString(),
    campaign.opened.toString(),
    campaign.clicked.toString(),
    `${campaign.audienceSize.toLocaleString()}`,
  ]);

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
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric']}
                headings={['Name', 'Type', 'Status', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Audience']}
                rows={rows}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
