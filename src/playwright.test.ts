import { describe, expect, it } from "vitest";
import { classifyStall } from "./index.js";
import type { PageLike } from "./index.js";

function fakePage(text = "", visible: string[] = []): PageLike {
  return {
    locator(selector) {
      const locator = {
        first: () => locator,
        isVisible: async () => visible.some((marker) => selector.includes(marker)),
        innerText: async () => selector === "body" ? text : "",
      };
      return locator;
    },
  };
}

describe("classifyStall", () => {
  it("reports a resolved SMS challenge as OTP received", async () => {
    const page = {
      locator(): never {
        throw new Error("resolved challenges should not inspect the page");
      },
    };

    await expect(classifyStall(page, {
      channel: "sms_otp",
      challengeValue: "847291",
      messageCount: 1,
    })).resolves.toBe("otp_received");
  });

  it.each([
    ["email_otp", "email_received"],
    ["magic_link", "magic_link_received"],
  ] as const)("reports a resolved %s challenge", async (channel, outcome) => {
    const page = {
      locator(): never {
        throw new Error("resolved challenges should not inspect the page");
      },
    };

    await expect(classifyStall(page, {
      channel,
      challengeValue: "https://example.test/verify",
      messageCount: 1,
    })).resolves.toBe(outcome);
  });

  it.each([
    ["anti-bot copy", fakePage("Verify you are human to continue")],
    ["robot-check copy", fakePage("Please prove you are not a robot")],
    ["a visible CAPTCHA iframe", fakePage("", ["recaptcha"])],
  ] as const)("reports an anti-bot gate from %s", async (_source, page) => {
    await expect(classifyStall(page, {
      channel: "sms_otp",
      messageCount: 0,
    })).resolves.toBe("anti_bot_gate");
  });

  it.each([
    ["passkey copy", fakePage("Use a passkey to continue")],
    ["security key copy", fakePage("Insert your security key to authenticate")],
    ["Touch ID copy", fakePage("Authenticate with Touch ID")],
    ["Windows Hello copy", fakePage("Sign in with Windows Hello")],
    ["Face ID copy", fakePage("Use Face ID to continue")],
    ["biometric copy", fakePage("Authenticate with biometric verification")],
    ["fingerprint auth copy", fakePage("Use fingerprint authentication to proceed")],
    ["navigator.credentials.get code", fakePage("navigator.credentials.get({ publicKey")],
    ["PublicKeyCredential code", fakePage("new PublicKeyCredential()")],
    ["a visible WebAuthn iframe", fakePage("", ["webauthn"])],
    ["a visible passkey button", fakePage("", ["passkey"])],
  ] as const)("reports WebAuthn from %s", async (_source, page) => {
    await expect(classifyStall(page, {
      channel: "email_otp",
      messageCount: 0,
    })).resolves.toBe("webauthn_required");
  });

  it.each([
    "This phone number cannot be used for verification.",
    "Phone number\ncannot be used here.",
  ])("reports an explicit phone rejection", async (text) => {
    await expect(classifyStall(fakePage(text), {
      channel: "sms_otp",
      messageCount: 0,
    })).resolves.toBe("phone_rejected");
  });

  it("reports SMS received without a parsed OTP", async () => {
    const page = fakePage("Enter the code we sent", ["one-time-code"]);

    await expect(classifyStall(page, {
      channel: "sms_otp",
      messageCount: 1,
    })).resolves.toBe("sms_no_otp");
  });

  it("reports no SMS when no message arrived", async () => {
    await expect(classifyStall(fakePage("Enter the code we sent", ["one-time-code"]), {
      channel: "sms_otp",
      messageCount: 0,
    })).resolves.toBe("no_sms");
  });

  it("reports no email while an email challenge field is visible", async () => {
    const page = fakePage("Check your email", ['input[type="email"']);

    await expect(classifyStall(page, {
      channel: "email_otp",
      messageCount: 0,
    })).resolves.toBe("no_email");
  });

  it("recognizes an email-first stall even on the default SMS channel", async () => {
    const page = fakePage("Enter your email to continue", ['input[type="email"']);

    await expect(classifyStall(page, {
      channel: "sms_otp",
      messageCount: 0,
    })).resolves.toBe("no_email");
  });

  it("reports no email while an OTP field is visible", async () => {
    const page = fakePage("Enter the code from your email", ["one-time-code"]);

    await expect(classifyStall(page, {
      channel: "email_otp",
      messageCount: 0,
    })).resolves.toBe("no_email");
  });

  it.each(["email_otp", "magic_link"] as const)(
    "uses no_email as the honest %s fallback",
    async (channel) => {
      await expect(classifyStall(fakePage(), {
        channel,
        messageCount: 0,
      })).resolves.toBe("no_email");
    },
  );
});
