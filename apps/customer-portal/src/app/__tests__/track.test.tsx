import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TrackPage from '../track/page';

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return { ...actual };
});

describe('TrackPage', () => {
  it('renders page title "Live Tracking"', () => {
    render(<TrackPage />);
    expect(screen.getByText('Live Tracking')).toBeInTheDocument();
  });

  it('renders page subtitle', () => {
    render(<TrackPage />);
    expect(screen.getByText('Real-time delivery tracking')).toBeInTheDocument();
  });

  it('shows ETA information with "Estimated Arrival" label', () => {
    render(<TrackPage />);
    expect(screen.getByText('Estimated Arrival')).toBeInTheDocument();
  });

  it('shows ETA in minutes format', () => {
    render(<TrackPage />);
    // The ETA should include "min" text
    expect(screen.getByText(/\d+\s*min/)).toBeInTheDocument();
  });

  it('shows driver name', () => {
    render(<TrackPage />);
    expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
  });

  it('shows driver vehicle info', () => {
    render(<TrackPage />);
    expect(screen.getByText('Blue Van')).toBeInTheDocument();
  });

  it('shows "Driver" section heading', () => {
    render(<TrackPage />);
    expect(screen.getByText('Driver')).toBeInTheDocument();
  });

  it('shows "Call Driver" and "Message" action buttons', () => {
    render(<TrackPage />);
    expect(screen.getByText('Call Driver')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  it('shows delivery status section', () => {
    render(<TrackPage />);
    expect(screen.getByText('Delivery Status')).toBeInTheDocument();
    expect(screen.getByText('Out for Delivery')).toBeInTheDocument();
    expect(screen.getByText('Driver left the warehouse')).toBeInTheDocument();
  });

  it('shows remaining stops info', () => {
    render(<TrackPage />);
    expect(screen.getByText('3 more stops')).toBeInTheDocument();
    expect(screen.getByText('Before your delivery')).toBeInTheDocument();
  });

  it('shows delivery address section', () => {
    render(<TrackPage />);
    expect(screen.getByText('Delivery Address')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, Apt 4B')).toBeInTheDocument();
    expect(screen.getByText('San Francisco, CA 94105')).toBeInTheDocument();
  });

  it('shows alert box with heads up message', () => {
    render(<TrackPage />);
    expect(screen.getByText('Heads up!')).toBeInTheDocument();
    expect(
      screen.getByText('Make sure someone is available at your delivery address')
    ).toBeInTheDocument();
  });

  it('shows "Refresh Location" button', () => {
    render(<TrackPage />);
    expect(
      screen.getByRole('button', { name: /Refresh Location/i })
    ).toBeInTheDocument();
  });

  it('shows "Last updated" timestamp on the map', () => {
    render(<TrackPage />);
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('shows "Around" ETA time text', () => {
    render(<TrackPage />);
    expect(screen.getByText(/Around/)).toBeInTheDocument();
  });

  it('Call Driver link has correct tel: href', () => {
    render(<TrackPage />);
    const callLink = screen.getByText('Call Driver').closest('a');
    expect(callLink).toHaveAttribute('href', 'tel:(555) 123-4567');
  });

  it('Message link has correct sms: href', () => {
    render(<TrackPage />);
    const messageLink = screen.getByText('Message').closest('a');
    expect(messageLink).toHaveAttribute('href', 'sms:(555) 123-4567');
  });
});
