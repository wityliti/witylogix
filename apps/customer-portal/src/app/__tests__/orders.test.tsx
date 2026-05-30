import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import OrdersPage from '../orders/page';

// Note: vi.mock is hoisted — keep mock data inline inside the factory
vi.mock('@/lib/use-api', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: {
      data: [
        {
          id: 'order-1',
          externalOrderNumber: 'ORD-2024-001',
          status: 'OUT_FOR_DELIVERY',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          deliveryDate: new Date().toISOString(),
          estimatedArrival: null,
          actualDelivery: null,
          customerName: 'John Doe',
          customerEmail: null,
          customerPhone: null,
          addressLine1: '123 Main St',
          addressLine2: null,
          city: 'San Francisco',
          province: 'CA',
          postalCode: '94105',
          country: 'USA',
          totalPrice: 149.99,
          trackingToken: 'token-1',
          driver: null,
          timeSlot: null,
          proofOfDelivery: null,
          lineItems: [{ id: '1', title: 'Premium Headphones', quantity: 1, price: 149.99 }],
        },
        {
          id: 'order-2',
          externalOrderNumber: 'ORD-2024-002',
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          deliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedArrival: null,
          actualDelivery: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          customerName: 'John Doe',
          customerEmail: null,
          customerPhone: null,
          addressLine1: '456 Oak Ave',
          addressLine2: null,
          city: 'New York',
          province: 'NY',
          postalCode: '10001',
          country: 'USA',
          totalPrice: 49.99,
          trackingToken: null,
          driver: null,
          timeSlot: null,
          proofOfDelivery: null,
          lineItems: [{ id: '2', title: 'Phone Case', quantity: 1, price: 19.99 }],
        },
      ],
      pagination: { total: 2, page: 1, limit: 50, totalPages: 1 },
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    loading: false,
    error: null,
    success: false,
    reset: vi.fn(),
  }),
}));

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return { ...actual };
});

describe('OrdersPage', () => {
  it('renders page title "My Orders"', () => {
    render(<OrdersPage />);
    expect(screen.getByText('My Orders')).toBeInTheDocument();
  });

  it('shows total order count in subtitle', () => {
    render(<OrdersPage />);
    expect(screen.getByText(/2 orders total/i)).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<OrdersPage />);
    expect(
      screen.getByPlaceholderText('Search by order number, item, or city…'),
    ).toBeInTheDocument();
  });

  it('shows filter buttons for all statuses', () => {
    render(<OrdersPage />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows order numbers from API data', () => {
    render(<OrdersPage />);
    expect(screen.getByText('ORD-2024-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-2024-002')).toBeInTheDocument();
  });

  it('filters orders when active filter is clicked', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    const activeButton = screen.getByRole('button', { name: 'Active' });
    await user.click(activeButton);

    // Only active orders should show
    expect(screen.getByText('ORD-2024-001')).toBeInTheDocument();
    expect(screen.queryByText('ORD-2024-002')).not.toBeInTheDocument();
  });

  it('search filters by order number', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText('Search by order number, item, or city…');
    await user.type(searchInput, '001');

    expect(screen.getByText('ORD-2024-001')).toBeInTheDocument();
    expect(screen.queryByText('ORD-2024-002')).not.toBeInTheDocument();
  });

  it('shows empty state when search has no matches', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);

    const searchInput = screen.getByPlaceholderText('Search by order number, item, or city…');
    await user.type(searchInput, 'ZZZNOTFOUND999');

    expect(screen.getByText('No orders found')).toBeInTheDocument();
  });
});
