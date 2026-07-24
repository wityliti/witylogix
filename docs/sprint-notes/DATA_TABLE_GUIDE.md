# Data Table & List Enhancements - Sprint 7.1 Guide

## Overview

This guide covers the enhanced data table components created for Sprint 7.1. These components provide comprehensive table management with sorting, selection, pagination, column visibility, and more.

## Components

### 1. DataTable Component

The core enhanced data table component with extensive features.

#### Basic Usage

```tsx
import { DataTable, type ColumnDef } from "@/components/ui";

interface User {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
}

const columns: ColumnDef<User>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sortable: true,
    width: 200,
  },
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
    sortable: true,
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    cell: (value) => <span className={`status-${value}`}>{value}</span>,
  },
];

export function UsersTable() {
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  return (
    <DataTable
      columns={columns}
      data={users}
      enableRowSelection={true}
      enableBulkActions={true}
      enableColumnVisibility={true}
      enableSorting={true}
      enablePagination={true}
      onSelectionChange={setSelectedIds}
      onBulkAction={(action, ids) => {
        if (action === "delete") {
          deleteUsers(ids);
        }
      }}
      pagination={{
        pageSize: 25,
        currentPage: 1,
        totalCount: 100,
        onPageChange: (page) => {
          fetchUsers(page);
        },
        onPageSizeChange: (size) => {
          updatePageSize(size);
        },
      }}
    />
  );
}
```

#### Features

- **Column Sorting**: Click column headers to sort ascending/descending/clear
  - Add `sortable: true` to `ColumnDef`
  - Provides visual indicators (chevron up/down)
  - Call `onSort` callback with column ID and direction

- **Row Selection**: Checkbox column with select all support
  - Enable with `enableRowSelection={true}`
  - Indeterminate state for partial selection
  - Returns selected row IDs via `onSelectionChange`

- **Bulk Actions**: Context bar appears when rows selected
  - Enable with `enableBulkActions={true}`
  - Built-in export and delete actions
  - Extend via `onBulkAction` callback

- **Column Resize**: Drag column borders to resize
  - Persisted widths available
  - Resizable indicator on hover

- **Column Visibility**: Toggle columns on/off
  - Dropdown with checkboxes
  - Persists to localStorage via hook

- **Inline Editing**: Double-click cells to edit
  - Press Enter to save, Escape to cancel
  - Returns edited values

- **Pagination**: Full pagination controls
  - Page size selector (10/25/50/100)
  - Previous/Next buttons
  - Total count display

- **Loading State**: Skeleton loading
  - Shows when `isLoading={true}`
  - Shimmer animation

- **Empty State**: Customizable message
  - `emptyMessage` prop

#### Props

```tsx
interface DataTableProps<T extends { id?: string | number }> {
  // Core data
  columns: ColumnDef<T>[];
  data: T[];

  // Selection and actions
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  onBulkAction?: (action: string, selectedIds: (string | number)[]) => void;

  // Sorting
  onSort?: (columnId: string, direction: SortDirection) => void;

  // Display
  emptyMessage?: string;
  isLoading?: boolean;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;

  // Pagination
  pagination?: {
    pageSize: number;
    currentPage?: number;
    totalCount?: number;
    onPageSizeChange?: (size: number) => void;
    onPageChange?: (page: number) => void;
  };

  // Feature toggles
  enableRowSelection?: boolean;
  enableBulkActions?: boolean;
  enableColumnVisibility?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;

  className?: string;
}
```

### 2. VirtualList Component

Efficient scrolling for large datasets (1000+ items) using windowing.

#### Usage

```tsx
import { VirtualList } from "@/components/ui";

function LargeUsersList() {
  const items = generateUsers(10000);

  return (
    <VirtualList
      items={items}
      itemHeight={50}
      renderItem={(user, index) => (
        <div className="p-4 border-b">
          {user.name} ({index})
        </div>
      )}
      overscan={5}
      height={600}
      onLoadMore={async () => {
        const newItems = await fetchMoreUsers();
        setItems((prev) => [...prev, ...newItems]);
      }}
      isLoadingMore={isLoading}
    />
  );
}
```

#### Features

- **Windowing**: Only renders visible items
- **Dynamic Heights**: Support for variable row heights
- **Overscan**: Renders 5 extra rows above/below viewport
- **Scroll to Index**: Jump to specific position
- **Infinite Scroll**: Load more indicator at bottom
- **Position Restoration**: Maintains scroll position

#### Props

```tsx
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  renderItem: (item: T, index: number) => ReactNode;

  overscan?: number; // Default: 5
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  onScrollToIndex?: (index: number) => void;

  className?: string;
  height?: number; // Default: 600px
  width?: string | number;
}
```

### 3. DataTableToolbar Component

Toolbar for table controls (search, export, column visibility).

#### Usage

```tsx
import { DataTableToolbar } from "@/components/ui";

function TableWithToolbar() {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(["name", "email", "status"]),
  );
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-4">
      <DataTableToolbar
        columns={columns}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={setVisibleColumns}
        onSearch={(query) => {
          setSearchQuery(query);
          filterData(query);
        }}
        onRefresh={() => {
          refetchData();
        }}
        viewMode="table"
        onViewModeChange={(mode) => {
          switchView(mode);
        }}
        selectedCount={selectedIds.length}
      />

      <DataTable
        columns={columns}
        data={filteredData}
        // ... other props
      />
    </div>
  );
}
```

#### Features

- **Search**: Filter table by keyword
- **Column Visibility**: Toggle columns on/off with count
- **Export**: Export to CSV, JSON, clipboard (extensible)
- **View Mode**: Switch between table/grid/compact views
- **Refresh**: Reload data with loading spinner
- **Selection Count**: Display selected row count

### 4. useTablePreferences Hook

