import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import OrdersPage from '../orders/page';

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return { ...actual };
});

describe('OrdersPage', () => {
  it('renders page title "Orders"', () => {
    render(<OrdersPage />);
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('renders page subtitle', () => {
    render(<OrdersPage />);
    expect(screen.getByText('Manage and track all your deliveries')).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<OrdersPage />);
    expect(
      screen.getByPlaceholderText('Search by order number, address, or item...')
    ).toBeInTheDocument();
  });

  it('shows filter buttons for all statuses', () => {
    render(<OrdersPage />);
    // Filter buttons are <button> elements
    const filterButtons = screen.getAllByRole('button');
    const filterLabels = filterButtons.map((btn) => btn.textContent?.trim());

    expect(filterLabels).toContain('All Orders');
    expect(filterLabels).toContain('Pending');
    expect(filterLabels).toContain('Confirmed');
    expect(filterLabels).toContain('Out for Delivery');
    expect(filterLabels).toContain('Delivered');
    expect(filterLabels).toContain('Cancelled');
  });

  it('shows result count for all orders', () => {
    render(<OrdersPage />);
    // "Showing 5 of 5 orders" - the count spans contain "5"
    const countText = screen.getByText(/Showing/);
    expect(countText).toHaveTextContent('Showing 5 of 5 orders');
  });

  it('filters orders when a status filter is clicked', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    // Click "Pending" filter button (the one inside the filter pill area)
    const pendingButtons = screen.getAllByText('Pending');
    // The filter button is the <button> element
    const filterButton = pendingButtons.find((el) => el.tagName === 'BUTTON')!;
    await user.click(filterButton);

    // Should show only the pending order (ORD-2024-004)
    expect(screen.getByText('ORD-2024-004')).toBeInTheDocument();
    expect(screen.queryByText('ORD-2024-001')).not.toBeInTheDocument();
    expect(screen.queryByText('ORD-2024-002')).not.toBeInTheDocument();
    expect(screen.queryByText('ORD-2024-003')).not.toBeInTheDocument();
  });

  it('search filters by order number', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(
      'Search by order number, address, or item...'
    );
    await user.type(searchInput, 'ORD-2024-003');

    expect(screen.getByText('ORD-2024-003')).toBeInTheDocument();
    expect(screen.queryByText('ORD-2024-001')).not.toBeInTheDocument();
  });

  it('shows empty state when no matches', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(
      'Search by order number, address, or item...'
    );
    await user.type(searchInput, 'NONEXISTENT-ORDER');

    expect(
      screen.getByText('No orders found matching your criteria')
    ).toBeInTheDocument();
  });

  it('shows "Clear filters" button in empty state', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(
      'Search by order number, address, or item...'
    );
    await user.type(searchInput, 'NONEXISTENT-ORDER');

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('clear filters works and restores all orders', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText(
      'Search by order number, address, or item...'
    );
    await user.type(searchInput, 'NONEXISTENT-ORDER');

    expect(
      screen.getByText('No orders found matching your criteria')
    ).toBeInTheDocument();

    await user.click(screen.getByText('Clear filters'));

    // All orders should be visible again
    expect(screen.getByText('ORD-2024-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-2024-002')).toBeInTheDocument();
    expect(screen.getByText('ORD-2024-003')).toBeInTheDocument();
    expect(screen.getByText('ORD-2024-004')).toBeInTheDocument();
    expect(screen.getByText('ORD-2024-005')).toBeInTheDocument();
  });

  it('shows sort dropdown with Newest First and Oldest First', () => {
    render(<OrdersPage />);
    expect(screen.getByText('Newest First')).toBeInTheDocument();
    expect(screen.getByText('Oldest First')).toBeInTheDocument();
  });
});
