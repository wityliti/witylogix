"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
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

  const faqs = [
    {
      category: "Delivery",
      items: [
        {
          id: "delivery-1",
          q: "How can I track my deliveries in real-time?",
          a: "You can track deliveries through our live tracking page. Each order gets a unique tracking link that displays the driver's real-time location, ETA, and delivery status updates.",
        },
        {
          id: "delivery-2",
          q: "Can customers update delivery preferences after order placement?",
          a: "Yes, customers can update delivery instructions, preferred time slots, and contact information up to 2 hours before estimated delivery.",
        },
        {
          id: "delivery-3",
          q: "What happens if there's a delivery delay?",
          a: "The system automatically sends notifications to customers about delays. You can also manually update the status and send custom messages through the dashboard.",
        },
      ],
    },
    {
      category: "Billing",
      items: [
        {
          id: "billing-1",
          q: "How am I charged for the platform?",
          a: "We offer flexible billing plans: per-delivery, monthly subscription, or enterprise custom pricing. Choose based on your volume and needs.",
        },
        {
          id: "billing-2",
          q: "When do I receive my invoice?",
          a: "Invoices are generated at the end of each billing cycle and sent automatically to your registered email. You can also download invoices from the billing section.",
        },
        {
          id: "billing-3",
          q: "Can I change my billing plan anytime?",
          a: "Yes, you can upgrade, downgrade, or switch plans at any time. Changes take effect at the start of your next billing cycle.",
        },
      ],
    },
    {
      category: "Integrations",
      items: [
        {
          id: "integration-1",
          q: "Which platforms does Witylogix integrate with?",
          a: "We integrate with Shopify, WooCommerce, Magento, custom APIs, and major shipping carriers. Check our integrations page for the complete list.",
        },
        {
          id: "integration-2",
          q: "How do I set up API access?",
          a: "Generate API keys from the Settings page. Use our comprehensive documentation to implement webhooks and REST endpoints in your application.",
        },
        {
          id: "integration-3",
          q: "Is webhook support available?",
          a: "Yes, we support webhooks for order updates, delivery status changes, and rating submissions. Configure them in the Integrations settings.",
        },
      ],
    },
    {
      category: "Troubleshooting",
      items: [
        {
          id: "trouble-1",
          q: "Why isn't my widget displaying on my website?",
          a: "Check that your API key is correct and the embed code is placed before the closing body tag. Clear your browser cache and check console for errors.",
        },
        {
          id: "trouble-2",
          q: "Live map is not showing on tracking page",
          a: "Ensure the 'Live Map' feature is enabled in Tracking Configuration. Verify that driver location tracking is active for the delivery.",
        },
        {
          id: "trouble-3",
          q: "I'm not receiving webhook notifications",
          a: "Verify your webhook URL is publicly accessible and returning a 200 status code. Check the webhook logs in the Integrations section.",
        },
      ],
    },
  ];

  const getStatusBadge = (status: string) => {
    const styles = {
      open: { backgroundColor: "#eab308", color: "#000" },
      "in-progress": { backgroundColor: "#3b82f6", color: "#fff" },
      resolved: { backgroundColor: "#22c55e", color: "#fff" },
    };
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
    <div style={{ minHeight: "100vh", backgroundColor: "var(--wl-bg)", padding: "24px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", marginBottom: "8px" }}>
            Support & Help Center
          </h1>
          <p style={{ color: "var(--wl-muted)", fontSize: "14px" }}>
            Get help with Witylogix platform and manage support tickets
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          {/* FAQ Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {faqs.map((section) => (
                  <div key={section.category} style={{ marginBottom: "8px" }}>
                    <h3 style={{ color: "var(--wl-primary)", fontSize: "12px", fontWeight: "600", marginBottom: "8px", textTransform: "uppercase" }}>
                      {section.category}
                    </h3>
                    {section.items.map((item) => (
                      <div key={item.id} style={{ marginBottom: "8px" }}>
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px",
                            backgroundColor: "var(--wl-bg)",
                            border: "1px solid var(--wl-border)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            color: "var(--wl-text)",
                            fontSize: "13px",
                            fontWeight: "500",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--wl-border)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--wl-bg)")}
                        >
                          <span style={{ textAlign: "left" }}>{item.q}</span>
                          {expandedFaq === item.id ? (
                            <ChevronUp size={16} style={{ flexShrink: 0, marginLeft: "8px" }} />
                          ) : (
                            <ChevronDown size={16} style={{ flexShrink: 0, marginLeft: "8px" }} />
                          )}
                        </button>
                        {expandedFaq === item.id && (
                          <div
                            style={{
                              backgroundColor: "var(--wl-bg)",
                              borderLeft: `3px solid var(--wl-primary)`,
                              borderRight: "1px solid var(--wl-border)",
                              borderBottom: "1px solid var(--wl-border)",
                              borderBottomLeftRadius: "6px",
                              borderBottomRightRadius: "6px",
                              padding: "12px",
                              marginTop: "-1px",
                              color: "var(--wl-muted)",
                              fontSize: "13px",
                              lineHeight: "1.6",
                            }}
                          >
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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>Contact Support</CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Create a new support ticket</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "6px",
                        color: "var(--wl-text)",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "6px",
                        color: "var(--wl-text)",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                      Subject
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "6px",
                        color: "var(--wl-text)",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "6px",
                        color: "var(--wl-text)",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "6px",
                        color: "var(--wl-text)",
                        fontSize: "13px",
                        minHeight: "100px",
                        resize: "vertical",
                        fontFamily: "sans-serif",
                      }}
                    />
                  </div>

                  <Button
                    type="submit"
                    style={{
                      width: "100%",
                      backgroundColor: "var(--wl-primary)",
                      color: "white",
                      border: "none",
                      padding: "10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
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
        <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--wl-text)", display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={20} />
              Your Support Tickets
            </CardTitle>
            <CardDescription style={{ color: "var(--wl-muted)" }}>Recent tickets and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--wl-border)" }}>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Ticket ID
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Subject
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Status
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Created
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} style={{ borderBottom: "1px solid var(--wl-border)" }}>
                      <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", fontFamily: "monospace" }}>
                        {ticket.id}
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "13px" }}>
                        {ticket.subject}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Badge style={{ ...getStatusBadge(ticket.status), padding: "4px 8px", fontSize: "11px", fontWeight: "600" }}>
                          {ticket.status.replace("-", " ").toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "12px" }}>
                        {ticket.created}
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "12px" }}>
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
