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

  it('renders "Good afternoon" subtitle', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Good afternoon')).toBeInTheDocument();
  });

  it('shows 3 stat cards (Active, Delivered, Total Spent)', () => {
    render(<DashboardPage />);
    const statCards = document.querySelectorAll('.stat-card');
    expect(statCards).toHaveLength(3);

    expect(screen.getByText('Active')).toBeInTheDocument();
    // "Delivered" appears as stat label and as status badges on order cards
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Spent')).toBeInTheDocument();
  });

  it('shows numeric stat values', () => {
    render(<DashboardPage />);

    // Active count: 2 upcoming deliveries
    const statCards = document.querySelectorAll('.stat-card');
    const activeCard = statCards[0];
    const activeValue = activeCard.querySelector('.value');
    expect(activeValue).toHaveTextContent('2');

    // Total Spent should be a dollar amount
    // 149.99 + 119.96 + 19.99 + 129.98 = 419.92
    const totalSpentCard = statCards[2];
    const totalSpentValue = totalSpentCard.querySelector('.value');
    expect(totalSpentValue).toHaveTextContent('$419.92');
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

  it('"View all" link points to /orders', () => {
    render(<DashboardPage />);
    const viewAllLink = screen.getByText('View all');
    expect(viewAllLink.closest('a')).toHaveAttribute('href', '/orders');
  });

  it('stat values for Delivered count are numeric', () => {
    render(<DashboardPage />);

    // 2 delivered orders in recentOrders
    const statCards = document.querySelectorAll('.stat-card');
    const deliveredCard = Array.from(statCards).find(
      (card) => card.textContent?.includes('Delivered')
    );
    expect(deliveredCard).toBeDefined();
    // The value element should contain a number
    const valueEl = deliveredCard!.querySelector('.value');
    expect(valueEl).toBeDefined();
    expect(Number(valueEl!.textContent)).not.toBeNaN();
  });
});
