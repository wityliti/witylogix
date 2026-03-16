"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Package,
  Download,
  Printer,
  MoreVertical,
  Plus,
  Filter,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

interface ShippingLabel {
  id: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  destination: string;
  status: "created" | "voided" | "printed";
  createdAt: string;
  weight: number;
  dimensions: { length: number; width: number; height: number };
}

export default function ShippingLabelsPage() {
  // Mock data
  const mockLabels: ShippingLabel[] = [
    {
      id: "label-1",
      trackingNumber: "1Z999AA10123456784",
      carrier: "UPS",
      service: "Ground",
      destination: "New York, NY",
      status: "printed",
      createdAt: "2025-03-16T10:30:00Z",
      weight: 2.5,
      dimensions: { length: 12, width: 8, height: 4 },
    },
    {
      id: "label-2",
      trackingNumber: "9400111899223456789",
      carrier: "USPS",
      service: "Priority Mail",
      destination: "Los Angeles, CA",
      status: "created",
      createdAt: "2025-03-16T09:15:00Z",
      weight: 1.2,
      dimensions: { length: 10, width: 6, height: 3 },
    },
    {
      id: "label-3",
      trackingNumber: "6934567890123456789",
      carrier: "FedEx",
      service: "Overnight",
      destination: "Chicago, IL",
      status: "voided",
      createdAt: "2025-03-16T08:00:00Z",
      weight: 3.8,
      dimensions: { length: 14, width: 10, height: 5 },
    },
  ];

  // State
  const [labels, setLabels] = useState<ShippingLabel[]>(mockLabels);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());

  // Filter labels
  const filteredLabels = useMemo(() => {
    return labels.filter((label) => {
      const matchesSearch =
        searchTerm === "" ||
        label.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        label.destination.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCarrier =
        filterCarrier === "" || label.carrier === filterCarrier;
      const matchesStatus = filterStatus === "" || label.status === filterStatus;
      return matchesSearch && matchesCarrier && matchesStatus;
    });
  }, [labels, searchTerm, filterCarrier, filterStatus]);

  // Get unique carriers
  const carriers = useMemo(
    () => [...new Set(labels.map((l) => l.carrier))],
    [labels]
  );

  // Toggle label selection
  const toggleLabelSelection = useCallback((labelId: string) => {
    setSelectedLabels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(labelId)) {
        newSet.delete(labelId);
      } else {
        newSet.add(labelId);
      }
      return newSet;
    });
  }, []);

  // Toggle all labels
  const toggleAllLabels = useCallback(() => {
    if (selectedLabels.size === filteredLabels.length) {
      setSelectedLabels(new Set());
    } else {
      setSelectedLabels(new Set(filteredLabels.map((l) => l.id)));
    }
  }, [filteredLabels, selectedLabels.size]);

  // Void selected labels
  const voidSelectedLabels = useCallback(() => {
    setLabels((prev) =>
      prev.map((label) =>
        selectedLabels.has(label.id) ? { ...label, status: "voided" as const } : label
      )
    );
    setSelectedLabels(new Set());
  }, [selectedLabels]);

  // Download label
  const downloadLabel = useCallback((label: ShippingLabel) => {
    console.log("Downloading label:", label.id);
    // Implementation would trigger actual download
  }, []);

  // Print label
  const printLabel = useCallback((label: ShippingLabel) => {
    console.log("Printing label:", label.id);
    // Implementation would trigger print dialog
  }, []);

  // Void label
  const voidLabel = useCallback((label: ShippingLabel) => {
    setLabels((prev) =>
      prev.map((l) =>
        l.id === label.id ? { ...l, status: "voided" as const } : l
      )
    );
  }, []);

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "printed":
        return "success";
      case "voided":
        return "danger";
      case "created":
        return "info";
      default:
        return "default";
    }
  };

  // Carrier options
  const carrierOptions = carriers.map((carrier) => ({
    value: carrier,
    label: carrier,
  }));

  const statusOptions = [
    { value: "created", label: "Created" },
    { value: "printed", label: "Printed" },
    { value: "voided", label: "Voided" },
  ];

  return (
    <div className={cn("p-6 max-w-7xl mx-auto")}>
      {/* Header */}
      <div className={cn("mb-8 flex items-center justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold text-wl-text-primary mb-1")}>
            Shipping Labels
          </h1>
          <p className={cn("text-sm text-wl-text-secondary")}>
            Create and manage shipping labels for your orders
          </p>
        </div>
        <Link href="/shipping/labels/new">
          <Button variant="primary" size="lg">
            <Plus className="w-4 h-4" />
            Create Label
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div
        className={cn(
          "mb-6 p-4 rounded-lg",
          "bg-wl-bg-elevated border border-wl-border-default",
          "flex flex-col gap-4 sm:flex-row sm:items-end"
        )}
      >
        <div className="flex-1 min-w-0">
          <Input
            placeholder="Search by tracking number or destination..."
            icon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            options={carrierOptions}
            placeholder="All Carriers"
            value={filterCarrier}
            onChange={(e) => setFilterCarrier(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            options={statusOptions}
            placeholder="All Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLabels.size > 0 && (
        <div
          className={cn(
            "mb-6 p-4 rounded-lg",
            "bg-wl-primary-500/10 border border-wl-primary-500/30",
            "flex items-center justify-between"
          )}
        >
          <span className="text-sm font-medium text-wl-text-primary">
            {selectedLabels.size} label{selectedLabels.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={voidSelectedLabels}
            >
              Void Selected
            </Button>
          </div>
        </div>
      )}

      {/* Labels Table */}
      {filteredLabels.length === 0 ? (
        <div
          className={cn(
            "py-12 text-center rounded-lg",
            "bg-wl-bg-elevated border border-wl-border-default"
          )}
        >
          <Package className="w-12 h-12 mx-auto mb-3 text-wl-text-tertiary" />
          <h3 className="text-lg font-semibold text-wl-text-primary mb-1">
            No shipping labels found
          </h3>
          <p className="text-sm text-wl-text-secondary mb-4">
            {labels.length === 0
              ? "Create your first shipping label to get started"
              : "Try adjusting your filters"}
          </p>
          {labels.length === 0 && (
            <Link href="/shipping/labels/new">
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4" />
                Create Label
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "rounded-lg overflow-hidden",
            "border border-wl-border-default"
          )}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-wl-border-default bg-wl-bg-elevated">
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedLabels.size === filteredLabels.length}
                    onChange={toggleAllLabels}
                    className={cn(
                      "w-4 h-4 rounded border",
                      "border-wl-border-default bg-wl-bg-surface",
                      "text-wl-primary-500 cursor-pointer"
                    )}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Tracking #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Carrier
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wl-border-default">
              {filteredLabels.map((label) => (
                <tr
                  key={label.id}
                  className="hover:bg-wl-bg-overlay transition-colors duration-fast ease-default"
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedLabels.has(label.id)}
                      onChange={() => toggleLabelSelection(label.id)}
                      className={cn(
                        "w-4 h-4 rounded border",
                        "border-wl-border-default bg-wl-bg-surface",
                        "text-wl-primary-500 cursor-pointer"
                      )}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-wl-text-primary">
                    {label.trackingNumber}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-wl-text-primary">
                    {label.carrier}
                  </td>
                  <td className="px-6 py-4 text-sm text-wl-text-secondary">
                    {label.service}
                  </td>
                  <td className="px-6 py-4 text-sm text-wl-text-secondary">
                    {label.destination}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={getStatusColor(label.status) as any}>
                      {label.status.charAt(0).toUpperCase() +
                        label.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-wl-text-secondary">
                    {new Date(label.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => downloadLabel(label)}
                        className={cn(
                          "p-2 rounded-md text-wl-text-secondary",
                          "hover:text-wl-text-primary hover:bg-wl-bg-overlay",
                          "transition-colors duration-fast ease-default"
                        )}
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => printLabel(label)}
                        className={cn(
                          "p-2 rounded-md text-wl-text-secondary",
                          "hover:text-wl-text-primary hover:bg-wl-bg-overlay",
                          "transition-colors duration-fast ease-default"
                        )}
                        title="Print"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <div className="relative group">
                        <button
                          className={cn(
                            "p-2 rounded-md text-wl-text-secondary",
                            "hover:text-wl-text-primary hover:bg-wl-bg-overlay",
                            "transition-colors duration-fast ease-default"
                          )}
                          title="More actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <div
                          className={cn(
                            "absolute right-0 top-full mt-1 hidden group-hover:block",
                            "bg-wl-bg-elevated border border-wl-border-default",
                            "rounded-md shadow-lg z-20 min-w-max"
                          )}
                        >
                          <button
                            onClick={() => voidLabel(label)}
                            className={cn(
                              "w-full text-left px-4 py-2 text-sm text-wl-danger-400",
                              "hover:bg-wl-danger-500/10",
                              "transition-colors duration-fast ease-default"
                            )}
                          >
                            Void Label
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {labels.length > 0 && (
        <div className={cn("mt-6 text-sm text-wl-text-secondary")}>
          Showing {filteredLabels.length} of {labels.length} labels
        </div>
      )}
    </div>
  );
}
