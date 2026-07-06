import * as SecureStore from "expo-secure-store";
import { api } from "./api";

const TOKEN_KEY = "auth_token";
const USER_KEY = "user_data";
const TOKEN_ISSUED_AT_KEY = "auth_token_issued_at";

const OFFLINE_GRACE_PERIOD_MS = 8 * 60 * 60 * 1000; // 8 hours

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    name: string;
    email?: string;
  };
}

export const authService = {
  async login(phone: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/api/v4/auth/driver/login", {
      phone,
      password,
    });

    await SecureStore.setItemAsync(TOKEN_KEY, response.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
    await SecureStore.setItemAsync(TOKEN_ISSUED_AT_KEY, String(Date.now()));

    return response;
  },

  async logout(): Promise<void> {
    try {
      await api.post("/api/v4/auth/driver/logout", {});
    } catch (error) {
      console.error("Logout API error:", error);
    }

    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(TOKEN_ISSUED_AT_KEY);
  },

  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error("Failed to get token:", error);
      return null;
    }
  },

  async getUser() {
    try {
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error("Failed to get user:", error);
      return null;
    }
  },

  /**
   * Returns true if the driver has a locally cached token that is still within
   * the 8-hour offline grace period.  When online the caller should also verify
   * the token with the server; this method only gates local access.
   */
  async isAuthenticatedOffline(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    const issuedAtStr = await SecureStore.getItemAsync(
      TOKEN_ISSUED_AT_KEY,
    ).catch(() => null);
    if (!issuedAtStr) return false;

    const issuedAt = parseInt(issuedAtStr, 10);
    if (isNaN(issuedAt)) return false;

    return Date.now() - issuedAt < OFFLINE_GRACE_PERIOD_MS;
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  },
};
