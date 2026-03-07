export interface AuthResponse {
    token: string;
    user: {
        id: string;
        phone: string;
        name: string;
        email?: string;
    };
}
export declare const authService: {
    login(phone: string, password: string): Promise<AuthResponse>;
    logout(): Promise<void>;
    getToken(): Promise<string | null>;
    getUser(): Promise<any>;
    isAuthenticated(): Promise<boolean>;
};
//# sourceMappingURL=auth.d.ts.map