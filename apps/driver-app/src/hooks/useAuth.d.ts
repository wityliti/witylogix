import React, { ReactNode } from "react";
interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
}
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
export declare const AuthProvider: React.FC<{
  children: ReactNode;
}>;
export declare const useAuth: () => AuthContextType;
export {};
//# sourceMappingURL=useAuth.d.ts.map
