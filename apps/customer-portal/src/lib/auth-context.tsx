"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  api,
  ApiError,
  setAuthToken,
  clearAuthToken,
  setUnauthorizedHandler,
} from "./api";

// ─── Types ────────────────────────────────────────────────────

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  shopId: string;
  avatar?: string;
}

export interface AuthState {
  user: PortalUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthActions {
  login: (
    email: string,
    password: string,
    shopDomain?: string,
  ) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

// ─── Context ─────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Helpers ─────────────────────────────────────────────────

interface LoginPayload {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  user?: PortalUser;
  data?: {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    user?: PortalUser;
  };
}

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  // Keep ref in sync so logout closure can read latest token
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // ── Refresh ────────────────────────────────────────────────
  const refreshToken = useCallback(async () => {
    const stored = localStorage.getItem("portal-refresh-token");
    if (!stored) throw new Error("No refresh token stored");

    try {
      const raw = await api.post<LoginPayload>("/api/v4/auth/refresh", {
        refreshToken: stored,
      });
      const payload = raw.data ?? raw;
      const newAccess = payload.accessToken ?? payload.token;
      const newRefresh = payload.refreshToken;

      if (newAccess) {
        setTokenState(newAccess);
        setAuthToken(newAccess);
      }
      if (newRefresh) {
        localStorage.setItem("portal-refresh-token", newRefresh);
      }
      if (payload.user) {
        setUser(payload.user);
        localStorage.setItem("portal-user", JSON.stringify(payload.user));
      }
    } catch {
      // Refresh failed — clear state
      setUser(null);
      setTokenState(null);
      clearAuthToken();
      localStorage.removeItem("portal-user");
      localStorage.removeItem("portal-refresh-token");
    }
  }, []);

  // ── Initialize from stored state ──────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const cookieToken =
          document.cookie
            .split("; ")
            .find((c) => c.startsWith("portal-auth-token="))
            ?.split("=")[1] ?? null;

        const storedUser = localStorage.getItem("portal-user");

        if (cookieToken && storedUser) {
          setTokenState(cookieToken);
          setUser(JSON.parse(storedUser) as PortalUser);

          const storedRefresh = localStorage.getItem("portal-refresh-token");
          if (storedRefresh) {
            await refreshToken().catch(() => {
              /* silent — access token may still be valid */
            });
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, [refreshToken]);

  // ── Register 401 handler ───────────────────────────────────
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setTokenState(null);
      clearAuthToken();
      localStorage.removeItem("portal-user");
      localStorage.removeItem("portal-refresh-token");
    });
  }, []);

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(
    async (
      email: string,
      password: string,
      shopDomain = process.env.NEXT_PUBLIC_SHOP_DOMAIN ?? "demo.witylogix.io",
    ) => {
      const raw = await api.post<LoginPayload>("/api/v4/auth/login", {
        email,
        password,
        shopDomain,
      });
      const payload = raw.data ?? raw;
      const accessToken = payload.accessToken ?? payload.token;
      const refresh = payload.refreshToken;
      const userData = payload.user;

      if (!accessToken)
        throw new ApiError(500, "No access token in login response");

      setTokenState(accessToken);
      setAuthToken(accessToken);
      if (userData) {
        setUser(userData);
        localStorage.setItem("portal-user", JSON.stringify(userData));
      }
      if (refresh) {
        localStorage.setItem("portal-refresh-token", refresh);
      }
    },
    [],
  );

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => {
    const current = tokenRef.current;
    setUser(null);
    setTokenState(null);
    clearAuthToken();
    localStorage.removeItem("portal-user");
    localStorage.removeItem("portal-refresh-token");

    if (current) {
      api
        .post("/api/v4/auth/logout", undefined, {
          headers: { Authorization: `Bearer ${current}` },
        })
        .catch(() => {
          /* ignore logout notification errors */
        });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      login,
      logout,
      refreshToken,
    }),
    [user, token, isLoading, login, logout, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Outside provider — return no-op defaults (e.g., server render)
    return {
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      login: async () => {},
      logout: () => {},
      refreshToken: async () => {},
    };
  }
  return ctx;
}
