import * as SecureStore from "expo-secure-store";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const TOKEN_KEY = "auth_token";
export class ApiClient {
  baseUrl;
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }
  async getToken() {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error("Failed to get token:", error);
      return null;
    }
  }
  async buildHeaders(includeAuth = true) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (includeAuth) {
      const token = await this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }
  async get(path, options) {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      ...options,
      headers: { ...headers, ...(options?.headers || {}) },
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async post(path, body, options) {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      ...options,
      headers: { ...headers, ...(options?.headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async patch(path, body, options) {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      ...options,
      headers: { ...headers, ...(options?.headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async delete(path, options) {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      ...options,
      headers: { ...headers, ...(options?.headers || {}) },
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}
export const api = new ApiClient();
//# sourceMappingURL=api.js.map
