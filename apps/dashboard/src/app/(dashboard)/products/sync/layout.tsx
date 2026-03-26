'use client';

import { ReactNode } from 'react';

interface SyncLayoutProps {
  children: ReactNode;
}

export default function SyncLayout({ children }: SyncLayoutProps) {
  return <>{children}</>;
}
