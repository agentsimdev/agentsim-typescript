export class AgentSimError extends Error {
  readonly code: string;
  readonly statusCode: number | undefined;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = "AgentSimError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends AgentSimError {
  constructor(message = "Invalid or missing API key.") {
    super(message, "unauthorized", 401);
    this.name = "AuthenticationError";
  }
}

export class ForbiddenError extends AgentSimError {
  constructor(message = "API key revoked or lacking permissions.") {
    super(message, "forbidden", 403);
    this.name = "ForbiddenError";
  }
}

export class PoolExhaustedError extends AgentSimError {
  readonly country: string;
  readonly availableCountries: string[];

  constructor(
    message = "No numbers available in the requested pool.",
    country = "",
    availableCountries: string[] = [],
  ) {
    super(message, "pool_exhausted", 503);
    this.name = "PoolExhaustedError";
    this.country = country;
    this.availableCountries = availableCountries;
  }
}

export class SessionNotFoundError extends AgentSimError {
  constructor(message = "Session not found.") {
    super(message, "not_found", 404);
    this.name = "SessionNotFoundError";
  }
}

export class OtpTimeoutError extends AgentSimError {
  constructor(message = "No OTP received within the timeout period.") {
    super(message, "otp_timeout", 408);
    this.name = "OtpTimeoutError";
  }
}

export class RateLimitError extends AgentSimError {
  constructor(message = "Rate limit exceeded.") {
    super(message, "rate_limited", 429);
    this.name = "RateLimitError";
  }
}

export class CountryNotAllowedError extends AgentSimError {
  readonly country: string;
  readonly plan: string;
  readonly allowed: string[];

  constructor(
    message = "Country not available on your current plan.",
    country = "",
    plan = "",
    allowed: string[] = [],
  ) {
    super(message, "country_not_allowed_on_plan", 403);
    this.name = "CountryNotAllowedError";
    this.country = country;
    this.plan = plan;
    this.allowed = allowed;
  }
}

export class ValidationError extends AgentSimError {
  readonly details: unknown;

  constructor(message = "Validation error.", details?: unknown) {
    super(message, "validation_error", 422);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class ApiError extends AgentSimError {
  constructor(message = "An unexpected API error occurred.", code = "internal_error", statusCode = 500) {
    super(message, code, statusCode);
    this.name = "ApiError";
  }
}

const CODE_MAP: Record<string, (msg: string, data?: Record<string, unknown>) => AgentSimError> = {
  unauthorized: (m) => new AuthenticationError(m),
  forbidden: (m) => new ForbiddenError(m),
  not_found: (m) => new SessionNotFoundError(m),
  otp_timeout: (m) => new OtpTimeoutError(m),
  rate_limited: (m) => new RateLimitError(m),
  validation_error: (m) => new ValidationError(m),
  country_not_allowed_on_plan: (m, d) =>
    new CountryNotAllowedError(
      m,
      typeof d?.["country"] === "string" ? d["country"] : "",
      typeof d?.["plan"] === "string" ? d["plan"] : "",
      Array.isArray(d?.["allowed"]) ? (d["allowed"] as string[]) : [],
    ),
};

export function fromApiError(
  code: string,
  message: string,
  statusCode: number,
  data?: Record<string, unknown>,
): AgentSimError {
  if (code === "pool_exhausted") {
    const country = typeof data?.["country"] === "string" ? data["country"] : "";
    const availableCountries = Array.isArray(data?.["available_countries"])
      ? (data["available_countries"] as string[])
      : [];
    return new PoolExhaustedError(message, country, availableCountries);
  }
  const factory = CODE_MAP[code];
  return factory ? factory(message, data) : new ApiError(message, code, statusCode);
}
