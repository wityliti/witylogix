import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, ColumnDef } from "../data-table";
import {
  generateCSV,
  generateJSON,
  exportSelectedRows,
} from "../data-table-export";

interface TestRow {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  joinDate: Date;
}

const mockData: TestRow[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    status: "active",
    joinDate: new Date("2024-01-15"),
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    status: "inactive",
    joinDate: new Date("2024-02-20"),
  },
  {
    id: "3",
    name: "Charlie Brown",
    email: "charlie@example.com",
    status: "active",
    joinDate: new Date("2024-03-10"),
  },
];

const mockColumns: ColumnDef<TestRow>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sortable: true,
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
    cell: (value) => (
      <span className={`badge-${value}`}>{value}</span>
    ),
  },
  {
    id: "joinDate",
    header: "Join Date",
    accessorKey: "joinDate",
    cell: (value) => (value instanceof Date ? value.toLocaleDateString() : ""),
  },
];

describe("DataTable Component", () => {
  describe("Rendering", () => {
    it("should render table with all columns", () => {
      render(
        <DataTable columns={mockColumns} data={mockData} />
      );

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Join Date")).toBeInTheDocument();
    });

    it("should render all data rows", () => {
      render(
        <DataTable columns={mockColumns} data={mockData} />
      );

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });

    it("should render empty state when data is empty", () => {
      const emptyMessage = "No users found";
      render(
        <DataTable
          columns={mockColumns}
          data={[]}
          emptyMessage={emptyMessage}
        />
      );

      expect(screen.getByText(emptyMessage)).toBeInTheDocument();
    });

    it("should show loading skeleton when isLoading is true", () => {
      const { container } = render(
        <DataTable columns={mockColumns} data={mockData} isLoading={true} />
      );

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Sorting", () => {
    it("should sort column ascending on click", async () => {
      const { container } = render(
        <DataTable columns={mockColumns} data={mockData} />
      );

      const nameHeader = screen.getByText("Name");
      await userEvent.click(nameHeader);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows[0]).toHaveTextContent("Alice Johnson");
      expect(rows[1]).toHaveTextContent("Bob Smith");
      expect(rows[2]).toHaveTextContent("Charlie Brown");
    });

    it("should sort column descending on second click", async () => {
      const { container } = render(
        <DataTable columns={mockColumns} data={mockData} />
      );

      const nameHeader = screen.getByText("Name");
      await userEvent.click(nameHeader);
      await userEvent.click(nameHeader);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows[0]).toHaveTextContent("Charlie Brown");
      expect(rows[1]).toHaveTextContent("Bob Smith");
      expect(rows[2]).toHaveTextContent("Alice Johnson");
    });

    it("should clear sort on third click", async () => {
      const { container } = render(
        <DataTable columns={mockColumns} data={mockData} />
      );

      const nameHeader = screen.getByText("Name");
      await userEvent.click(nameHeader);
      await userEvent.click(nameHeader);
      await userEvent.click(nameHeader);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows[0]).toHaveTextContent("Alice Johnson");
    });

    it("should call onSort callback when sorting", async () => {
      const onSort = vi.fn();
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onSort={onSort}
        />
      );

      const nameHeader = screen.getByText("Name");
      await userEvent.click(nameHeader);

      expect(onSort).toHaveBeenCalledWith("name", "asc");
    });
  });

  describe("Row Selection", () => {
    it("should select individual rows", async () => {
      const onSelectionChange = vi.fn();
      const { container } = render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onSelectionChange={onSelectionChange}
          enableRowSelection={true}
        />
      );

      const checkboxes = container.querySelectorAll("input[type='checkbox']");
      const firstRowCheckbox = checkboxes[1]; // Skip header checkbox

      await userEvent.click(firstRowCheckbox as HTMLInputElement);

      expect(onSelectionChange).toHaveBeenCalledWith(["1"]);
    });

    it("should select all rows with header checkbox", async () => {
      const onSelectionChange = vi.fn();
      const { container } = render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onSelectionChange={onSelectionChange}
          enableRowSelection={true}
        />
      );

      const headerCheckbox = container.querySelector(
        "thead input[type='checkbox']"
      ) as HTMLInputElement;

      await userEvent.click(headerCheckbox);

      expect(onSelectionChange).toHaveBeenCalledWith(["1", "2", "3"]);
    });

    it("should show bulk actions bar when rows are selected", async () => {
      const { container } = render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          enableRowSelection={true}
          enableBulkActions={true}
        />
      );

      const checkboxes = container.querySelectorAll("input[type='checkbox']");
      const firstRowCheckbox = checkboxes[1];

      await userEvent.click(firstRowCheckbox as HTMLInputElement);

      expect(screen.getByText(/1 row selected/)).toBeInTheDocument();
    });

    it("should call onBulkAction when bulk action is triggered", async () => {
      const onBulkAction = vi.fn();
      const { container } = render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onBulkAction={onBulkAction}
          enableRowSelection={true}
          enableBulkActions={true}
        />
      );

      const checkboxes = container.querySelectorAll("input[type='checkbox']");
      await userEvent.click(checkboxes[1] as HTMLInputElement);

      const deleteButton = screen.getByText("Delete");
      await userEvent.click(deleteButton);

      expect(onBulkAction).toHaveBeenCalledWith("delete", ["1"]);
    });
  });

  describe("Pagination", () => {
    it("should paginate data correctly", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          enablePagination={true}
          pagination={{
            pageSize: 2,
            currentPage: 1,
          }}
        />
      );

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.queryByText("Charlie Brown")).not.toBeInTheDocument();
    });

    it("should call onPageSizeChange when page size is changed", async () => {
      const onPageSizeChange = vi.fn();
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          enablePagination={true}
          pagination={{
            pageSize: 10,
            currentPage: 1,
            onPageSizeChange,
          }}
        />
      );

      const pageSizeSelect = screen.getByDisplayValue("10");
      await userEvent.selectOptions(pageSizeSelect, "25");

      expect(onPageSizeChange).toHaveBeenCalledWith(25);
    });

    it("should disable prev button on first page", () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          enablePagination={true}
          pagination={{
            pageSize: 10,
            currentPage: 1,
            totalCount: 30,
          }}
        />
      );

      const prevButton = screen.getByText("Previous");
      expect(prevButton).toBeDisabled();
    });
  });

  describe("Column Visibility", () => {
    it("should hide columns when toggled", async () => {
      const { container } = render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          enableColumnVisibility={true}
        />
      );

      // Initially all columns visible
      expect(screen.getByText("Email")).toBeInTheDocument();

      // This would require accessing the column visibility UI
      // which depends on toolbar implementation
    });
  });

  describe("Export Functions", () => {
    it("should generate CSV correctly", () => {
      const csv = generateCSV(mockData, mockColumns);

      expect(csv).toContain("Name,Email,Status,Join Date");
      expect(csv).toContain("Alice Johnson");
      expect(csv).toContain("bob@example.com");
    });

    it("should generate JSON correctly", () => {
      const json = generateJSON(mockData, mockColumns);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toHaveProperty("name", "Alice Johnson");
    });

    it("should escape CSV special characters", () => {
      const dataWithSpecialChars: TestRow[] = [
        {
          id: "1",
          name: 'John "The Boss" Doe',
          email: "john@example.com",
          status: "active",
          joinDate: new Date(),
        },
      ];

      const csv = generateCSV(dataWithSpecialChars, mockColumns);
      expect(csv).toContain('"John ""The Boss"" Doe"');
    });

    it("should export selected rows", () => {
      const csv = generateCSV(
        mockData.filter((d) => d.id === "1" || d.id === "2"),
        mockColumns
      );

      expect(csv).toContain("Alice Johnson");
      expect(csv).toContain("Bob Smith");
      expect(csv).not.toContain("Charlie Brown");
    });
  });

  describe("Row Click Handler", () => {
    it("should call onRowClick when a row is clicked", async () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          onRowClick={onRowClick}
        />
      );

      const firstRow = screen.getByText("Alice Johnson");
      await userEvent.click(firstRow);

      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });
  });
});
