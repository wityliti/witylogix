"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { WLMap } from "@/components/map/wl-map";
import { PinLayer } from "@/components/map/pin-layer";

// ─── Types matching the API response shape ────────────────────────────────────

interface NotificationLog {
  id: string;
  createdAt: string;
  type: string;
  status: string;
  recipient?: string | null;
}

interface ApiLineItem {
  id?: string;
  name?: string;
  title?: string;
  product?: string;
  sku?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  unitPrice?: number;
  total?: number;
  lineTotal?: number;
}

interface PrimaryShipment {
  id: string;
  shipmentNumber: string;
  trackingNumber: string | null;
  status: string;
  deliveryMethod: string;
  estimatedArrival: string | null;
  deliveryLocation: { lat: number; lng: number } | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  addressLine1: string | null;
}

interface ApiOrder {
  id: string;
  externalOrderNumber: string | null;
  externalOrderId: string;
  source: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  deliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
  totalPrice: string | number | null;
  totalWeight: string | number | null;
  itemCount: number;
  lineItems: ApiLineItem[];
  notes: string | null;
  driver: {
    id: string;
    name: string;
    phone: string | null;
    vehicleType: string | null;
  } | null;
  notificationLogs: NotificationLog[];
  primaryShipment: PrimaryShipment | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  ASSIGNED: "Assigned",
  PICKED_UP: "Picked Up",
  OUT_FOR_DELIVERY: "Out for Delivery",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "default"
> = {
  DELIVERED: "success",
  OUT_FOR_DELIVERY: "warning",
  ARRIVED: "warning",
  FAILED: "danger",
  CANCELLED: "danger",
  RETURNED: "danger",
};

// ─── Delivery Map sub-component ────────────────────────────────────────────────

function DeliveryPin({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const pins = useMemo(
    () => [{ id: "delivery", lat, lng, status: "open" as const, label }],
    [lat, lng, label],
  );
  return <PinLayer pins={pins} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const {
    data: order,
    loading,
    error,
    refetch,
  } = useApiQuery<ApiOrder>(id ? `/api/v4/orders/${id}` : null);

  const { execute: patchOrder } = useApiMutation<ApiOrder>(
    "PATCH",
    `/api/v4/orders/${id}`,
  );

  const saveNote = async () => {
    if (!noteInput.trim()) return;
    setSavingNote(true);
    try {
      await patchOrder({ notes: noteInput.trim() });
      setNoteInput("");
      refetch();
    } catch {
      // display is handled via the order refetch; silent fail is acceptable
    } finally {
      setSavingNote(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-wl-bg-root p-6">
        <LoadingSkeleton />
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-wl-bg-root p-6">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  if (!order)
    return (
      <div className="min-h-screen bg-wl-bg-root p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-2">Order not found</p>
          <p className="text-wl-text-secondary text-sm">
            This order may have been deleted or moved.
          </p>
        </div>
      </div>
    );

  const displayNumber =
    order.externalOrderNumber ?? order.externalOrderId ?? order.id.slice(0, 8);
  const statusLabel = STATUS_LABEL[order.status.toUpperCase()] ?? order.status;
  const statusVariant = STATUS_VARIANT[order.status.toUpperCase()] ?? "default";

  const lineItems: ApiLineItem[] = Array.isArray(order.lineItems)
    ? order.lineItems
    : [];
  const total = order.totalPrice != null ? Number(order.totalPrice) : null;

  const hasMap = order.deliveryLat != null && order.deliveryLng != null;
  const addressParts = [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.province,
    order.postalCode,
    order.country,
  ].filter(Boolean);
  const fullAddress = addressParts.join(", ") || "—";

  const shipment = order.primaryShipment;

  return (
    <div className="min-h-screen bg-wl-bg-root p-6 text-white">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">{displayNumber}</h1>
          <p className="text-sm text-wl-text-secondary mt-1">
            Created {new Date(order.createdAt).toLocaleDateString()} · Source:{" "}
            <span className="text-wl-neutral-300">{order.source}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm">
            Create Shipment
          </Button>
          <Button variant="secondary" size="sm">
            Print Label
          </Button>
          <Button variant="danger" size="sm">
            Cancel Order
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-wl-text-secondary font-medium">
            Status:
          </span>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        {order.deliveryDate && (
          <p className="text-sm text-wl-text-secondary">
            Delivery date:{" "}
            <span className="text-wl-text-primary">
              {new Date(order.deliveryDate).toLocaleDateString()}
            </span>
          </p>
        )}
        <p className="text-sm text-wl-text-tertiary">
          Last updated {new Date(order.updatedAt).toLocaleString()}
        </p>
      </div>

      {/* Three-column info grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Customer */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Customer</h3>
          {[
            { label: "Name", value: order.customerName },
            { label: "Email", value: order.customerEmail },
            { label: "Phone", value: order.customerPhone },
            order.driver ? { label: "Driver", value: order.driver.name } : null,
          ]
            .filter(Boolean)
            .map((row, i) => (
              <div
                key={i}
                className="flex justify-between py-2.5 border-b border-wl-border-default text-sm last:border-0"
              >
                <span className="text-wl-text-secondary">{row!.label}</span>
                <span className="text-wl-text-primary font-medium truncate max-w-[60%] text-right">
                  {row!.value ?? "—"}
                </span>
              </div>
            ))}
        </div>

        {/* Delivery address + map */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            Delivery Address
          </h3>
          {[
            { label: "Street", value: order.addressLine1 },
            { label: "City", value: order.city },
            { label: "State/Province", value: order.province },
            { label: "Postal", value: order.postalCode },
            { label: "Country", value: order.country },
          ].map((row, i) => (
            <div
              key={i}
              className="flex justify-between py-2 border-b border-wl-border-default text-sm last:border-0"
            >
              <span className="text-wl-text-secondary">{row.label}</span>
              <span className="text-wl-text-primary font-medium">
                {row.value ?? "—"}
              </span>
            </div>
          ))}
          {hasMap ? (
            <div className="w-full h-44 mt-4 rounded-lg overflow-hidden">
              <WLMap
                center={[order.deliveryLng!, order.deliveryLat!]}
                zoom={14}
                interactive={false}
                className="w-full h-full"
              >
                <DeliveryPin
                  lat={order.deliveryLat!}
                  lng={order.deliveryLng!}
                  label={fullAddress}
                />
              </WLMap>
            </div>
          ) : (
            <p className="text-xs text-wl-text-tertiary mt-3 italic">
              No map coordinates on record.
            </p>
          )}
        </div>

        {/* Shipment / Tracking */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Shipment</h3>
          {shipment ? (
            <>
              {[
                { label: "Shipment #", value: shipment.shipmentNumber },
                { label: "Tracking #", value: shipment.trackingNumber },
                { label: "Method", value: shipment.deliveryMethod },
                {
                  label: "Est. Delivery",
                  value: shipment.estimatedArrival
                    ? new Date(shipment.estimatedArrival).toLocaleDateString()
                    : null,
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex justify-between py-2.5 border-b border-wl-border-default text-sm last:border-0"
                >
                  <span className="text-wl-text-secondary">{row.label}</span>
                  <span className="text-wl-text-primary font-medium">
                    {row.value ?? "—"}
                  </span>
                </div>
              ))}
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-wl-text-secondary">Status</span>
                <Badge
                  variant={
                    shipment.status === "DELIVERED" ? "success" : "default"
                  }
                >
                  {shipment.status}
                </Badge>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-wl-text-tertiary">
              <p className="text-sm font-medium text-wl-text-secondary mb-1">
                No shipment yet
              </p>
              <p className="text-xs">Create a shipment to start tracking.</p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">
          Line Items{" "}
          <span className="text-wl-text-tertiary ml-1">
            ({lineItems.length})
          </span>
        </h3>
        {lineItems.length === 0 ? (
          <p className="text-wl-text-tertiary text-sm py-4 text-center">
            No line items recorded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Product", "SKU", "Qty", "Unit Price", "Total"].map((h) => (
                    <th
                      key={h}
                      className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left text-xs font-semibold text-wl-text-secondary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => {
                  const name = item.name ?? item.title ?? item.product ?? "—";
                  const sku = item.sku ?? "—";
                  const qty = item.quantity ?? item.qty ?? 1;
                  const unit = item.unitPrice ?? item.price ?? 0;
                  const itemTotal = item.total ?? item.lineTotal ?? unit * qty;
                  return (
                    <tr
                      key={item.id ?? idx}
                      className="hover:bg-wl-bg-elevated transition-colors"
                    >
                      <td className="border-b border-wl-border-default p-3 text-sm text-wl-neutral-300">
                        {name}
                      </td>
                      <td className="border-b border-wl-border-default p-3 text-sm text-wl-text-secondary">
                        {sku}
                      </td>
                      <td className="border-b border-wl-border-default p-3 text-sm text-wl-neutral-300">
                        {qty}
                      </td>
                      <td className="border-b border-wl-border-default p-3 text-sm text-wl-neutral-300">
                        {unit ? `₹${Number(unit).toLocaleString()}` : "—"}
                      </td>
                      <td className="border-b border-wl-border-default p-3 text-sm text-wl-text-primary font-medium">
                        {itemTotal
                          ? `₹${Number(itemTotal).toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total != null && (
          <div className="mt-4 flex justify-end">
            <div className="text-right">
              <div className="flex items-center gap-8 py-2 text-sm text-wl-text-secondary">
                <span>Items</span>
                <span className="text-wl-neutral-300">{order.itemCount}</span>
              </div>
              <div className="flex items-center gap-8 py-2 border-t border-wl-border-default text-base font-bold text-blue-400">
                <span>Total</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activity Timeline from notification logs */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            Activity Timeline
          </h3>
          {order.notificationLogs.length === 0 ? (
            <p className="text-wl-text-tertiary text-sm text-center py-6">
              No activity recorded yet.
            </p>
          ) : (
            <div className="relative pl-6 space-y-4 max-h-72 overflow-y-auto">
              {order.notificationLogs.map((log, idx) => (
                <div key={log.id} className="relative">
                  <span
                    className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 border-wl-border-default ${
                      log.status === "sent" || log.status === "delivered"
                        ? "bg-emerald-500"
                        : log.status === "failed"
                          ? "bg-red-500"
                          : "bg-blue-500"
                    }`}
                  />
                  <p className="text-xs text-wl-text-tertiary">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-wl-neutral-300 font-medium mt-0.5">
                    {log.type.replace(/_/g, " ")}
                  </p>
                  {log.recipient && (
                    <p className="text-xs text-wl-text-tertiary mt-0.5">
                      → {log.recipient}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            Internal Notes
          </h3>
          {order.notes ? (
            <div className="bg-wl-bg-root border border-wl-border-default rounded-lg p-4 mb-4">
              <p className="text-sm text-wl-neutral-300 leading-relaxed whitespace-pre-wrap">
                {order.notes}
              </p>
            </div>
          ) : (
            <p className="text-wl-text-tertiary text-sm mb-4 italic">
              No notes yet.
            </p>
          )}
          <label className="block text-xs font-medium text-wl-text-secondary mb-2">
            {order.notes ? "Update Notes" : "Add Notes"}
          </label>
          <textarea
            className="w-full p-3 bg-wl-bg-root border border-wl-border-default rounded-lg text-wl-neutral-300 text-sm min-h-[80px] resize-y focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Add internal notes…"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
          />
          <Button
            variant="primary"
            className="w-full mt-2"
            onClick={saveNote}
            disabled={savingNote || !noteInput.trim()}
          >
            {savingNote ? "Saving…" : "Save Notes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
