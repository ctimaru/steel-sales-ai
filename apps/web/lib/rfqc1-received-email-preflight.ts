/**
 * RFQC1.EMAIL1.C — received-mail PRE-FLIGHT ONLY. No webhook, DB, AI or write.
 *
 * The caller MUST have checked the Resend Svix signature over the raw POST
 * before passing payload to this parser. These values are only hints until
 * their identity has been matched to an authorised RFQH3 dispatch and a
 * sender-authentication verdict from a trusted mail transport.
 *
 * Treat all sender-controlled fields, including email headers and subject,
 * as UNTRUSTED. Do not use Authentication-Results or DKIM header text as an
 * authentication verdict without verifying its trusted provenance.
 */
export type Rfqc1InboundEnvelope =
  | { kind: "ignored" }
  | { kind: "rejected"; reason: "shape" | "identity" | "recipients" | "attachments" | "alias" }
  | {
      kind: "candidate";
      providerEmailId: string;
      dispatchId: string;
      from: string;
      recipient: string;
    };

export type Rfqc1ReceivedContent =
  | { kind: "rejected"; reason: "shape" | "identity" | "recipients" | "attachments" | "body" | "oversize" }
  | {
      kind: "candidate";
      providerEmailId: string;
      from: string;
      recipient: string;
      plainText: string;
      /** Deliberately NOT authenticated by received-email API payload alone. */
      senderAuthenticationPassed: false;
    };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const alias = /^reply\+([0-9a-f-]{36})\.([A-Za-z0-9_-]{24})@([a-z0-9.-]+)$/;
const maxBytes = 32768;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function safeMailbox(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 320 || /[\r\n,]/.test(value)) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^[^<>]*<([^<>\s]+)>$/);
  const email = (match ? match[1] : trimmed).toLowerCase();
  return /^[^@\s<>]+@[a-z0-9.-]+$/.test(email) && !email.includes("..") ? email : null;
}
function safeAlias(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 320 || /[\r\n,<>\s]/.test(value)) return null;
  const i = value.lastIndexOf("@");
  if (i < 1) return null;
  return value.slice(0, i) + "@" + value.slice(i + 1).toLowerCase();
}
function zeroOrAbsent(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}
function soleRecipient(value: unknown): string | null {
  return Array.isArray(value) && value.length === 1 ? safeAlias(value[0]) : null;
}

/**
 * Expected Resend payload (verified elsewhere):
 * { type:"email.received", data:{email_id,from,to,cc,bcc,attachments} }
 * Does NOT trust message body, sender identity or signature embedded in alias.
 */
export function parseRfqc1ReceivedWebhook(
  payload: unknown,
  receivingDomain: string,
): Rfqc1InboundEnvelope {
  const root = object(payload);
  if (!root || root.type !== "email.received") return { kind: "ignored" };
  const data = object(root.data);
  if (!data) return { kind: "rejected", reason: "shape" };
  if (typeof data.email_id !== "string" || !uuid.test(data.email_id)) {
    return { kind: "rejected", reason: "identity" };
  }
  if (!zeroOrAbsent(data.cc) || !zeroOrAbsent(data.bcc) ||
      !Array.isArray(data.to) || data.to.length !== 1) {
    return { kind: "rejected", reason: "recipients" };
  }
  if (!zeroOrAbsent(data.attachments)) {
    return { kind: "rejected", reason: "attachments" };
  }
  const sender = safeMailbox(data.from);
  const recipient = soleRecipient(data.to);
  if (!sender || !recipient) return { kind: "rejected", reason: "recipients" };
  const match = recipient.match(alias);
  const domain = receivingDomain.trim().toLowerCase();
  if (!match || !uuid.test(match[1]) ||
      domain.length < 4 || !domain.includes(".") || domain.includes("..") ||
      match[3] !== domain) {
    return { kind: "rejected", reason: "alias" };
  }
  return {
    kind: "candidate",
    providerEmailId: data.email_id,
    dispatchId: match[1].toLowerCase(),
    from: sender,
    recipient,
  };
}

/**
 * Validate metadata again against a separately fetched Received Email API
 * response. Only plain text; reject HTML-only, group mail, attachments and
 * mismatched provider identity. No processing of mail headers or URLs.
 */
export function inspectRfqc1ReceivedContent(
  envelope: Extract<Rfqc1InboundEnvelope, {kind:"candidate"}>,
  received: unknown,
): Rfqc1ReceivedContent {
  const data = object(received);
  if (!data) return { kind: "rejected", reason: "shape" };
  if (data.id !== envelope.providerEmailId) {
    return { kind: "rejected", reason: "identity" };
  }
  if (!zeroOrAbsent(data.cc) || !zeroOrAbsent(data.bcc) ||
      soleRecipient(data.to) !== envelope.recipient ||
      (data.received_for !== undefined &&
        (!Array.isArray(data.received_for) ||
          data.received_for.length !== 1 ||
          safeAlias(data.received_for[0]) !== envelope.recipient)) ||
      safeMailbox(data.from) !== envelope.from) {
    return { kind: "rejected", reason: "recipients" };
  }
  if (!zeroOrAbsent(data.attachments)) {
    return { kind: "rejected", reason: "attachments" };
  }
  if (typeof data.text !== "string") return { kind: "rejected", reason: "body" };
  if (Buffer.byteLength(data.text, "utf8") > maxBytes) {
    return { kind: "rejected", reason: "oversize" };
  }
  if (data.text.trim().length === 0) return { kind: "rejected", reason: "body" };
  return {
    kind: "candidate",
    providerEmailId: envelope.providerEmailId,
    from: envelope.from,
    recipient: envelope.recipient,
    plainText: data.text,
    senderAuthenticationPassed: false,
  };
}
