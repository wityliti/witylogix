import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Select,
  Checkbox,
  Box,
  Divider,
  Text,
  InlineStack,
  BlockStack,
  DataTable,
} from '@shopify/polaris';

interface TemplateVariable {
  id: string;
  name: string;
  defaultValue: string;
  description: string;
}

interface TemplateDetail {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  status: 'active' | 'inactive' | 'draft';
  subject?: string;
  body: string;
  variables: TemplateVariable[];
  createdAt: string;
  lastUpdated: string;
  updatedBy: string;
}

const MOCK_TEMPLATE_DETAIL: TemplateDetail = {
  id: '1',
  name: 'Welcome Email',
  channel: 'email',
  status: 'active',
  subject: 'Welcome to {{storeName}}!',
  body: 'Hello {{firstName}},\n\nThank you for signing up. We are excited to have you as a member of {{storeName}}.\n\nStart exploring our products and enjoy exclusive member benefits!\n\nBest regards,\nThe {{storeName}} Team',
  variables: [
    {
      id: 'v1',
      name: 'firstName',
      defaultValue: 'Customer',
      description: 'Customer first name',
    },
    {
      id: 'v2',
      name: 'storeName',
      defaultValue: 'Our Store',
      description: 'Store name',
    },
  ],
  createdAt: '2026-01-10T09:00:00Z',
  lastUpdated: '2026-03-05T14:20:00Z',
  updatedBy: 'admin@witylogix.com',
};

export default function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('email');
  const [status, setStatus] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarDefault, setNewVarDefault] = useState('');

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const mockTemplate = {
        ...MOCK_TEMPLATE_DETAIL,
        id: id || '1',
      };
      setTemplate(mockTemplate);
      setName(mockTemplate.name);
      setChannel(mockTemplate.channel);
      setStatus(mockTemplate.status === 'active');
      setSubject(mockTemplate.subject || '');
      setBody(mockTemplate.body);
      setVariables(mockTemplate.variables);
      setLoading(false);
    }, 500);
  }, [id]);

  const handleAddVariable = () => {
    if (newVarName.trim()) {
      const newVar: TemplateVariable = {
        id: `v${Date.now()}`,
        name: newVarName,
        defaultValue: newVarDefault,
        description: '',
      };
      setVariables([...variables, newVar]);
      setNewVarName('');
      setNewVarDefault('');
    }
  };

  const handleRemoveVariable = (varId: string) => {
    setVariables(variables.filter((v) => v.id !== varId));
  };

  const handleSave = () => {
    // Mock save - in real app, would call API
    console.log({
      name,
      channel,
      status: status ? 'active' : 'inactive',
      subject,
      body,
      variables,
    });
    navigate('/app/templates');
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this template?')) {
      navigate('/app/templates');
    }
  };

  if (loading || !template) {
    return (
      <Page title="Loading...">
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text as="p">Loading template...</Text>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const variableRows = variables.map((variable) => [
    variable.name,
    variable.defaultValue,
    variable.description,
  ]);

  return (
    <Page
      title={name || 'New Template'}
      backAction={{ onAction: () => navigate('/app/templates') }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Template Information
              </Text>
              <Divider />
              <TextField
                label="Template Name"
                placeholder="e.g., Welcome Email"
                value={name}
                onChange={setName}
                autoComplete="off"
              />
              <Select
                label="Channel"
                options={[
                  { label: 'Email', value: 'email' },
                  { label: 'SMS', value: 'sms' },
                  { label: 'WhatsApp', value: 'whatsapp' },
                  { label: 'Push Notification', value: 'push' },
                ]}
                value={channel}
                onChange={setChannel}
              />
              <Checkbox
                label="Active"
                checked={status}
                onChange={setStatus}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Message Content
              </Text>
              <Divider />
              {channel === 'email' && (
                <TextField
                  label="Subject Line"
                  placeholder="e.g., Welcome to {{storeName}}!"
                  value={subject}
                  onChange={setSubject}
                  autoComplete="off"
                  helpText="You can use variables like {{firstName}} or {{storeName}}"
                />
              )}
              <TextField
                label="Message Body"
                placeholder="Enter your message content..."
                value={body}
                onChange={setBody}
                autoComplete="off"
                multiline={4}
                helpText="Use variables like {{firstName}}, {{storeName}}, etc. to personalize"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Variables
              </Text>
              <Divider />
              {variables.length > 0 && (
                <>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text']}
                    headings={['Variable Name', 'Default Value', 'Description']}
                    rows={variableRows}
                  />
                  <Divider />
                </>
              )}
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Add New Variable
                </Text>
                <InlineStack gap="200" wrap>
                  <TextField
                    label="Variable Name"
                    placeholder="e.g., firstName"
                    value={newVarName}
                    onChange={setNewVarName}
                    autoComplete="off"
                  />
                  <TextField
                    label="Default Value"
                    placeholder="e.g., Customer"
                    value={newVarDefault}
                    onChange={setNewVarDefault}
                    autoComplete="off"
                  />
                  <Button
                    onClick={handleAddVariable}
                    disabled={!newVarName.trim()}
                  >
                    Add Variable
                  </Button>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Preview
              </Text>
              <Divider />
              {channel === 'email' && subject && (
                <Box padding="300">
                  <BlockStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Subject:
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {subject}
                    </Text>
                  </BlockStack>
                </Box>
              )}
              <Box padding="300">
                <BlockStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    Message:
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {body || 'No message content yet'}
                  </Text>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="300" blockAlign="center">
            <Button variant="primary" onClick={handleSave}>
              Save Template
            </Button>
            <Button variant="secondary" onClick={() => navigate('/app/templates')}>
              Cancel
            </Button>
            <Button variant="tertiary" tone="critical" onClick={handleDelete}>
              Delete
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
