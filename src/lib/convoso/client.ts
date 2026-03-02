import type { ConvosoClientConfig, ConvosoLogResponse } from "./types";

export class ConvosoClient {
  private config: ConvosoClientConfig;

  constructor(config: ConvosoClientConfig) {
    this.config = config;
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const body = new URLSearchParams({
      auth_token: this.config.authToken,
      ...params,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Convoso API error: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();

    if (json.success === false) {
      throw new Error(
        `Convoso API error: ${json.code} ${json.text || json.error || "Unknown"}`
      );
    }

    return json.data ?? json;
  }

  async getCallLogs(params: {
    start_date: string;
    end_date: string;
    limit: string;
    offset: string;
  }): Promise<ConvosoLogResponse> {
    return this.request<ConvosoLogResponse>(
      "/log/retrieve",
      params as Record<string, string>
    );
  }
}

export function createConvosoClient(): ConvosoClient | null {
  const apiUrl = process.env.CONVOSO_API_URL;
  const authToken = process.env.CONVOSO_AUTH_TOKEN;

  if (!apiUrl || !authToken) {
    return null;
  }

  return new ConvosoClient({ apiUrl, authToken });
}
