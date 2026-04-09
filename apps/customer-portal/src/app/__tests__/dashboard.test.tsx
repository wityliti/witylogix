import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from '../page';

// Mock date-fns to avoid snapshot instability
vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return {
    ...actual,
    addDays: actual.addDays,
    format: actual.format,
  };
});

describe('DashboardPage', () => {
  it('renders greeting text "Welcome back, John"', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Welcome back, John')).toBeInTheDocument();
  });

  it('renders overview subtitle', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/overview of your deliveries/i)).toBeInTheDocument();
  });

  it('shows 4 stat cards (Total Orders, Active Deliveries, Pending, Delivered)', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('Active Deliveries')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    // "Delivered" appears as stat label and as status badges on order cards
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
  });

  it('shows numeric stat values', () => {
    render(<DashboardPage />);

    // Total Orders: 4 (2 upcoming + 2 recent)
    const statGrid = document.querySelector('.grid.grid-cols-2');
    const statCards = statGrid?.querySelectorAll('.section-card') ?? [];
    const totalOrdersValue = statCards[0]?.querySelector('p.text-3xl');
    expect(totalOrdersValue).toHaveTextContent('4');

    // Active Deliveries: 1 (only out-for-delivery status)
    const activeValue = statCards[1]?.querySelector('p.text-3xl');
    expect(activeValue).toHaveTextContent('1');
  });

  it('shows "Active Deliveries" section heading', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Active Deliveries')).toBeInTheDocument();
  });

  it('shows order cards in Active Deliveries section', () => {
    render(<DashboardPage />);
    expect(screen.getByText('ORD-2024-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-2024-002')).toBeInTheDocument();
  });

  it('shows "Recent Orders" section heading', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Recent Orders')).toBeInTheDocument();
  });

  it('shows recent order cards', () => {
    render(<DashboardPage />);
    expect(screen.getByText('ORD-2024-003')).toBeInTheDocument();
    expect(screen.getByText('ORD-2024-004')).toBeInTheDocument();
  });

  it('"View all" link in Upcoming Deliveries points to /deliveries', () => {
    render(<DashboardPage />);
    const viewAllLink = screen.getByText('View all');
    expect(viewAllLink.closest('a')).toHaveAttribute('href', '/deliveries');
  });

  it('stat values for Delivered count are numeric', () => {
    render(<DashboardPage />);

    // 2 delivered orders in recentOrders
    const statGrid = document.querySelector('.grid.grid-cols-2');
    const statCards = Array.from(statGrid?.querySelectorAll('.section-card') ?? []);
    const deliveredCard = statCards.find(
      (card) => card.textContent?.includes('Delivered')
    );
    expect(deliveredCard).toBeDefined();
    // The value element should contain a number
    const valueEl = deliveredCard!.querySelector('p.text-3xl');
    expect(valueEl).toBeDefined();
    expect(Number(valueEl!.textContent)).not.toBeNaN();
  });
});
