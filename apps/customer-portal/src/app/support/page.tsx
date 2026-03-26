'use client';

import { useState } from 'react';
import { Mail, MessageCircle, Phone, HelpCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
  category: 'delivery' | 'account' | 'payment' | 'contact';
}

const faqs: FAQItem[] = [
  {
    category: 'delivery',
    question: 'Can I reschedule my delivery?',
    answer: 'Yes, you can reschedule your delivery up to 24 hours before the scheduled time. Go to your order and click the "Reschedule" button. You can select from available time slots.',
  },
  {
    category: 'delivery',
    question: 'What if I\'m not home for delivery?',
    answer: 'You can set safe place instructions in your preferences. The driver will leave your package at the specified location. You can also contact the driver directly to arrange an alternative delivery time.',
  },
  {
    category: 'delivery',
    question: 'How can I track my delivery in real-time?',
    answer: 'Go to the "Track" page to see real-time tracking of your delivery. You can see the driver\'s current location, estimated arrival time, and remaining stops.',
  },
  {
    category: 'account',
    question: 'How do I update my delivery preferences?',
    answer: 'Visit the Preferences page to update safe place instructions, access codes, preferred delivery times, and notification settings. All changes are saved automatically.',
  },
  {
    category: 'account',
    question: 'Can I change my default address?',
    answer: 'Yes, you can manage your default address in the Preferences section. Click "Edit Address" to update it.',
  },
  {
    category: 'payment',
    question: 'How can I get an invoice for my order?',
    answer: 'You can download an invoice directly from your order details page. Click the "Download Invoice" button on any order.',
  },
  {
    category: 'contact',
    question: 'How do I contact my driver?',
    answer: 'When your order is out for delivery, you can call or message your driver directly from the tracking page or order details.',
  },
  {
    category: 'contact',
    question: 'What is your customer support response time?',
    answer: 'We aim to respond to all support inquiries within 2 hours during business hours (9 AM - 6 PM, Monday to Friday).',
  },
];

const categories = [
  { id: 'all', label: 'All' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'account', label: 'Account' },
  { id: 'payment', label: 'Payment' },
  { id: 'contact', label: 'Contact' },
];

export default function SupportPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);

  const filteredFAQs = selectedCategory === 'all'
    ? faqs
    : faqs.filter(faq => faq.category === selectedCategory);

  const handleSendMessage = () => {
    if (message.trim()) {
      // Simulate sending message
      setMessage('');
      setMessageSent(true);
      setTimeout(() => setMessageSent(false), 3000);
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
            'section-card flex items-start gap-4',
            'hover:border-wl-primary-500 transition-colors'
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
          href="tel:1-800-WITYLOGIX"
          className={cn(
            'section-card flex items-start gap-4',
            'hover:border-wl-primary-500 transition-colors'
          )}
        >
          <Phone size={24} className="text-wl-primary-500 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-wl-text-primary">Phone</h3>
            <p className="text-sm text-wl-text-secondary mt-1">
              1-800-WITYLOGIX
            </p>
            <p className="text-xs text-wl-text-tertiary mt-2">
              9 AM - 6 PM EST
            </p>
          </div>
        </a>

        <div className={cn(
          'section-card flex items-start gap-4',
          'hover:border-wl-primary-500 transition-colors'
        )}>
          <MessageCircle size={24} className="text-wl-primary-500 flex-shrink-0" />
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
                      ? 'btn btn-primary'
                      : 'btn btn-ghost'
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
                    'section-card overflow-hidden transition-colors duration-fast',
                    'hover:border-wl-primary-500/50',
                    expandedFAQ === index && 'border-wl-primary-500'
                  )}
                >
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                    className={cn(
                      'w-full px-4 py-4 text-left',
                      'flex items-center justify-between gap-3',
                      'hover:bg-wl-bg-elevated transition-colors'
                    )}
                  >
                    <p className={cn(
                      'font-medium',
                      expandedFAQ === index
                        ? 'text-wl-primary-400'
                        : 'text-wl-text-primary'
                    )}>
                      {faq.question}
                    </p>
                    <span className={cn(
                      'text-wl-text-tertiary transition-transform duration-fast flex-shrink-0',
                      expandedFAQ === index && 'rotate-180'
                    )}>
                      &#x25BC;
                    </span>
                  </button>

                  {expandedFAQ === index && (
                    <div className={cn(
                      'px-4 py-4 border-t border-wl-border-subtle',
                      'bg-wl-bg-elevated text-wl-text-secondary text-sm'
                    )}>
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="flex flex-col gap-6 stagger-3">
          <div className="section-card">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={24} className="text-wl-primary-500" />
              <h2 className="text-xl font-bold text-wl-text-primary">
                Send us a Message
              </h2>
            </div>

            {messageSent && (
              <div className={cn(
                'section-card border-l-2 border-wl-success-500',
                'p-3 mb-4 text-sm',
                'flex items-center gap-2'
              )}>
                <span>&#x2713;</span>
                <span className="text-wl-text-primary">Message sent!</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label block mb-2">
                  Your Email
                </label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="label block mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="How can we help?"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="label block mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue..."
                  className="input w-full resize-none h-24"
                />
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className={cn(
                  'btn btn-primary btn-lg w-full',
                  'flex items-center justify-center gap-2',
                  !message.trim() && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Send size={16} />
                Send Message
              </button>
            </div>
          </div>

          {/* Response Time Info */}
          <div>
            <p className="text-sm font-medium text-wl-text-secondary mb-1">
              Response Time
            </p>
            <p className="text-xs text-wl-text-tertiary">
              We typically respond within 2 hours during business hours (9 AM - 6 PM EST, Monday to Friday).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
