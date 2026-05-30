import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '../page';

// Mock the API and auth hooks
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
          addressLine1: '123 Main St',
          addressLine2: null,
          city: 'San Francisco',
          province: 'CA',
          postalCode: '94105',
          country: 'USA',
          totalPrice: 49.99,
          trackingToken: null,
          driver: null,
          timeSlot: null,
          proofOfDelivery: null,
          lineItems: [],
        },
      ],
      pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com', role: 'ADMIN', shopId: 'shop-1' },
    token: 'test-token',
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return { ...actual };
});

describe('DashboardPage', () => {
  it('renders greeting with user name', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/welcome back, john/i)).toBeInTheDocument();
  });

  it('renders overview subtitle', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/overview of your deliveries/i)).toBeInTheDocument();
  });

  it('shows 4 stat card labels', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    // "Delivered" appears as stat label
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Active Deliveries" section heading', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Active Deliveries')).toBeInTheDocument();
  });

  it('shows "Recent Orders" section heading', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Recent Orders')).toBeInTheDocument();
  });

  it('shows quick action links', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Track a Delivery')).toBeInTheDocument();
    expect(screen.getByText('View All Orders')).toBeInTheDocument();
    expect(screen.getByText('Get Support')).toBeInTheDocument();
  });

  it('"View all" link points to /orders', () => {
    render(<DashboardPage />);
    const viewAllLinks = screen.getAllByText('View all');
    expect(viewAllLinks[0].closest('a')).toHaveAttribute('href', '/orders');
  });

  it('renders order number from API', () => {
    render(<DashboardPage />);
    // Order number may appear in multiple places (active + recent sections)
    expect(screen.getAllByText('ORD-2024-001').length).toBeGreaterThanOrEqual(1);
  });
});
