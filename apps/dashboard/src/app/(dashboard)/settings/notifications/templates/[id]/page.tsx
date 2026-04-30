'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Save,
  X,
  Send,
  History,
  Copy,
  RefreshCw,
  Eye,
  Code,
} from 'lucide-react';

type Channel = 'email' | 'sms' | 'whatsapp' | 'push';

interface TemplateVersion {
  id: string;
  timestamp: Date;
  author: string;
  changes: string;
}

interface TemplateContent {
  email: {
    subject: string;
    html: string;
    text: string;
  };
  sms: {
    text: string;
  };
  whatsapp: {
    templateId: string;
    headerType: 'text' | 'image' | 'video' | 'document';
    headerText?: string;
    body: string;
    footer?: string;
    buttons: Array<{
      type: 'quick_reply' | 'url' | 'phone';
      text: string;
      value: string;
    }>;
  };
  push: {
    title: string;
    body: string;
    actions: Array<{
      action: string;
      title: string;
      icon?: string;
    }>;
  };
}

const VARIABLES = [
  { name: "customer_name", label: "Customer Name" },
  { name: "order_id", label: "Order ID" },
  { name: "delivery_date", label: "Delivery Date" },
  { name: "time_window", label: "Time Window" },
  { name: "tracking_url", label: "Tracking URL" },
  { name: "driver_name", label: "Driver Name" },
  { name: "delivery_address", label: "Delivery Address" },
];

const SAMPLE_DATA = {
  customer_name: "John Doe",
  order_id: "ORD-123456",
  delivery_date: "March 15, 2026",
  time_window: "9:00 AM - 5:00 PM",
  tracking_url: "https://track.example.com/ORD-123456",
  driver_name: "Mike Johnson",
  delivery_address: "123 Main St, New York, NY 10001",
};

