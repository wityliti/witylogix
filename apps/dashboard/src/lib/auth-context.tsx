"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem("authToken");
        const storedUser = localStorage.getItem("authUser");

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Skip token refresh for demo tokens
          if (!storedToken.startsWith("demo-token-")) {
            try {
              await refreshTokenFn(storedToken);
            } catch (error) {
              // If refresh fails, clear auth
              localStorage.removeItem("authToken");
              localStorage.removeItem("authUser");
              setToken(null);
              setUser(null);
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

  const refreshTokenFn = async (currentToken: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (response.ok) {
        const data: AuthResponse = await response.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("authUser", JSON.stringify(data.user));
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      throw error;
    }
  };

  const login = async (email: string, password: string, rememberMe = false) => {
    // Demo credentials bypass (no backend required)
    if (email === "demo@witylogix.com" && password === "demo123") {
      const demoUser: User = {
        id: "demo-001",
        name: "Demo User",
        email: "demo@witylogix.com",
        role: "admin",
        shopId: "shop-demo",
        createdAt: new Date().toISOString(),
      };
      const demoToken = "demo-token-" + Date.now();
      setToken(demoToken);
      setUser(demoUser);
      localStorage.setItem("authToken", demoToken);
      localStorage.setItem("authUser", JSON.stringify(demoUser));
      // Set cookie so middleware can verify auth on protected routes
      document.cookie = `auth-token=${demoToken}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("rememberedEmail", email);
      }
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Login failed: ${response.status}`;

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

      const data: AuthResponse = await response.json();
      setToken(data.token);
      setUser(data.user);

      // Store auth data
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));
      // Set cookie so middleware can verify auth on protected routes
      document.cookie = `auth-token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;

      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("rememberedEmail");
      }
    } catch (error) {
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
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 400) {
          throw new Error(errorData.message || "Invalid registration data");
        } else if (response.status === 409) {
          throw new Error("Email already registered");
        } else {
          throw new Error(errorData.message || `Registration failed: ${response.status}`);
        }
      }

      const responseData: AuthResponse = await response.json();
      setToken(responseData.token);
      setUser(responseData.user);

      // Store auth data
      localStorage.setItem("authToken", responseData.token);
      localStorage.setItem("authUser", JSON.stringify(responseData.user));
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    // Clear auth state
    setUser(null);
    setToken(null);

    // Clear localStorage
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("rememberedEmail");

    // Clear auth cookie so middleware stops protecting routes
    document.cookie = "auth-token=; path=/; max-age=0; samesite=lax";

    // Optional: Notify backend of logout
    if (token) {
      fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
