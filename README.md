# @agentsim/sdk

We run the auth challenge so your agent doesn't die there. This TypeScript SDK is the primary published SDK: `openChallenge` opens an SMS challenge, `waitForVerdict` waits for the verdict. `provision` and `waitForOtp` are aliases that still work. Timeouts are seconds. Zero runtime dependencies. Works in Node.js 18+, Bun, Deno, and Edge runtimes.

**Availability:** Live SMS is self-serve for owned public HTTPS services after exact-origin verification and an allow policy. Hobby includes 10 live US SMS sessions per UTC month, with one active live session per account and no card required. Billing shows current paid terms before checkout and preserves any existing agreement. Check [current access and channel support](https://docs.agentsim.dev/availability) before using live examples.

## Install

```bash
bun add @agentsim/sdk
# or: npm install @agentsim/sdk
```

## Quickstart

Set `AGENTSIM_API_KEY` first and replace the target with your owned public HTTPS origin. Browser actions such as `enterPhoneNumber` and `enterOtp` are supplied by your app automation; request the SMS before waiting.

```typescript
import { openChallenge } from "@agentsim/sdk";

await using num = await openChallenge({ agentId: "checkout-bot", serviceUrl: "https://staging.example.com", country: "US" });
await enterPhoneNumber(num.number);
const otp = await num.waitForVerdict({ timeout: 60 });
await enterOtp(otp.otpCode);
```

```typescript
const num = await openChallenge({ agentId: "checkout-bot", serviceUrl: "https://staging.example.com" });
try {
  const otp = await num.waitForVerdict();
} finally {
  await num.release();
}
```

`provision` / `waitForOtp` remain aliases of `openChallenge` / `waitForVerdict`.

## Auth

Set `AGENTSIM_API_KEY` in your environment, or pass the key as the first constructor argument:

```typescript
import { AgentSimClient } from "@agentsim/sdk";
const client = new AgentSimClient("asm_live_xxx");
```

Get your API key at [console.agentsim.dev](https://console.agentsim.dev).

## API

### `openChallenge(options, clientOrApiKey?)`

Opens an SMS challenge and returns a `NumberSession`. `provision` is an alias.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentId` | `string` | required | Identifier for your agent |
| `country` | `string` | `"US"` | ISO country code |
| `serviceUrl` | `string` | required | HTTPS origin of the owned target; policy-checked before allocation |
| `ttlSeconds` | `number` | `3600` | Auto-release after N seconds |
| `webhookUrl` | `string` | — | POST verdicts here as they arrive |

Pass an API key as the second argument, not as a field on `options`.

### `num.waitForVerdict(options?)`

Waits for the SMS verdict. Timeout is seconds. `waitForOtp` is an alias.

| Option | Type | Default |
|--------|------|---------|
| `timeout` | `number` | `60` |

Returns `{ otpCode: string, fromNumber: string | null, receivedAt: string }`.

Throws `OtpTimeoutError` if no verdict arrives within `timeout` seconds.

### `num.release()`

Closes the challenge session. Called automatically by `[Symbol.asyncDispose]`.

## Error Reference

| Class | When |
|-------|------|
| `AuthenticationError` | Missing or invalid API key |
| `PoolExhaustedError` | No numbers available in requested country |
| `OtpTimeoutError` | No verdict arrived within timeout |
| `RateLimitError` | Too many requests |

## Supported Countries

US
