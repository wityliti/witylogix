"use client";

import { useState } from "react";
import {
  Mail,
  MessageCircle,
  Phone,
  HelpCircle,
  Send,
  Loader2,
  Check,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@/lib/use-api";
import { ROUTES } from "@/lib/portal-api";
import type { ApiSupportTicket } from "@/lib/portal-api";
import { ErrorMessage, Skeleton } from "@/components/loading-skeleton";
import { format } from "date-fns";

// ─── Paginated tickets ────────────────────────────────────────

interface PaginatedTickets {
  data: ApiSupportTicket[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface CreateTicketResponse {
  data: ApiSupportTicket;
}

// ─── FAQ Items ─────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: string;
  category: "delivery" | "account" | "payment" | "contact";
}

const faqs: FAQItem[] = [
  {
    category: "delivery",
    question: "Can I reschedule my delivery?",
    answer:
      'Yes, you can reschedule your delivery up to 24 hours before the scheduled time. Go to your order and click the "Reschedule" button. You can select from available time slots.',
  },
  {
    category: "delivery",
    question: "What if I'm not home for delivery?",
    answer:
      "You can set safe place instructions in the Manage Delivery panel on your tracking page. The driver will leave your package at the specified location.",
  },
  {
    category: "delivery",
    question: "How can I track my delivery in real-time?",
    answer:
      "Go to the Track page and enter your tracking token. You can see the driver's current status, estimated arrival time, and manage delivery instructions.",
  },
  {
    category: "account",
    question: "How do I update my profile?",
    answer:
      "Visit the Preferences page to update your display name and phone number. Notification preferences can be managed per delivery on the tracking page.",
  },
  {
    category: "account",
    question: "Where can I find my tracking token?",
    answer:
      'Your tracking token is in your delivery confirmation email and on the order details page (click "Live Track").',
  },
  {
    category: "payment",
    question: "How can I get an invoice for my order?",
    answer:
      "Invoices are available on the order details page. Contact our support team if you need a custom invoice.",
  },
  {
    category: "contact",
    question: "How do I contact my driver?",
    answer:
      "When your order is out for delivery, you can use the contact preference option in the Manage Delivery panel on your tracking page to set how the driver should reach you.",
  },
  {
    category: "contact",
    question: "What is your customer support response time?",
    answer:
      "We aim to respond to all support tickets within 2 hours during business hours (9 AM–6 PM, Monday to Friday).",
  },
];

const categories = [
  { id: "all", label: "All" },
  { id: "delivery", label: "Delivery" },
  { id: "account", label: "Account" },
  { id: "payment", label: "Payment" },
  { id: "contact", label: "Contact" },
] as const;

type FAQCategory = (typeof categories)[number]["id"];

// ─── Status badges for tickets ────────────────────────────────

const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN: "status-active",
  IN_PROGRESS: "status-warn",
  RESOLVED: "status-complete",
  CLOSED: "status-default",
};

// ─── Component ────────────────────────────────────────────────

export default function SupportPage() {
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory>("all");
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  // Ticket form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [ticketSent, setTicketSent] = useState(false);

  const {
    data: ticketsData,
    loading: ticketsLoading,
    error: ticketsError,
    refetch: refetchTickets,
  } = useQuery<PaginatedTickets>(ROUTES.SUPPORT_TICKETS);

  const {
    mutate: createTicket,
    loading: creating,
    error: createError,
  } = useMutation<CreateTicketResponse>(ROUTES.SUPPORT_TICKETS, "POST");

  const filteredFAQs =
    selectedCategory === "all"
      ? faqs
      : faqs.filter((faq) => faq.category === selectedCategory);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    try {
      await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority: "MEDIUM",
      });
      setSubject("");
      setDescription("");
      setTicketSent(true);
      setTimeout(() => setTicketSent(false), 4000);
      refetchTickets();
    } catch {
      // Error shown via createError
    }
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Support Center</h1>
        <p className="page-subtitle">
          Get help with your deliveries and account
        </p>
      </div>

      {/* Quick Contact Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-1">
        <a
          href="mailto:support@witylogix.com"
          className={cn(
            "section-card flex items-start gap-4",
            "hover:border-wl-primary-500 transition-colors",
          )}
        >
          <Mail size={24} className="text-wl-primary-500 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-wl-text-primary">Email</h3>
            <p className="text-sm text-wl-text-secondary mt-1">
              support@witylogix.com
            </p>
            <p className="text-xs text-wl-text-tertiary mt-2">
              Response in 2 hours
            </p>
          </div>
        </a>

        <a
          href="tel:1-800-948-9564"
          className={cn(
            "section-card flex items-start gap-4",
            "hover:border-wl-primary-500 transition-colors",
          )}
        >
          <Phone size={24} className="text-wl-primary-500 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-wl-text-primary">Phone</h3>
            <p className="text-sm text-wl-text-secondary mt-1">1-800-WITYLOG</p>
            <p className="text-xs text-wl-text-tertiary mt-2">9 AM–6 PM EST</p>
          </div>
        </a>

        <div
          className={cn(
            "section-card flex items-start gap-4",
            "hover:border-wl-primary-500 transition-colors",
          )}
        >
          <MessageCircle
            size={24}
            className="text-wl-primary-500 flex-shrink-0"
          />
          <div>
            <h3 className="font-bold text-wl-text-primary">Chat</h3>
            <p className="text-sm text-wl-text-secondary mt-1">
              Live chat available
            </p>
            <p className="text-xs text-wl-text-tertiary mt-2">
              During business hours
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FAQ Section */}
        <div className="lg:col-span-2 stagger-2">
          <div className="section-card">
            <h2 className="text-2xl font-bold text-wl-text-primary mb-6">
              Frequently Asked Questions
            </h2>

            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setExpandedFAQ(null);
                  }}
                  className={cn(
                    selectedCategory === category.id
                      ? "btn btn-primary"
                      : "btn btn-ghost",
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* FAQ Items */}
            <div className="space-y-3">
              {filteredFAQs.map((faq, index) => (
                <div
                  key={index}
                  className={cn(
                    "section-card overflow-hidden transition-colors duration-fast",
                    "hover:border-wl-primary-500/50",
                    expandedFAQ === index && "border-wl-primary-500",
                  )}
                >
                  <button
                    onClick={() =>
                      setExpandedFAQ(expandedFAQ === index ? null : index)
                    }
                    className={cn(
                      "w-full px-4 py-4 text-left",
                      "flex items-center justify-between gap-3",
                      "hover:bg-wl-bg-elevated transition-colors",
                    )}
                  >
                    <p
                      className={cn(
                        "font-medium",
                        expandedFAQ === index
                          ? "text-wl-primary-400"
                          : "text-wl-text-primary",
                      )}
                    >
                      {faq.question}
                    </p>
                    <span
                      className={cn(
                        "text-wl-text-tertiary transition-transform duration-fast flex-shrink-0",
                        expandedFAQ === index && "rotate-180",
                      )}
                    >
                      &#x25BC;
                    </span>
                  </button>

                  {expandedFAQ === index && (
                    <div
                      className={cn(
                        "px-4 py-4 border-t border-wl-border-subtle",
                        "bg-wl-bg-elevated text-wl-text-secondary text-sm",
                      )}
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6 stagger-3">
          {/* Submit Ticket Form */}
          <form onSubmit={handleSubmitTicket} className="section-card">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={24} className="text-wl-primary-500" />
              <h2 className="text-xl font-bold text-wl-text-primary">
                Submit a Ticket
              </h2>
            </div>

            {ticketSent && (
              <div
                className={cn(
                  "section-card border-l-2 border-wl-success-500",
                  "p-3 mb-4 text-sm flex items-center gap-2",
                )}
              >
                <Check size={14} className="text-wl-success-500" />
                <span className="text-wl-text-primary">
                  Ticket submitted! We'll respond shortly.
                </span>
              </div>
            )}

            {createError && (
              <p className="text-sm text-wl-error-500 mb-3">
                {createError.message}
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="label block mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="How can we help?"
                  className="input w-full"
                  minLength={5}
                  maxLength={200}
                  required
                />
              </div>

              <div>
                <label className="label block mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your issue in detail…"
                  className="input w-full resize-none h-24"
                  minLength={10}
                  maxLength={5000}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={creating || !subject.trim() || !description.trim()}
                className={cn(
                  "btn btn-primary btn-lg w-full flex items-center justify-center gap-2",
                  (creating || !subject.trim() || !description.trim()) &&
                    "opacity-50 cursor-not-allowed",
                )}
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Ticket
                  </>
                )}
              </button>
            </div>
          </form>

          {/* My Tickets */}
          <div className="section-card">
            <div className="flex items-center gap-2 mb-4">
              <Ticket size={18} className="text-wl-primary-500" />
              <h2 className="text-lg font-bold text-wl-text-primary">
                My Tickets
              </h2>
            </div>

            {ticketsLoading && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}

            {!ticketsLoading && ticketsError && (
              <ErrorMessage
                message={ticketsError.message}
                onRetry={refetchTickets}
              />
            )}

            {!ticketsLoading &&
              !ticketsError &&
              (!ticketsData || ticketsData.data.length === 0) && (
                <p className="text-sm text-wl-text-tertiary">
                  No tickets yet. Submit one above.
                </p>
              )}

            {!ticketsLoading &&
              !ticketsError &&
              ticketsData &&
              ticketsData.data.length > 0 && (
                <div className="space-y-2">
                  {ticketsData.data.slice(0, 5).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-3 rounded-lg border border-wl-border-subtle hover:border-wl-primary-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-wl-text-primary line-clamp-1">
                          {ticket.subject}
                        </p>
                        <span
                          className={cn(
                            "status-badge flex-shrink-0 text-xs",
                            TICKET_STATUS_COLORS[ticket.status] ??
                              "status-default",
                          )}
                        >
                          {ticket.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-wl-text-tertiary mt-1">
                        {format(new Date(ticket.createdAt), "PPP")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Response Time Info */}
          <div>
            <p className="text-sm font-medium text-wl-text-secondary mb-1">
              Response Time
            </p>
            <p className="text-xs text-wl-text-tertiary">
              We typically respond within 2 hours during business hours (9 AM–6
              PM EST, Monday to Friday).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
