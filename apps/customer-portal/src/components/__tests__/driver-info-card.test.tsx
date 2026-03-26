import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DriverInfoCard } from '../driver-info-card';
import type { Driver } from '@/types';

const mockDriver: Driver = {
  id: 'drv-1',
  name: 'Alex Johnson',
  phone: '+15551234567',
  email: 'alex@example.com',
  vehicle: {
    type: 'Van',
    plate: 'ABC-1234',
    color: 'White',
  },
  rating: 4.5,
};

describe('DriverInfoCard', () => {
  it('shows loading state when driver is null', () => {
    render(<DriverInfoCard driver={null} isConnected={false} />);
    expect(screen.getByText('Loading driver information...')).toBeInTheDocument();
  });

  it('renders driver name', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
  });

  it('renders driver initials when no photo', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);
    expect(screen.getByText('AJ')).toBeInTheDocument();
  });

  it('shows star rating with numeric value', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('renders 5 star icons', () => {
    const { container } = render(
      <DriverInfoCard driver={mockDriver} isConnected={true} />
    );
    const stars = container.querySelectorAll('.flex.items-center.gap-0\\.5 svg');
    expect(stars).toHaveLength(5);
  });

  it('fills correct number of stars based on rating', () => {
    const { container } = render(
      <DriverInfoCard driver={mockDriver} isConnected={true} />
    );
    const filledStars = container.querySelectorAll(
      '.flex.items-center.gap-0\\.5 .fill-wl-warning-500'
    );
    // Math.floor(4.5) = 4 filled stars
    expect(filledStars).toHaveLength(4);
  });

  it('shows vehicle info', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);

    // The component renders: "White Van · ABC-1234"
    // Using &middot; entity, rendered as ·
    const vehicleInfo = screen.getByText((content) =>
      content.includes('White') &&
      content.includes('Van') &&
      content.includes('ABC-1234')
    );
    expect(vehicleInfo).toBeInTheDocument();
  });

  it('shows Call and Text buttons', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);
    expect(screen.getByText('Call')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('Call and Text buttons are enabled when connected', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);

    const callButton = screen.getByText('Call').closest('button');
    const textButton = screen.getByText('Text').closest('button');

    expect(callButton).not.toBeDisabled();
    expect(textButton).not.toBeDisabled();
  });

  it('Call and Text buttons are disabled when not connected', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={false} />);

    const callButton = screen.getByText('Call').closest('button');
    const textButton = screen.getByText('Text').closest('button');

    expect(callButton).toBeDisabled();
    expect(textButton).toBeDisabled();
  });

  it('shows unavailable message when disconnected', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={false} />);
    expect(
      screen.getByText('Driver temporarily unavailable')
    ).toBeInTheDocument();
  });

  it('does not show unavailable message when connected', () => {
    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);
    expect(
      screen.queryByText('Driver temporarily unavailable')
    ).not.toBeInTheDocument();
  });

  it('Call button triggers tel: link', async () => {
    const user = userEvent.setup();
    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<DriverInfoCard driver={mockDriver} isConnected={true} />);
    const callButton = screen.getByText('Call').closest('button')!;
    await user.click(callButton);

    expect(window.location.href).toBe('tel:+15551234567');

    // Restore
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('shows connection indicator with success color when connected', () => {
    const { container } = render(
      <DriverInfoCard driver={mockDriver} isConnected={true} />
    );
    const indicator = container.querySelector('.absolute.rounded-full.border-2');
    expect(indicator).toHaveClass('bg-wl-success-500');
  });

  it('shows connection indicator with neutral color when disconnected', () => {
    const { container } = render(
      <DriverInfoCard driver={mockDriver} isConnected={false} />
    );
    const indicator = container.querySelector('.absolute.rounded-full.border-2');
    expect(indicator).toHaveClass('bg-wl-neutral-600');
  });
});
