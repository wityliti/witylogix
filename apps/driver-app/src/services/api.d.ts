export declare class ApiClient {
  private baseUrl;
  constructor(baseUrl?: string);
  private getToken;
  private buildHeaders;
  get<T = any>(path: string, options?: RequestInit): Promise<T>;
  post<T = any>(path: string, body?: any, options?: RequestInit): Promise<T>;
  patch<T = any>(path: string, body?: any, options?: RequestInit): Promise<T>;
  delete<T = any>(path: string, options?: RequestInit): Promise<T>;
}
export declare const api: ApiClient;
//# sourceMappingURL=api.d.ts.map
