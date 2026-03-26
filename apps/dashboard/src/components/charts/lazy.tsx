'use client';

import dynamic from 'next/dynamic';

const ChartLoadingFallback = () => (
  <div className="h-64 bg-wl-bg-secondary animate-pulse rounded-lg border border-wl-neutral-800" />
);

export const LazyLineChart = dynamic(
  () => import('./index').then((m) => ({ default: m.LineChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);

export const LazyBarChart = dynamic(
  () => import('./index').then((m) => ({ default: m.BarChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);

export const LazyPieChart = dynamic(
  () => import('./index').then((m) => ({ default: m.PieChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);

export const LazyAreaChart = dynamic(
  () => import('./index').then((m) => ({ default: m.AreaChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);

export const LazyComposedChart = dynamic(
  () => import('./index').then((m) => ({ default: m.ComposedChart })),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);

export const LazyXAxis = dynamic(
  () => import('./index').then((m) => ({ default: m.XAxis })),
  { ssr: false }
);

export const LazyYAxis = dynamic(
  () => import('./index').then((m) => ({ default: m.YAxis })),
  { ssr: false }
);

export const LazyCartesianGrid = dynamic(
  () => import('./index').then((m) => ({ default: m.CartesianGrid })),
  { ssr: false }
);

export const LazyTooltip = dynamic(
  () => import('./index').then((m) => ({ default: m.Tooltip })),
  { ssr: false }
);

export const LazyLegend = dynamic(
  () => import('./index').then((m) => ({ default: m.Legend })),
  { ssr: false }
);

export const LazyResponsiveContainer = dynamic(
  () => import('./index').then((m) => ({ default: m.ResponsiveContainer })),
  { ssr: false }
);

export const LazyCell = dynamic(
  () => import('./index').then((m) => ({ default: m.Cell })),
  { ssr: false }
);

export const LazyBar = dynamic(
  () => import('./index').then((m) => ({ default: m.Bar })),
  { ssr: false }
);

export const LazyLine = dynamic(
  () => import('./index').then((m) => ({ default: m.Line })),
  { ssr: false }
);

export const LazyArea = dynamic(
  () => import('./index').then((m) => ({ default: m.Area })),
  { ssr: false }
);

export const LazyPie = dynamic(
  () => import('./index').then((m) => ({ default: m.Pie })),
  { ssr: false }
);
