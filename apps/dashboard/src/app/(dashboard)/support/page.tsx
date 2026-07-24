"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, MessageSquare, Plus } from "lucide-react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";

interface SupportTicket {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category?: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketsResponse {
  data: SupportTicket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface FAQ {
  id: string;
  q: string;
  a: string;
  category: string;
}

const faqs: FAQ[] = [
  {
    id: "delivery-1",
    category: "Delivery",
    q: "How do I track a delivery?",
    a: "You can track your delivery in real-time through the Tracking page. Enter your shipment ID or order number to view location, estimated arrival, and driver contact information.",
  },
  {
    id: "delivery-2",
    category: "Delivery",
    q: "What if my delivery is delayed?",
    a: "If your delivery is delayed, you can contact support immediately. Our team will investigate and provide you with updates. You may be eligible for a credit.",
  },
  {
    id: "billing-1",
    category: "Billing",
    q: "When will I be charged?",
    a: "You are charged when the delivery is completed. We accept all major credit cards and provide detailed invoices for your records.",
  },
  {
    id: "billing-2",
    category: "Billing",
    q: "How do I download an invoice?",
    a: "Invoices are available in your account dashboard under Billing. You can download them as PDF for your records.",
  },
  {
    id: "api-1",
    category: "API & Integration",
    q: "What API rate limits apply?",
    a: "Standard accounts have 1000 requests per hour. Enterprise accounts have custom limits. See our API documentation for details.",
  },
];

function getStatusBadge(
  status: string,
): "warning" | "info" | "success" | "default" {
  switch (status) {
    case "OPEN":
      return "warning";
    case "IN_PROGRESS":
      return "info";
    case "RESOLVED":
    case "CLOSED":
      return "success";
    default:
      return "default";
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export default function SupportPage() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>("delivery-1");
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  });

  // Fetch tickets from real API
  const {
    data: ticketsData,
    loading,
    error,
    refetch,
  } = useApiQuery<TicketsResponse>("/api/v4/support/tickets");

  // Create ticket mutation
  const { execute: createTicket, loading: creating } =
    useApiMutation<SupportTicket>("POST", "/api/v4/support/tickets");

  const tickets = ticketsData?.data ?? [];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await createTicket(formData);
        setFormData({ subject: "", description: "", priority: "MEDIUM" });
        refetch();
      } catch {
        // error surfaced via mutation hook
      }
    },
    [formData, createTicket, refetch],
  );

  // Group FAQs by category
  const faqSections = faqs.reduce(
    (acc, item) => {
      const group = acc.find((g) => g.category === item.category);
      if (group) {
        group.items.push(item);
      } else {
        acc.push({ category: item.category, items: [item] });
      }
      return acc;
    },
    [] as { category: string; items: FAQ[] }[],
  );

  return (
    <div className="min-h-screen bg-wl-bg-root p-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Support & Help Center
          </h1>
          <p className="text-gray-400 text-sm">
            Get help with Witylogix platform and manage support tickets
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* FAQ Section */}
          <div className="flex flex-col gap-4">
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-white">
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {faqSections.map((section) => (
                  <div key={section.category} className="mb-2">
                    <h3 className="text-blue-400 text-xs font-semibold mb-2 uppercase">
                      {section.category}
                    </h3>
                    {section.items.map((item) => (
                      <div key={item.id} className="mb-2">
                        <button
                          onClick={() =>
                            setExpandedFaq(
                              expandedFaq === item.id ? null : item.id,
                            )
                          }
                          className="w-full flex items-center justify-between p-3 bg-wl-bg-elevated border border-wl-border-default rounded hover:bg-wl-bg-elevated/80 cursor-pointer text-white text-sm font-medium transition-all"
                        >
                          <span className="text-left">{item.q}</span>
                          {expandedFaq === item.id ? (
                            <ChevronUp
                              size={16}
                              className="flex-shrink-0 ml-2"
                            />
                          ) : (
                            <ChevronDown
                              size={16}
                              className="flex-shrink-0 ml-2"
                            />
                          )}
                        </button>
                        {expandedFaq === item.id && (
                          <div className="bg-wl-bg-elevated border-l-4 border-l-blue-500 border-r border-r-[#1e1e2e] border-b border-b-[#1e1e2e] rounded-bl rounded-br p-3 -mt-0.5 text-gray-400 text-sm leading-relaxed">
                            {item.a}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="flex flex-col gap-4">
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-white">Contact Support</CardTitle>
                <CardDescription className="text-gray-400">
                  Create a new support ticket
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      required
                      minLength={5}
                      className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as typeof formData.priority,
                        })
                      }
                      className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      required
                      minLength={10}
                      className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm min-h-[100px] resize-vertical placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full flex items-center justify-center gap-1.5"
                    disabled={creating}
                  >
                    <Plus size={16} />
                    {creating ? "Creating..." : "Create Ticket"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Support Tickets */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare size={20} />
              Your Support Tickets
            </CardTitle>
            <CardDescription className="text-gray-400">
              Recent tickets and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
                <span className="text-sm text-red-400">
                  Failed to load tickets
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  className="text-red-400"
                >
                  Retry
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-b-[#1e1e2e]">
                    <th className="p-3 text-left text-gray-400 text-xs font-semibold">
                      Ticket ID
                    </th>
                    <th className="p-3 text-left text-gray-400 text-xs font-semibold">
                      Subject
                    </th>
                    <th className="p-3 text-left text-gray-400 text-xs font-semibold">
                      Priority
                    </th>
                    <th className="p-3 text-left text-gray-400 text-xs font-semibold">
                      Status
                    </th>
                    <th className="p-3 text-left text-gray-400 text-xs font-semibold">
                      Created
                    </th>
                    <th className="p-3 text-left text-gray-400 text-xs font-semibold">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-b-[#1e1e2e]">
                        <td
                          colSpan={6}
                          className="px-3 py-4 h-12 bg-wl-bg-elevated/30 animate-pulse"
                        />
                      </tr>
                    ))
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-gray-400 text-sm"
                      >
                        No support tickets yet. Create one above.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className={cn(
                          "border-b border-b-[#1e1e2e] hover:bg-wl-bg-elevated/40 transition-colors",
                        )}
                      >
                        <td className="p-3 text-white text-sm font-medium font-mono">
                          {ticket.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="p-3 text-white text-sm">
                          {ticket.subject}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              ticket.priority === "URGENT"
                                ? "danger"
                                : ticket.priority === "HIGH"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {ticket.priority}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={getStatusBadge(ticket.status)}>
                            {formatStatus(ticket.status)}
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-400 text-xs">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-gray-400 text-xs">
                          {new Date(ticket.updatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
