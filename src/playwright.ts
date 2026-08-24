export type ChallengeChannel = "sms_otp" | "email_otp" | "magic_link" | "webauthn_required";

export type StallOutcome =
  | "otp_received"
  | "sms_no_otp"
  | "no_sms"
  | "phone_rejected"
  | "anti_bot_gate"
  | "email_received"
  | "magic_link_received"
  | "webauthn_required"
  | "no_email";

export interface LocatorLike {
  first(): LocatorLike;
  isVisible(): Promise<boolean>;
  innerText(): Promise<string>;
}

export interface PageLike {
  locator(selector: string): LocatorLike;
}

export interface StallSessionEvidence {
  channel: ChallengeChannel;
  challengeValue?: string | null;
  messageCount: number;
}

const ANTI_BOT_SELECTOR = [
  'iframe[src*="recaptcha" i]',
  'iframe[src*="hcaptcha" i]',
  'iframe[src*="arkoselabs" i]',
  "[data-sitekey]",
  '[class*="captcha" i]',
].join(", ");

const WEBAUTHN_SELECTOR = [
  'iframe[src*="webauthn" i]',
  '[autocomplete="webauthn"]',
  '[data-testid*="passkey" i]',
  '[data-testid*="webauthn" i]',
  '[id*="passkey" i]',
  '[id*="webauthn" i]',
  '[class*="passkey" i]',
  '[class*="webauthn" i]',
  'button[data-action*="passkey" i]',
  'button[data-action*="webauthn" i]',
].join(", ");

const EMAIL_FIELD_SELECTOR = 'input[type="email"], input[autocomplete="email"]';
const OTP_FIELD_SELECTOR = [
  'input[autocomplete="one-time-code"]',
  'input[name*="otp" i]',
  'input[id*="otp" i]',
  'input[name*="code" i]',
  'input[id*="code" i]',
].join(", ");

export async function classifyStall(
  page: PageLike,
  session: StallSessionEvidence,
): Promise<StallOutcome> {
  if (session.challengeValue?.trim()) {
    return ({
      sms_otp: "otp_received",
      email_otp: "email_received",
      magic_link: "magic_link_received",
      webauthn_required: "webauthn_required",
    } as const)[session.channel];
  }

  const pageText = await page.locator("body").innerText();
  if (
    await page.locator(ANTI_BOT_SELECTOR).first().isVisible()
    || /captcha|verify (?:you are|that you are) human|(?:not a|are you (?:a )?) robot|security challenge/i.test(pageText)
  ) {
    return "anti_bot_gate";
  }
  if (
    await page.locator(WEBAUTHN_SELECTOR).first().isVisible()
    || /\b(?:passkey|security key|webauthn|touch id|windows hello|face id|biometric|fingerprint auth(?:entication)?|use your (?:passkey|security key)|authenticate with (?:passkey|security key|biometric))\b/i.test(pageText)
    || /navigator\.credentials\.get/i.test(pageText)
    || /PublicKeyCredential/i.test(pageText)
  ) {
    return "webauthn_required";
  }
  if (
    /\b(?:phone|mobile)(?: number)?\b[\s\S]{0,80}\b(?:cannot|can't|invalid|unsupported|rejected|not (?:accepted|supported|allowed)|try another)\b/i.test(pageText)
    || /\b(?:invalid|unsupported|rejected)\b[\s\S]{0,40}\b(?:phone|mobile)(?: number)?\b/i.test(pageText)
  ) {
    return "phone_rejected";
  }
  if (
    await page.locator(EMAIL_FIELD_SELECTOR).first().isVisible()
    || (
      session.channel !== "sms_otp"
      && await page.locator(OTP_FIELD_SELECTOR).first().isVisible()
    )
  ) {
    return "no_email";
  }
  if (session.channel === "sms_otp" && session.messageCount > 0) {
    return "sms_no_otp";
  }
  return session.channel === "sms_otp" ? "no_sms" : "no_email";
}
