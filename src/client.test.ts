import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { provision, PoolExhaustedError, OtpTimeoutError } from "./index.js";
import { AgentSimClient } from "./client.js";

const PROVISION_RESPONSE = {
  session_id: "sess-abc123",
  number: "+15551234567",
  country: "US",
  agent_id: "test-bot",
  status: "active",
  expires_at: "2026-03-16T20:00:00Z",
};

function makeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  });
}

describe("AgentSIM TypeScript SDK", () => {
  let client: AgentSimClient;

  beforeEach(() => {
    client = new AgentSimClient("test-key", {
      baseUrl: "https://api.agentsim.io/v1",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("provisions a session", async () => {
    vi.stubGlobal("fetch", makeFetch(201, PROVISION_RESPONSE));
    const session = await provision({ agentId: "test-bot" }, client);
    expect(session.number).toBe("+15551234567");
    expect(session.sessionId).toBe("sess-abc123");
  });

  it("throws PoolExhaustedError on 503", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(503, { error: "pool_exhausted", message: "No US numbers available" }),
    );
    await expect(provision({ agentId: "test-bot" }, client)).rejects.toBeInstanceOf(
      PoolExhaustedError,
    );
  });

  it("waits for OTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          statusText: "201",
          json: async () => PROVISION_RESPONSE,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "200",
          json: async () => ({
            otp_code: "123456",
            from_number: "+15550000000",
            received_at: "2026-03-16T18:00:00Z",
            message_id: "msg-xyz",
          }),
        }),
    );
    const session = await provision({ agentId: "test-bot" }, client);
    const result = await session.waitForOtp({ timeout: 30 });
    expect(result.otpCode).toBe("123456");
  });

  it("throws OtpTimeoutError on 408", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          statusText: "201",
          json: async () => PROVISION_RESPONSE,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 408,
          statusText: "408",
          json: async () => ({
            error: "otp_timeout",
            message: "No OTP received within timeout",
          }),
        }),
    );
    const session = await provision({ agentId: "test-bot" }, client);
    await expect(session.waitForOtp({ timeout: 30 })).rejects.toBeInstanceOf(OtpTimeoutError);
  });

  it("release calls DELETE", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          statusText: "201",
          json: async () => PROVISION_RESPONSE,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          statusText: "204",
          json: async () => ({}),
        }),
    );
    const session = await provision({ agentId: "test-bot" }, client);
    await expect(session.release()).resolves.toBeUndefined();
  });
});
