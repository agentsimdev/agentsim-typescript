import { AgentSimClient } from "./client.js";
import { NumberSession } from "./session.js";
import type { ProvisionOptions, ProvisionedNumberData } from "./client.js";

export { AgentSimClient } from "./client.js";
export { NumberSession } from "./session.js";
export type { ProvisionOptions, OtpResult, SmsMessage, WaitForOtpOptions, ReregistrationInfo } from "./client.js";
export {
  AgentSimError,
  AuthenticationError,
  ForbiddenError,
  PoolExhaustedError,
  SessionNotFoundError,
  OtpTimeoutError,
  RateLimitError,
  ValidationError,
  ApiError,
} from "./errors.js";

/**
 * Provision a real mobile number for the given agent. Starts a billable session.
 *
 * **Billing:** $0.99 per session on the Builder plan. Free on Hobby (10 sessions/month limit).
 * Sessions that end with an `OtpTimeoutError` are NOT billed.
 *
 * Returns a `NumberSession` implementing `AsyncDisposable` — use `await using`
 * in TypeScript 5.2+ for automatic release, or call `num.release()` manually.
 *
 * @example
 * ```ts
 * await using num = await provision({ agentId: "checkout-bot" });
 * const otp = await num.waitForOtp({ timeout: 60 });
 * ```
 */
export async function provision(
  options: ProvisionOptions,
  clientOrApiKey?: AgentSimClient | string,
): Promise<NumberSession> {
  let client: AgentSimClient;

  if (clientOrApiKey instanceof AgentSimClient) {
    client = clientOrApiKey;
  } else {
    client = new AgentSimClient(clientOrApiKey);
  }

  const data = await client.request<ProvisionedNumberData>("POST", "/sessions", {
    agent_id: options.agentId,
    ...(options.country !== undefined ? { country: options.country } : {}),
    ...(options.serviceUrl !== undefined ? { service_url: options.serviceUrl } : {}),
    ttl_seconds: options.ttlSeconds ?? 3600,
    ...(options.webhookUrl ? { webhook_url: options.webhookUrl } : {}),
  });

  return new NumberSession(client, data);
}
