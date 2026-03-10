'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function Nav() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check system preference or localStorage
    const isDarkMode =
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newDark);
  };

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-wl-border bg-wl-bg-primary/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-wl-accent flex items-center justify-center">
            <span className="font-bold text-wl-bg-primary text-sm">W</span>
          </div>
          <span className="font-bold text-wl-text hidden sm:inline">Witylogix</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1 sm:gap-8">
          <Link
            href="/docs"
            className={`text-sm font-medium transition-colors px-3 py-2 rounded-md ${
              isActive('/docs')
                ? 'text-wl-accent bg-wl-bg-secondary'
                : 'text-wl-text-secondary hover:text-wl-text'
            }`}
          >
            Docs
          </Link>
          <Link
            href="/docs/api"
            className={`text-sm font-medium transition-colors px-3 py-2 rounded-md ${
              isActive('/docs/api')
                ? 'text-wl-accent bg-wl-bg-secondary'
                : 'text-wl-text-secondary hover:text-wl-text'
            }`}
          >
            API
          </Link>
          <Link
            href="/docs/components"
            className={`text-sm font-medium transition-colors px-3 py-2 rounded-md ${
              isActive('/docs/components')
                ? 'text-wl-accent bg-wl-bg-secondary'
                : 'text-wl-text-secondary hover:text-wl-text'
            }`}
          >
            Components
          </Link>

          {/* External links */}
          <a
            href="https://github.com/witylogix/witylogix"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-wl-text-secondary hover:text-wl-text transition-colors px-3 py-2 rounded-md"
          >
            GitHub
          </a>

          {/* Search trigger */}
          <button
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-wl-text-secondary bg-wl-bg-secondary rounded-md border border-wl-border hover:border-wl-border-light transition-colors"
            onClick={() => {
              // Trigger search modal
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                ctrlKey: true,
              });
              window.dispatchEvent(event);
            }}
          >
            <span>Search</span>
            <kbd className="hidden sm:inline text-xs opacity-75">⌘K</kbd>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-wl-text-secondary hover:text-wl-text transition-colors rounded-md hover:bg-wl-bg-secondary"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1m-16 0H1m15.364 1.636l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