const INITIAL_TEMPLATE: TemplateContent = {
  email: {
    subject: "Your Delivery - {{order_id}}",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2>Delivery Update</h2>
  <p>Hi {{customer_name}},</p>
  <p>Your order {{order_id}} will be delivered on {{delivery_date}} between {{time_window}}.</p>
  <p><a href="{{tracking_url}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Your Order</a></p>
  <p>Thank you!</p>
</div>`,
    text: "Hi {{customer_name}},\\n\\nYour order {{order_id}} will be delivered on {{delivery_date}} between {{time_window}}.\\n\\nTrack here: {{tracking_url}}\\n\\nThank you!",
  },
  sms: {
    text: "Hi {{customer_name}}, your order {{order_id}} will arrive on {{delivery_date}} {{time_window}}. Track: {{tracking_url}}",
  },
  whatsapp: {
    templateId: "delivery_update",
    headerType: "text",
    headerText: "{{order_id}}",
    body: "Hi {{customer_name}},\\n\\nYour order is arriving on {{delivery_date}} between {{time_window}}.\\n\\nDriver: {{driver_name}}",
    footer: "Thank you for your order!",
    buttons: [
      {
        type: "url",
        text: "Track Order",
        value: "{{tracking_url}}",
      },
    ],
  },
  push: {
    title: "Delivery Coming",
    body: "Your order {{order_id}} arrives {{delivery_date}}",
    actions: [
      {
        action: "track",
        title: "Track",
      },
    ],
  },
};

const VERSION_HISTORY: TemplateVersion[] = [
  {
    id: "v1",
    timestamp: new Date("2026-03-10"),
    author: "John Smith",
    changes: "Updated email template",
  },
  {
    id: "v2",
    timestamp: new Date("2026-03-08"),
    author: "Jane Doe",
    changes: "Added WhatsApp template",
  },
  {
    id: "v3",
    timestamp: new Date("2026-03-01"),
    author: "System",
    changes: "Created template",
  },
];

const renderPreview = (text: string) => {
  return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    return (
      SAMPLE_DATA[variable as keyof typeof SAMPLE_DATA] || match
    );
  });
};

export default function TemplateEditorPage() {
  const router = useRouter();
  const [content, setContent] = useState<TemplateContent>(INITIAL_TEMPLATE);
  const [activeChannel, setActiveChannel] = useState<Channel>("email");
  const [isSaving, setIsSaving] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTestSend, setShowTestSend] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("/settings/notifications/templates");
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variableName: string) => {
    const variable = `{{${variableName}}}`;
    if (activeChannel === "email") {
      setContent((prev) => ({
        ...prev,
        email: {
          ...prev.email,
          text: prev.email.text + variable,
        },
      }));
    } else if (activeChannel === "sms") {
      setContent((prev) => ({
        ...prev,
        sms: {
          ...prev.sms,
          text: prev.sms.text + variable,
        },
      }));
    } else if (activeChannel === "push") {
      setContent((prev) => ({
        ...prev,
        push: {
          ...prev.push,
          body: prev.push.body + variable,
        },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Edit Notification Template"
        subtitle="Customize template content for different channels"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor */}
          <div className="lg:col-span-2">
            <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as Channel)}>
              <Card className="border border-[#1e1e2e] bg-[#12121a]">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Template Editor</CardTitle>
                      <CardDescription>
                        Edit template content for each channel
                      </CardDescription>
                    </div>
                    <TabsList className="grid w-32 grid-cols-2">
                      <TabsTrigger value="email">Email</TabsTrigger>
                      <TabsTrigger value="sms">SMS</TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>

                <TabsContent value="email" className="m-0">
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-white block mb-2">
                        Subject
                      </label>
                      <Input
                        value={content.email.subject}
                        onChange={(e) =>
                          setContent((prev) => ({
                            ...prev,
                            email: {
                              ...prev.email,
                              subject: e.target.value,
                            },
                          }))
                        }
                        placeholder="Email subject"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-white block mb-2">
                        HTML Content
                      </label>
                      <textarea
                        value={content.email.html}
                        onChange={(e) =>
                          setContent((prev) => ({
                            ...prev,
                            email: {
                              ...prev.email,
                              html: e.target.value,
                            },
                          }))
                        }
                        placeholder="HTML content"
                        className="w-full h-64 px-3 py-2 bg-[#1a1a2e] text-white border border-[#1e1e2e] rounded-md text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-white block mb-2">
                        Plain Text Content
                      </label>
                      <textarea
                        value={content.email.text}
                        onChange={(e) =>
                          setContent((prev) => ({
                            ...prev,
                            email: {
                              ...prev.email,
                              text: e.target.value,
                            },
                          }))
                        }
                        placeholder="Plain text content"
                        className="w-full h-32 px-3 py-2 bg-[#1a1a2e] text-white border border-[#1e1e2e] rounded-md text-sm font-mono"
                      />
                    </div>
                  </CardContent>
                </TabsContent>

                <TabsContent value="sms" className="m-0">
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-white block mb-2">
                        Message Text
                      </label>
                      <textarea
                        value={content.sms.text}
                        onChange={(e) =>
                          setContent((prev) => ({
                            ...prev,
                            sms: {
                              ...prev.sms,
                              text: e.target.value,
                            },
                          }))
                        }
                        placeholder="SMS message"
                        className="w-full h-32 px-3 py-2 bg-[#1a1a2e] text-white border border-[#1e1e2e] rounded-md text-sm font-mono"
                      />
                      <div className="mt-3 p-3 bg-[#1a1a2e] rounded-lg border border-[#1e1e2e]">
                        <p className="text-xs text-gray-400 mb-2">
                          Character count: {content.sms.text.length} / 160
                        </p>
                        <div className="relative h-2 bg-[#2a2a3e] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{
                              width: `${Math.min(
                                (content.sms.text.length / 160) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </TabsContent>
              </Card>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowVersionHistory(true)}
                >
                  <History className="w-4 h-4 mr-2" />
                  Version History
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowTestSend(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Test Send
                </Button>
              </div>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Variable Picker */}
            <Card className="border border-[#1e1e2e] bg-[#12121a]">
              <CardHeader>
                <CardTitle className="text-base">Variables</CardTitle>
                <CardDescription>Insert template variables</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {VARIABLES.map((variable) => (
                  <button
                    key={variable.name}
                    onClick={() => insertVariable(variable.name)}
                    className="w-full text-left px-3 py-2 bg-[#1a1a2e] hover:bg-[#202030] text-white rounded-lg text-sm transition-colors border border-[#1e1e2e]"
                  >
                    <code className="font-mono">{`{{${variable.name}}}`}</code>
                    <p className="text-xs text-gray-400 mt-1">
                      {variable.label}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="border border-[#1e1e2e] bg-[#12121a]">
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
                <CardDescription>Live preview with sample data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeChannel === "email" && (
                  <div className="space-y-2">
                    <div className="p-3 bg-[#1a1a2e] rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">
                        Subject:
                      </p>
                      <p className="text-sm text-white break-words">
                        {renderPreview(content.email.subject)}
                      </p>
                    </div>
                    <div className="p-3 bg-[#1a1a2e] rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">
                        Text Preview:
                      </p>
                      <p className="text-sm text-white whitespace-pre-wrap break-words">
                        {renderPreview(content.email.text)}
                      </p>
                    </div>
                  </div>
                )}
                {activeChannel === "sms" && (
                  <div className="p-3 bg-[#1a1a2e] rounded-lg">
                    <p className="text-xs text-gray-400 mb-2">
                      SMS Preview:
                    </p>
                    <div className="bg-white text-black p-3 rounded text-sm">
                      {renderPreview(content.sms.text)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={handlePublish}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Publish"}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                <Copy className="w-4 h-4 mr-2" />
                Save as Draft
              </Button>
            </div>
          </div>
        </div>

        {/* Version History Modal */}
        {showVersionHistory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="border border-[#1e1e2e] bg-[#12121a] w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Version History</CardTitle>
                  <button
                    onClick={() => setShowVersionHistory(false)}
                    className="p-2 hover:bg-[#1a1a2e] rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {VERSION_HISTORY.map((version) => (
                  <div
                    key={version.id}
                    className="p-4 border border-[#1e1e2e] rounded-lg flex items-start justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {version.changes}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        by {version.author} on{" "}
                        {version.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Test Send Modal */}
        {showTestSend && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="border border-[#1e1e2e] bg-[#12121a] w-full max-w-md mx-4">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Send Test Message</CardTitle>
                  <button
                    onClick={() => setShowTestSend(false)}
                    className="p-2 hover:bg-[#1a1a2e] rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    {activeChannel === "email"
                      ? "Email Address"
                      : activeChannel === "sms"
                      ? "Phone Number"
                      : "Recipient"}
                  </label>
                  <Input
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder={
                      activeChannel === "email"
                        ? "test@example.com"
                        : "+1234567890"
                    }
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowTestSend(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowTestSend(false);
                    }}
                    className="flex-1"
                  >
                    Send Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

