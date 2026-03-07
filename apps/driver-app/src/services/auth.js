import * as SecureStore from 'expo-secure-store';
import { api } from './api';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
export const authService = {
    async login(phone, password) {
        const response = await api.post('/api/v4/auth/driver/login', {
            phone,
            password,
        });
        // Store token securely
        await SecureStore.setItemAsync(TOKEN_KEY, response.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
        return response;
    },
    async logout() {
        try {
            // Call logout endpoint
            await api.post('/api/v4/auth/driver/logout', {});
        }
        catch (error) {
            console.error('Logout API error:', error);
        }
        // Clear stored data
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
    },
    async getToken() {
        try {
            return await SecureStore.getItemAsync(TOKEN_KEY);
        }
        catch (error) {
            console.error('Failed to get token:', error);
            return null;
        }
    },
    async getUser() {
        try {
            const userJson = await SecureStore.getItemAsync(USER_KEY);
            return userJson ? JSON.parse(userJson) : null;
        }
        catch (error) {
            console.error('Failed to get user:', error);
            return null;
        }
    },
    async isAuthenticated() {
        const token = await this.getToken();
        return !!token;
    },
};
//# sourceMappingURL=auth.js.map