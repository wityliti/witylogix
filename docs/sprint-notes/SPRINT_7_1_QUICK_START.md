# Sprint 7.1 - Quick Start Guide

## Quick Import

```tsx
// Components
import { DataTable, VirtualList, DataTableToolbar } from "@/components/ui";

// Hooks
import { useTablePreferences } from "@/hooks";

// Utilities
import { exportAsCSV, exportAsJSON, copyToClipboard } from "@/components/ui";
```

## Basic Table Example

```tsx
import { useState } from "react";
import { DataTable, type ColumnDef } from "@/components/ui";

interface User {
  id: string;
  name: string;
  email: string;
}

export function UsersTable() {
  const [data, setData] = useState<User[]>([
    { id: "1", name: "Alice", email: "alice@example.com" },
    { id: "2", name: "Bob", email: "bob@example.com" },
  ]);

  const columns: ColumnDef<User>[] = [
    { id: "name", header: "Name", accessorKey: "name", sortable: true },
    { id: "email", header: "Email", accessorKey: "email" },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      enableSorting={true}
      enablePagination={true}
      pagination={{ pageSize: 25, currentPage: 1, totalCount: 100 }}
    />
  );
}
```

## With All Features

```tsx
export function AdvancedTable() {
  const [data, setData] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const { preferences } = useTablePreferences("users-table", ["name", "email"]);

  const columns: ColumnDef<User>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sortable: true,
      width: 150,
    },
    { id: "email", header: "Email", accessorKey: "email", sortable: true },
  ];

  return (
    <>
      <DataTableToolbar
        columns={columns}
        visibleColumns={new Set(preferences.visibleColumns)}
        onRefresh={() => fetchData()}
        selectedCount={selectedIds.length}
      />

      <DataTable
        columns={columns}
        data={data}
        enableRowSelection={true}
        enableBulkActions={true}
        enableColumnVisibility={true}
        enableSorting={true}
        enablePagination={true}
        onSelectionChange={setSelectedIds}
        onBulkAction={(action, ids) => {
          if (action === "delete") deleteUsers(ids);
          if (action === "export") exportAsCSV(data, columns);
        }}
        pagination={{
          pageSize: 25,
          currentPage: 1,
          totalCount: 100,
          onPageChange: (page) => fetchPage(page),
          onPageSizeChange: (size) => {
            preferences.updatePageSize(size);
          },
        }}
      />
    </>
  );
}
```

## Virtual List (Large Datasets)

```tsx
import { VirtualList } from "@/components/ui";

export function LargeList() {
  const [items, setItems] = useState<Item[]>([]);

  return (
    <VirtualList
      items={items}
      itemHeight={48}
      renderItem={(item, index) => (
        <div className="px-4 py-3 border-b">{item.name}</div>
      )}
      height={600}
      onLoadMore={async () => {
        const more = await fetchMore();
        setItems((prev) => [...prev, ...more]);
      }}
    />
  );
}
```

## Export Examples

```tsx
// Export all as CSV
exportAsCSV(data, columns, { filename: "export.csv" });

// Export all as JSON
exportAsJSON(data, columns, { filename: "export.json" });

// Copy to clipboard
await copyToClipboard(data, columns, "csv");

// Export selected rows
exportSelectedRows(data, selectedIds, columns, "csv");
```

## Preferences Hook

```tsx
const {
  preferences, // Current preferences object
  isLoaded, // Whether loaded from storage
  updateColumnOrder, // Update column order
  updateColumnWidths, // Update column widths
  updateVisibleColumns, // Update visible columns
  updateSortState, // Update sort (columnId, direction)
  updatePageSize, // Update page size
  resetToDefaults, // Reset all to defaults
} = useTablePreferences("table-id", ["col1", "col2"]);
```

## Column Definition

```tsx
interface ColumnDef<T> {
  id: string; // Unique column ID
  header: string; // Column header text
  accessorKey?: keyof T; // Data key to access
  cell?: (value: any, row: T) => ReactNode; // Custom cell renderer
  width?: number; // Column width
  align?: "left" | "center" | "right"; // Text alignment
  sortable?: boolean; // Enable sorting
  resizable?: boolean; // Enable resizing
  visible?: boolean; // Initially visible
}
```

## Common Patterns

### With Loading State

```tsx
<DataTable
  columns={columns}
  data={data}
  isLoading={isLoading}
  emptyMessage="No data found"
/>
```

### Custom Row Rendering

