"use client";

import { useState } from "react";
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
import {
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
} from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  status: "open" | "in-progress" | "resolved";
  created: string;
  updated: string;
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

export default function SupportPage() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>("delivery-1");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    priority: "normal",
  });
  const [tickets, setTickets] = useState<Ticket[]>([
    {
      id: "TKT-001",
      subject: "Delivery tracking not updating",
      status: "in-progress",
      created: "2026-03-04",
      updated: "2026-03-05",
    },
    {
      id: "TKT-002",
      subject: "Integration with Shopify",
      status: "resolved",
      created: "2026-03-02",
      updated: "2026-03-05",
    },
    {
      id: "TKT-003",
      subject: "API rate limit questions",
      status: "open",
      created: "2026-03-05",
      updated: "2026-03-05",
    },
    {
      id: "TKT-004",
      subject: "Billing invoice inquiry",
      status: "open",
      created: "2026-03-03",
      updated: "2026-03-04",
    },
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return "warning";
      case "in-progress":
        return "info";
      case "resolved":
        return "success";
      default:
        return "default";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTicket: Ticket = {
      id: `TKT-${String(tickets.length + 1).padStart(3, "0")}`,
      subject: formData.subject,
      status: "open",
      created: new Date().toISOString().split("T")[0],
      updated: new Date().toISOString().split("T")[0],
    };
    setTickets([newTicket, ...tickets]);
    setFormData({ name: "", email: "", subject: "", message: "", priority: "normal" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
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
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {faqs.reduce((acc, item) => {
                  const categoryGroup = acc.find(g => g.category === item.category);
                  if (categoryGroup) {
                    categoryGroup.items.push(item);
                  } else {
                    acc.push({ category: item.category, items: [item] });
                  }
                  return acc;
                }, [] as any[]).map((section) => (
                  <div key={section.category} className="mb-2">
                    <h3 className="text-blue-400 text-xs font-semibold mb-2 uppercase">
                      {section.category}
                    </h3>
                    {section.items.map((item: FAQ) => (
                      <div key={item.id} className="mb-2">
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                          className="w-full flex items-center justify-between p-3 bg-[#1a1a2e] border border-[#1e1e2e] rounded hover:bg-[#1a1a2e]/80 cursor-pointer text-white text-sm font-medium transition-all"
                        >
                          <span className="text-left">{item.q}</span>
                          {expandedFaq === item.id ? (
                            <ChevronUp size={16} className="flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronDown size={16} className="flex-shrink-0 ml-2" />
                          )}
                        </button>
                        {expandedFaq === item.id && (
                          <div className="bg-[#1a1a2e] border-l-4 border-l-blue-500 border-r border-r-[#1e1e2e] border-b border-b-[#1e1e2e] rounded-bl rounded-br p-3 -mt-0.5 text-gray-400 text-sm leading-relaxed">
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
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Contact Support</CardTitle>
                <CardDescription className="text-gray-400">Create a new support ticket</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1.5">
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm min-h-[100px] resize-vertical placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} />
                    Create Ticket
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Support Tickets */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare size={20} />
              Your Support Tickets
            </CardTitle>
            <CardDescription className="text-gray-400">Recent tickets and their status</CardDescription>
          </CardHeader>
          <CardContent>
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
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-b-[#1e1e2e] hover:bg-[#1a1a2e]/40 transition-colors">
                      <td className="p-3 text-white text-sm font-medium font-mono">
                        {ticket.id}
                      </td>
                      <td className="p-3 text-white text-sm">
                        {ticket.subject}
                      </td>
                      <td className="p-3">
                        <Badge variant={getStatusBadge(ticket.status) as any}>
                          {ticket.status.replace("-", " ").toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">
                        {ticket.created}
                      </td>
                      <td className="p-3 text-gray-400 text-xs">
                        {ticket.updated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
