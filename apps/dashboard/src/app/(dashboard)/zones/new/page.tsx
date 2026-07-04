"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { WLMap } from "@/components/map/wl-map";
import { DrawLayer } from "@/components/map/draw-layer";
import { api } from "@/lib/api";
import { track } from "@/lib/track";
import type { ZoneShape } from "@witylogix/validators";

const DEFAULT_CENTER: [number, number] = [77.12, 28.65];

export default function NewZonePage() {
  const router = useRouter();
  const [tool, setTool] = useState<"polygon" | "circle">("polygon");
  const [shape, setShape] = useState<ZoneShape | null>(null);
  const [name, setName] = useState("");
  const [baseRate, setBaseRate] = useState("0");
  const [perKmRate, setPerKmRate] = useState("0");
  const [minOrder, setMinOrder] = useState("0");
  const [freeAbove, setFreeAbove] = useState("");
  const [circleRadius, setCircleRadius] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = name.length > 0 && shape !== null;

  async function submit() {
    if (!shape) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = await api.post<{ data: { id: string } }>("/api/v4/zones", {
        name,
        shape,
        baseRate: Number(baseRate),
        perKmRate: Number(perKmRate),
        minOrder: Number(minOrder),
        freeAbove: freeAbove ? Number(freeAbove) : undefined,
      });
      track("zones.created", {
        shape: shape.type,
        baseRate: Number(baseRate),
        perKmRate: Number(perKmRate),
      });
      router.push(`/zones/${body.data.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header title="New zone" subtitle="Draw a shape, set rates, save." />
      <div
        className="relative h-[calc(100vh-64px)] w-full"
        style={{ background: "var(--wl-bg-root)" }}
      >
        <WLMap center={DEFAULT_CENTER} zoom={11}>
          <DrawLayer
            mode={tool}
            value={shape}
            onChange={setShape}
            circleRadiusMeters={circleRadius}
          />
        </WLMap>

        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div
            role="tablist"
            className="inline-flex rounded-md border text-sm"
            style={{
              background: "var(--wl-bg-elevated)",
              borderColor: "var(--wl-neutral-800)",
            }}
          >
            {(["polygon", "circle"] as const).map((t) => (
              <button
                key={t}
                aria-selected={tool === t}
                onClick={() => setTool(t)}
                className="px-3 py-1.5 capitalize"
                style={{
                  color:
                    tool === t
                      ? "var(--wl-neutral-50)"
                      : "var(--wl-neutral-400)",
                  background:
                    tool === t ? "var(--wl-primary-700)" : "transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {tool === "circle" && (
            <label
              className="flex flex-col text-xs p-2 rounded border"
              style={{
                background: "var(--wl-bg-elevated)",
                borderColor: "var(--wl-neutral-800)",
                color: "var(--wl-neutral-200)",
              }}
            >
              Radius: {(circleRadius / 1000).toFixed(1)} km
              <input
                type="range"
                min={100}
                max={30000}
                step={100}
                value={circleRadius}
                onChange={(e) => setCircleRadius(Number(e.target.value))}
              />
            </label>
          )}
        </div>

        <aside
          className="absolute top-0 right-0 h-full w-80 p-4 border-l"
          style={{
            background: "var(--wl-bg-surface)",
            borderColor: "var(--wl-neutral-800)",
          }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: "var(--wl-neutral-50)" }}
          >
            Zone details
          </h2>
          {[
            { label: "Name", value: name, onChange: setName, type: "text" },
            {
              label: "Base rate",
              value: baseRate,
              onChange: setBaseRate,
              type: "number",
            },
            {
              label: "Per-km rate",
              value: perKmRate,
              onChange: setPerKmRate,
              type: "number",
            },
            {
              label: "Min order",
              value: minOrder,
              onChange: setMinOrder,
              type: "number",
            },
            {
              label: "Free above",
              value: freeAbove,
              onChange: setFreeAbove,
              type: "number",
            },
          ].map((f) => (
            <label key={f.label} className="block text-xs mb-3">
              <span style={{ color: "var(--wl-neutral-500)" }}>{f.label}</span>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="mt-1 w-full rounded px-2 py-1 text-sm border"
                style={{
                  background: "var(--wl-bg-overlay)",
                  borderColor: "var(--wl-neutral-800)",
                  color: "var(--wl-neutral-100)",
                }}
              />
            </label>
          ))}
          {submitError && (
            <p
              className="text-xs mb-3"
              style={{ color: "var(--wl-danger-500)" }}
            >
              {submitError}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" onClick={() => router.push("/zones")}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!canSubmit || submitting}
              onClick={submit}
            >
              {submitting ? "Creating…" : "Create zone"}
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
