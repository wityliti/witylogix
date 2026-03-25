import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DeliveryTimeline } from '../delivery-timeline';
import type { DeliveryTimestep } from '@/types';

const completedSteps: DeliveryTimestep[] = [
  {
    step: 'ordered',
    status: 'completed',
    timestamp: new Date('2024-06-01T10:00:00'),
    details: 'Order placed successfully',
  },
  {
    step: 'confirmed',
    status: 'completed',
    timestamp: new Date('2024-06-01T10:15:00'),
    details: 'Warehouse confirmed',
  },
  {
    step: 'out-for-delivery',
    status: 'pending',
  },
  {
    step: 'delivered',
    status: 'pending',
  },
];

describe('DeliveryTimeline', () => {
  it('renders all step labels', () => {
    render(<DeliveryTimeline steps={completedSteps} />);

    expect(screen.getByText('Order Placed')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Out for Delivery')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('completed steps have success background marker', () => {
    const { container } = render(<DeliveryTimeline steps={completedSteps} />);

    const markers = container.querySelectorAll('.rounded-full.flex.items-center');
    // First two are completed
    expect(markers[0]).toHaveClass('bg-wl-success-500');
    expect(markers[1]).toHaveClass('bg-wl-success-500');
  });

  it('pending steps have neutral background marker', () => {
    const { container } = render(<DeliveryTimeline steps={completedSteps} />);

    const markers = container.querySelectorAll('.rounded-full.flex.items-center');
    // Last two are pending
    expect(markers[2]).toHaveClass('bg-wl-neutral-800');
    expect(markers[3]).toHaveClass('bg-wl-neutral-800');
  });

  it('shows timestamps for completed steps', () => {
    render(<DeliveryTimeline steps={completedSteps} />);

    expect(screen.getByText('Jun 1, 10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Jun 1, 10:15 AM')).toBeInTheDocument();
  });

  it('does not show timestamps for pending steps', () => {
    render(<DeliveryTimeline steps={completedSteps} />);

    // Only 2 timestamps should exist (for the completed steps)
    const timestamps = screen.getAllByText(/Jun 1,/);
    expect(timestamps).toHaveLength(2);
  });

  it('shows details text for steps that have it', () => {
    render(<DeliveryTimeline steps={completedSteps} />);

    expect(screen.getByText('Order placed successfully')).toBeInTheDocument();
    expect(screen.getByText('Warehouse confirmed')).toBeInTheDocument();
  });

  it('renders connecting lines between steps but not after last', () => {
    const { container } = render(<DeliveryTimeline steps={completedSteps} />);

    // There should be 3 connector lines (between 4 steps)
    const connectors = container.querySelectorAll('.w-px.flex-1');
    expect(connectors).toHaveLength(3);
  });

  it('completed step labels have primary text color', () => {
    render(<DeliveryTimeline steps={completedSteps} />);

    const orderedLabel = screen.getByText('Order Placed');
    expect(orderedLabel).toHaveClass('text-wl-text-primary');
  });

  it('pending step labels have tertiary text color', () => {
    render(<DeliveryTimeline steps={completedSteps} />);

    const deliveredLabel = screen.getByText('Delivered');
    expect(deliveredLabel).toHaveClass('text-wl-text-tertiary');
  });
});
