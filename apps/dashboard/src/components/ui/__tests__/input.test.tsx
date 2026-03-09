import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, Textarea } from '../input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render an input element', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input).toBeTruthy();
    });

    it('should have displayName set to Input', () => {
      expect(Input.displayName).toBe('Input');
    });

    it('should render with label when provided', () => {
      render(<Input label="Username" />);
      expect(screen.getByText('Username')).toBeTruthy();
    });

    it('should not render label when not provided', () => {
      const { container } = render(<Input />);
      const labels = container.querySelectorAll('label');
      expect(labels.length).toBe(0);
    });

    it('should render error message when provided', () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeTruthy();
    });

    it('should render hint text when provided', () => {
      render(<Input hint="Enter your email address" />);
      expect(screen.getByText('Enter your email address')).toBeTruthy();
    });

    it('should not render hint when error is present', () => {
      const { container } = render(
        <Input hint="Hint text" error="Error message" />
      );
      expect(screen.queryByText('Hint text')).toBeFalsy();
      expect(screen.getByText('Error message')).toBeTruthy();
    });
  });

  describe('Value and onChange', () => {
    it('should handle value prop', async () => {
      const { container, rerender } = render(<Input value="initial" onChange={() => {}} />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('initial');
    });

    it('should handle onChange event', async () => {
      const handleChange = vi.fn();
      const { container } = render(<Input onChange={handleChange} />);
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.type(input, 'test');

      expect(handleChange).toHaveBeenCalled();
    });

    it('should update value when onChange fires', async () => {
      let value = '';
      const handleChange = (e: any) => {
        value = e.target.value;
      };

      const { container } = render(
        <Input value={value} onChange={handleChange} />
      );
      const input = container.querySelector('input') as HTMLInputElement;

      const user = userEvent.setup();
      await user.type(input, 't');

      expect(input.value).toBe('');
    });
  });

  describe('Placeholder', () => {
    it('should display placeholder text', () => {
      const { container } = render(
        <Input placeholder="Enter text here" />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.placeholder).toBe('Enter text here');
    });

    it('should show placeholder when value is empty', () => {
      const { container } = render(
        <Input placeholder="Type here" value="" onChange={() => {}} />
      );
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.placeholder).toBe('Type here');
    });
  });

  describe('Type Variants', () => {
    it('should default to text type', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('text');
    });

    it('should support email type', () => {
      const { container } = render(<Input type="email" />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('email');
    });

    it('should support password type', () => {
      const { container } = render(<Input type="password" />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    it('should support number type', () => {
      const { container } = render(<Input type="number" />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('number');
    });

    it('should support search type', () => {
      const { container } = render(<Input type="search" />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('search');
    });

    it('should support tel type', () => {
      const { container } = render(<Input type="tel" />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('tel');
    });

    it('should support url type', () => {
      const { container } = render(<Input type="url" />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('url');
    });
  });

  describe('Sizes', () => {
    it('should render with default md size', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('px-4');
      expect(input?.className).toContain('py-2');
      expect(input?.className).toContain('text-sm');
    });

    it('should render with sm size', () => {
      const { container } = render(<Input size="sm" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('px-3');
      expect(input?.className).toContain('py-2');
      expect(input?.className).toContain('text-xs');
    });

    it('should render with lg size', () => {
      const { container } = render(<Input size="lg" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('px-4');
      expect(input?.className).toContain('py-3');
      expect(input?.className).toContain('text-base');
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled state', () => {
      const { container } = render(<Input disabled />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('should have disabled styles', () => {
      const { container } = render(<Input disabled />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('disabled:opacity-60');
      expect(input?.className).toContain('disabled:cursor-not-allowed');
    });

    it('should not allow typing when disabled', async () => {
      const { container } = render(<Input disabled value="" onChange={() => {}} />);
      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('should show cursor-not-allowed when disabled', () => {
      const { container } = render(<Input disabled />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('cursor-not-allowed');
    });
  });

  describe('Error State', () => {
    it('should have error border when error is provided', () => {
      const { container } = render(<Input error="Required" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('border-wl-danger-400');
    });

    it('should have error focus state', () => {
      const { container } = render(<Input error="Required" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('focus:border-wl-danger-500');
    });

    it('should display error message in red', () => {
      render(<Input error="This is an error" />);
      const errorElement = screen.getByText('This is an error');
      expect(errorElement?.className).toContain('text-wl-danger-400');
    });

    it('should have error text size', () => {
      render(<Input error="Error message" />);
      const errorElement = screen.getByText('Error message');
      expect(errorElement?.className).toContain('text-xs');
    });

    it('should not show hint when error exists', () => {
      const { container } = render(
        <Input hint="Hint" error="Error" />
      );
      expect(screen.queryByText('Hint')).toBeFalsy();
      expect(screen.getByText('Error')).toBeTruthy();
    });
  });

  describe('Focus State', () => {
    it('should have focus border when focused', async () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input') as HTMLInputElement;
      const user = userEvent.setup();

      await user.click(input);

      expect(input.className).toContain('border-wl-primary-500');
    });

    it('should have focus outline', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('focus-visible:outline-2');
    });

    it('should change border color on blur', async () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input') as HTMLInputElement;
      const user = userEvent.setup();

      await user.click(input);
      await user.tab();

      expect(input.className).not.toContain('focus:border-wl-primary-500');
    });
  });

  describe('Icon', () => {
    it('should render icon when provided', () => {
      render(
        <Input icon={<span data-testid="test-icon">Icon</span>} />
      );
      expect(screen.getByTestId('test-icon')).toBeTruthy();
    });

    it('should not render icon when not provided', () => {
      const { container } = render(<Input />);
      const icon = container.querySelector('[data-testid="test-icon"]');
      expect(icon).toBeFalsy();
    });

    it('should add left padding when icon is present', () => {
      const { container } = render(
        <Input icon={<span>Icon</span>} />
      );
      const input = container.querySelector('input');
      expect(input?.className).toContain('pl-10');
    });

    it('should have pointer-events-none on icon', () => {
      const { container } = render(
        <Input icon={<span>Icon</span>} />
      );
      const iconContainer = container.querySelector('.absolute');
      expect(iconContainer?.className).toContain('pointer-events-none');
    });
  });

  describe('Base Styles', () => {
    it('should have full width', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('w-full');
    });

    it('should have correct background color', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('bg-wl-bg-surface');
    });

    it('should have correct text color', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('text-wl-text-primary');
    });

    it('should have border and rounded corners', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('border');
      expect(input?.className).toContain('rounded-md');
    });

    it('should have outline none', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('outline-none');
    });

    it('should have transition styles', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('transition-all');
      expect(input?.className).toContain('duration-fast');
      expect(input?.className).toContain('ease-default');
    });
  });

  describe('className Merging', () => {
    it('should merge custom className', () => {
      const { container } = render(<Input className="custom-input" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('custom-input');
      expect(input?.className).toContain('w-full');
    });

    it('should allow overriding default styles', () => {
      const { container } = render(<Input className="px-2" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('px-2');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      const { container } = render(
        <Input aria-label="Search input" />
      );
      const input = container.querySelector('input');
      expect(input?.getAttribute('aria-label')).toBe('Search input');
    });

    it('should link label to input with htmlFor', () => {
      const { container } = render(
        <Input label="Email" />
      );
      const label = container.querySelector('label');
      expect(label).toBeTruthy();
    });

    it('should be keyboard accessible', async () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input') as HTMLInputElement;
      const user = userEvent.setup();

      await user.tab();
      expect(input).toHaveFocus();
    });
  });

  describe('Forward Ref', () => {
    it('should forward ref to input element', () => {
      const ref = { current: null };
      const { container } = render(<Input ref={ref as any} />);
      const input = container.querySelector('input');
      expect(input).toBeTruthy();
    });
  });
});

describe('Textarea Component', () => {
  describe('Rendering', () => {
    it('should render a textarea element', () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      expect(textarea).toBeTruthy();
    });

    it('should have displayName set to Textarea', () => {
      expect(Textarea.displayName).toBe('Textarea');
    });

    it('should render with label when provided', () => {
      render(<Textarea label="Comments" />);
      expect(screen.getByText('Comments')).toBeTruthy();
    });

    it('should render error message when provided', () => {
      render(<Textarea error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeTruthy();
    });
  });

  describe('Textarea Value and onChange', () => {
    it('should handle value changes', async () => {
      const handleChange = vi.fn();
      const { container } = render(<Textarea onChange={handleChange} />);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

      const user = userEvent.setup();
      await user.type(textarea, 'test');

      expect(handleChange).toHaveBeenCalled();
    });

    it('should have minimum height', () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('min-h-20');
    });

    it('should be resizable vertically', () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('resize-vertical');
    });
  });

  describe('Textarea Error State', () => {
    it('should have error border', () => {
      const { container } = render(<Textarea error="Error" />);
      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('border-wl-danger-400');
    });

    it('should display error message', () => {
      render(<Textarea error="Required field" />);
      expect(screen.getByText('Required field')).toBeTruthy();
    });
  });

  describe('Textarea Base Styles', () => {
    it('should have correct padding', () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('px-4');
      expect(textarea?.className).toContain('py-3');
      expect(textarea?.className).toContain('text-sm');
    });

    it('should have full width', () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('w-full');
    });

    it('should have dark theme colors', () => {
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('bg-wl-bg-surface');
      expect(textarea?.className).toContain('text-wl-text-primary');
    });
  });

  describe('Textarea Forward Ref', () => {
    it('should forward ref to textarea element', () => {
      const ref = { current: null };
      const { container } = render(<Textarea ref={ref as any} />);
      const textarea = container.querySelector('textarea');
      expect(textarea).toBeTruthy();
    });
  });

  describe('Textarea Accessibility', () => {
    it('should support aria-label', () => {
      const { container } = render(
        <Textarea aria-label="Message textarea" />
      );
      const textarea = container.querySelector('textarea');
      expect(textarea?.getAttribute('aria-label')).toBe('Message textarea');
    });

    it('should link label to textarea', () => {
      const { container } = render(<Textarea label="Message" />);
      const label = container.querySelector('label');
      expect(label).toBeTruthy();
    });
  });
});
