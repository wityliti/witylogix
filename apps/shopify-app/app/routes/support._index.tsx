import { useState } from 'react';
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
  Banner,
  Divider,
} from '@shopify/polaris';

interface SupportTicket {
  id: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export default function SupportIndex() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([
    {
      id: '1',
      email: 'customer1@example.com',
      subject: 'Integration Setup Help',
      message: 'Need help setting up the Shopify integration.',
      status: 'in-progress',
      priority: 'high',
      createdAt: '2026-03-01T10:00:00Z',
    },
  ]);

  const handleSubmit = () => {
    if (email && subject && message) {
      const newTicket: SupportTicket = {
        id: Date.now().toString(),
        email,
        subject,
        message,
        status: 'open',
        priority: 'medium',
        createdAt: new Date().toISOString(),
      };
      setTickets([newTicket, ...tickets]);
      setEmail('');
      setSubject('');
      setMessage('');
      setShowForm(false);
    }
  };

  const getPriorityColor = (priority: string): 'critical' | 'warning' | undefined => {
    switch (priority) {
      case 'high':
        return 'critical';
      case 'medium':
        return 'warning';
      default:
        return undefined;
    }
  };

  return (
    <Page title="Support">
      <Layout>
        <Layout.Section>
          <Banner title="Support Center" tone="info">
            <BlockStack gap="200">
              <Text as="p">
                Need help? Submit a support ticket or check the FAQs below.
              </Text>
            </BlockStack>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          {!showForm ? (
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Submit a Support Ticket
                </Text>
                <Button onClick={() => setShowForm(true)} variant="primary">
                  Create Ticket
                </Button>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  New Support Ticket
                </Text>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="your@email.com"
                  autoComplete="off"
                />
                <TextField
                  label="Subject"
                  value={subject}
                  onChange={setSubject}
                  placeholder="Brief description of issue"
                  autoComplete="off"
                />
                <TextField
                  label="Message"
                  value={message}
                  onChange={setMessage}
                  placeholder="Detailed description of your issue"
                  multiline={5}
                  autoComplete="off"
                />
                <InlineStack gap="200">
                  <Button onClick={handleSubmit} variant="primary">
                    Submit Ticket
                  </Button>
                  <Button onClick={() => setShowForm(false)} variant="secondary">
                    Cancel
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Tickets
              </Text>
              <BlockStack gap="300">
                {tickets.length === 0 ? (
                  <Text as="p">No support tickets yet.</Text>
                ) : (
                  tickets.map((ticket) => (
                    <Box key={ticket.id} padding="300">
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <BlockStack gap="100">
                            <Text as="h3" variant="headingSm">
                              {ticket.subject}
                            </Text>
                            <Text as="span" variant="bodySm">
                              {ticket.email}
                            </Text>
                          </BlockStack>
                          <InlineStack gap="100">
                            <Text as="span" variant="bodySm">
                              {ticket.status}
                            </Text>
                          </InlineStack>
                        </InlineStack>
                        <Divider />
                        <Text as="p" variant="bodySm">
                          {ticket.message}
                        </Text>
                        <Text as="span" variant="bodySm">
                          Created: {new Date(ticket.createdAt).toLocaleDateString()}
                        </Text>
                      </BlockStack>
                    </Box>
                  ))
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Frequently Asked Questions
              </Text>
              <BlockStack gap="300">
                <div>
                  <Text as="h3" variant="headingSm">
                    How do I install the app?
                  </Text>
                  <Text as="p" variant="bodySm">
                    Click the Install button and follow the OAuth flow to connect your Shopify store.
                  </Text>
                </div>
                <Divider />
                <div>
                  <Text as="h3" variant="headingSm">
                    What are the supported integrations?
                  </Text>
                  <Text as="p" variant="bodySm">
                    We support email, SMS, WhatsApp, and custom webhooks.
                  </Text>
                </div>
                <Divider />
                <div>
                  <Text as="h3" variant="headingSm">
                    How do I contact support?
                  </Text>
                  <Text as="p" variant="bodySm">
                    Submit a ticket above or email us at support@example.com
                  </Text>
                </div>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