Persist table preferences to localStorage.

#### Usage

```tsx
import { useTablePreferences } from "@/hooks";

function TablePage() {
  const {
    preferences,
    isLoaded,
    updateColumnOrder,
    updateColumnWidths,
    updateVisibleColumns,
    updateSortState,
    updatePageSize,
    resetToDefaults,
  } = useTablePreferences("users-table", ["name", "email", "status"]);

  // Use preferences to set initial state
  useEffect(() => {
    if (isLoaded) {
      setColumnWidths(preferences.columnWidths);
      setVisibleColumns(preferences.visibleColumns);
      // ... etc
    }
  }, [isLoaded]);

  // Update when table changes
  const handleSort = (columnId: string, direction) => {
    updateSortState(columnId, direction);
  };

  return (
    <>
      <DataTable columns={columns} data={data} onSort={handleSort} />
      <button onClick={resetToDefaults}>Reset to Defaults</button>
    </>
  );
}
```

#### Features

- **localStorage Persistence**: Per-table-id key
- **Preferences Tracked**:
  - Column order
  - Column widths
  - Visible columns
  - Sort state
  - Page size

- **Reset to Defaults**: Clear all preferences

### 5. Export Utilities

Functions for exporting table data.

#### Usage

```tsx
import {
  exportAsCSV,
  exportAsJSON,
  copyToClipboard,
  exportSelectedRows,
} from "@/components/ui";

function ExportExample() {
  const handleExport = async (format: "csv" | "json") => {
    if (selectedIds.length > 0) {
      exportSelectedRows(data, selectedIds, columns, format, {
        filename: "users-export.csv",
      });
    } else {
      if (format === "csv") {
        exportAsCSV(data, columns, { filename: "all-users.csv" });
      } else {
        exportAsJSON(data, columns, { filename: "all-users.json" });
      }
    }
  };

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(data, columns, "csv");
    if (success) {
      toast.success("Copied to clipboard!");
    }
  };

  return (
    <div className="space-y-2">
      <button onClick={() => handleExport("csv")}>Export as CSV</button>
      <button onClick={() => handleExport("json")}>Export as JSON</button>
      <button onClick={handleCopyToClipboard}>Copy to Clipboard</button>
    </div>
  );
}
```

#### Functions

- **generateCSV**: Create CSV string with proper escaping
- **generateJSON**: Create formatted JSON string
- **exportAsCSV**: Download CSV file
- **exportAsJSON**: Download JSON file
- **copyToClipboard**: Copy to clipboard (CSV or JSON)
- **exportSelectedRows**: Export subset of data
- **buildColumnHeaderMap**: Create header mapping

## Complete Example

```tsx
"use client";

import { useState, useEffect } from "react";
import {
  DataTable,
  DataTableToolbar,
  VirtualList,
  type ColumnDef,
} from "@/components/ui";
import { useTablePreferences } from "@/hooks";

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  date: Date;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);

  const {
    preferences,
    updateVisibleColumns,
    updatePageSize: savePageSize,
  } = useTablePreferences("orders-table", [
    "orderNumber",
    "customer",
    "amount",
    "status",
    "date",
  ]);

  const columns: ColumnDef<Order>[] = [
    {
      id: "orderNumber",
      header: "Order #",
      accessorKey: "orderNumber",
      sortable: true,
      width: 120,
    },
    {
      id: "customer",
      header: "Customer",
      accessorKey: "customer",
      sortable: true,
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      cell: (value) => `$${value.toFixed(2)}`,
      align: "right",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (value) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            value === "completed"
              ? "bg-wl-success-bg text-wl-success-400"
              : value === "pending"
                ? "bg-wl-warning-bg text-wl-warning-400"
                : "bg-wl-danger-bg text-wl-danger-400"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      id: "date",
      header: "Date",
      accessorKey: "date",
      cell: (value) => new Date(value).toLocaleDateString(),
      sortable: true,
    },
  ];

  useEffect(() => {
    loadOrders();
  }, [currentPage, pageSize]);

  const loadOrders = async () => {
    setIsLoading(true);
    const data = await fetchOrders(currentPage, pageSize);
    setOrders(data);
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <DataTableToolbar
        columns={columns}
        visibleColumns={new Set(preferences.visibleColumns)}
        onVisibleColumnsChange={(visible) => {
          updateVisibleColumns(Array.from(visible));
        }}
        onSearch={(query) => {
          // Implement search filtering
          console.log("Search:", query);
        }}
        onRefresh={loadOrders}
        selectedCount={selectedIds.length}
      />

      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        onSelectionChange={setSelectedIds}
        onBulkAction={(action, ids) => {
          if (action === "delete") {
            deleteOrders(ids);
            loadOrders();
          }
        }}
        pagination={{
          pageSize,
          currentPage,
          totalCount: 500,
          onPageChange: setCurrentPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            savePageSize(size);
            setCurrentPage(1);
          },
        }}
      />
    </div>
  );
}
```

## Styling Notes

- All components use Tailwind CSS v3.4 (NOT v4)
- Dark theme with `--wl-*` CSS variables
- Color schemes: primary, success, warning, danger, info
- Button variants: "primary" | "secondary" | "ghost" | "danger"
- Badge variants: "default" | "success" | "warning" | "danger" | "info" | "primary"

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## Performance

- DataTable: 100+ rows performant with pagination
- VirtualList: 10,000+ rows using windowing
- localStorage: ~5KB per table preferences
- No external dependencies beyond lucide-react

## Testing

Run tests with:

```bash
npm test -- data-table.test.tsx
```

Test coverage includes:

- Column sorting (asc/desc/clear)
- Row selection (single/all/indeterminate)
- Pagination
- Export functionality
- Column visibility
- Empty states
- Loading states
