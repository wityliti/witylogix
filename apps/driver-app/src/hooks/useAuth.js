import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/auth";
const AuthContext = createContext(undefined);
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const checkAuth = async () => {
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        const userData = await authService.getUser();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };
  const login = async (phone, password) => {
    try {
      const response = await authService.login(phone, password);
      setIsAuthenticated(true);
      setUser(response.user);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };
  const logout = async () => {
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };
  useEffect(() => {
    checkAuth();
  }, []);
  const value = {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
    checkAuth,
  };
  return React.createElement(AuthContext.Provider, { value }, children);
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
//# sourceMappingURL=useAuth.js.map
