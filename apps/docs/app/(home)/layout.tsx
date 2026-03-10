'use client';

import React, { ReactNode } from 'react';
import { Nav } from '@/components/nav';

interface HomeLayoutProps {
  children: ReactNode;
}

export default function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div className="min-h-screen bg-wl-bg-primary text-wl-text">
      <Nav />
      <main>{children}</main>
    </div>
  );
}
