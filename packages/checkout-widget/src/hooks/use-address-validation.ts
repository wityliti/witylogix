/**
 * useAddressValidation Hook
 * Validates addresses and detects delivery zones
 */

import { useState, useCallback, useRef } from 'react';
import type { AddressValidation, AddressValidationRequest } from '../types';

interface UseAddressValidationState {
  data: AddressValidation | null;
  isLoading: boolean;
  error: Error | null;
  suggestions: string[];
}

interface UseAddressValidationOptions {
  apiBaseUrl: string;
  debounceMs?: number;
  minChars?: number;
}

export const useAddressValidation = (options: UseAddressValidationOptions) => {
  const [state, setState] = useState<UseAddressValidationState>({
    data: null,
    isLoading: false,
    error: null,
    suggestions: [],
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const validate = useCallback(
    async (address: string, zipcode: string) => {
      if (!address || !zipcode) {
        setState((prev) => ({ ...prev, data: null, error: null }));
        return;
      }

      if (options.minChars && address.length < options.minChars) {
        setState((prev) => ({ ...prev, data: null, suggestions: [] }));
        return;
      }

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const request: AddressValidationRequest = {
          address,
          zipcode,
        };

        const response = await fetch(`${options.apiBaseUrl}/api/address/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`Address validation failed: ${response.statusText}`);
        }

        const data = await response.json();
        setState((prev) => ({
          ...prev,
          data,
          isLoading: false,
          suggestions: [],
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error('Unknown error'),
          isLoading: false,
        }));
      }
    },
    [options.apiBaseUrl, options.minChars]
  );

  const debouncedValidate = useCallback(
    (address: string, zipcode: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(
        () => validate(address, zipcode),
        options.debounceMs || 300
      );
    },
    [validate, options.debounceMs]
  );

  const getSuggestions = useCallback(
    async (query: string): Promise<string[]> => {
      if (!query || (options.minChars && query.length < options.minChars)) {
        setState((prev) => ({ ...prev, suggestions: [] }));
        return [];
      }

      try {
        const response = await fetch(`${options.apiBaseUrl}/api/address/suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const suggestions = await response.json();
        setState((prev) => ({ ...prev, suggestions }));
        return suggestions;
      } catch {
        return [];
      }
    },
    [options.apiBaseUrl, options.minChars]
  );

  const clearSuggestions = useCallback(() => {
    setState((prev) => ({ ...prev, suggestions: [] }));
  }, []);

  return {
    ...state,
    validate,
    debouncedValidate,
    getSuggestions,
    clearSuggestions,
  };
};

/**
 * useAddressAutocomplete Hook
 * Handles address autocomplete with suggestions
 */
interface UseAddressAutocompleteOptions {
  apiBaseUrl: string;
  debounceMs?: number;
}

export const useAddressAutocomplete = (options: UseAddressAutocompleteOptions) => {
  const [state, setState] = useState<{
    suggestions: string[];
    isLoading: boolean;
    error: Error | null;
    selectedAddress: AddressValidation | null;
  }>({
    suggestions: [],
    isLoading: false,
    error: null,
    selectedAddress: null,
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const search = useCallback(
    async (query: string) => {
      if (!query || query.length < 3) {
        setState((prev) => ({ ...prev, suggestions: [], isLoading: false }));
        return;
      }

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          setState((prev) => ({ ...prev, isLoading: true, error: null }));

          const response = await fetch(`${options.apiBaseUrl}/api/address/autocomplete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          });

          if (!response.ok) {
            throw new Error('Autocomplete search failed');
          }

          const suggestions = await response.json();
          setState((prev) => ({ ...prev, suggestions, isLoading: false }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error : new Error('Unknown error'),
            isLoading: false,
          }));
        }
      }, options.debounceMs || 300);
    },
    [options.apiBaseUrl, options.debounceMs]
  );

  const selectAddress = useCallback((address: AddressValidation) => {
    setState((prev) => ({
      ...prev,
      selectedAddress: address,
      suggestions: [],
    }));
  }, []);

  const clearSuggestions = useCallback(() => {
    setState((prev) => ({ ...prev, suggestions: [] }));
  }, []);

  const reset = useCallback(() => {
    setState({
      suggestions: [],
      isLoading: false,
      error: null,
      selectedAddress: null,
    });
  }, []);

  return {
    ...state,
    search,
    selectAddress,
    clearSuggestions,
    reset,
  };
};
