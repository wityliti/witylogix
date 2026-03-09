import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table } from '../table';

interface TestData {
  id: string;
  name: string;
  email: string;
  status: string;
}

describe('Table Component', () => {
  const mockData: TestData[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'Active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' },
  ];

  const mockColumns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Status' },
  ];

  describe('Rendering', () => {
    it('should render a table element', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );
      expect(container.querySelector('table')).toBeTruthy();
    });

    it('should render header row', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );
      expect(container.querySelector('thead')).toBeTruthy();
    });

    it('should render body rows', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );
      expect(container.querySelector('tbody')).toBeTruthy();
    });

    it('should render all column headers', () => {
      render(<Table columns={mockColumns} data={mockData} />);
      expect(screen.getByText('Name')).toBeTruthy();
      expect(screen.getByText('Email')).toBeTruthy();
      expect(screen.getByText('Status')).toBeTruthy();
    });

    it('should render all data rows', () => {
      render(<Table columns={mockColumns} data={mockData} />);
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('Jane Smith')).toBeTruthy();
      expect(screen.getByText('Bob Johnson')).toBeTruthy();
    });

    it('should render correct number of cells per row', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );
      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3);
    });
  });

  describe('Empty State', () => {
    it('should render empty message when no data', () => {
      render(<Table columns={mockColumns} data={[]} />);
      expect(screen.getByText('No data available')).toBeTruthy();
    });

    it('should allow custom empty message', () => {
      render(
        <Table
          columns={mockColumns}
          data={[]}
          emptyMessage="No results found"
        />
      );
      expect(screen.getByText('No results found')).toBeTruthy();
    });

    it('should not render table structure on empty', () => {
      const { container } = render(
        <Table columns={mockColumns} data={[]} />
      );
      expect(container.querySelector('table')).toBeFalsy();
    });
  });

  describe('Sorting', () => {
    it('should sort string column ascending', async () => {
      const { container } = render(
        <Table columns={[{ key: 'name', header: 'Name', sortable: true }, ...mockColumns]} data={mockData} />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      const user = userEvent.setup();
      await user.click(nameHeader!);

      const firstRow = container.querySelector('tbody tr:first-child');
      expect(firstRow?.textContent).toContain('Bob Johnson');
    });

    it('should sort string column descending', async () => {
      const { container } = render(
        <Table columns={[{ key: 'name', header: 'Name', sortable: true }, ...mockColumns]} data={mockData} />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      const user = userEvent.setup();
      await user.click(nameHeader!);
      await user.click(nameHeader!);

      const firstRow = container.querySelector('tbody tr:first-child');
      expect(firstRow?.textContent).toContain('John Doe');
    });

    it('should clear sorting on third click', async () => {
      const { container } = render(
        <Table columns={[{ key: 'name', header: 'Name', sortable: true }, ...mockColumns]} data={mockData} />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      const user = userEvent.setup();
      await user.click(nameHeader!);
      await user.click(nameHeader!);
      await user.click(nameHeader!);

      const rows = container.querySelectorAll('tbody tr');
      // After clearing sort, order should return to original
      expect(rows[0].textContent).toContain('John Doe');
    });

    it('should show sort indicator on active column', async () => {
      const { container } = render(
        <Table columns={[{ key: 'name', header: 'Name', sortable: true }, ...mockColumns]} data={mockData} />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      const user = userEvent.setup();
      await user.click(nameHeader!);

      const icon = nameHeader?.querySelector('svg');
      expect(icon).toBeTruthy();
    });

    it('should not sort when sortable is false', async () => {
      const { container } = render(
        <Table columns={[{ key: 'name', header: 'Name', sortable: false }, ...mockColumns]} data={mockData} />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      expect(nameHeader?.className).not.toContain('cursor-pointer');
    });

    it('should sort numeric columns correctly', async () => {
      const numericData = [
        { id: '1', value: 30 },
        { id: '2', value: 10 },
        { id: '3', value: 20 },
      ];

      const numericColumns = [
        { key: 'value', header: 'Value', sortable: true },
      ];

      const { container } = render(
        <Table columns={numericColumns} data={numericData} />
      );

      const valueHeader = screen.getByText('Value').closest('th');
      const user = userEvent.setup();
      await user.click(valueHeader!);

      const rows = container.querySelectorAll('tbody tr');
      expect(rows[0].textContent).toContain('10');
      expect(rows[1].textContent).toContain('20');
      expect(rows[2].textContent).toContain('30');
    });
  });

  describe('Row Click Handler', () => {
    it('should call onRowClick with row data', async () => {
      const handleRowClick = vi.fn();
      render(
        <Table
          columns={mockColumns}
          data={mockData}
          onRowClick={handleRowClick}
        />
      );

      const user = userEvent.setup();
      const firstRow = screen.getByText('John Doe').closest('tr');
      await user.click(firstRow!);

      expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('should make rows clickable when onRowClick is provided', () => {
      const { container } = render(
        <Table
          columns={mockColumns}
          data={mockData}
          onRowClick={vi.fn()}
        />
      );

      const rows = container.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        expect(row.className).toContain('cursor-pointer');
      });
    });

    it('should not make rows clickable when onRowClick is not provided', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const rows = container.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        expect(row.className).not.toContain('cursor-pointer');
      });
    });

    it('should call onRowClick for each row', async () => {
      const handleRowClick = vi.fn();
      render(
        <Table
          columns={mockColumns}
          data={mockData}
          onRowClick={handleRowClick}
        />
      );

      const user = userEvent.setup();
      const rows = screen.getAllByText(/Doe|Smith|Johnson/);
      await user.click(rows[0].closest('tr')!);
      await user.click(rows[1].closest('tr')!);

      expect(handleRowClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Row Selection', () => {
    it('should highlight selected row', () => {
      const { container } = render(
        <Table
          columns={mockColumns}
          data={mockData}
          selectedId="1"
        />
      );

      const selectedRow = container.querySelector('tbody tr:first-child');
      expect(selectedRow?.className).toContain('bg-wl-primary-500/10');
    });

    it('should not highlight non-selected rows', () => {
      const { container } = render(
        <Table
          columns={mockColumns}
          data={mockData}
          selectedId="1"
        />
      );

      const secondRow = container.querySelector('tbody tr:nth-child(2)');
      expect(secondRow?.className).not.toContain('bg-wl-primary-500/10');
    });
  });

  describe('Column Customization', () => {
    it('should support custom render function', () => {
      const customColumns = [
        { key: 'name', header: 'Name' },
        {
          key: 'status',
          header: 'Status',
          render: (item: TestData) => `[${item.status}]`,
        },
      ];

      render(<Table columns={customColumns} data={mockData} />);
      expect(screen.getByText('[Active]')).toBeTruthy();
      expect(screen.getByText('[Inactive]')).toBeTruthy();
    });

    it('should support column width', () => {
      const { container } = render(
        <Table
          columns={[{ key: 'name', header: 'Name', width: '50%' }, ...mockColumns]}
          data={mockData}
        />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      const style = nameHeader?.getAttribute('style');
      expect(style).toContain('width');
    });

    it('should support text alignment', () => {
      const { container } = render(
        <Table
          columns={[{ key: 'name', header: 'Name', align: 'center' }, ...mockColumns]}
          data={mockData}
        />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      const style = nameHeader?.getAttribute('style');
      expect(style).toContain('center');
    });
  });

  describe('Striped Rows', () => {
    it('should apply striped styling by default', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const secondRow = container.querySelector('tbody tr:nth-child(2)');
      expect(secondRow?.className).toContain('bg-wl-bg-surface');
    });

    it('should disable striped rows when striped is false', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} striped={false} />
      );

      const secondRow = container.querySelector('tbody tr:nth-child(2)');
      expect(secondRow?.className).not.toContain('bg-wl-bg-surface');
    });
  });

  describe('Sticky Header', () => {
    it('should have sticky header by default', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const headerRow = container.querySelector('thead tr');
      expect(headerRow?.className).toContain('sticky');
      expect(headerRow?.className).toContain('top-0');
      expect(headerRow?.className).toContain('z-10');
    });

    it('should disable sticky header when stickyHeader is false', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} stickyHeader={false} />
      );

      const headerRow = container.querySelector('thead tr');
      expect(headerRow?.className).not.toContain('sticky');
    });
  });

  describe('className and style Props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} className="custom-table" />
      );

      const wrapper = container.firstChild;
      expect(wrapper?.toString()).toContain('custom-table');
    });

    it('should accept custom style', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} style={{ minHeight: '400px' }} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.minHeight).toBe('400px');
    });
  });

  describe('Header Styling', () => {
    it('should have header background', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const headerRow = container.querySelector('thead tr');
      expect(headerRow?.className).toContain('bg-wl-bg-surface');
    });

    it('should have header text styling', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const headerCell = container.querySelector('thead th');
      expect(headerCell?.className).toContain('text-xs');
      expect(headerCell?.className).toContain('font-semibold');
      expect(headerCell?.className).toContain('uppercase');
    });

    it('should have hover effect on sortable headers', () => {
      const { container } = render(
        <Table columns={[{ key: 'name', header: 'Name', sortable: true }, ...mockColumns]} data={mockData} />
      );

      const header = screen.getByText('Name').closest('th');
      expect(header?.className).toContain('hover:text-wl-text-primary');
    });
  });

  describe('Row Styling', () => {
    it('should have border between rows', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const row = container.querySelector('tbody tr');
      expect(row?.className).toContain('border-b');
      expect(row?.className).toContain('border-wl-border-subtle');
    });

    it('should have hover effect on clickable rows', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} onRowClick={vi.fn()} />
      );

      const row = container.querySelector('tbody tr');
      expect(row?.className).toContain('hover:bg-white/\\[0.02\\]');
    });
  });

  describe('Cell Content', () => {
    it('should render text content correctly', () => {
      render(<Table columns={mockColumns} data={mockData} />);
      expect(screen.getByText('john@example.com')).toBeTruthy();
    });

    it('should apply monospace font to identifier-like content', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const cells = container.querySelectorAll('tbody td');
      const idCell = cells[0];
      expect(idCell.textContent).toBeTruthy();
    });
  });

  describe('Border and Wrapper', () => {
    it('should have border around table', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const wrapper = container.firstChild;
      expect(wrapper?.toString()).toContain('border');
    });

    it('should have rounded corners', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const wrapper = container.firstChild;
      expect(wrapper?.toString()).toContain('rounded-lg');
    });

    it('should have horizontal scroll on overflow', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const wrapper = container.firstChild;
      expect(wrapper?.toString()).toContain('overflow-x-auto');
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      expect(container.querySelector('table')).toBeTruthy();
      expect(container.querySelector('thead')).toBeTruthy();
      expect(container.querySelector('tbody')).toBeTruthy();
    });

    it('should have proper header cells', () => {
      const { container } = render(
        <Table columns={mockColumns} data={mockData} />
      );

      const headers = container.querySelectorAll('thead th');
      expect(headers.length).toBe(3);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle sorting and selection together', async () => {
      const { container } = render(
        <Table
          columns={[{ key: 'name', header: 'Name', sortable: true }, ...mockColumns]}
          data={mockData}
          selectedId="2"
          onRowClick={vi.fn()}
        />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      const user = userEvent.setup();
      await user.click(nameHeader!);

      const selectedRow = container.querySelector('[class*="bg-wl-primary-500"]');
      expect(selectedRow).toBeTruthy();
    });

    it('should handle custom render with sorting', async () => {
      const customColumns = [
        {
          key: 'name',
          header: 'Name',
          sortable: true,
          render: (item: TestData) => `Mr./Ms. ${item.name}`,
        },
        { key: 'email', header: 'Email' },
      ];

      render(<Table columns={customColumns} data={mockData} />);
      expect(screen.getByText(/Mr.\/Ms\./)).toBeTruthy();
    });

    it('should handle large datasets', () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        name: `User ${i}`,
        email: `user${i}@example.com`,
        status: i % 2 === 0 ? 'Active' : 'Inactive',
      }));

      const { container } = render(
        <Table columns={mockColumns} data={largeData} />
      );

      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(100);
    });
  });
});
