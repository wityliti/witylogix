'use client';

/**
 * SWR global configuration and provider.
 * Dependency: swr (must be installed in package.json)
 */

import { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { api } from './api';

/**
 * Global SWR config with sensible defaults for the dashboard
 */
const swrConfig = {
  fetcher: api.get,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  focusThrottleInterval: 300000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  loadingTimeout: 3000,
};

interface SWRProviderProps {
  children: ReactNode;
}

/**
 * SWR Provider component wrapping the global SWR config.
 * Wrap your app's root layout with this provider to enable SWR hooks globally.
 *
 * @example
 * ```tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <SWRProvider>
 *       {children}
 *     </SWRProvider>
 *   );
 * }
 * ```
 */
export function SWRProvider({ children }: SWRProviderProps) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
