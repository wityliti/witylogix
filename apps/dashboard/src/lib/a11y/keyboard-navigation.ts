/**
 * Keyboard Navigation Utilities
 * Arrow key navigation, roving tabindex, shortcuts, and type-ahead
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Arrow key navigation for lists and menus
 */
export function useKeyboardNavigation<T>(
  items: T[],
  options: {
    orientation?: 'vertical' | 'horizontal';
    loop?: boolean;
    onSelect?: (item: T, index: number) => void;
    getLabel?: (item: T) => string;
  } = {}
): {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handlers: {
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
} {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const {
    orientation = 'vertical',
    loop = true,
    onSelect,
    getLabel,
  } = options;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isVertical = orientation === 'vertical';
      const isArrowUp = e.key === 'ArrowUp';
      const isArrowDown = e.key === 'ArrowDown';
      const isArrowLeft = e.key === 'ArrowLeft';
      const isArrowRight = e.key === 'ArrowRight';

      let isNavKey = false;
      let direction: 'next' | 'prev' = 'next';

      if (isVertical) {
        isNavKey = isArrowUp || isArrowDown;
        direction = isArrowUp ? 'prev' : 'next';
      } else {
        isNavKey = isArrowLeft || isArrowRight;
        direction = isArrowLeft ? 'prev' : 'next';
      }

      if (!isNavKey) return;

      e.preventDefault();

      let nextIndex = selectedIndex;
      if (direction === 'next') {
        nextIndex = selectedIndex + 1;
        if (loop && nextIndex >= items.length) {
          nextIndex = 0;
        } else if (!loop) {
          nextIndex = Math.min(nextIndex, items.length - 1);
        }
      } else {
        nextIndex = selectedIndex - 1;
        if (loop && nextIndex < 0) {
          nextIndex = items.length - 1;
        } else if (!loop) {
          nextIndex = Math.max(nextIndex, 0);
        }
      }

      setSelectedIndex(nextIndex);
      onSelect?.(items[nextIndex], nextIndex);
    },
    [selectedIndex, items, orientation, loop, onSelect]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    handlers: {
      onKeyDown: handleKeyDown,
    },
  };
}

/**
 * Roving tabindex pattern for accessible lists
 * Only one item in the list has tabindex="0", others have tabindex="-1"
 */
export function useRovingTabIndex(
  items: HTMLElement[],
  options: {
    orientation?: 'vertical' | 'horizontal';
  } = {}
): {
  focusIndex: number;
  setFocusIndex: (index: number) => void;
} {
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === focusIndex ? '0' : '-1');
    });
  }, [items, focusIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isVertical = options.orientation !== 'horizontal';
      const isArrowUp = e.key === 'ArrowUp';
      const isArrowDown = e.key === 'ArrowDown';
      const isArrowLeft = e.key === 'ArrowLeft';
      const isArrowRight = e.key === 'ArrowRight';

      let isNavKey = false;
      let nextIndex = focusIndex;

      if (isVertical && (isArrowUp || isArrowDown)) {
        isNavKey = true;
        nextIndex = isArrowUp
          ? Math.max(0, focusIndex - 1)
          : Math.min(items.length - 1, focusIndex + 1);
      } else if (!isVertical && (isArrowLeft || isArrowRight)) {
        isNavKey = true;
        nextIndex = isArrowLeft
          ? Math.max(0, focusIndex - 1)
          : Math.min(items.length - 1, focusIndex + 1);
      }

      if (isNavKey) {
        e.preventDefault();
        setFocusIndex(nextIndex);
        items[nextIndex]?.focus();
      }
    };

    items[focusIndex]?.addEventListener('keydown', handleKeyDown);
    return () => {
      items[focusIndex]?.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusIndex, items]);

  return { focusIndex, setFocusIndex };
}

/**
 * Close dialog/modal on Escape key
 */
export function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
}

/**
 * Type-ahead search for lists and comboboxes
 */
export function useTypeAhead<T>(
  items: T[],
  getLabel: (item: T) => string,
  options: {
    timeout?: number;
  } = {}
): {
  selectedIndex: number;
  clear: () => void;
  handlers: {
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
} {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const { timeout = 500 } = options;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const char = e.key.toLowerCase();

      // Only accept printable characters
      if (char.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      e.preventDefault();

      // Clear timeout and accumulate search string
      clearTimeout(timeoutRef.current);
      searchRef.current += char;

      // Find matching item
      const matchIndex = items.findIndex((item) =>
        getLabel(item).toLowerCase().startsWith(searchRef.current)
      );

      if (matchIndex !== -1) {
        setSelectedIndex(matchIndex);
      }

      // Clear search after timeout
      timeoutRef.current = setTimeout(() => {
        searchRef.current = '';
      }, timeout);
    },
    [items, getLabel, timeout]
  );

  const clear = useCallback(() => {
    searchRef.current = '';
    clearTimeout(timeoutRef.current);
  }, []);

  return {
    selectedIndex,
    clear,
    handlers: { onKeyDown: handleKeyDown },
  };
}

/**
 * Global keyboard shortcut manager
 */
export class KeyboardShortcutManager {
  private shortcuts: Map<
    string,
    { handler: (e: KeyboardEvent) => void; modifiers: Set<string> }
  > = new Map();

  register(
    key: string,
    handler: (e: KeyboardEvent) => void,
    modifiers: string[] = []
  ): () => void {
    const shortcutKey = this.getShortcutKey(key, modifiers);
    this.shortcuts.set(shortcutKey, {
      handler,
      modifiers: new Set(modifiers),
    });

    if (this.shortcuts.size === 1) {
      document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    return () => this.unregister(key, modifiers);
  }

  unregister(key: string, modifiers: string[] = []): void {
    const shortcutKey = this.getShortcutKey(key, modifiers);
    this.shortcuts.delete(shortcutKey);

    if (this.shortcuts.size === 0) {
      document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const modifiers = this.getActiveModifiers(e);
    const shortcutKey = this.getShortcutKey(e.key, Array.from(modifiers));

    const shortcut = this.shortcuts.get(shortcutKey);
    if (shortcut) {
      e.preventDefault();
      shortcut.handler(e);
    }
  }

  private getShortcutKey(key: string, modifiers: string[]): string {
    const normalizedModifiers = modifiers.sort().join('+');
    return `${normalizedModifiers}${normalizedModifiers ? '+' : ''}${key}`;
  }

  private getActiveModifiers(e: KeyboardEvent): Set<string> {
    const modifiers = new Set<string>();
    if (e.ctrlKey) modifiers.add('ctrl');
    if (e.shiftKey) modifiers.add('shift');
    if (e.altKey) modifiers.add('alt');
    if (e.metaKey) modifiers.add('meta');
    return modifiers;
  }
}

/**
 * React hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  modifiers: string[] = []
): void {
  const managerRef = useRef<KeyboardShortcutManager>(
    new KeyboardShortcutManager()
  );

  useEffect(() => {
    const cleanup = managerRef.current.register(key, handler, modifiers);
    return cleanup;
  }, [key, handler, modifiers]);
}
