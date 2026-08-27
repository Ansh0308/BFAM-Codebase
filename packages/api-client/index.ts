import { User, Turf } from '@bfam/shared-types';

export class BFAMApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`BFAM API error: ${response.status} ${response.statusText}. ${errorBody}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async getHealth(): Promise<{ status: string; uptime: number; timestamp: string }> {
    return this.request<{ status: string; uptime: number; timestamp: string }>('/health');
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async getTurfs(): Promise<Turf[]> {
    return this.request<Turf[]>('/turfs');
  }
}
