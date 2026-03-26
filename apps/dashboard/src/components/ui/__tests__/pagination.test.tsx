import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../pagination';

describe('Pagination Component', () => {
  const mockOnPageChange = vi.fn();
  const mockOnPageSizeChange = vi.fn();

  describe('Rendering', () => {
    it('should render pagination container', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('should have displayName set to Pagination', () => {
      expect(Pagination.displayName).toBe('Pagination');
    });

    it('should render page size selector by default', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const label = screen.getByText('Show');
      expect(label).toBeTruthy();
    });

    it('should not render page size selector when showPageSizeSelector is false', () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          showPageSizeSelector={false}
        />
      );
      const label = screen.queryByText('Show');
      expect(label).toBeFalsy();
    });
  });

  describe('Page Navigation Buttons', () => {
    it('should render first page button', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should render previous page button', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const prevButton = container.querySelector('[aria-label="Previous page"]');
      expect(prevButton).toBeTruthy();
    });

    it('should render next page button', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const nextButton = container.querySelector('[aria-label="Next page"]');
      expect(nextButton).toBeTruthy();
    });

    it('should render last page button', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const lastButton = container.querySelector('[aria-label="Last page"]');
      expect(lastButton).toBeTruthy();
    });

    it('should render all navigation buttons for multi-page', () => {
      const { container } = render(
        <Pagination currentPage={2} totalPages={10} onPageChange={mockOnPageChange} />
      );
      const buttons = container.querySelectorAll('[aria-label]');
      const labels = Array.from(buttons).map((b) => b.getAttribute('aria-label'));
      expect(labels).toContain('First page');
      expect(labels).toContain('Previous page');
      expect(labels).toContain('Next page');
      expect(labels).toContain('Last page');
    });
  });

  describe('Page Numbers Display', () => {
    it('should display page numbers', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('should highlight current page', () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const currentPageButton = container.querySelector('[aria-current="page"]');
      expect(currentPageButton).toBeTruthy();
      expect(currentPageButton?.textContent).toBe('3');
    });

    it('should show active state styling for current page', () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const currentPageButton = container.querySelector('[aria-current="page"]');
      expect(currentPageButton?.className).toContain('bg-wl-primary-500');
      expect(currentPageButton?.className).toContain('text-wl-text-inverse');
    });

    it('should not show active state for non-current pages', () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const page1 = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === '1'
      );
      expect(page1?.className).not.toContain('bg-wl-primary-500');
    });
  });

  describe('Ellipsis Display', () => {
    it('should show ellipsis when pages are skipped', () => {
      render(
        <Pagination currentPage={1} totalPages={10} onPageChange={mockOnPageChange} />
      );
      const ellipsis = screen.getAllByText('...');
      expect(ellipsis.length).toBeGreaterThan(0);
    });

    it('should show ellipsis before current page range', () => {
      render(
        <Pagination currentPage={8} totalPages={10} onPageChange={mockOnPageChange} />
      );
      expect(screen.getByText('...')).toBeTruthy();
    });

    it('should not show ellipsis when all pages fit', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const ellipsis = screen.queryAllByText('...');
      expect(ellipsis.length).toBe(0);
    });

    it('should show correct page ranges around current', () => {
      render(
        <Pagination currentPage={5} totalPages={10} onPageChange={mockOnPageChange} />
      );
      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
      expect(screen.getByText('10')).toBeTruthy();
    });
  });

  describe('Page Change Handling', () => {
    it('should call onPageChange when page number is clicked', async () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const page2Button = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === '2'
      );

      const user = userEvent.setup();
      await user.click(page2Button!);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when next button is clicked', async () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const nextButton = container.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
      const user = userEvent.setup();
      await user.click(nextButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when previous button is clicked', async () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const prevButton = container.querySelector('[aria-label="Previous page"]') as HTMLButtonElement;
      const user = userEvent.setup();
      await user.click(prevButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when first page button is clicked', async () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const firstButton = container.querySelector('[aria-label="First page"]') as HTMLButtonElement;
      const user = userEvent.setup();
      await user.click(firstButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    it('should call onPageChange when last page button is clicked', async () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const lastButton = container.querySelector('[aria-label="Last page"]') as HTMLButtonElement;
      const user = userEvent.setup();
      await user.click(lastButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(5);
    });
  });

  describe('Disabled States', () => {
    it('should disable first page button on first page', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const firstButton = container.querySelector('[aria-label="First page"]') as HTMLButtonElement;
      expect(firstButton.disabled).toBe(true);
    });

    it('should disable previous page button on first page', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const prevButton = container.querySelector('[aria-label="Previous page"]') as HTMLButtonElement;
      expect(prevButton.disabled).toBe(true);
    });

    it('should enable previous page button on non-first page', () => {
      const { container } = render(
        <Pagination currentPage={2} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const prevButton = container.querySelector('[aria-label="Previous page"]') as HTMLButtonElement;
      expect(prevButton.disabled).toBe(false);
    });

    it('should disable next page button on last page', () => {
      const { container } = render(
        <Pagination currentPage={5} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const nextButton = container.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
      expect(nextButton.disabled).toBe(true);
    });

    it('should disable last page button on last page', () => {
      const { container } = render(
        <Pagination currentPage={5} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const lastButton = container.querySelector('[aria-label="Last page"]') as HTMLButtonElement;
      expect(lastButton.disabled).toBe(true);
    });

    it('should enable navigation buttons on middle pages', () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const nextButton = container.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
      const prevButton = container.querySelector('[aria-label="Previous page"]') as HTMLButtonElement;
      expect(nextButton.disabled).toBe(false);
      expect(prevButton.disabled).toBe(false);
    });
  });

  describe('Page Size Selector', () => {
    it('should render page size select element', () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          onPageSizeChange={mockOnPageSizeChange}
        />
      );
      const select = container.querySelector('select');
      expect(select).toBeTruthy();
    });

    it('should have default page size options', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      const options = container.querySelectorAll('select option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should accept custom page size options', () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          pageSizeOptions={[10, 25, 50]}
        />
      );
      const options = container.querySelectorAll('select option');
      expect(options.length).toBe(3);
    });

    it('should call onPageSizeChange when size is changed', async () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          pageSize={10}
          onPageSizeChange={mockOnPageSizeChange}
        />
      );

      const select = container.querySelector('select') as HTMLSelectElement;
      const user = userEvent.setup();
      await user.selectOptions(select, '20');

      expect(mockOnPageSizeChange).toHaveBeenCalledWith(20);
    });

    it('should display current page size', () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          pageSize={20}
        />
      );

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('20');
    });

    it('should hide page size selector when showPageSizeSelector is false', () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          showPageSizeSelector={false}
        />
      );

      const select = container.querySelector('select');
      expect(select).toBeFalsy();
    });
  });

  describe('Item Count Display', () => {
    it('should display item count info when totalItems provided', () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          totalItems={50}
          pageSize={10}
        />
      );

      expect(screen.getByText(/Showing.*items/)).toBeTruthy();
    });

    it('should calculate correct item range', () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={mockOnPageChange}
          totalItems={50}
          pageSize={10}
        />
      );

      expect(screen.getByText(/Showing 11 to 20 of 50 items/)).toBeTruthy();
    });

    it('should handle last page item count correctly', () => {
      render(
        <Pagination
          currentPage={5}
          totalPages={5}
          onPageChange={mockOnPageChange}
          totalItems={47}
          pageSize={10}
        />
      );

      expect(screen.getByText(/Showing 41 to 47 of 47 items/)).toBeTruthy();
    });

    it('should not display item count when totalItems not provided', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const itemCount = Array.from(container.querySelectorAll('div')).find(
        (el) => el.textContent?.includes('Showing')
      );
      expect(itemCount).toBeFalsy();
    });
  });

  describe('Styling', () => {
    it('should have flex layout', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('flex');
      expect(wrapper.className).toContain('flex-col');
    });

    it('should have gap between sections', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('gap-4');
    });

    it('should have padding', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('py-4');
      expect(wrapper.className).toContain('px-4');
    });
  });

  describe('Button Styling', () => {
    it('should have ghost variant for nav buttons', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const firstButton = container.querySelector('[aria-label="First page"]');
      expect(firstButton?.className).toContain('bg-transparent');
    });

    it('should have small size for nav buttons', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const firstButton = container.querySelector('[aria-label="First page"]');
      expect(firstButton?.className).toContain('px-2');
    });

    it('should have correct styling for active page number', () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const activePage = container.querySelector('[aria-current="page"]');
      expect(activePage?.className).toContain('bg-wl-primary-500');
      expect(activePage?.className).toContain('text-wl-text-inverse');
      expect(activePage?.className).toContain('font-semibold');
    });

    it('should have correct styling for inactive page numbers', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const page2 = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === '2'
      );
      expect(page2?.className).toContain('text-wl-text-primary');
      expect(page2?.className).not.toContain('bg-wl-primary-500');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on buttons', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const prevBtn = container.querySelector('[aria-label="Previous page"]');
      const nextBtn = container.querySelector('[aria-label="Next page"]');
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
    });

    it('should mark current page with aria-current', () => {
      const { container } = render(
        <Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const currentPage = container.querySelector('[aria-current="page"]');
      expect(currentPage).toBeTruthy();
    });

    it('should have proper page button labels', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const buttons = container.querySelectorAll('button[aria-label^="Page"]');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Forward Ref', () => {
    it('should forward ref to container div', () => {
      const ref = { current: null };
      const { container } = render(
        <Pagination ref={ref as any} currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('className Prop', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          className="custom-pagination"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('custom-pagination');
    });

    it('should merge custom className with default styles', () => {
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
          className="custom-pagination"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('flex');
      expect(wrapper.className).toContain('custom-pagination');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single page', () => {
      render(
        <Pagination currentPage={1} totalPages={1} onPageChange={mockOnPageChange} />
      );

      expect(screen.getByText('1')).toBeTruthy();
    });

    it('should handle very large page counts', () => {
      const { container } = render(
        <Pagination currentPage={50} totalPages={1000} onPageChange={mockOnPageChange} />
      );

      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('1000')).toBeTruthy();
    });

    it('should handle first page correctly', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const firstBtn = container.querySelector('[aria-label="First page"]') as HTMLButtonElement;
      expect(firstBtn.disabled).toBe(true);
    });

    it('should handle last page correctly', () => {
      const { container } = render(
        <Pagination currentPage={5} totalPages={5} onPageChange={mockOnPageChange} />
      );

      const lastBtn = container.querySelector('[aria-label="Last page"]') as HTMLButtonElement;
      expect(lastBtn.disabled).toBe(true);
    });
  });
});
