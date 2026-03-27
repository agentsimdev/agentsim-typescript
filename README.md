<p align="center">
  <a href="https://agentsim.dev">
    <img src="https://agentsim.dev/logo.svg" alt="AgentSIM" width="80" />
  </a>
</p>

<h1 align="center">@agentsim/sdk</h1>

<p align="center">
  <strong>TypeScript SDK for AgentSIM — real SIM-backed phone numbers for AI agents</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@agentsim/sdk"><img src="https://img.shields.io/npm/v/@agentsim/sdk?color=%2334D058&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@agentsim/sdk"><img src="https://img.shields.io/node/v/@agentsim/sdk" alt="Node.js version"></a>
  <a href="https://github.com/agentsimdev/agentsim-typescript/blob/main/LICENSE"><img src="https://img.shields.io/github/license/agentsimdev/agentsim-typescript" alt="License"></a>
</p>

<p align="center">
  <a href="https://docs.agentsim.dev">Docs</a> ·
  <a href="https://agentsim.dev/dashboard">Dashboard</a> ·
  <a href="https://github.com/agentsimdev/agentsim-examples">Examples</a> ·
  <a href="https://github.com/agentsimdev/agentsim-mcp">MCP Server</a>
</p>

---

Provision real carrier-routed mobile numbers, receive inbound SMS, and get parsed OTP codes — all from your AI agent. Zero runtime dependencies. Works in Node.js 18+, Bun, Deno, and Edge runtimes.

## Install

```bash
npm install @agentsim/sdk
```

```bash
bun add @agentsim/sdk
```

## Quick Start

```typescript
import { provision } from "@agentsim/sdk";

// TypeScript 5.2+ with AsyncDisposable (recommended)
await using num = await provision({ agentId: "checkout-bot", country: "US" });
await enterPhoneNumber(num.number);          // "+14155552671"
const otp = await num.waitForOtp({ timeout: 60 });
await enterOtp(otp.otpCode);                 // "847291"
// number auto-released via [Symbol.asyncDispose]
```

```typescript
// Manual release (Node 18, no `using` declaration)
const num = await provision({ agentId: "checkout-bot" });
try {
  const otp = await num.waitForOtp();
} finally {
  await num.release();
}
```

## Authentication

Set `AGENTSIM_API_KEY` in your environment, or pass it to the client:

```typescript
import { AgentSimClient, provision } from "@agentsim/sdk";

const client = new AgentSimClient("asm_live_xxx");
const num = await provision({ agentId: "my-bot" }, client);
```

Get your API key at [agentsim.dev/dashboard](https://agentsim.dev/dashboard).

## API Reference

### `provision(options)`

Provisions a number and returns a `NumberSession`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentId` | `string` | required | Identifier for your agent |
| `country` | `string` | `"US"` | ISO 3166-1 alpha-2 country code |
| `ttlSeconds` | `number` | `3600` | Auto-release after N seconds |
| `webhookUrl` | `string` | — | Receive OTPs via webhook |

### `num.waitForOtp(options?)`

Waits for an OTP to arrive on the provisioned number.

| Option | Type | Default | Description |
|--------|------|---------| ------------|
| `timeout` | `number` | `60` | Max seconds to wait |
| `autoReroute` | `boolean` | `false` | Swap number on timeout |
| `maxReroutes` | `number` | `2` | Max reroute attempts |

Returns `{ otpCode: string, fromNumber: string | null, receivedAt: string }`.

### `num.release()`

Release the number early. Called automatically by `[Symbol.asyncDispose]`.

### `num.getMessages()`

List all SMS messages received in this session.

## Error Handling

```typescript
import { provision, OtpTimeoutError, PoolExhaustedError } from "@agentsim/sdk";

try {
  await using num = await provision({ agentId: "my-bot" });
  const otp = await num.waitForOtp({ timeout: 30 });
} catch (err) {
  if (err instanceof OtpTimeoutError) {
    console.log("No OTP received — not billed");
  } else if (err instanceof PoolExhaustedError) {
    console.log("No numbers available");
  }
}
```

| Class | HTTP | When |
|-------|------|------|
| `AuthenticationError` | 401 | Missing or invalid API key |
| `ForbiddenError` | 403 | Key revoked or lacking permissions |
| `PoolExhaustedError` | 503 | No numbers available in requested country |
| `OtpTimeoutError` | 408 | No OTP arrived within timeout (not billed) |
| `RateLimitError` | 429 | Too many requests |
| `SessionNotFoundError` | 404 | Session expired or already released |
| `CountryNotAllowedError` | 403 | Country not on your plan |

## Pricing

- **Hobby**: 10 free sessions/month
- **Builder**: $0.99/session
- Sessions that time out (`OtpTimeoutError`) are **not billed**

## Links

- [Documentation](https://docs.agentsim.dev)
- [Python SDK](https://github.com/agentsimdev/agentsim-python)
- [MCP Server](https://github.com/agentsimdev/agentsim-mcp)
- [Examples](https://github.com/agentsimdev/agentsim-examples)

## License

[MIT](LICENSE)