```tsx
columns.push({
  id: "status",
  header: "Status",
  accessorKey: "status",
  cell: (value) => <span className={`badge-${value}`}>{value}</span>,
});
```

### Row Click Handler

```tsx
<DataTable
  columns={columns}
  data={data}
  onRowClick={(row) => navigate(`/users/${row.id}`)}
/>
```

### Custom Bulk Actions

```tsx
<DataTable
  columns={columns}
  data={data}
  onBulkAction={(action, ids) => {
    switch (action) {
      case "delete":
        deleteUsers(ids);
        break;
      case "export":
        exportAsCSV(
          data.filter((d) => ids.includes(d.id!)),
          columns,
        );
        break;
      case "activate":
        activateUsers(ids);
        break;
    }
  }}
/>
```

## Styling

All components use Tailwind CSS with `--wl-*` CSS variables for colors:

```tsx
// Colors available:
--wl-primary-500, --wl-primary-400, etc.
--wl-success-400, --wl-success-bg
--wl-warning-400, --wl-warning-bg
--wl-danger-400, --wl-danger-bg
--wl-info-400, --wl-info-bg
--wl-bg-surface, --wl-bg-elevated, --wl-bg-overlay
--wl-text-primary, --wl-text-secondary
--wl-border-subtle, --wl-border-default, --wl-border-strong
```

## API Reference

### DataTable Props

- `columns: ColumnDef<T>[]`
- `data: T[]`
- `onSelectionChange?: (ids) => void`
- `onBulkAction?: (action, ids) => void`
- `onSort?: (columnId, direction) => void`
- `pagination?: { pageSize, currentPage, totalCount, onPageChange, onPageSizeChange }`
- `enableRowSelection?: boolean` (default: true)
- `enableBulkActions?: boolean` (default: true)
- `enableColumnVisibility?: boolean` (default: true)
- `enableSorting?: boolean` (default: true)
- `enablePagination?: boolean` (default: true)

### VirtualList Props

- `items: T[]`
- `itemHeight: number | (index, item) => number`
- `renderItem: (item, index) => ReactNode`
- `overscan?: number` (default: 5)
- `onLoadMore?: () => void`
- `isLoadingMore?: boolean`
- `height?: number` (default: 600)
- `width?: string | number`

### DataTableToolbar Props

- `columns: Column[]`
- `visibleColumns: Set<string>`
- `onVisibleColumnsChange?: (visible) => void`
- `onSearch?: (query) => void`
- `onRefresh?: () => void`
- `viewMode?: "table" | "grid" | "compact"`
- `onViewModeChange?: (mode) => void`
- `selectedCount?: number`

## Performance Tips

1. **Pagination**: Use for 100+ rows instead of loading all at once
2. **VirtualList**: Use for 1000+ items with windowing
3. **useTablePreferences**: Persists to localStorage automatically
4. **Memoization**: Wrap columns and data callbacks with useMemo
5. **Lazy Loading**: Load data on demand via pagination callbacks

## Testing

```tsx
import { render, screen } from "@testing-library/react";
import { DataTable } from "@/components/ui";

test("renders table", () => {
  render(<DataTable columns={columns} data={mockData} />);
  expect(screen.getByText("Name")).toBeInTheDocument();
});
```

## Common Issues

**Issue**: Column widths reset
**Solution**: Use `useTablePreferences` hook to persist widths

**Issue**: Selection lost on sort
**Solution**: This is expected behavior; clear selection on sort if needed

**Issue**: Large datasets slow
**Solution**: Use VirtualList component or enable pagination

**Issue**: Export includes hidden columns
**Solution**: Filter columns based on visibleColumns set before export

## Files Created

- `apps/dashboard/src/components/ui/data-table.tsx`
- `apps/dashboard/src/components/ui/virtual-list.tsx`
- `apps/dashboard/src/components/ui/data-table-toolbar.tsx`
- `apps/dashboard/src/components/ui/data-table-export.ts`
- `apps/dashboard/src/hooks/use-table-preferences.ts`
- `apps/dashboard/src/components/ui/__tests__/data-table.test.tsx`
- `apps/dashboard/src/components/ui/DATA_TABLE_GUIDE.md`

## Documentation

For detailed documentation, see:

- `/apps/dashboard/src/components/ui/DATA_TABLE_GUIDE.md`
- `/SPRINT_7_1_SUMMARY.md`

## Support

For questions or issues:

1. Check the DATA_TABLE_GUIDE.md
2. Review test examples
3. Check component prop interfaces
