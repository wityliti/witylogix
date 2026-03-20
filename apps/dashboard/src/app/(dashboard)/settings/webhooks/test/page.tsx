'use client';

import { useState } from 'react';
import { useApiMutation } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Send,
  Copy,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TestSend {
  id: string;
  timestamp: Date;
  eventType: string;
  endpoint: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  duration: number;
  responseBody?: string;
}

const WEBHOOK_EVENTS = [
  { id: "shipment.created", label: "Shipment Created" },
  { id: "shipment.status_changed", label: "Shipment Status Changed" },
  { id: "order.created", label: "Order Created" },
  { id: "order.updated", label: "Order Updated" },
  { id: "driver.assigned", label: "Driver Assigned" },
  { id: "route.completed", label: "Route Completed" },
  { id: "payment.completed", label: "Payment Completed" },
];

const SAMPLE_PAYLOADS: Record<string, Record<string, any>> = {
  "shipment.created": {
    id: "evt_1a2b3c4d5e6f",
    event: "shipment.created",
    timestamp: new Date().toISOString(),
    data: {
      shipmentId: "ship_1234567890",
      orderId: "order_987654321",
      carrier: "DHL",
      trackingNumber: "1234567890123",
      status: "pending",
      estimatedDelivery: "2025-03-20",
    },
  },
  "order.created": {
    id: "evt_2b3c4d5e6f7g",
    event: "order.created",
    timestamp: new Date().toISOString(),
    data: {
      orderId: "order_987654321",
      customerId: "cust_123456",
      totalAmount: 99.99,
      currency: "USD",
      items: 3,
      status: "pending",
    },
  },
};

export default function WebhookTestPage() {
  const { execute: sendTestWebhook } = useApiMutation('POST', '/api/v4/webhooks/test');

  const [selectedEvent, setSelectedEvent] = useState('shipment.created');
  const [endpoint, setEndpoint] = useState('https://webhook.example.com/events');
  const [customPayload, setCustomPayload] = useState(
    JSON.stringify(
      SAMPLE_PAYLOADS['shipment.created'] || {},
      null,
      2
    )
  );
  const [isLoading, setIsLoading] = useState(false);
  const [testSends, setTestSends] = useState<TestSend[]>([]);
  const [expandedSendId, setExpandedSendId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const samplePayload = SAMPLE_PAYLOADS[selectedEvent] || {
    event: selectedEvent,
    timestamp: new Date().toISOString(),
    data: {},
  };

  const handleEventChange = (eventId: string) => {
    setSelectedEvent(eventId);
    setCustomPayload(
      JSON.stringify(SAMPLE_PAYLOADS[eventId] || { event: eventId }, null, 2)
    );
  };

  const handleSendTest = async () => {
    setIsLoading(true);

    try {
      const payload = JSON.parse(customPayload);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const newSend: TestSend = {
        id: `test-${Date.now()}`,
        timestamp: new Date(),
        eventType: selectedEvent,
        endpoint,
        status: Math.random() > 0.2 ? "success" : "failed",
        statusCode: Math.random() > 0.2 ? 200 : 500,
        duration: Math.floor(Math.random() * 300) + 50,
        responseBody: JSON.stringify({
          success: true,
          message: "Webhook processed",
          eventId: payload.id,
        }),
      };

      setTestSends([newSend, ...testSends]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Webhook Test Sender"
        subtitle="Test webhook deliveries with custom payloads"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Test Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Type Selection */}
            <Card className="border border-[var(--wl-border)]">
              <CardHeader>
                <CardTitle className="text-lg">Select Event Type</CardTitle>
                <CardDescription>
                  Choose the webhook event to test
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => handleEventChange(event.id)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                        selectedEvent === event.id
                          ? "bg-[var(--wl-primary)] text-white border-[var(--wl-primary)]"
                          : "border-[var(--wl-border)] hover:bg-[var(--wl-bg-secondary)]"
                      )}
                    >
                      {event.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Endpoint Configuration */}
            <Card className="border border-[var(--wl-border)]">
              <CardHeader>
                <CardTitle className="text-lg">Target Endpoint</CardTitle>
                <CardDescription>
                  URL where the webhook will be sent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://webhook.example.com/events"
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>

            {/* Payload Editor */}
            <Card className="border border-[var(--wl-border)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Payload</CardTitle>
                    <CardDescription>
                      Edit the JSON payload to send
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyToClipboard(customPayload, "Payload copied")
                    }
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <textarea
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  className="w-full h-48 p-3 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] font-mono text-xs resize-none focus:outline-none focus:border-[var(--wl-primary)]"
                />
              </CardContent>
            </Card>

            {/* Send Button */}
            <Card className="border border-[var(--wl-border)]">
              <CardContent className="pt-6">
                <Button
                  onClick={handleSendTest}
                  disabled={isLoading || !endpoint}
                  className="w-full"
                  variant="primary"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isLoading ? "Sending..." : "Send Test Webhook"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Test History */}
          <div className="lg:col-span-1">
            <Card className="border border-[var(--wl-border)] sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Test History</CardTitle>
              </CardHeader>
              <CardContent>
                {testSends.length === 0 ? (
                  <div className="text-center py-8 text-[var(--wl-text-secondary)]">
                    No test sends yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {testSends.map((send) => (
                      <div
                        key={send.id}
                        className="border border-[var(--wl-border)] rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedSendId(
                              expandedSendId === send.id ? null : send.id
                            )
                          }
                          className="w-full p-3 hover:bg-[var(--wl-bg-secondary)] transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 flex-1 text-left">
                            {getStatusIcon(send.status)}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono text-[var(--wl-text-secondary)]">
                                {send.timestamp.toLocaleTimeString()}
                              </div>
                              <div className="text-xs truncate">
                                {send.eventType}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                send.status === "success"
                                  ? "success"
                                  : send.status === "failed"
                                    ? "danger"
                                    : "warning"
                              }
                              className="text-xs"
                            >
                              {send.statusCode || "—"}
                            </Badge>
                            {expandedSendId === send.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </button>

                        {expandedSendId === send.id && (
                          <div className="border-t border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] p-3 text-xs space-y-2">
                            <div>
                              <div className="font-semibold text-[var(--wl-text-secondary)] mb-1">
                                Duration
                              </div>
                              <div className="font-mono">
                                {send.duration}ms
                              </div>
                            </div>

                            <div>
                              <div className="font-semibold text-[var(--wl-text-secondary)] mb-1">
                                Endpoint
                              </div>
                              <div className="font-mono break-all">
                                {send.endpoint}
                              </div>
                            </div>

                            {send.responseBody && (
                              <div>
                                <div className="font-semibold text-[var(--wl-text-secondary)] mb-1">
                                  Response
                                </div>
                                <pre className="bg-[var(--wl-bg-primary)] p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                                  {send.responseBody}
                                </pre>
                              </div>
                            )}

                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              onClick={() =>
                                copyToClipboard(
                                  send.responseBody || "",
                                  "Response copied"
                                )
                              }
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy Response
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div className="fixed bottom-4 right-4 px-4 py-2 rounded-lg bg-green-500 text-white text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {copyFeedback}
        </div>
      )}
    </div>
  );
}
