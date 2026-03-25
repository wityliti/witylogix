import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PreferencesPage from '../preferences/page';

describe('PreferencesPage', () => {
  it('renders page title "Delivery Preferences"', () => {
    render(<PreferencesPage />);
    expect(screen.getByText('Delivery Preferences')).toBeInTheDocument();
  });

  it('renders page subtitle', () => {
    render(<PreferencesPage />);
    expect(
      screen.getByText('Customize how you want to receive your deliveries')
    ).toBeInTheDocument();
  });

  it('shows safe place instruction buttons', () => {
    render(<PreferencesPage />);
    expect(screen.getByText('Front Door')).toBeInTheDocument();
    expect(screen.getByText('Back Door')).toBeInTheDocument();
    expect(screen.getByText('Garage')).toBeInTheDocument();
    expect(screen.getByText('Leave with Neighbor')).toBeInTheDocument();
  });

  it('shows "Where should we leave your package?" prompt', () => {
    render(<PreferencesPage />);
    expect(
      screen.getByText('Where should we leave your package?')
    ).toBeInTheDocument();
  });

  it('shows notification channel toggles', () => {
    render(<PreferencesPage />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('shows access code section with inputs', () => {
    render(<PreferencesPage />);
    expect(screen.getByText('Access Codes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., 1234#')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Apt 4B')).toBeInTheDocument();
  });

  it('shows access code default values', () => {
    render(<PreferencesPage />);
    const gateCodeInput = screen.getByPlaceholderText('e.g., 1234#') as HTMLInputElement;
    const buildingInput = screen.getByPlaceholderText('e.g., Apt 4B') as HTMLInputElement;
    expect(gateCodeInput.value).toBe('1234');
    expect(buildingInput.value).toBe('Apt 4B');
  });

  it('shows delivery time section with day labels', () => {
    render(<PreferencesPage />);
    expect(screen.getByText('Preferred Delivery Times')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
    expect(screen.getByText('Wednesday')).toBeInTheDocument();
    expect(screen.getByText('Thursday')).toBeInTheDocument();
    expect(screen.getByText('Friday')).toBeInTheDocument();
  });

  it('shows time inputs for delivery windows', () => {
    render(<PreferencesPage />);
    const timeInputs = document.querySelectorAll('input[type="time"]');
    // 7 days x 2 inputs (start + end) = 14
    expect(timeInputs.length).toBe(14);
  });

  it('shows save button with "Save Preferences" text', () => {
    render(<PreferencesPage />);
    expect(
      screen.getByRole('button', { name: /Save Preferences/i })
    ).toBeInTheDocument();
  });

  it('save button triggers save flow and shows success message', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    render(<PreferencesPage />);

    const saveButton = screen.getByRole('button', { name: /Save Preferences/i });
    await user.click(saveButton);

    // Button should change to "Saving..."
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    // Advance past the 1000ms simulated API call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // Success message should appear
    expect(screen.getByText('Preferences saved successfully!')).toBeInTheDocument();

    // Advance past the 3000ms auto-dismiss
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    // Success message should disappear
    expect(screen.queryByText('Preferences saved successfully!')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows default address section', () => {
    render(<PreferencesPage />);
    expect(screen.getByText('Default Address')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, Apt 4B')).toBeInTheDocument();
    expect(screen.getByText('San Francisco')).toBeInTheDocument();
    expect(screen.getByText('CA')).toBeInTheDocument();
    expect(screen.getByText('94105')).toBeInTheDocument();
  });

  it('clicking a different safe place option updates selection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    render(<PreferencesPage />);

    const garageButton = screen.getByText('Garage');
    await user.click(garageButton);

    // After clicking Garage, it should be the selected one
    // The button should have the active styling class
    expect(garageButton.closest('button')).toHaveClass('bg-wl-bg-elevated');

    vi.useRealTimers();
  });
});
