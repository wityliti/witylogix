import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TrackPage from '../track/page';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return { ...actual };
});

describe('TrackPage', () => {
  it('renders page title "Track Delivery"', () => {
    render(<TrackPage />);
    expect(screen.getByText('Track Delivery')).toBeInTheDocument();
  });

  it('renders page subtitle about tracking token', () => {
    render(<TrackPage />);
    expect(screen.getByText(/enter your tracking token/i)).toBeInTheDocument();
  });

  it('shows tracking token input', () => {
    render(<TrackPage />);
    expect(screen.getByPlaceholderText('Enter tracking token…')).toBeInTheDocument();
  });

  it('shows "Track My Delivery" submit button', () => {
    render(<TrackPage />);
    expect(screen.getByText('Track My Delivery')).toBeInTheDocument();
  });

  it('shows helper tips section', () => {
    render(<TrackPage />);
    expect(screen.getByText('Where is my token?')).toBeInTheDocument();
  });

  it('shows error when submitting empty form', async () => {
    const user = userEvent.setup();
    render(<TrackPage />);

    const submitButton = screen.getByText('Track My Delivery');
    await user.click(submitButton);

    expect(screen.getByText('Please enter a tracking token or order number.')).toBeInTheDocument();
  });

  it('navigates to track/[token] when token is entered', async () => {
    const mockPush = vi.fn();
    const { useRouter } = await import('next/navigation');
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      prefetch: vi.fn(),
    });

    const user = userEvent.setup();
    render(<TrackPage />);

    const input = screen.getByPlaceholderText('Enter tracking token…');
    await user.type(input, 'my-tracking-token');

    const submitButton = screen.getByText('Track My Delivery');
    await user.click(submitButton);

    expect(mockPush).toHaveBeenCalledWith('/track/my-tracking-token');
  });
});
