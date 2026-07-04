/**
 * Dynamic field array management hook
 * Handles repeating field groups with validation and constraints
 *
 * @example
 * ```tsx
 * const form = useForm({ initialValues: { items: [] }, ... });
 * const items = useFieldArray(form, 'items');
 *
 * return (
 *   <>
 *     {items.fields.map((field, index) => (
 *       <input key={field.id} {...form.register(`items.${index}.name`)} />
 *     ))}
 *     <button onClick={() => items.append({})}>Add</button>
 *   </>
 * );
 * ```
 */

"use client";

import { useCallback, useState } from "react";

/** Field array configuration */
export interface UseFieldArrayConfig {
  /** Minimum number of items (default: 0) */
  minItems?: number;
  /** Maximum number of items (default: Infinity) */
  maxItems?: number;
  /** Whether to validate each item on change */
  validateOnChange?: boolean;
}

/** Individual field item */
export interface FieldItem {
  id: string;
}

/** Field array instance */
export interface FieldArrayInstance {
  fields: FieldItem[];
  append: (value: Record<string, unknown>) => void;
  prepend: (value: Record<string, unknown>) => void;
  insert: (index: number, value: Record<string, unknown>) => void;
  remove: (index: number) => void;
  swap: (indexA: number, indexB: number) => void;
  move: (from: number, to: number) => void;
  clear: () => void;
  length: number;
  canAddMore: boolean;
  canRemove: (index: number) => boolean;
}

/**
 * Simple form instance mock for testing purposes
 * In real usage, this would be the actual form instance from useForm
 */
interface FormInstance {
  values: Record<string, unknown>;
  setFieldValue: (path: string, value: unknown) => void;
  errors: Record<string, string>;
  setFieldError: (path: string, error: string) => void;
}

/**
 * Generate a unique ID for each field item
 */
function generateId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Dynamic field array management hook
 * Provides array manipulation methods for repeating form fields
 *
 * @param form - Form instance from useForm hook
 * @param fieldName - Name of the array field in form values
 * @param config - Optional configuration
 * @returns Field array instance with manipulation methods
 */
export function useFieldArray(
  form: FormInstance,
  fieldName: string,
  config: UseFieldArrayConfig = {},
): FieldArrayInstance {
  const { minItems = 0, maxItems = Infinity, validateOnChange = true } = config;

  const [fieldIds, setFieldIds] = useState<string[]>(() => {
    const fieldValue = form.values[fieldName];
    if (Array.isArray(fieldValue)) {
      return fieldValue.map(() => generateId());
    }
    return [];
  });

  /**
   * Gets the current array from form values
   */
  const getFieldArray = useCallback(() => {
    const fieldValue = form.values[fieldName];
    return Array.isArray(fieldValue) ? fieldValue : [];
  }, [form.values, fieldName]);

  /**
   * Updates the entire array in form values
   */
  const setFieldArray = useCallback(
    (newArray: unknown[]) => {
      form.setFieldValue(fieldName, newArray);
      if (validateOnChange) {
        form.setFieldError(fieldName, "");
      }
    },
    [form, fieldName, validateOnChange],
  );

  /**
   * Appends a new item to the end of the array
   */
  const append = useCallback(
    (value: Record<string, unknown>) => {
      const currentArray = getFieldArray();
      if (currentArray.length < maxItems) {
        setFieldArray([...currentArray, value]);
        setFieldIds((prev) => [...prev, generateId()]);
      }
    },
    [getFieldArray, setFieldArray, maxItems],
  );

  /**
   * Prepends a new item to the beginning of the array
   */
  const prepend = useCallback(
    (value: Record<string, unknown>) => {
      const currentArray = getFieldArray();
      if (currentArray.length < maxItems) {
        setFieldArray([value, ...currentArray]);
        setFieldIds((prev) => [generateId(), ...prev]);
      }
    },
    [getFieldArray, setFieldArray, maxItems],
  );

  /**
   * Inserts an item at a specific index
   */
  const insert = useCallback(
    (index: number, value: Record<string, unknown>) => {
      const currentArray = getFieldArray();
      if (
        currentArray.length < maxItems &&
        index >= 0 &&
        index <= currentArray.length
      ) {
        const newArray = [...currentArray];
        newArray.splice(index, 0, value);
        setFieldArray(newArray);
        setFieldIds((prev) => {
          const newIds = [...prev];
          newIds.splice(index, 0, generateId());
          return newIds;
        });
      }
    },
    [getFieldArray, setFieldArray, maxItems],
  );

  /**
   * Removes an item at a specific index
   */
  const remove = useCallback(
    (index: number) => {
      const currentArray = getFieldArray();
      if (
        currentArray.length > minItems &&
        index >= 0 &&
        index < currentArray.length
      ) {
        const newArray = [...currentArray];
        newArray.splice(index, 1);
        setFieldArray(newArray);
        setFieldIds((prev) => {
          const newIds = [...prev];
          newIds.splice(index, 1);
          return newIds;
        });
      }
    },
    [getFieldArray, setFieldArray, minItems],
  );

  /**
   * Swaps two items in the array
   */
  const swap = useCallback(
    (indexA: number, indexB: number) => {
      const currentArray = getFieldArray();
      if (
        indexA >= 0 &&
        indexA < currentArray.length &&
        indexB >= 0 &&
        indexB < currentArray.length
      ) {
        const newArray = [...currentArray];
        [newArray[indexA], newArray[indexB]] = [
          newArray[indexB],
          newArray[indexA],
        ];
        setFieldArray(newArray);
        setFieldIds((prev) => {
          const newIds = [...prev];
          [newIds[indexA], newIds[indexB]] = [newIds[indexB], newIds[indexA]];
          return newIds;
        });
      }
    },
    [getFieldArray, setFieldArray],
  );

  /**
   * Moves an item from one index to another
   */
  const move = useCallback(
    (from: number, to: number) => {
      const currentArray = getFieldArray();
      if (
        from >= 0 &&
        from < currentArray.length &&
        to >= 0 &&
        to < currentArray.length
      ) {
        const newArray = [...currentArray];
        const [movedItem] = newArray.splice(from, 1);
        newArray.splice(to, 0, movedItem);
        setFieldArray(newArray);
        setFieldIds((prev) => {
          const newIds = [...prev];
          const [movedId] = newIds.splice(from, 1);
          newIds.splice(to, 0, movedId);
          return newIds;
        });
      }
    },
    [getFieldArray, setFieldArray],
  );

  /**
   * Clears all items from the array
   */
  const clear = useCallback(() => {
    if (minItems === 0) {
      setFieldArray([]);
      setFieldIds([]);
    }
  }, [minItems, setFieldArray]);

  /**
   * Checks if more items can be added
   */
  const canAddMore = getFieldArray().length < maxItems;

  /**
   * Checks if an item can be removed
   */
  const canRemove = useCallback(
    (index: number) => {
      return getFieldArray().length > minItems;
    },
    [getFieldArray, minItems],
  );

  return {
    fields: fieldIds.map((id) => ({ id })),
    append,
    prepend,
    insert,
    remove,
    swap,
    move,
    clear,
    length: getFieldArray().length,
    canAddMore,
    canRemove,
  };
}
