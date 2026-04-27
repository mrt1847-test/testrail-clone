export type ApiClientConfig = {
  baseUrl: string;
  token?: string;
};

export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  async getHealth() {
    const res = await fetch(`${this.config.baseUrl}/api/health`, {
      headers: this.config.token ? { Authorization: `Bearer ${this.config.token}` } : undefined
    });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    return (await res.json()) as { status: string };
  }
}
