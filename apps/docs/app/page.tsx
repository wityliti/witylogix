'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IntegrationsMarquee } from './components/integrations-marquee';

const terminalLines = [
  { text: '$ npx create-witylogix my-store', type: 'command' },
  { text: '', type: 'blank' },
  { text: 'Initializing Witylogix delivery logistics...', type: 'info' },
  { text: 'Installing dependencies', type: 'info' },
  { text: '  + @witylogix/core', type: 'success' },
  { text: '  + @witylogix/api', type: 'success' },
  { text: '  + @witylogix/tracking', type: 'success' },
  { text: '  + @witylogix/webhooks', type: 'success' },
  { text: '', type: 'blank' },
  { text: 'Integrations detected:', type: 'info' },
  { text: '  ✓ Shopify', type: 'success' },
  { text: '  ✓ WooCommerce', type: 'success' },
  { text: '', type: 'blank' },
  { text: 'Setup complete.', type: 'highlight' },
  { text: '', type: 'blank' },
  { text: 'Ready at http://localhost:8000', type: 'highlight' },
];

function Terminal() {
  const [lines, setLines] = useState<typeof terminalLines>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i >= terminalLines.length) {
        setDone(true);
        clearInterval(id);
        return;
      }
      const line = terminalLines[i];
      i++;
      setLines((prev) => [...prev, line]);
    }, 90);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="terminal animate-fade-up stagger-3">
      <div className="terminal-header">
        <div className="terminal-dot bg-[#ff5f57]" />
        <div className="terminal-dot bg-[#febc2e]" />
        <div className="terminal-dot bg-[#28c840]" />
        <span className="ml-auto text-[11px] font-mono text-sand-dim">terminal</span>
      </div>
      <div className="terminal-body">
        {lines.map((line, idx) => (
          <div key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
            {line.type === 'blank' ? (
              <div className="h-4" />
            ) : line.type === 'command' ? (
              <span className="text-teal font-medium">{line.text}</span>
            ) : line.type === 'success' ? (
              <span className="text-teal-light">{line.text}</span>
            ) : line.type === 'highlight' ? (
              <span className="text-coral-light font-semibold">{line.text}</span>
            ) : (
              <span className="text-sand-dim">{line.text}</span>
            )}
          </div>
        ))}
        {done && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-teal">$</span>
            <span className="inline-block w-2 h-4 bg-teal animate-terminal-blink" />
          </div>
        )}
      </div>
    </div>
  );
}

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8" /><path d="M12 17v4" />
        <path d="M7 8l3 3-3 3" /><path d="M13 14h4" />
      </svg>
    ),
    title: 'Multi-Platform SDK',
    description: 'Type-safe SDKs for Shopify, WooCommerce, Magento, and custom storefronts. One API, every platform.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
    title: 'Real-Time Tracking',
    description: 'Live GPS tracking, delivery confirmations, and push notifications. WebSocket-powered instant updates.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: 'Self-Hosted & Secure',
    description: 'Full data sovereignty. Deploy on-premises or private cloud. Zero vendor lock-in, complete control.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: 'AI Route Optimization',
    description: 'ML-powered route planning, dynamic dispatch, and smart delivery windows that reduce costs 30%.',
  },
];

const stats = [
  { value: '73', label: 'API Endpoints' },
  { value: '180+', label: 'Test Suites' },
  { value: '4', label: 'Platform SDKs' },
  { value: '<50ms', label: 'Avg. Latency' },
];

