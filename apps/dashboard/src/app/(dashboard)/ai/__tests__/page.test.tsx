// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/link so it renders a plain anchor in tests
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// Mock useApiQuery to return empty data (graceful zero path)
vi.mock('@/hooks/use-api', () => ({
  useApiQuery: () => ({ data: null, loading: false, error: null, refetch: vi.fn() }),
}));

// Mock cn and Badge/Card so we don't need Tailwind or full component tree
vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

import AiHubPage from '../page';
import React from 'react';

describe('AiHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the AI Hub page heading', () => {
    render(<AiHubPage />);
    expect(screen.getByText('AI & Intelligence')).toBeTruthy();
  });

  it('renders the feature grid', () => {
    render(<AiHubPage />);
    expect(screen.getByTestId('ai-feature-grid')).toBeTruthy();
  });

  it('renders all six feature cards', () => {
    render(<AiHubPage />);
    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBe(6);
  });

  it('renders ETA Prediction feature card', () => {
    render(<AiHubPage />);
    expect(screen.getByText('ETA Prediction')).toBeTruthy();
  });

  it('renders AI Co-pilot card as Coming Soon', () => {
    render(<AiHubPage />);
    expect(screen.getByText('AI Co-pilot')).toBeTruthy();
    const badges = screen.getAllByTestId('badge');
    const comingSoonBadge = badges.find((b) => b.textContent === 'Coming Soon');
    expect(comingSoonBadge).toBeTruthy();
  });

  it('renders hero subtitle', () => {
    render(<AiHubPage />);
    expect(screen.getByText('All your AI-powered logistics features in one place')).toBeTruthy();
  });

  it('renders usage count as 0 when API returns null (graceful zero)', () => {
    render(<AiHubPage />);
    const usageLabels = screen.getAllByText(/uses last 30 days/);
    expect(usageLabels.length).toBeGreaterThan(0);
    usageLabels.forEach((el) => {
      expect(el.textContent).toContain('0');
    });
  });
});
