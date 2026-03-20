"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
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
    const styles = {
      open: { backgroundColor: "#eab308", color: "#000" },
      "in-progress": { backgroundColor: "#3b82f6", color: "#fff" },
      resolved: { backgroundColor: "#22c55e", color: "#fff" },
    };
  const { items: data, loading, error, refetch, pagination } = useApiList<SupportTicket>('/api/v4/support');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

    return styles[status as keyof typeof styles] || styles.open;
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
    <div className="min-h-screen bg-wl-bg p-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-wl-text mb-2">
            Support & Help Center
          </h1>
          <p className="text-wl-muted text-sm">
            Get help with Witylogix platform and manage support tickets
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* FAQ Section */}
          <div className="flex flex-col gap-4">
            <Card className="bg-wl-card border border-wl-border">
              <CardHeader>
                <CardTitle className="text-wl-text">Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {faqs.map((section) => (
                  <div key={section.category} className="mb-2">
                    <h3 className="text-wl-primary text-xs font-semibold mb-2 uppercase">
                      {section.category}
                    </h3>
                    {section.items.map((item) => (
                      <div key={item.id} className="mb-2">
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                          className="w-full flex items-center justify-between p-3 bg-wl-bg border border-wl-border rounded hover:bg-wl-border cursor-pointer text-wl-text text-sm font-medium transition-all"
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--wl-border)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--wl-bg)")}
                        >
                          <span className="text-left">{item.q}</span>
                          {expandedFaq === item.id ? (
                            <ChevronUp size={16} className="flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronDown size={16} className="flex-shrink-0 ml-2" />
                          )}
                        </button>
                        {expandedFaq === item.id && (
                          <div className="bg-wl-bg border-l-4 border-l-wl-primary border-r border-r-wl-border border-b border-b-wl-border rounded-bl rounded-br p-3 -mt-0.5 text-wl-muted text-sm leading-relaxed">
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
            <Card className="bg-wl-card border border-wl-border">
              <CardHeader>
                <CardTitle className="text-wl-text">Contact Support</CardTitle>
                <CardDescription className="text-wl-muted">Create a new support ticket</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-wl-text text-sm font-medium mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-wl-text text-sm font-medium mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-wl-text text-sm font-medium mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-wl-text text-sm font-medium mb-1.5">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm cursor-pointer"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-wl-text text-sm font-medium mb-1.5">
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm min-h-[100px] resize-vertical"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-wl-primary text-white border-none p-2.5 rounded cursor-pointer text-sm font-medium flex items-center justify-center gap-1.5"
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
        <Card className="bg-wl-card border border-wl-border">
          <CardHeader>
            <CardTitle className="text-wl-text flex items-center gap-2">
              <MessageSquare size={20} />
              Your Support Tickets
            </CardTitle>
            <CardDescription className="text-wl-muted">Recent tickets and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-b-wl-border">
                    <th className="p-3 text-left text-wl-muted text-xs font-semibold">
                      Ticket ID
                    </th>
                    <th className="p-3 text-left text-wl-muted text-xs font-semibold">
                      Subject
                    </th>
                    <th className="p-3 text-left text-wl-muted text-xs font-semibold">
                      Status
                    </th>
                    <th className="p-3 text-left text-wl-muted text-xs font-semibold">
                      Created
                    </th>
                    <th className="p-3 text-left text-wl-muted text-xs font-semibold">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-b-wl-border">
                      <td className="p-3 text-wl-text text-sm font-medium font-mono">
                        {ticket.id}
                      </td>
                      <td className="p-3 text-wl-text text-sm">
                        {ticket.subject}
                      </td>
                      <td className="p-3">
                        <Badge style={{ ...getStatusBadge(ticket.status), padding: "4px 8px", fontSize: "11px", fontWeight: "600" }}>
                          {ticket.status.replace("-", " ").toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-wl-muted text-xs">
                        {ticket.created}
                      </td>
                      <td className="p-3 text-wl-muted text-xs">
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
