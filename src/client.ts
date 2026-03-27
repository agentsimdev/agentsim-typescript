import { fromApiError, AgentSimError } from "./errors.js";

declare const Deno: { env: { get(k: string): string | undefined } } | undefined;

export interface ProvisionOptions {
  agentId: string;
  country?: string;
  serviceUrl?: string;
  ttlSeconds?: number;
  webhookUrl?: string;
}

export interface ReregistrationInfo {
  newNumber: string;
  country: string;
}

export interface OtpResult {
  otpCode: string;
  fromNumber: string | null;
  receivedAt: string;
  messageId: string | null;
}

export interface SmsMessage {
  id: string;
  fromNumber: string;
  toNumber: string;
  otpCode: string | null;
  otpConfidence: string | null;
  otpMethod: string | null;
  otpConsumed: boolean;
  otpConsumedAt: string | null;
  webhookDelivered: boolean;
  receivedAt: string;
}

export interface WaitForOtpOptions {
  timeout?: number;
  autoReroute?: boolean;
  maxReroutes?: number;
  onReregistrationNeeded?: (info: ReregistrationInfo) => Promise<void>;
}

export interface ProvisionedNumberData {
  session_id: string;
  number: string;
  country: string;
  agent_id: string;
  status: string;
  expires_at: string;
}

const DEFAULT_BASE_URL = "https://api.agentsim.dev/v1";

function getApiKey(): string {
  // Support both Node.js and Deno environments
  if (typeof process !== "undefined" && process.env["AGENTSIM_API_KEY"]) {
    return process.env["AGENTSIM_API_KEY"];
  }
  if (typeof Deno !== "undefined") {
    const key = (Deno as { env: { get(k: string): string | undefined } }).env.get("AGENTSIM_API_KEY");
    if (key) return key;
  }
  return "";
}

function getBaseUrl(): string {
  if (typeof process !== "undefined" && process.env["AGENTSIM_BASE_URL"]) {
    return process.env["AGENTSIM_BASE_URL"];
  }
  return DEFAULT_BASE_URL;
}

export class AgentSimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, options?: { baseUrl?: string }) {
    this.apiKey = apiKey ?? getApiKey();
    this.baseUrl = (options?.baseUrl ?? getBaseUrl()).replace(/\/$/, "");
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      throw new AgentSimError(`Network error: ${err}`, "network_error");
    }

    if (response.status === 204) return undefined as unknown as T;

    const data = await response.json().catch(() => ({})) as Record<string, unknown>;

    if (!response.ok) {
      const code = typeof data["error"] === "string" ? data["error"] : "unknown_error";
      const message = typeof data["message"] === "string" ? data["message"] : response.statusText;
      throw fromApiError(code, message, response.status, data);
    }

    return data as T;
  }
}
