"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

/* ═══════════════════════════════════════════════════════════
   AUTH CONTEXT & PROVIDER
   ═══════════════════════════════════════════════════════════ */

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "driver" | "viewer";
  avatar?: string;
  shopId: string;
  createdAt?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  companyName?: string;
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "") + "/api/v4";

  // Initialize auth state from cookie and localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Read token from httpOnly cookie (via document.cookie)
        const cookieToken = document.cookie
          .split("; ")
          .find((c) => c.startsWith("auth-token="))
          ?.split("=")[1];

        const storedUser = localStorage.getItem("authUser");

        if (cookieToken && storedUser) {
          setToken(cookieToken);
          setUser(JSON.parse(storedUser));

          // Only attempt refresh if we have a stored refresh token
          const storedRefreshToken = localStorage.getItem("refreshToken");
          if (storedRefreshToken) {
            try {
              await refreshTokenFn(storedRefreshToken);
            } catch {
              // Refresh failed but access token may still be valid — don't clear auth
              console.warn("Token refresh failed, using existing access token");
            }
          }
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const refreshTokenFn = async (refreshTokenValue: string, retryCount = 0) => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
        credentials: "include",
      });

      if (response.ok) {
        const raw = await response.json();
        const payload = raw.data || raw;
        const newToken = payload.accessToken || payload.token;
        const newRefreshToken = payload.refreshToken;

        if (newToken) {
          setToken(newToken);
          document.cookie = `auth-token=${newToken}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`;
        }
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }
        if (payload.user) {
          setUser(payload.user);
          localStorage.setItem("authUser", JSON.stringify(payload.user));
        }
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (error) {
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return refreshTokenFn(refreshTokenValue, retryCount + 1);
      }
      throw error;
    }
  };

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          shopDomain:
            process.env.NEXT_PUBLIC_SHOP_DOMAIN || "demo.witylogix.io",
        }),
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || `Login failed: ${response.status}`;

        if (response.status === 401) {
          throw new Error("Invalid email or password");
        } else if (response.status === 429) {
          throw new Error("Too many login attempts. Please try again later.");
        } else if (response.status === 423) {
          throw new Error("Account locked. Please contact support.");
        } else {
          throw new Error(errorMessage);
        }
      }

      const raw = await response.json();
      // API wraps response in { data: { accessToken, user, shop, ... } }
      const payload = raw.data || raw;
      const data: AuthResponse = {
        token: payload.accessToken || payload.token,
        user: payload.user,
        refreshToken: payload.refreshToken,
      };
      setToken(data.token);
      setUser(data.user);

      // Store user profile and refresh token in localStorage
      localStorage.setItem("authUser", JSON.stringify(data.user));
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      if (payload.shop) {
        localStorage.setItem("authShop", JSON.stringify(payload.shop));
      }

      // Fallback: also set cookie in case backend doesn't set httpOnly
      if (data.token) {
        document.cookie = `auth-token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`;
      }

      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("rememberedEmail");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          "Login request timed out. Please check that the API server is running.",
        );
      }
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include", // Allow cookies to be set by backend
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 400) {
          throw new Error(
            errorData.message || errorData.error || "Invalid registration data",
          );
        } else if (response.status === 409) {
          throw new Error(errorData.error || "Email already registered");
        } else {
          throw new Error(
            errorData.message ||
              errorData.error ||
              `Registration failed: ${response.status}`,
          );
        }
      }

      const raw = await response.json();
      // API wraps response in { data: { accessToken, user, shop, ... } }
      const payload = raw.data || raw;
      const responseData: AuthResponse = {
        token: payload.accessToken || payload.token,
        user: payload.user,
        refreshToken: payload.refreshToken,
      };
      setToken(responseData.token);
      setUser(responseData.user);

      // Store user profile and refresh token in localStorage
      localStorage.setItem("authUser", JSON.stringify(responseData.user));
      if (responseData.refreshToken) {
        localStorage.setItem("refreshToken", responseData.refreshToken);
      }
      if (payload.shop) {
        localStorage.setItem("authShop", JSON.stringify(payload.shop));
      }

      // Fallback: also set cookie in case backend doesn't set httpOnly
      if (responseData.token) {
        document.cookie = `auth-token=${responseData.token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`;
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    // Clear auth state
    setUser(null);
    setToken(null);

    // Clear localStorage
    localStorage.removeItem("authUser");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("authShop");
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("rememberedEmail");

    // Clear auth cookie
    document.cookie =
      "auth-token=; path=/; max-age=0; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}";

    // Notify backend of logout
    if (token) {
      fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      }).catch((error) => console.error("Logout notification failed:", error));
    }
  };

  const refreshToken = async () => {
    if (!token) {
      throw new Error("No token available");
    }

    await refreshTokenFn(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthContext: AuthContextType = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshToken: async () => {},
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  return context ?? defaultAuthContext;
}
