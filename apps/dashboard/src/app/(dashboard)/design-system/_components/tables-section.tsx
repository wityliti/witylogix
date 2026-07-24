"use client";

import { Badge, Card } from "@/components/ui";

export function TablesSection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Tables</h2>
        <p className="text-gray-300 mb-8">
          Responsive table component for displaying structured data.
        </p>

        <Card className="w-full overflow-hidden">
          <table>
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left px-4 py-3 font-semibold text-white">
                  ID
                </th>
                <th className="text-left px-4 py-3 font-semibold text-white">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-semibold text-white">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-semibold text-white">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  id: "001",
                  name: "John Doe",
                  status: "Active",
                  date: "2024-01-15",
                },
                {
                  id: "002",
                  name: "Jane Smith",
                  status: "Pending",
                  date: "2024-01-14",
                },
                {
                  id: "003",
                  name: "Bob Johnson",
                  status: "Inactive",
                  date: "2024-01-13",
                },
              ].map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-[#1e1e2e] hover:bg-[#12121a] transition-colors"
                >
                  <td className="px-4 py-3 text-gray-300">{row.id}</td>
                  <td className="px-4 py-3 text-white">{row.name}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        row.status === "Active"
                          ? "success"
                          : row.status === "Pending"
                            ? "warning"
                            : "default"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
