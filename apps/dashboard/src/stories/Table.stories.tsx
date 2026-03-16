import type { Meta, StoryObj } from "@storybook/react";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

const meta = {
  title: "UI/Table",
  component: Table,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

interface OrderItem {
  id: string;
  orderNumber: string;
  customer: string;
  amount: number;
  status: "completed" | "pending" | "cancelled";
  date: string;
}

const sampleData: OrderItem[] = [
  {
    id: "1",
    orderNumber: "ORD-001",
    customer: "John Doe",
    amount: 250.5,
    status: "completed",
    date: "2024-01-15",
  },
  {
    id: "2",
    orderNumber: "ORD-002",
    customer: "Jane Smith",
    amount: 450.0,
    status: "pending",
    date: "2024-01-14",
  },
  {
    id: "3",
    orderNumber: "ORD-003",
    customer: "Bob Wilson",
    amount: 180.75,
    status: "completed",
    date: "2024-01-13",
  },
  {
    id: "4",
    orderNumber: "ORD-004",
    customer: "Alice Brown",
    amount: 320.25,
    status: "cancelled",
    date: "2024-01-12",
  },
];

const columns = [
  {
    key: "orderNumber",
    header: "Order",
    width: "100px",
  },
  {
    key: "customer",
    header: "Customer",
    width: "150px",
    sortable: true,
  },
  {
    key: "amount",
    header: "Amount",
    width: "100px",
    align: "right" as const,
    render: (item: OrderItem) => `$${item.amount.toFixed(2)}`,
  },
  {
    key: "status",
    header: "Status",
    width: "120px",
    render: (item: OrderItem) => {
      const statusConfig = {
        completed: { variant: "success" as const, icon: <CheckCircle2 size={14} /> },
        pending: { variant: "warning" as const },
        cancelled: { variant: "danger" as const, icon: <AlertCircle size={14} /> },
      };
      const config = statusConfig[item.status];
      return (
        <Badge variant={config.variant}>
          {config.icon} {item.status}
        </Badge>
      );
    },
  },
  {
    key: "date",
    header: "Date",
    width: "120px",
    sortable: true,
  },
];

export const Default: Story = {
  args: {
    columns,
    data: sampleData,
  },
};

export const Striped: Story = {
  args: {
    columns,
    data: sampleData,
    striped: true,
  },
};

export const Sortable: Story = {
  args: {
    columns: columns.map((col) =>
      col.key === "customer" || col.key === "date"
        ? { ...col, sortable: true }
        : col
    ),
    data: sampleData,
  },
};

export const WithRowClick: Story = {
  args: {
    columns,
    data: sampleData,
    onRowClick: (item) => alert(`Clicked: ${item.orderNumber}`),
  },
};

export const SelectedRow: Story = {
  args: {
    columns,
    data: sampleData,
    selectedId: "2",
  },
};

export const EmptyState: Story = {
  args: {
    columns,
    data: [],
    emptyMessage: "No orders found",
  },
};

export const WithStickyHeader: Story = {
  args: {
    columns,
    data: sampleData,
    stickyHeader: true,
  },
};

export const ComplexLayout: Story = {
  render: () => {
    const complexData = [
      ...sampleData,
      ...sampleData.map((item, i) => ({
        ...item,
        id: `${item.id}-dup-${i}`,
        orderNumber: `ORD-${String(i + 100).padStart(3, "0")}`,
      })),
    ];

    return (
      <div className="w-full">
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          Orders Table
        </h3>
        <Table columns={columns} data={complexData} striped />
      </div>
    );
  },
};
