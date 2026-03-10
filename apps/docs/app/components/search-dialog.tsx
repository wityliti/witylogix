'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, XCircle } from 'lucide-react';
import clsx from 'clsx';

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

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dialog when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred during search'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFollowUp(question: string) {
    setQuery(question);
    // Trigger search for follow-up question
    setTimeout(() => {
      handleSearch({
        preventDefault: () => {},
      } as React.FormEvent);
    }, 100);
  }

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-wl-border bg-wl-bg-secondary hover:border-wl-accent/50 transition-colors group"
      >
        <Search className="w-4 h-4 text-wl-text-secondary group-hover:text-wl-accent transition-colors" />
        <span className="text-sm text-wl-text-secondary flex-1 text-left">
          Search docs...
        </span>
        <kbd className="hidden sm:inline-flex text-xs px-2 py-1 rounded bg-wl-bg-tertiary border border-wl-border text-wl-text-muted font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm">
          <div
            ref={dialogRef}
            className="w-full max-w-2xl mx-4 rounded-lg border border-wl-border bg-wl-bg-secondary shadow-wl-xl overflow-hidden"
          >
            {/* Search Input */}
            <form onSubmit={handleSearch} className="border-b border-wl-border p-4">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-wl-accent flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask anything about Witylogix..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-wl-text placeholder-wl-text-muted focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setResult(null);
                      setError(null);
                    }}
                    className="text-wl-text-muted hover:text-wl-text transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-wl-accent animate-spin" />
                  <span className="ml-3 text-wl-text-secondary">
                    Searching documentation...
                  </span>
                </div>
              ) : error ? (
                <div className="p-6">
                  <div className="rounded-lg bg-wl-error/10 border border-wl-error/30 p-4">
                    <p className="text-sm text-wl-error">{error}</p>
                  </div>
                </div>
              ) : result ? (
                <div className="p-6 space-y-6">
                  {/* Answer */}
                  <div>
                    <h3 className="text-sm font-semibold text-wl-accent mb-3">
                      Answer
                    </h3>
                    <p className="text-wl-text leading-relaxed">
                      {result.answer}
                    </p>
                  </div>

                  {/* Citations */}
                  {result.citations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-wl-accent mb-3">
                        Sources
                      </h3>
                      <div className="space-y-2">
                        {result.citations.map((citation, idx) => (
                          <a
                            key={idx}
                            href={citation.url}
                            className="block p-3 rounded-lg bg-wl-bg-primary border border-wl-border hover:border-wl-accent/50 hover:bg-wl-bg-tertiary transition-colors"
                          >
                            <div className="font-medium text-sm text-wl-accent">
                              {citation.title}
                            </div>
                            <div className="text-xs text-wl-text-muted mt-1">
                              {citation.section}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up Questions */}
                  {result.followUpQuestions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-wl-accent mb-3">
                        Follow-up questions
                      </h3>
                      <div className="space-y-2">
                        {result.followUpQuestions.map((question, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleFollowUp(question)}
                            className="w-full text-left p-3 rounded-lg bg-wl-bg-primary border border-wl-border hover:border-wl-accent/50 hover:bg-wl-bg-tertiary transition-colors group"
                          >
                            <div className="text-sm text-wl-text group-hover:text-wl-accent transition-colors">
                              {question}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : query ? (
                <div className="p-6 text-center">
                  <p className="text-wl-text-secondary">
                    Click the search button or press Enter to search
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-wl-accent mb-3">
                      EXAMPLE QUERIES
                    </p>
                    <div className="space-y-2">
                      {[
                        'How do I get started?',
                        'What are the rate limits?',
                        'How do I authenticate?',
                        'How do I create a shipment?',
                      ].map((example) => (
                        <button
                          key={example}
                          onClick={() => {
                            setQuery(example);
                            setTimeout(() => {
                              handleSearch({
                                preventDefault: () => {},
                              } as React.FormEvent);
                            }, 100);
                          }}
                          className="w-full text-left text-sm text-wl-text-secondary hover:text-wl-accent p-2 rounded hover:bg-wl-bg-primary transition-colors"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-wl-border bg-wl-bg-primary px-4 py-3 flex items-center justify-between text-xs text-wl-text-muted">
              <div className="flex gap-4">
                <span>Press ESC to close</span>
              </div>
              <div className="flex gap-2">
                <span>Powered by Claude</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
