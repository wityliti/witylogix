/**
 * Search Hook — Debounced search with loading/error states.
 *
 * Features:
 * - Debounced search (300ms default)
 * - Type-ahead suggestions
 * - Recent searches (localStorage)
 * - Keyboard navigation (↑↓ select, Enter to confirm)
 * - Error handling and retry
 *
 * @example
 * ```tsx
 * const search = useSearch({ limit: 20 });
 * return (
 *   <>
 *     <input {...search.register} />
 *     {search.isLoading && <Spinner />}
 *     {search.suggestions.map(s => <div key={s.id}>{s.title}</div>)}
 *   </>
 * );
 * ```
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// ─── TYPES ──────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  entity: "orders" | "drivers" | "deliveries" | "integrations" | "customers";
  title: string;
  description?: string;
  rank: number;
  highlight?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchSuggestion {
  id?: string;
  title: string;
  type: "recent" | "suggestion" | "action";
  metadata?: Record<string, any>;
}

export interface UseSearchOptions {
  type?: "orders" | "drivers" | "deliveries" | "integrations" | "customers";
  limit?: number;
  debounceMs?: number;
  onSearch?: (results: SearchResult[]) => void;
  onError?: (error: Error) => void;
}

export interface UseSearchState {
  query: string;
  isLoading: boolean;
  error: Error | null;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  selectedIndex: number;
  recentSearches: string[];
  register: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  clear: () => void;
  search: (q: string) => Promise<SearchResult[]>;
  selectSuggestion: (suggestion: SearchSuggestion) => void;
  navigateSuggestions: (direction: "up" | "down") => void;
  saveSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────

const RECENT_SEARCHES_KEY = "search:recent";
const DEBOUNCE_MS = 300;
const MAX_RECENT = 10;

// ─── HOOK ───────────────────────────────────────────────────────────

export function useSearch(options: UseSearchOptions = {}): UseSearchState {
  const {
    type,
    limit = 20,
    debounceMs = DEBOUNCE_MS,
    onSearch,
    onError,
  } = options;

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  /**
   * Execute search API call.
   */
  const executeSearch = useCallback(
    async (q: string): Promise<SearchResult[]> => {
      if (!q.trim()) {
        setResults([]);
        setSuggestions([]);
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        // Abort previous request
        if (abortController.current) {
          abortController.current.abort();
        }
        abortController.current = new AbortController();

        const params = new URLSearchParams({
          q,
          limit: limit.toString(),
          ...(type && { type }),
        });

        const data = await api.get<{ results: SearchResult[] }>(
          `/api/v4/search?${params}`,
          { signal: abortController.current.signal },
        );
        const searchResults = data.results || [];

        setResults(searchResults);
        onSearch?.(searchResults);

        return searchResults;
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err);
          onError?.(err);
        }
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [type, limit, onSearch, onError],
  );

  /**
   * Fetch suggestions from API.
   */
  const fetchSuggestions = useCallback(
    async (q: string): Promise<void> => {
      if (!q.trim()) {
        // Show recent searches if empty
        const recentSuggestions: SearchSuggestion[] = recentSearches
          .slice(0, 5)
          .map((s) => ({
            title: s,
            type: "recent" as const,
          }));
        setSuggestions(recentSuggestions);
        return;
      }

      try {
        const params = new URLSearchParams({ q, limit: "5" });
        const data = await api.get<{ suggestions: string[] }>(
          `/api/v4/search/suggestions?${params}`,
        );
        const suggestionList: SearchSuggestion[] = (data.suggestions || []).map(
          (s: string) => ({
            title: s,
            type: "suggestion" as const,
          }),
        );
        setSuggestions(suggestionList);
      } catch (e) {
        // Silently fail on suggestions
      }
    },
    [recentSearches],
  );

  /**
   * Handle input change with debounce.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      setQuery(newQuery);
      setSelectedIndex(-1);

      // Clear existing debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      if (!newQuery.trim()) {
        setResults([]);
        fetchSuggestions("");
        return;
      }

      // Set new debounce timer
      debounceTimer.current = setTimeout(() => {
        executeSearch(newQuery);
        fetchSuggestions(newQuery);
      }, debounceMs);
    },
    [debounceMs, executeSearch, fetchSuggestions],
  );

  /**
   * Handle keyboard navigation.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const suggestionsToShow = suggestions.length > 0 ? suggestions : results;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestionsToShow.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestionsToShow.length - 1,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestionsToShow.length) {
          const selected = suggestionsToShow[selectedIndex];
          if ("type" in selected) {
            selectSuggestion(selected as SearchSuggestion);
          }
        } else if (query.trim()) {
          saveSearch(query);
        }
      } else if (e.key === "Escape") {
        setSelectedIndex(-1);
        setSuggestions([]);
      }
    },
    [suggestions, results, selectedIndex, query],
  );

  /**
   * Select a suggestion or result.
   */
  const selectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.title);
    setSelectedIndex(-1);
    setSuggestions([]);
  }, []);

  /**
   * Navigate suggestions with arrow keys.
   */
  const navigateSuggestions = useCallback(
    (direction: "up" | "down") => {
      const suggestionsToShow = suggestions.length > 0 ? suggestions : results;

      if (direction === "down") {
        setSelectedIndex((prev) =>
          prev < suggestionsToShow.length - 1 ? prev + 1 : 0,
        );
      } else {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestionsToShow.length - 1,
        );
      }
    },
    [suggestions, results],
  );

  /**
   * Save search to recent searches and localStorage.
   */
  const saveSearch = useCallback((q: string) => {
    if (!q.trim()) return;

    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (e) {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  /**
   * Clear all recent searches.
   */
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  /**
   * Clear search state.
   */
  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setSuggestions([]);
    setSelectedIndex(-1);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return {
    query,
    isLoading,
    error,
    results,
    suggestions,
    selectedIndex,
    recentSearches,
    register: {
      value: query,
      onChange: handleInputChange,
      onKeyDown: handleKeyDown,
    },
    clear,
    search: executeSearch,
    selectSuggestion,
    navigateSuggestions,
    saveSearch,
    clearRecentSearches,
  };
}
