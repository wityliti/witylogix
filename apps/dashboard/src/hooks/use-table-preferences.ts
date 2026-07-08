import { useState, useEffect, useCallback } from "react";

export interface TablePreferences {
  columnOrder: string[];
  columnWidths: Record<string, number>;
  visibleColumns: string[];
  sortState: {
    columnId: string;
    direction: "asc" | "desc" | null;
  } | null;
  pageSize: number;
}

const DEFAULT_PREFERENCES: Omit<
  TablePreferences,
  "columnOrder" | "visibleColumns"
> = {
  columnWidths: {},
  sortState: null,
  pageSize: 25,
};

export function useTablePreferences(tableId: string, defaultColumns: string[]) {
  const [preferences, setPreferences] = useState<TablePreferences>({
    columnOrder: defaultColumns,
    visibleColumns: defaultColumns,
    ...DEFAULT_PREFERENCES,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage
  useEffect(() => {
    const storageKey = `table-preferences-${tableId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as TablePreferences;
        setPreferences({
          columnOrder: parsed.columnOrder || defaultColumns,
          visibleColumns: parsed.visibleColumns || defaultColumns,
          columnWidths: parsed.columnWidths || {},
          sortState: parsed.sortState || null,
          pageSize: parsed.pageSize || 25,
        });
      }
    } catch (error) {
      console.error("Failed to load table preferences:", error);
    }
    setIsLoaded(true);
  }, [tableId, defaultColumns]);

  // Save preferences to localStorage
  const savePreferences = useCallback(
    (updates: Partial<TablePreferences>) => {
      const storageKey = `table-preferences-${tableId}`;
      const updated = { ...preferences, ...updates };
      setPreferences(updated);

      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save table preferences:", error);
      }
    },
    [tableId, preferences],
  );

  const updateColumnOrder = useCallback(
    (order: string[]) => {
      savePreferences({ columnOrder: order });
    },
    [savePreferences],
  );

  const updateColumnWidths = useCallback(
    (widths: Record<string, number>) => {
      savePreferences({ columnWidths: widths });
    },
    [savePreferences],
  );

  const updateVisibleColumns = useCallback(
    (visible: string[]) => {
      savePreferences({ visibleColumns: visible });
    },
    [savePreferences],
  );

  const updateSortState = useCallback(
    (columnId: string, direction: "asc" | "desc" | null) => {
      savePreferences({
        sortState: direction === null ? null : { columnId, direction },
      });
    },
    [savePreferences],
  );

  const updatePageSize = useCallback(
    (size: number) => {
      savePreferences({ pageSize: size });
    },
    [savePreferences],
  );

  const resetToDefaults = useCallback(() => {
    const storageKey = `table-preferences-${tableId}`;
    setPreferences({
      columnOrder: defaultColumns,
      visibleColumns: defaultColumns,
      ...DEFAULT_PREFERENCES,
    });

    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Failed to reset table preferences:", error);
    }
  }, [tableId, defaultColumns]);

  return {
    preferences,
    isLoaded,
    updateColumnOrder,
    updateColumnWidths,
    updateVisibleColumns,
    updateSortState,
    updatePageSize,
    resetToDefaults,
  };
}
