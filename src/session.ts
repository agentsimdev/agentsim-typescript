import { OtpTimeoutError } from "./errors.js";
import type { AgentSimClient, OtpResult, ProvisionedNumberData, ReregistrationInfo, SmsMessage, WaitForOtpOptions } from "./client.js";

const DEFAULT_FALLBACK_CHAIN = ["US"] as const;

export class NumberSession implements AsyncDisposable {
  private released = false;
  private _number: string;
  private _country: string;

  readonly sessionId: string;
  readonly agentId: string;
  readonly expiresAt: string;
  readonly status: string;

  get number(): string { return this._number; }
  get country(): string { return this._country; }

  constructor(
    private readonly client: AgentSimClient,
    data: ProvisionedNumberData,
  ) {
    this.sessionId = data.session_id;
    this._number = data.number;
    this._country = data.country;
    this.agentId = data.agent_id;
    this.expiresAt = data.expires_at;
    this.status = data.status;
  }

  private async _pollOtp(timeout: number): Promise<OtpResult> {
    const data = await this.client.request<{
      otp_code: string;
      from_number: string | null;
      received_at: string;
      message_id: string | null;
    }>(
      "POST",
      `/sessions/${this.sessionId}/wait`,
      { timeout_seconds: timeout },
    );

    return {
      otpCode: data.otp_code,
      fromNumber: data.from_number,
      receivedAt: data.received_at,
      messageId: data.message_id,
    };
  }

  /**
   * Wait for an OTP to arrive on the provisioned number.
   *
   * Throws `OtpTimeoutError` if no OTP is received within the timeout period.
   * Sessions that time out are NOT billed — the $0.99 charge applies only to
   * successfully provisioned sessions that do not time out.
   */
  async waitForOtp(options: WaitForOtpOptions = {}): Promise<OtpResult> {
    const timeout = options.timeout ?? 60;
    const autoReroute = options.autoReroute ?? false;
    const maxReroutes = options.maxReroutes ?? 2;
    const onReregistrationNeeded = options.onReregistrationNeeded;

    if (!autoReroute) return this._pollOtp(timeout);

    // Build reroute chain: remaining countries after the current one
    const currentIdx = DEFAULT_FALLBACK_CHAIN.indexOf(this._country as typeof DEFAULT_FALLBACK_CHAIN[number]);
    const rerouteChain: string[] = currentIdx >= 0
      ? [...DEFAULT_FALLBACK_CHAIN.slice(currentIdx + 1), ...DEFAULT_FALLBACK_CHAIN.slice(0, currentIdx)]
      : [...DEFAULT_FALLBACK_CHAIN];

    let reroutesUsed = 0;
    let chainIdx = 0;

    while (true) {
      try {
        return await this._pollOtp(timeout);
      } catch (err) {
        if (
          !(err instanceof OtpTimeoutError) ||
          reroutesUsed >= maxReroutes ||
          chainIdx >= rerouteChain.length
        ) {
          throw err;
        }

        const nextCountry = rerouteChain[chainIdx++]!;
        reroutesUsed++;

        const rerouteData = await this.client.request<{
          new_number: string;
          country: string;
          expires_at: string;
        }>(
          "POST",
          `/sessions/${this.sessionId}/reroute`,
          { country: nextCountry },
        );

        this._number = rerouteData.new_number;
        this._country = rerouteData.country;

        if (onReregistrationNeeded) {
          const info: ReregistrationInfo = { newNumber: this._number, country: this._country };
          await onReregistrationNeeded(info);
        }
      }
    }
  }

  async getMessages(): Promise<SmsMessage[]> {
    const data = await this.client.request<{
      messages: Array<{
        id: string;
        from_number: string;
        to_number: string;
        otp_code: string | null;
        otp_confidence: string | null;
        otp_method: string | null;
        otp_consumed: boolean;
        otp_consumed_at: string | null;
        webhook_delivered: boolean;
        received_at: string;
      }>;
    }>("GET", `/sessions/${this.sessionId}/messages`);

    return data.messages.map((m) => ({
      id: m.id,
      fromNumber: m.from_number,
      toNumber: m.to_number,
      otpCode: m.otp_code,
      otpConfidence: m.otp_confidence,
      otpMethod: m.otp_method,
      otpConsumed: m.otp_consumed,
      otpConsumedAt: m.otp_consumed_at,
      webhookDelivered: m.webhook_delivered,
      receivedAt: m.received_at,
    }));
  }

  async release(): Promise<void> {
    if (!this.released) {
      this.released = true;
      await this.client.request("DELETE", `/sessions/${this.sessionId}`);
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.release();
  }
}
