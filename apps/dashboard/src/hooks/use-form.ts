/**
 * Core form management hook
 * Handles form state, validation, field registration, and submission
 *
 * @example
 * ```tsx
 * const form = useForm({
 *   initialValues: { email: '', password: '' },
 *   validationMode: 'onBlur',
 *   onSubmit: async (values) => {
 *     await api.submit(values);
 *   },
 * });
 *
 * const emailField = form.register('email');
 * return (
 *   <input {...emailField} />
 * );
 * ```
 */

"use client";

import { useCallback, useState, useRef, useEffect } from "react";

/** Validation mode for form fields */
export type ValidationMode = "onChange" | "onBlur" | "onSubmit";

/** Field state returned by register() */
export interface RegisteredField<T = unknown> {
  value: T;
  onChange: (value: T) => void;
  onBlur: () => void;
  error?: string;
  touched: boolean;
  isDirty: boolean;
}

/** Form configuration */
export interface UseFormConfig<T extends Record<string, unknown>> {
  /** Initial form values */
  initialValues: T;
  /** Validation schema function that returns errors record or null */
  validationSchema?: (values: T) => Record<string, string> | null;
  /** Validation mode: onChange, onBlur, or onSubmit */
  validationMode?: ValidationMode;
  /** Async validation function */
  asyncValidate?: (values: T) => Promise<Record<string, string> | null>;
  /** Form submission handler */
  onSubmit: (values: T) => void | Promise<void>;
}

/** Form state */
export interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirtyFields: Record<string, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  isValid: boolean;
  isDirty: boolean;
}

/** Returned form instance */
export interface FormInstance<T extends Record<string, unknown>> {
  register: <K extends keyof T>(fieldName: K) => RegisteredField<T[K]>;
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirtyFields: Record<string, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  isValid: boolean;
  isDirty: boolean;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  reset: () => void;
  setFieldValue: <K extends keyof T>(fieldName: K, value: T[K]) => void;
  setFieldError: (fieldName: string, error: string) => void;
  setFieldTouched: (fieldName: string, touched: boolean) => void;
}

/**
 * Core form management hook
 * Provides complete form lifecycle management with validation support
 *
 * @template T - Form values type
 * @param config - Form configuration
 * @returns Form instance with field registration and utilities
 */
export function useForm<T extends Record<string, unknown>>({
  initialValues,
  validationSchema,
  validationMode = "onSubmit",
  asyncValidate,
  onSubmit,
}: UseFormConfig<T>): FormInstance<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const validationTimeoutRef = useRef<NodeJS.Timeout>();
  const submitCountRef = useRef(0);

  /**
   * Validates form values against schema
   */
  const validateForm = useCallback(
    async (valuesToValidate: T): Promise<Record<string, string>> => {
      let newErrors: Record<string, string> = {};

      if (validationSchema) {
        const schemaErrors = validationSchema(valuesToValidate);
        if (schemaErrors) {
          newErrors = { ...schemaErrors };
        }
      }

      if (asyncValidate) {
        setIsValidating(true);
        try {
          const asyncErrors = await asyncValidate(valuesToValidate);
          if (asyncErrors) {
            newErrors = { ...newErrors, ...asyncErrors };
          }
        } catch (error) {
          console.error("Async validation failed:", error);
        } finally {
          setIsValidating(false);
        }
      }

      return newErrors;
    },
    [validationSchema, asyncValidate],
  );

  /**
   * Validates a single field
   */
  const validateField = useCallback(
    async (
      fieldName: string,
      fieldValue: unknown,
    ): Promise<string | undefined> => {
      if (!validationSchema) return undefined;

      const testValues = { ...values, [fieldName]: fieldValue };
      const schemaErrors = validationSchema(testValues as T);
      return schemaErrors?.[fieldName];
    },
    [values, validationSchema],
  );

  /**
   * Handles field change
   */
  const handleFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      setValues((prev) => ({ ...prev, [fieldName]: value }));
      setIsDirty((prev) => ({ ...prev, [fieldName]: true }));

      if (validationMode === "onChange" || submitCountRef.current > 0) {
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }

        validationTimeoutRef.current = setTimeout(async () => {
          const error = await validateField(fieldName, value);
          setErrors((prev) => {
            const updated = { ...prev };
            if (error) {
              updated[fieldName] = error;
            } else {
              delete updated[fieldName];
            }
            return updated;
          });
        }, 300);
      }
    },
    [validationMode, validateField],
  );

  /**
   * Handles field blur
   */
  const handleFieldBlur = useCallback(
    (fieldName: string) => {
      setTouched((prev) => ({ ...prev, [fieldName]: true }));

      if (validationMode === "onBlur" || submitCountRef.current > 0) {
        validateField(fieldName, values[fieldName as keyof T]).then((error) => {
          setErrors((prev) => {
            const updated = { ...prev };
            if (error) {
              updated[fieldName] = error;
            } else {
              delete updated[fieldName];
            }
            return updated;
          });
        });
      }
    },
    [validationMode, values, validateField],
  );

  /**
   * Registers a form field
   */
  const register = useCallback(
    <K extends keyof T>(fieldName: K): RegisteredField<T[K]> => {
      const fieldNameStr = String(fieldName);
      return {
        value: values[fieldName],
        onChange: (value: T[K]) => handleFieldChange(fieldNameStr, value),
        onBlur: () => handleFieldBlur(fieldNameStr),
        error: errors[fieldNameStr],
        touched: touched[fieldNameStr] ?? false,
        isDirty: isDirty[fieldNameStr] ?? false,
      };
    },
    [values, errors, touched, isDirty, handleFieldChange, handleFieldBlur],
  );

  /**
   * Resets form to initial state
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsDirty({});
    submitCountRef.current = 0;
  }, [initialValues]);

  /**
   * Sets a field value
   */
  const setFieldValue = useCallback(
    <K extends keyof T>(fieldName: K, value: T[K]) => {
      handleFieldChange(String(fieldName), value);
    },
    [handleFieldChange],
  );

  /**
   * Sets a field error
   */
  const setFieldError = useCallback((fieldName: string, error: string) => {
    setErrors((prev) => ({ ...prev, [fieldName]: error }));
  }, []);

  /**
   * Sets a field touched state
   */
  const setFieldTouched = useCallback(
    (fieldName: string, isTouched: boolean) => {
      setTouched((prev) => ({ ...prev, [fieldName]: isTouched }));
    },
    [],
  );

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();

      submitCountRef.current += 1;
      setIsSubmitting(true);

      try {
        const newErrors = await validateForm(values);
        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
          await onSubmit(values);
        }
      } catch (error) {
        console.error("Form submission failed:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateForm, onSubmit],
  );

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Determine if form is valid
   */
  const isValid = Object.keys(errors).length === 0;
  const isFormDirty = Object.values(isDirty).some((v) => v);

  return {
    register,
    values,
    errors,
    touched,
    dirtyFields: isDirty,
    isSubmitting,
    isValidating,
    isValid,
    isDirty: isFormDirty,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldError,
    setFieldTouched,
  };
}
