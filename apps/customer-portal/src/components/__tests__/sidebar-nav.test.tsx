import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SidebarNav } from '../sidebar-nav';

// Override usePathname per test
const mockUsePathname = vi.fn(() => '/');
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    usePathname: () => mockUsePathname(),
    useRouter: () => ({
      push: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    }),
    useParams: () => ({ id: '1' }),
    useSearchParams: () => new URLSearchParams(),
  };
});

describe('SidebarNav', () => {
  const navLabels = ['Dashboard', 'Orders', 'Track', 'Preferences', 'Support'];

  it('renders all 5 nav items', () => {
    render(<SidebarNav />);
    for (const label of navLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('highlights the active Dashboard route when pathname is /', () => {
    mockUsePathname.mockReturnValue('/');
    render(<SidebarNav />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveClass('bg-wl-bg-elevated');
    expect(dashboardLink).toHaveClass('font-medium');
  });

  it('highlights the active Orders route when pathname is /orders', () => {
    mockUsePathname.mockReturnValue('/orders');
    render(<SidebarNav />);

    const ordersLink = screen.getByText('Orders').closest('a');
    expect(ordersLink).toHaveClass('bg-wl-bg-elevated');
    expect(ordersLink).toHaveClass('font-medium');

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).not.toHaveClass('font-medium');
  });

  it('highlights Orders for sub-routes like /orders/123', () => {
    mockUsePathname.mockReturnValue('/orders/123');
    render(<SidebarNav />);

    const ordersLink = screen.getByText('Orders').closest('a');
    expect(ordersLink).toHaveClass('font-medium');
  });

  it('renders logo letter W', () => {
    render(<SidebarNav />);
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('renders brand name Witylogix', () => {
    render(<SidebarNav />);
    expect(screen.getByText('Witylogix')).toBeInTheDocument();
  });

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SidebarNav isOpen onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close sidebar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mobile overlay appears when isOpen is true', () => {
    const onClose = vi.fn();
    const { container } = render(<SidebarNav isOpen onClose={onClose} />);

    const overlay = container.querySelector('.fixed.inset-0.bg-black\\/50');
    expect(overlay).toBeInTheDocument();
  });

  it('mobile overlay calls onClose when clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<SidebarNav isOpen onClose={onClose} />);

    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
    await user.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sidebar is hidden when isOpen is false', () => {
    const { container } = render(<SidebarNav isOpen={false} />);

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('-translate-x-full');
  });

  it('renders version text', () => {
    render(<SidebarNav />);
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });
});