const quickLinks = [
  { title: 'Getting Started', href: '/docs/getting-started', description: 'Install, configure, and ship your first delivery in minutes.' },
  { title: 'API Reference', href: '/docs/api', description: 'Complete REST API documentation with request/response examples.' },
  { title: 'Architecture', href: '/docs/architecture', description: 'System design, data models, and deployment topology.' },
  { title: 'Guides', href: '/docs/guides/platform-adapters', description: 'Platform integrations, webhooks, billing, and workflows.' },
  { title: 'Components', href: '/docs/components', description: 'Pre-built UI components for tracking pages and dashboards.' },
  { title: 'Self-Hosting', href: '/docs/self-hosting', description: 'Docker deployment, environment variables, and production config.' },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-forge-border/60 bg-forge-bg/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 sm:px-6 lg:px-8 h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Witylogix" className="h-7 w-7 rounded-md" />
            <span className="font-display font-bold text-sand tracking-tight">Witylogix</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/docs/getting-started" className="text-sm text-sand-muted hover:text-sand transition-colors">Docs</Link>
            <Link href="/docs/api" className="text-sm text-sand-muted hover:text-sand transition-colors">API</Link>
            <Link href="https://github.com/wityliti/witylogix" className="text-sm text-sand-muted hover:text-sand transition-colors">GitHub</Link>
          </div>
        </div>
      </nav>

      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-teal/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-coral/[0.02] blur-[100px]" />
      </div>

      {/* ---- HERO ---- */}
      <section className="relative z-10 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20 items-center">
            {/* Left: Copy */}
            <div className="space-y-8">
              <div className="animate-fade-up">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/[0.06] px-4 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal animate-glow-pulse" />
                  <span className="text-xs font-medium text-teal-light tracking-wide">Open Source Delivery Logistics</span>
                </div>
                <h1 className="font-display">
                  <span className="block text-sand">Ship Faster.</span>
                  <span className="block text-gradient-brand">Track Everything.</span>
                  <span className="block text-sand">Own Your Stack.</span>
                </h1>
              </div>

              <p className="animate-fade-up stagger-1 text-lg text-sand-muted leading-relaxed max-w-lg">
                The open-source delivery logistics platform for e-commerce.
                Multi-platform integrations, real-time tracking, and complete self-hosting.
              </p>

              <div className="animate-fade-up stagger-2 flex flex-col sm:flex-row gap-4">
                <Link href="/docs/getting-started" className="btn-primary">
                  Get Started
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link href="/docs/api" className="btn-ghost">
                  API Reference
                </Link>
              </div>

              {/* Stats row */}
              <div className="animate-fade-up stagger-4 grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 border-t border-forge-border">
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="stat-value">{s.value}</div>
                    <div className="mt-1 text-xs text-sand-dim">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Terminal */}
            <div className="relative">
              {/* Glow behind terminal */}
              <div className="absolute -inset-4 rounded-2xl bg-teal/[0.04] blur-2xl animate-glow-pulse" />
              <Terminal />
            </div>
          </div>
        </div>
      </section>

      {/* ---- FEATURES ---- */}
      <section className="relative z-10 py-24 border-t border-forge-border">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-16 animate-fade-up">
            <h2 className="font-display text-sand mb-4">Built for Scale</h2>
            <p className="text-sand-muted text-lg max-w-xl mx-auto">
              Enterprise-grade features designed for developers who ship fast and demand reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`forge-card border-gradient group animate-fade-up stagger-${i + 1}`}
              >
                <div className="feature-icon mb-5 text-teal transition-transform duration-300 group-hover:scale-110">
                  {f.icon}
                </div>
                <h3 className="font-display text-lg text-sand mb-2">{f.title}</h3>
                <p className="text-sm text-sand-muted leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- INTEGRATIONS MARQUEE ---- */}
      <section className="relative z-10 py-16 border-t border-forge-border overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="font-display text-xl text-sand">Works With Your Stack</h3>
              <p className="text-sm text-sand-dim mt-1">Pre-built integrations for the tools you already use.</p>
            </div>
            <Link
              href="/docs/integrations"
              className="inline-flex items-center gap-2 text-sm font-medium text-teal hover:text-teal-light transition-colors flex-shrink-0"
            >
              View all integrations
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
        <IntegrationsMarquee />
      </section>

      {/* ---- QUICK LINKS ---- */}
      <section className="relative z-10 py-24 border-t border-forge-border">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-16 animate-fade-up">
            <h2 className="font-display text-sand mb-4">Explore the Docs</h2>
            <p className="text-sand-muted text-lg max-w-xl mx-auto">
              Jump straight to what you need. Every section is designed to get you shipping faster.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((link, i) => (
              <Link
                key={link.title}
                href={link.href}
                className={`group forge-card animate-fade-up stagger-${i + 1}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-2 w-2 rounded-full bg-teal/60 group-hover:bg-teal transition-colors" />
                  <h3 className="font-display text-base text-sand group-hover:text-teal transition-colors">{link.title}</h3>
                </div>
                <p className="text-sm text-sand-dim leading-relaxed">{link.description}</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-teal opacity-0 translate-x-[-8px] transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                  Read more
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="relative z-10 py-24 border-t border-forge-border">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <div className="animate-fade-up">
            <h2 className="font-display text-sand mb-4">Ready to Ship?</h2>
            <p className="text-sand-muted text-lg mb-10">
              Get started in minutes. Comprehensive docs, type-safe SDKs, and a community that helps you move fast.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/docs/getting-started" className="btn-coral">
                Start Building
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link href="https://github.com/wityliti/witylogix" className="btn-ghost">
                View on GitHub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className="relative z-10 border-t border-forge-border py-10">
        <div className="mx-auto max-w-6xl px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Witylogix" className="h-6 w-6 rounded-md" />
            <span className="font-display text-sm font-semibold text-sand">Witylogix</span>
          </div>
          <p className="text-xs text-sand-dim">
            Open-source delivery logistics for e-commerce. A{' '}
            <a href="https://wityliti.io" target="_blank" rel="noopener noreferrer" className="text-teal hover:text-teal-light transition-colors">wityliti.io</a>{' '}
            product.
          </p>
        </div>
      </footer>
    </div>
  );
}
