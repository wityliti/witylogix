import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SupportPage from '../support/page';

describe('SupportPage', () => {
  it('renders page title "Support Center"', () => {
    render(<SupportPage />);
    expect(screen.getByText('Support Center')).toBeInTheDocument();
  });

  it('renders page subtitle', () => {
    render(<SupportPage />);
    expect(
      screen.getByText('Get help with your deliveries and account')
    ).toBeInTheDocument();
  });

  it('shows 3 contact method cards (Email, Phone, Chat)', () => {
    render(<SupportPage />);
    // Contact card headings
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('shows email contact details', () => {
    render(<SupportPage />);
    expect(screen.getByText('support@witylogix.com')).toBeInTheDocument();
    expect(screen.getByText('Response in 2 hours')).toBeInTheDocument();
  });

  it('shows phone contact details', () => {
    render(<SupportPage />);
    expect(screen.getByText('1-800-WITYLOGIX')).toBeInTheDocument();
    expect(screen.getByText('9 AM - 6 PM EST')).toBeInTheDocument();
  });

  it('shows chat contact details', () => {
    render(<SupportPage />);
    expect(screen.getByText('Live chat available')).toBeInTheDocument();
    expect(screen.getByText('During business hours')).toBeInTheDocument();
  });

  it('shows FAQ section with heading', () => {
    render(<SupportPage />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
  });

  it('shows FAQ category filter buttons', () => {
    render(<SupportPage />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Payment')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('shows all FAQ questions by default', () => {
    render(<SupportPage />);
    expect(screen.getByText('Can I reschedule my delivery?')).toBeInTheDocument();
    expect(screen.getByText("What if I'm not home for delivery?")).toBeInTheDocument();
    expect(screen.getByText('How can I track my delivery in real-time?')).toBeInTheDocument();
    expect(screen.getByText('How do I update my delivery preferences?')).toBeInTheDocument();
    expect(screen.getByText('Can I change my default address?')).toBeInTheDocument();
    expect(screen.getByText('How can I get an invoice for my order?')).toBeInTheDocument();
    expect(screen.getByText('How do I contact my driver?')).toBeInTheDocument();
    expect(screen.getByText('What is your customer support response time?')).toBeInTheDocument();
  });

  it('FAQ items expand on click to show answer', async () => {
    const user = userEvent.setup();
    render(<SupportPage />);

    // Click first FAQ question
    await user.click(screen.getByText('Can I reschedule my delivery?'));

    // Answer should be visible
    expect(
      screen.getByText(/you can reschedule your delivery up to 24 hours/i)
    ).toBeInTheDocument();
  });

  it('FAQ items collapse when clicked again', async () => {
    const user = userEvent.setup();
    render(<SupportPage />);

    // Expand
    await user.click(screen.getByText('Can I reschedule my delivery?'));
    expect(
      screen.getByText(/you can reschedule your delivery up to 24 hours/i)
    ).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('Can I reschedule my delivery?'));
    expect(
      screen.queryByText(/you can reschedule your delivery up to 24 hours/i)
    ).not.toBeInTheDocument();
  });

  it('filters FAQs by category', async () => {
    const user = userEvent.setup();
    render(<SupportPage />);

    // Click "Payment" category
    await user.click(screen.getByText('Payment'));

    // Payment FAQ should be visible
    expect(screen.getByText('How can I get an invoice for my order?')).toBeInTheDocument();

    // Delivery FAQ should not be visible
    expect(screen.queryByText('Can I reschedule my delivery?')).not.toBeInTheDocument();
  });

  it('contact form has email, subject, message fields', () => {
    render(<SupportPage />);
    expect(screen.getByText('Your Email')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();

    expect(screen.getByPlaceholderText('john@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('How can we help?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe your issue...')).toBeInTheDocument();
  });

  it('send button is disabled when message is empty', () => {
    render(<SupportPage />);
    const sendButton = screen.getByRole('button', { name: /Send Message/i });
    expect(sendButton).toBeDisabled();
  });

  it('send button is enabled when message has content', async () => {
    const user = userEvent.setup();
    render(<SupportPage />);

    const messageInput = screen.getByPlaceholderText('Describe your issue...');
    await user.type(messageInput, 'I need help with my delivery');

    const sendButton = screen.getByRole('button', { name: /Send Message/i });
    expect(sendButton).not.toBeDisabled();
  });

  it('message sent confirmation appears after sending', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    render(<SupportPage />);

    const messageInput = screen.getByPlaceholderText('Describe your issue...');
    await user.type(messageInput, 'I need help');

    const sendButton = screen.getByRole('button', { name: /Send Message/i });
    await user.click(sendButton);

    // Confirmation should appear
    expect(screen.getByText('Message sent!')).toBeInTheDocument();

    // Message field should be cleared
    expect(messageInput).toHaveValue('');

    // Confirmation should disappear after 3 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(screen.queryByText('Message sent!')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows "Send us a Message" heading in contact form', () => {
    render(<SupportPage />);
    expect(screen.getByText('Send us a Message')).toBeInTheDocument();
  });
});
