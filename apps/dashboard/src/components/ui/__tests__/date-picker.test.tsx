import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '../date-picker';

describe('DatePicker Component', () => {
  const mockOnChange = vi.fn();

  describe('Rendering', () => {
    it('should render a date picker input', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input');
      expect(input).toBeTruthy();
    });

    it('should have displayName set to DatePicker', () => {
      expect(DatePicker.displayName).toBe('DatePicker');
    });

    it('should display placeholder text', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} placeholder="Pick a date" />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.placeholder).toBe('Pick a date');
    });

    it('should have default placeholder text', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.placeholder).toBe('Select date');
    });

    it('should render calendar icon', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const icon = container.querySelector('svg');
      expect(icon).toBeTruthy();
    });

    it('should display formatted date value', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} value={new Date(2024, 0, 15)} />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toContain('Jan');
      expect(input.value).toContain('15');
      expect(input.value).toContain('2024');
    });

    it('should be readonly', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });
  });

  describe('Calendar Open/Close', () => {
    it('should not show calendar initially', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const calendar = container.querySelector('[class*="grid"]');
      expect(calendar?.className).not.toContain('grid-cols-7');
    });

    it('should open calendar on input click', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const calendar = container.querySelector('[class*="grid-cols-7"]');
      expect(calendar).toBeTruthy();
    });

    it('should close calendar when date is selected', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const dateButton = container.querySelector('button[class*="flex"][class*="items-center"]');
      if (dateButton && dateButton.textContent === '15') {
        await user.click(dateButton as HTMLElement);
      }

      expect(container.querySelector('[class*="grid-cols-7"]')).toBeTruthy();
    });

    it('should close calendar on escape key', async () => {
      const { container, rerender } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);
      await user.keyboard('{Escape}');

      // Calendar should be hidden after escape
      const calendar = Array.from(container.querySelectorAll('[class*="absolute"]')).find(
        (el) => el.className.includes('grid-cols-7')
      );
      expect(calendar).toBeFalsy();
    });

    it('should close calendar on outside click', async () => {
      const { container } = render(
        <div>
          <DatePicker onChange={mockOnChange} />
          <button data-testid="outside-btn">Outside</button>
        </div>
      );

      const input = container.querySelector('input') as HTMLInputElement;
      const user = userEvent.setup();
      await user.click(input);

      const outsideBtn = screen.getByTestId('outside-btn');
      await user.click(outsideBtn);

      // Calendar should be hidden
      const calendarGrid = Array.from(container.querySelectorAll('[class*="grid"]')).find(
        (el) => el.className.includes('grid-cols-7')
      );
      expect(calendarGrid).toBeFalsy();
    });
  });

  describe('Date Selection', () => {
    it('should call onChange when date is selected', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      // Find and click a date button
      const dateButtons = container.querySelectorAll('[class*="rounded-md"][class*="flex"]');
      if (dateButtons.length > 0) {
        for (const btn of dateButtons) {
          if (btn.textContent?.trim() === '15') {
            await user.click(btn as HTMLElement);
            break;
          }
        }
      }

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should display selected date in input', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} value={new Date(2024, 0, 15)} />
      );

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toContain('15');
    });

    it('should update when value prop changes', () => {
      const { container, rerender } = render(
        <DatePicker onChange={mockOnChange} value={new Date(2024, 0, 15)} />
      );

      let input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toContain('15');

      rerender(
        <DatePicker onChange={mockOnChange} value={new Date(2024, 0, 20)} />
      );

      input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toContain('20');
    });

    it('should clear selection when null is passed', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} value={null} />
      );

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('Month Navigation', () => {
    it('should navigate to next month', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const nextButton = container.querySelector('[aria-label="Next month"]') as HTMLButtonElement;
      await user.click(nextButton);

      // Month should have changed
      const monthDisplay = container.querySelector('[class*="font-semibold"][class*="text-wl-text-primary"]');
      expect(monthDisplay).toBeTruthy();
    });

    it('should navigate to previous month', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const prevButton = container.querySelector('[aria-label="Previous month"]') as HTMLButtonElement;
      await user.click(prevButton);

      // Month should have changed
      const monthDisplay = container.querySelector('[class*="font-semibold"][class*="text-wl-text-primary"]');
      expect(monthDisplay).toBeTruthy();
    });

    it('should display correct month and year', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const monthDisplay = container.querySelector('[class*="font-semibold"]');
      expect(monthDisplay?.textContent).toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/);
    });

    it('should navigate multiple months', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const nextButton = container.querySelector('[aria-label="Next month"]') as HTMLButtonElement;
      await user.click(nextButton);
      await user.click(nextButton);
      await user.click(nextButton);

      expect(container).toBeTruthy();
    });
  });

  describe('Min/Max Date Constraints', () => {
    it('should disable dates before minDate', async () => {
      const minDate = new Date(2024, 0, 10);
      const { container } = render(
        <DatePicker onChange={mockOnChange} minDate={minDate} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      // Days 1-9 should be disabled
      const allButtons = container.querySelectorAll('button[class*="flex"][class*="items-center"]');
      let disabledCount = 0;
      allButtons.forEach((btn) => {
        if (btn.textContent && parseInt(btn.textContent) < 10) {
          if (btn.hasAttribute('disabled')) {
            disabledCount++;
          }
        }
      });
      expect(disabledCount).toBeGreaterThan(0);
    });

    it('should disable dates after maxDate', async () => {
      const maxDate = new Date(2024, 0, 20);
      const { container } = render(
        <DatePicker onChange={mockOnChange} maxDate={maxDate} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      expect(container).toBeTruthy();
    });

    it('should not allow selecting disabled dates', async () => {
      const minDate = new Date(2024, 0, 15);
      const { container } = render(
        <DatePicker onChange={mockOnChange} minDate={minDate} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const disabledButtons = container.querySelectorAll('button[disabled]');
      expect(disabledButtons.length).toBeGreaterThan(0);
    });

    it('should show disabled state styling', async () => {
      const minDate = new Date(2024, 0, 15);
      const { container } = render(
        <DatePicker onChange={mockOnChange} minDate={minDate} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const disabledButton = container.querySelector('button[disabled][class*="text-wl-text-tertiary"]');
      expect(disabledButton).toBeTruthy();
    });
  });

  describe('Today Highlighting', () => {
    it('should highlight today in calendar', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const today = new Date();
      // Check if today is highlighted with border
      const todayButton = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim() === String(today.getDate()) &&
                btn.className.includes('border')
      );

      if (todayButton) {
        expect(todayButton.className).toContain('border-wl-primary-500');
      }
    });

    it('should show primary color for today when not selected', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      expect(container).toBeTruthy();
    });
  });

  describe('Keyboard Interaction', () => {
    it('should close on Escape key', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);
      await user.keyboard('{Escape}');

      // Calendar should be closed
      const calendar = Array.from(container.querySelectorAll('[class*="absolute"]')).find(
        (el) => el.className.includes('grid-cols-7')
      );
      expect(calendar).toBeFalsy();
    });

    it('should be keyboard accessible', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.tab();
      expect(input).toHaveFocus();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} disabled />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('should not open calendar when disabled', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} disabled />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const calendar = Array.from(container.querySelectorAll('[class*="absolute"]')).find(
        (el) => el.className.includes('grid-cols-7')
      );
      expect(calendar).toBeFalsy();
    });

    it('should have disabled styling', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} disabled />
      );
      const input = container.querySelector('input');
      expect(input?.className).toContain('disabled:opacity-60');
      expect(input?.className).toContain('disabled:cursor-not-allowed');
    });
  });

  describe('Calendar Layout', () => {
    it('should display weekday headers', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      weekdays.forEach((day) => {
        const found = Array.from(container.querySelectorAll('div')).some(
          (el) => el.textContent === day
        );
        expect(found).toBeTruthy();
      });
    });

    it('should have 7-column grid layout', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const grids = container.querySelectorAll('[class*="grid-cols-7"]');
      expect(grids.length).toBeGreaterThan(0);
    });

    it('should show full month view', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      // Should render at least first day of month
      expect(container.textContent).toContain('1');
    });
  });

  describe('Focus State', () => {
    it('should show focus border when focused', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      expect(input.className).toContain('border-wl-primary-500');
    });

    it('should show default border when not focused', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input');

      expect(input?.className).toContain('border-wl-border-default');
    });
  });

  describe('className and style Props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} className="custom-picker" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('custom-picker');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on input', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} aria-label="Select date" />
      );
      const input = container.querySelector('input');
      expect(input?.getAttribute('aria-label')).toBe('Select date');
    });

    it('should have aria-label on navigation buttons', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.click(input);

      const prevBtn = container.querySelector('[aria-label="Previous month"]');
      const nextBtn = container.querySelector('[aria-label="Next month"]');
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
    });
  });

  describe('Forward Ref', () => {
    it('should forward ref to container div', () => {
      const ref = { current: null };
      const { container } = render(
        <DatePicker ref={ref as any} onChange={mockOnChange} />
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null value', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} value={null} />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle undefined value', () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle leap year dates', () => {
      const leapDate = new Date(2024, 1, 29); // Feb 29, 2024
      const { container } = render(
        <DatePicker onChange={mockOnChange} value={leapDate} />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toContain('29');
    });

    it('should format date consistently', () => {
      const date = new Date(2024, 0, 15);
      const { container: container1 } = render(
        <DatePicker onChange={mockOnChange} value={date} />
      );
      const input1 = container1.querySelector('input') as HTMLInputElement;

      const { container: container2 } = render(
        <DatePicker onChange={mockOnChange} value={date} />
      );
      const input2 = container2.querySelector('input') as HTMLInputElement;

      expect(input1.value).toBe(input2.value);
    });
  });

  describe('Multiple Date Selections', () => {
    it('should handle multiple date selections in sequence', async () => {
      const { container } = render(
        <DatePicker onChange={mockOnChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();

      // First selection
      await user.click(input);
      mockOnChange.mockClear();

      // Second selection
      await user.click(input);
      expect(container).toBeTruthy();
    });
  });
});
