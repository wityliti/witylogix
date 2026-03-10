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
    <div className={cn(
      'flex flex-col gap-6 px-4 sm:px-6 lg:px-8',
      'py-6 sm:py-8 pb-12'
    )}>
      {/* Header */}
      <section>
        <h1 className="text-3xl sm:text-4xl font-bold text-wl-text-primary mb-2">
          Support Center
        </h1>
        <p className="text-wl-text-secondary">
          Get help with your deliveries and account
        </p>
      </section>

      {/* Quick Contact Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a
          href="mailto:support@witylogix.com"
          className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6',
            'flex items-start gap-4',
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
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6',
            'flex items-start gap-4',
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
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6',
          'flex items-start gap-4'
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
        <div className="lg:col-span-2">
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
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
                    'px-3 py-1 rounded-full text-sm font-medium',
                    'transition-colors duration-fast',
                    selectedCategory === category.id
                      ? 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
                      : 'bg-wl-bg-elevated text-wl-text-secondary hover:text-wl-text-primary'
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
                    'border border-wl-border-subtle rounded-lg overflow-hidden',
                    'transition-colors duration-fast',
                    expandedFAQ === index && 'border-wl-primary-500'
                  )}
                >
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                    className={cn(
                      'w-full px-4 py-4 text-left',
                      'flex items-center justify-between gap-3',
                      'hover:bg-wl-bg-elevated transition-colors',
                      expandedFAQ === index && 'bg-wl-primary-500/10'
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
                      ▼
                    </span>
                  </button>

                  {expandedFAQ === index && (
                    <div className={cn(
                      'px-4 py-4 border-t border-wl-border-subtle',
                      'bg-wl-bg-elevated text-wl-text-secondary'
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
        <div className="flex flex-col gap-6">
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={24} className="text-wl-primary-500" />
              <h2 className="text-xl font-bold text-wl-text-primary">
                Send us a Message
              </h2>
            </div>

            {messageSent && (
              <div className={cn(
                'bg-wl-success-bg border border-wl-success-500/30',
                'rounded-lg p-3 mb-4 text-sm',
                'flex items-center gap-2'
              )}>
                <span>✓</span>
                <span className="text-wl-text-primary">Message sent!</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Your Email
                </label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border border-wl-border-subtle',
                    'bg-wl-bg-elevated text-wl-text-primary',
                    'placeholder-wl-text-tertiary',
                    'focus:outline-none focus:border-wl-primary-500'
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="How can we help?"
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border border-wl-border-subtle',
                    'bg-wl-bg-elevated text-wl-text-primary',
                    'placeholder-wl-text-tertiary',
                    'focus:outline-none focus:border-wl-primary-500'
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue..."
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border border-wl-border-subtle',
                    'bg-wl-bg-elevated text-wl-text-primary',
                    'placeholder-wl-text-tertiary',
                    'focus:outline-none focus:border-wl-primary-500',
                    'resize-none h-24'
                  )}
                />
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className={cn(
                  'w-full px-4 py-3 rounded-lg font-medium',
                  'flex items-center justify-center gap-2',
                  'transition-colors duration-fast',
                  !message.trim()
                    ? 'bg-wl-neutral-800 text-wl-text-tertiary cursor-not-allowed'
                    : 'bg-wl-primary-500 text-wl-text-inverse hover:bg-wl-primary-600'
                )}
              >
                <Send size={16} />
                Send Message
              </button>
            </div>
          </div>

          {/* Response Time Info */}
          <div className={cn(
            'bg-wl-info-bg border border-wl-info-500/30',
            'rounded-lg p-4'
          )}>
            <p className="text-sm text-wl-info-500 font-medium mb-2">
              Response Time
            </p>
            <p className="text-xs text-wl-text-secondary">
              We typically respond within 2 hours during business hours (9 AM - 6 PM EST, Monday to Friday).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
