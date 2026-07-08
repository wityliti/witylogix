"use client";

import dynamic from "next/dynamic";
// Recharts components have complex internal types that don't directly satisfy Next.js dynamic() constraints
// We use a typed adapter to bridge between recharts component types and Next.js dynamic() expectations
type AnyProps = Record<string, unknown>;
type AnyComponent = React.ComponentType<AnyProps>;
// This function coerces any module loader to the expected dynamic() format
// The recharts components are valid React components at runtime despite the type mismatch
function makeLoader<T>(
  loader: () => Promise<{ default: T }>,
): () => Promise<{ default: AnyComponent }> {
  return loader as unknown as () => Promise<{ default: AnyComponent }>;
}

const ChartLoadingFallback = () => (
  <div className="h-64 bg-wl-bg-secondary animate-pulse rounded-lg border border-wl-neutral-800" />
);

export const LazyLineChart = dynamic(
  () => import("./index").then((m) => ({ default: m.LineChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> },
);

export const LazyBarChart = dynamic(
  () => import("./index").then((m) => ({ default: m.BarChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> },
);

export const LazyPieChart = dynamic(
  () => import("./index").then((m) => ({ default: m.PieChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> },
);

export const LazyAreaChart = dynamic(
  () => import("./index").then((m) => ({ default: m.AreaChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> },
);

export const LazyComposedChart = dynamic(
  () => import("./index").then((m) => ({ default: m.ComposedChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> },
);

export const LazyXAxis = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.XAxis }))),
  { ssr: false },
);

export const LazyYAxis = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.YAxis }))),
  { ssr: false },
);

export const LazyCartesianGrid = dynamic(
  makeLoader(() =>
    import("./index").then((m) => ({ default: m.CartesianGrid })),
  ),
  { ssr: false },
);

export const LazyTooltip = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.Tooltip }))),
  { ssr: false },
);

export const LazyLegend = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.Legend }))),
  { ssr: false },
);

export const LazyResponsiveContainer = dynamic(
  makeLoader(() =>
    import("./index").then((m) => ({ default: m.ResponsiveContainer })),
  ),
  { ssr: false },
);

export const LazyCell = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.Cell }))),
  { ssr: false },
);

export const LazyBar = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.Bar }))),
  { ssr: false },
);

export const LazyLine = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.Line }))),
  { ssr: false },
);

export const LazyArea = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.Area }))),
  { ssr: false },
);

export const LazyPie = dynamic(
  makeLoader(() => import("./index").then((m) => ({ default: m.Pie }))),
  { ssr: false },
);
