import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Box,
  Divider,
  Text,
  InlineStack,
  BlockStack,
  Badge,
  Tabs,
} from '@shopify/polaris';

interface CampaignDetail {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'whatsapp';
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
  createdAt: string;
  sentAt?: string;
  scheduledAt?: string;
  subject?: string;
  previewText?: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  audienceSize: number;
  audienceSegments: string[];
  contentPreview: string;
}

interface AudienceBreakdown {
  segment: string;
  count: number;
  percentage: number;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    setLoading(true);
    const mockCampaign: CampaignDetail = {
      id: id || '1',
      name: 'Spring Sale 2026',
      type: 'email',
      status: 'completed',
      createdAt: '2026-02-15T10:30:00Z',
      sentAt: '2026-03-01T08:00:00Z',
      subject: 'Spring Sale 2026 - Up to 50% Off!',
      previewText: 'Limited time offer on our best-selling products',
      sent: 8542,
      delivered: 8420,
      opened: 3156,
      clicked: 892,
      bounced: 122,
      unsubscribed: 45,
      audienceSize: 9200,
      audienceSegments: ['Active Customers', 'Cart Abandoners', 'VIP Members'],
      contentPreview: 'This is a preview of the email content...',
    };
    setTimeout(() => {
      setCampaign(mockCampaign);
      setLoading(false);
    }, 600);
  }, [id]);

  const handleEdit = () => {
    navigate(`/app/campaigns/${id}/edit`);
  };

  const handleDuplicate = () => {
    navigate(`/app/campaigns/new?duplicate=${id}`);
  };

  if (loading || !campaign) {
    return (
      <Page title="Loading...">
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text as="p">Loading campaign details...</Text>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const deliveryRate = ((campaign.delivered / campaign.sent) * 100).toFixed(1);
  const openRate = ((campaign.opened / campaign.sent) * 100).toFixed(1);
  const clickRate = ((campaign.clicked / campaign.sent) * 100).toFixed(1);
  const bounceRate = ((campaign.bounced / campaign.sent) * 100).toFixed(1);
  const unsubscribeRate = ((campaign.unsubscribed / campaign.sent) * 100).toFixed(1);

  const audienceBreakdown: AudienceBreakdown[] = [
    {
      segment: 'Active Customers',
      count: 4200,
      percentage: 45.65,
    },
    {
      segment: 'Cart Abandoners',
      count: 3100,
      percentage: 33.70,
    },
    {
      segment: 'VIP Members',
      count: 1900,
      percentage: 20.65,
    },
  ];

  return (
    <Page title={campaign.name} backAction={{ onAction: () => navigate('/app/campaigns') }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">
                    {campaign.name}
                  </Text>
                  <Badge tone={campaign.status === 'completed' ? 'success' : undefined}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </Badge>
                </BlockStack>
                <InlineStack gap="200">
                  <Button onClick={handleEdit}>Edit</Button>
                  <Button onClick={handleDuplicate} variant="secondary">
                    Duplicate
                  </Button>
                </InlineStack>
              </InlineStack>
              <Divider />
              <div>
                <Text as="h3" variant="headingMd">
                  Campaign Details
                </Text>
                <InlineStack gap="400">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm">
                      <strong>Type:</strong> {campaign.type.toUpperCase()}
                    </Text>
                    <Text as="span" variant="bodySm">
                      <strong>Created:</strong> {new Date(campaign.createdAt).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm">
                      <strong>Sent:</strong> {campaign.sentAt ? new Date(campaign.sentAt).toLocaleDateString() : 'Not sent yet'}
                    </Text>
                    <Text as="span" variant="bodySm">
                      <strong>Audience Size:</strong> {campaign.audienceSize.toLocaleString()}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Performance Metrics
              </Text>
              <DataTable
                columnContentTypes={['numeric', 'numeric', 'numeric']}
                headings={['Metric', 'Count', 'Rate']}
                rows={[
                  ['Delivered', campaign.delivered.toString(), `${deliveryRate}%`],
                  ['Opened', campaign.opened.toString(), `${openRate}%`],
                  ['Clicked', campaign.clicked.toString(), `${clickRate}%`],
                  ['Bounced', campaign.bounced.toString(), `${bounceRate}%`],
                  ['Unsubscribed', campaign.unsubscribed.toString(), `${unsubscribeRate}%`],
                ]}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Tabs
            tabs={[
              {
                id: 'audience',
                content: 'Audience Breakdown',
              },
              {
                id: 'preview',
                content: 'Content Preview',
              },
            ]}
            selected={selectedTab}
            onSelect={setSelectedTab}
          >
            {selectedTab === 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Audience Breakdown
                  </Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric']}
                    headings={['Segment', 'Count', 'Percentage']}
                    rows={audienceBreakdown.map((item) => [
                      item.segment,
                      item.count.toString(),
                      `${item.percentage}%`,
                    ])}
                  />
                </BlockStack>
              </Card>
            )}
            {selectedTab === 1 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Content Preview
                  </Text>
                  <Box padding="400">
                    <Text as="p" variant="bodyMd">
                      {campaign.contentPreview}
                    </Text>
                  </Box>
                </BlockStack>
              </Card>
            )}
          </Tabs>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
