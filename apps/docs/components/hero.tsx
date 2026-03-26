'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function Hero() {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const lines = [
      '$ pnpm create witylogix-app my-store',
      '',
      '⚙️  Initializing Witylogix delivery logistics...',
      '📦 Installing dependencies',
      '✓ @witylogix/core',
      '✓ @witylogix/api',
      '✓ @witylogix/tracking',
      '✓ @witylogix/webhooks',
      '',
      '🔗 Integrations detected:',
      '✓ Shopify',
      '✓ WooCommerce',
      '',
      '✨ Setup complete!',
      '',
      '🚀 Ready at localhost:8000',
      '📖 Docs: http://localhost:8000/docs',
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < lines.length) {
        setTerminalOutput((prev) => [...prev, lines[currentLine]]);
        currentLine++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-wl-bg-primary pt-20 pb-20">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url(data:image/svg+xml,%3Csvg width="40" height="40" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M0 0h40v40H0z" fill="none" stroke="%234f8fff" stroke-width="0.5"/%3E%3C/svg%3E)',
        }}
      />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-wl-bg-secondary via-wl-bg-primary to-wl-bg-primary opacity-40" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Hero content */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
          {/* Left: Text content */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-wl-text leading-tight">
                Ship Faster.
                <br />
                <span className="text-wl-accent">Track Everything.</span>
                <br />
                Own Your Stack.
              </h1>
              <p className="text-lg sm:text-xl text-wl-text-secondary max-w-lg leading-relaxed">
                Open-source delivery logistics platform for e-commerce. Multi-platform, real-time, self-hosted.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/docs/getting-started"
                className="group relative px-8 py-3 text-center font-medium text-wl-bg-primary bg-wl-accent rounded-lg hover:bg-wl-accent-light transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-wl-accent to-wl-accent-light opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative">Get Started</span>
              </Link>
              <Link
                href="/docs/api"
                className="group relative px-8 py-3 text-center font-medium text-wl-accent border border-wl-accent rounded-lg hover:bg-wl-accent/10 transition-all duration-300"
              >
                API Reference
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-8 border-t border-wl-border">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-wl-accent">350K+</p>
                <p className="text-sm text-wl-text-secondary">Lines of Code</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-wl-accent">180+</p>
                <p className="text-sm text-wl-text-secondary">Test Suites</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-wl-accent">73</p>
                <p className="text-sm text-wl-text-secondary">API Endpoints</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-wl-accent">4</p>
                <p className="text-sm text-wl-text-secondary">Platform Adapters</p>
              </div>
            </div>
          </div>

          {/* Right: Terminal */}
          <div className="relative animate-slide-up" style={{ animationDelay: '0.2s' }}>
            {/* Terminal window */}
            <div className="rounded-lg border border-wl-border bg-wl-bg-secondary/50 backdrop-blur-md overflow-hidden shadow-lg">
              {/* Terminal header */}
              <div className="bg-wl-bg-tertiary px-4 py-3 flex items-center gap-2 border-b border-wl-border">
                <div className="w-3 h-3 rounded-full bg-wl-status-error" />
                <div className="w-3 h-3 rounded-full bg-wl-status-warning" />
                <div className="w-3 h-3 rounded-full bg-wl-status-success" />
                <span className="ml-auto text-xs text-wl-text-secondary font-mono">terminal.sh</span>
              </div>

              {/* Terminal content */}
              <div className="p-6 font-mono text-sm text-wl-text-secondary space-y-1 h-96 overflow-hidden">
                {terminalOutput.map((line, index) => (
                  <div
                    key={index}
                    className="animate-fade-in"
                    style={{
                      animationDelay: `${index * 80}ms`,
                    }}
                  >
                    {line === '' ? (
                      <div>&nbsp;</div>
                    ) : line.startsWith('$') ? (
                      <div className="text-wl-accent">{line}</div>
                    ) : line.startsWith('✓') ? (
                      <div className="text-wl-status-success">{line}</div>
                    ) : line.startsWith('✨') || line.startsWith('🚀') ? (
                      <div className="text-wl-accent font-bold">{line}</div>
                    ) : (
                      <div>{line}</div>
                    )}
                  </div>
                ))}

                {isComplete && (
                  <div className="pt-4 border-t border-wl-border mt-4 animate-glow">
                    <p className="text-wl-accent font-bold">Ready to ship</p>
                  </div>
                )}
              </div>
            </div>

            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-wl-accent/20 to-wl-accent-light/20 rounded-lg blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </section>
  );
}
