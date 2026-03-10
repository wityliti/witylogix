import { useState, useCallback } from 'react';
import { api } from '../services/api';

interface ApiState {
  loading: boolean;
  error: string | null;
  data: any;
}

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export const useApi = () => {
  const [state, setState] = useState<ApiState>({
    loading: false,
    error: null,
    data: null,
  });

  const get = useCallback(
    async <T = any,>(path: string, options?: UseApiOptions): Promise<T> => {
      setState({ loading: true, error: null, data: null });
      try {
        const response = await api.get<T>(path);
        setState({ loading: false, error: null, data: response });
        options?.onSuccess?.(response);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState({ loading: false, error: errorMessage, data: null });
        options?.onError?.(error);
        throw error;
      }
    },
    []
  );

  const post = useCallback(
    async <T = any,>(
      path: string,
      body?: any,
      options?: UseApiOptions
    ): Promise<T> => {
      setState({ loading: true, error: null, data: null });
      try {
        const response = await api.post<T>(path, body);
        setState({ loading: false, error: null, data: response });
        options?.onSuccess?.(response);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState({ loading: false, error: errorMessage, data: null });
        options?.onError?.(error);
        throw error;
      }
    },
    []
  );

  const put = useCallback(
    async <T = any,>(
      path: string,
      body?: any,
      options?: UseApiOptions
    ): Promise<T> => {
      setState({ loading: true, error: null, data: null });
      try {
        const response = await api.patch<T>(path, body);
        setState({ loading: false, error: null, data: response });
        options?.onSuccess?.(response);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState({ loading: false, error: errorMessage, data: null });
        options?.onError?.(error);
        throw error;
      }
    },
    []
  );

  const remove = useCallback(
    async <T = any,>(path: string, options?: UseApiOptions): Promise<T> => {
      setState({ loading: true, error: null, data: null });
      try {
        const response = await api.delete<T>(path);
        setState({ loading: false, error: null, data: response });
        options?.onSuccess?.(response);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState({ loading: false, error: errorMessage, data: null });
        options?.onError?.(error);
        throw error;
      }
    },
    []
  );

  return {
    ...state,
    get,
    post,
    put,
    delete: remove,
  };
};
