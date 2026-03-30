# @agentsim/sdk

TypeScript/JavaScript SDK for AgentSIM — autonomous OTP relay for AI agents. Zero runtime dependencies. Works in Node.js 18+, Bun, Deno, and Edge runtimes.

## Install

```bash
npm install @agentsim/sdk
# or: bun add @agentsim/sdk
```

## Quickstart

```typescript
import { provision } from "@agentsim/sdk";

// Using AsyncDisposable (TypeScript 5.2+, recommended)
await using num = await provision({ agentId: "checkout-bot", country: "US" });
await enterPhoneNumber(num.number);            // "+14155552671"
const otp = await num.waitForOtp({ timeout: 60 });
await enterOtp(otp.otpCode);                   // "847291"
// number auto-released via [Symbol.asyncDispose]
```

```typescript
// Manual release (Node 18, no using declaration)
const num = await provision({ agentId: "checkout-bot" });
try {
  const otp = await num.waitForOtp();
} finally {
  await num.release();
}
```

## Auth

Set `AGENTSIM_API_KEY` in your environment, or pass `apiKey` to the client constructor:

```typescript
import { AgentSimClient } from "@agentsim/sdk";
const client = new AgentSimClient({ apiKey: "asm_live_xxx" });
```

Get your API key at [console.agentsim.dev](https://console.agentsim.dev).

## API

### `provision(options)`

Provisions a number and returns a `NumberSession`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentId` | `string` | required | Identifier for your agent |
| `country` | `string` | `"US"` | ISO country code |
| `ttlSeconds` | `number` | `3600` | Auto-release after N seconds |
| `webhookUrl` | `string` | — | POST OTPs here as they arrive |
| `apiKey` | `string` | env var | Override `AGENTSIM_API_KEY` |

### `num.waitForOtp(options?)`

Waits for an OTP to arrive on the provisioned number.

| Option | Type | Default |
|--------|------|---------|
| `timeout` | `number` | `60` |

Returns `{ otpCode: string, fromNumber: string | null, receivedAt: string }`.

Throws `OtpTimeoutError` if no OTP arrives within `timeout` seconds.

### `num.release()`

Releases the number back to the pool early. Called automatically by `[Symbol.asyncDispose]`.

## Error Reference

| Class | When |
|-------|------|
| `AuthenticationError` | Missing or invalid API key |
| `PoolExhaustedError` | No numbers available in requested country |
| `OtpTimeoutError` | No OTP arrived within timeout |
| `RateLimitError` | Too many requests |

## Supported Countries

US (CA, AU, DE, FR coming soon)
