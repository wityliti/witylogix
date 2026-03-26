'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  answer: string;
  citations: Array<{
    title: string;
    section: string;
    url: string;
    content: string;
  }>;
  followUpQuestions: string[];
}

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (!response.ok) throw new Error('Search failed');
      const data: SearchResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  function open() {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  if (!isOpen) {
    return (
      <button
        onClick={open}
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border border-[var(--forge-border)] bg-[var(--forge-elevated)] hover:border-[var(--teal)] text-[var(--sand-dim)] hover:text-[var(--sand-muted)] transition-all text-sm group"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-80 transition-opacity">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <span className="flex-1 text-left">Ask AI...</span>
        <kbd className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-[var(--forge-border-light)] bg-[var(--forge-raised)] text-[var(--sand-dim)] font-mono">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        ref={dialogRef}
        className="w-full max-w-2xl mx-4 rounded-xl border border-[var(--forge-border-light)] bg-[var(--forge-surface)] shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden animate-scale-in"
      >
        {/* Search Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
          className="flex items-center gap-3 px-5 py-4 border-b border-[var(--forge-border)]"
        >
          {loading ? (
            <div className="w-5 h-5 flex-shrink-0">
              <svg className="animate-spin text-[var(--teal)]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v2a8 8 0 0 0 16 0v-2a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
              <circle cx="9" cy="13" r="1" fill="var(--teal)" stroke="none" />
              <circle cx="15" cy="13" r="1" fill="var(--teal)" stroke="none" />
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask anything about Witylogix..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[var(--sand)] placeholder-[var(--sand-dim)] focus:outline-none text-[15px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResult(null); setError(null); }}
              className="text-[var(--sand-dim)] hover:text-[var(--sand)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6" /><path d="M9 9l6 6" />
              </svg>
            </button>
          )}
        </form>

        {/* Results Area */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-[var(--forge-border-light)] border-t-[var(--teal)] animate-spin" />
              <span className="text-sm text-[var(--sand-dim)]">Thinking...</span>
            </div>
          ) : error ? (
            <div className="p-5">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          ) : result ? (
            <div className="p-5 space-y-5">
              {/* Answer */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
                  <span className="text-xs font-semibold text-[var(--teal)] uppercase tracking-wider">Answer</span>
                </div>
                <p className="text-[var(--sand)] text-[15px] leading-relaxed whitespace-pre-wrap">{result.answer}</p>
              </div>

              {/* Citations */}
              {result.citations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--mint,#34d399)]" />
                    <span className="text-xs font-semibold text-[var(--mint,#34d399)] uppercase tracking-wider">Sources</span>
                  </div>
                  <div className="grid gap-2">
                    {result.citations.map((c, idx) => (
                      <a
                        key={idx}
                        href={c.url}
                        onClick={() => setIsOpen(false)}
                        className="block px-3.5 py-2.5 rounded-lg border border-[var(--forge-border)] bg-[var(--forge-elevated)] hover:border-[var(--teal)] hover:bg-[var(--forge-raised)] transition-all group"
                      >
                        <div className="text-sm font-medium text-[var(--sand)] group-hover:text-[var(--teal)] transition-colors">{c.title}</div>
                        <div className="text-xs text-[var(--sand-dim)] mt-0.5">{c.section}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-ups */}
              {result.followUpQuestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--sand-dim)]" />
                    <span className="text-xs font-semibold text-[var(--sand-dim)] uppercase tracking-wider">Related</span>
                  </div>
                  <div className="grid gap-1.5">
                    {result.followUpQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setQuery(q); handleSearch(q); }}
                        className="w-full text-left px-3.5 py-2.5 rounded-lg border border-[var(--forge-border)] hover:border-[var(--teal)] hover:bg-[var(--forge-elevated)] text-sm text-[var(--sand-muted)] hover:text-[var(--teal)] transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--sand-dim)]" />
                <span className="text-xs font-semibold text-[var(--sand-dim)] uppercase tracking-wider">Try asking</span>
              </div>
              <div className="grid gap-1.5">
                {[
                  'How do I get started with Witylogix?',
                  'What are the API rate limits?',
                  'How does authentication work?',
                  'How do I create a shipment?',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => { setQuery(example); handleSearch(example); }}
                    className="w-full text-left px-3.5 py-2.5 rounded-lg border border-transparent hover:border-[var(--forge-border)] hover:bg-[var(--forge-elevated)] text-sm text-[var(--sand-muted)] hover:text-[var(--teal)] transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-[var(--forge-border)] text-[11px] text-[var(--sand-dim)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--forge-border-light)] bg-[var(--forge-raised)] font-mono text-[10px]">↵</kbd>
              Search
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--forge-border-light)] bg-[var(--forge-raised)] font-mono text-[10px]">Esc</kbd>
              Close
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v2a8 8 0 0 0 16 0v-2a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
            </svg>
            Powered by Claude
          </span>
        </div>
      </div>
    </div>
  );
}
