"use client";
import { useState } from "react";
import Link from "next/link";
import type { UpdateDeliveryZone } from "@witylogix/validators";

export interface InspectorZone {
  id: string;
  name: string;
  baseRate: number;
  perKmRate: number;
  minOrder: number;
  freeAbove: number | null;
  isActive: boolean;
  priority: number;
}

export interface InspectorOverlay {
  id: string;
  openOrders: number;
  drivers: number;
  slaPct: number;
  health: "good" | "watch" | "slipping";
}

export interface ZoneInspectorProps {
  zone: InspectorZone;
  overlay?: InspectorOverlay;
  mode: "monitor" | "configure";
  onSave: (patch: UpdateDeliveryZone) => void;
  onDelete: () => void;
  onEditGeometry: () => void;
}

const HEALTH_COLOR: Record<InspectorOverlay["health"], string> = {
  good: "var(--wl-success-500)",
  watch: "var(--wl-warning-500)",
  slipping: "var(--wl-danger-500)",
};

export function ZoneInspector({
  zone,
  overlay,
  mode,
  onSave,
  onDelete,
  onEditGeometry,
}: ZoneInspectorProps) {
  return (
    <aside
      aria-live="polite"
      className="flex flex-col w-80 h-full p-4 border-l"
      style={{
        background: "var(--wl-bg-surface)",
        borderColor: "var(--wl-neutral-800)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: "var(--wl-neutral-500)" }}
      >
        Zone
      </div>
      <div
        className="mt-1 mb-4 text-base font-semibold"
        style={{ color: "var(--wl-neutral-50)" }}
      >
        {zone.name}
      </div>

      {overlay && (
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <Stat
            label="SLA"
            value={`${Math.round(overlay.slaPct * 100)}%`}
            color={HEALTH_COLOR[overlay.health]}
          />
          <Stat label="Drivers" value={overlay.drivers} />
          <Stat label="Open" value={overlay.openOrders} />
          <Stat label="Active" value={zone.isActive ? "Yes" : "No"} />
        </div>
      )}

      {mode === "monitor" ? (
        <>
          <div
            className="text-[10px] uppercase tracking-wide mb-1"
            style={{ color: "var(--wl-neutral-500)" }}
          >
            Rates
          </div>
          <div
            className="text-sm mb-4"
            style={{ color: "var(--wl-neutral-100)" }}
          >
            Base {formatRate(zone.baseRate)}
            <br />+{formatRate(zone.perKmRate)}/km
          </div>
          <Link
            href={`/zones/${zone.id}`}
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--wl-primary-400)" }}
          >
            Open full detail →
          </Link>
        </>
      ) : (
        <ConfigureForm
          zone={zone}
          onSave={onSave}
          onDelete={onDelete}
          onEditGeometry={onEditGeometry}
        />
      )}
    </aside>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div>
      <div
        className="text-[9px] uppercase tracking-wider"
        style={{ color: "var(--wl-neutral-500)" }}
      >
        {label}
      </div>
      <div
        className="text-sm"
        style={{ color: color ?? "var(--wl-neutral-100)" }}
      >
        {value}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: keyof UpdateDeliveryZone;
  defaultValue: string | number | null;
  onSave: (patch: UpdateDeliveryZone) => void;
}

function Field({ label, name, defaultValue, onSave }: FieldProps) {
  return (
    <label className="block text-xs mb-2">
      <span style={{ color: "var(--wl-neutral-500)" }}>{label}</span>
      <input
        aria-label={label}
        defaultValue={defaultValue ?? ""}
        onBlur={(e) => {
          const raw = e.target.value;
          const v = raw === "" ? null : Number(raw);
          onSave({ [name]: v } as UpdateDeliveryZone);
        }}
        className="mt-1 w-full rounded px-2 py-1 text-sm border"
        style={{
          background: "var(--wl-bg-overlay)",
          borderColor: "var(--wl-neutral-800)",
          color: "var(--wl-neutral-100)",
        }}
      />
    </label>
  );
}

function ConfigureForm({
  zone,
  onSave,
  onDelete,
  onEditGeometry,
}: {
  zone: InspectorZone;
  onSave: (p: UpdateDeliveryZone) => void;
  onDelete: () => void;
  onEditGeometry: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Base rate"
        name="baseRate"
        defaultValue={zone.baseRate}
        onSave={onSave}
      />
      <Field
        label="Per-km rate"
        name="perKmRate"
        defaultValue={zone.perKmRate}
        onSave={onSave}
      />
      <Field
        label="Min order"
        name="minOrder"
        defaultValue={zone.minOrder}
        onSave={onSave}
      />
      <Field
        label="Free above"
        name="freeAbove"
        defaultValue={zone.freeAbove}
        onSave={onSave}
      />
      <label className="flex items-center gap-2 text-xs py-2">
        <input
          type="checkbox"
          defaultChecked={zone.isActive}
          onChange={(e) => onSave({ isActive: e.target.checked })}
          className="accent-[var(--wl-primary-500)]"
        />
        <span style={{ color: "var(--wl-neutral-200)" }}>Active</span>
      </label>
      <button
        onClick={onEditGeometry}
        className="mt-2 rounded py-1.5 text-xs border"
        style={{
          background: "var(--wl-bg-overlay)",
          borderColor: "var(--wl-neutral-800)",
          color: "var(--wl-neutral-100)",
        }}
      >
        Edit geometry
      </button>
      {confirmDelete ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setConfirmDelete(false)}
            className="flex-1 text-[11px] rounded py-1 border"
            style={{
              borderColor: "var(--wl-neutral-800)",
              color: "var(--wl-neutral-200)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="flex-1 text-[11px] rounded py-1 text-white"
            style={{ background: "var(--wl-danger-600)" }}
          >
            Confirm Delete
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="mt-3 text-[11px] text-left"
          style={{ color: "var(--wl-danger-400)" }}
        >
          Delete zone
        </button>
      )}
    </div>
  );
}

function formatRate(n: number): string {
  return `₹${n.toFixed(0)}`;
}
