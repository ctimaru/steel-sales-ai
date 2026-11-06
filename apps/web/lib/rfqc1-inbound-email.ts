/**
 * RFQC1.EMAIL1.A — PURE inbound email contract, NOT a webhook or ingest path.
 *
 * External email is untrusted. This module does not send, persist, or call any
 * RFQH6 RPC. A future handler MUST independently verify the Resend webhook's
 * raw-body signature, the provider's identity/authentication evidence, tenant
 * authorisation, rate limits, and a database UNIQUE receipt key before posting.
 *
 * Reply aliases are correlation hints, not login capabilities.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isRfqc1TrustedSenderVerifierAvailable } from "./rfqc1-inbound-transport-auth.ts";

export type Rfqc1InboundDispatch = {
  rfqId: string;
  dispatchId: string;
  supplierId: string;
  supplierEmail: string;
};

export type Rfqc1InboundReply = {
  providerEmailId: string;
  from: string;
  envelopeTo: readonly string[];
  plainText: string | null;
  /** True ONLY after checking trusted SMTP/DKIM/DMARC evidence, not From text. */
  senderAuthenticationPassed: boolean;
};

export type Rfqc1InboundDecision =
  | { kind: "rejected"; reason: "invalid" | "recipient" | "sender" | "body" | "oversize" }
  | { kind: "quarantine"; reason: "sender_unverified" }
  | { kind: "eligible"; correlationId: string; idempotencyKey: string; body: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const ALIAS = new RegExp("^reply\\+(" + UUID + ")\\.([A-Za-z0-9_-]{24})@([a-z0-9.-]+)$");
const MAX_EMAIL_BYTES = 32768;
const MAX_MESSAGE_CHARS = 4000;
const MAX_PROVIDER_ID = 200;

function canonicalDomain(domain: string): string {
  const result = domain.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(result) ||
      !result.includes(".") || result.includes("..")) {
    throw new Error("Invalid inbound email domain");
  }
  return result;
}

function normalizeMailbox(value: string): string | null {
  if (typeof value !== "string" || value.length > 320 || /[\r\n,]/.test(value)) return null;
  const raw = value.trim();
  const inBrackets = raw.match(/^[^<>]*<([^<>\s]+)>$/);
  const address = (inBrackets ? inBrackets[1] : raw).toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+$/.test(address)) return null;
  const [local, host] = address.split("@");
  if (!local || !host || local.length > 64 || !host.includes(".") || host.includes("..")) return null;
  return address;
}

/**
 * Email domains are case-insensitive, but a signed base64url local-part is not.
 * Never lowercase a signature before timing-safe comparison.
 */
function normalizeAliasMailbox(value: string): string | null {
  if (typeof value !== "string" || value.length > 320 || /[\r\n,<>\s]/.test(value)) return null;
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  return value.slice(0, at) + "@" + value.slice(at + 1).toLowerCase();
}

function requiredUuid(uuid: string): string {
  const normalized = uuid.toLowerCase();
  if (!(new RegExp("^" + UUID + "$")).test(normalized)) throw new Error("Invalid dispatch identity");
  return normalized;
}

function aliasMac(identity: Rfqc1InboundDispatch, secret: string): string {
  if (secret.length < 32) throw new Error("Inbound email secret is not configured");
  // Fixed-length/line-separated components prevent ambiguous concatenations.
  const material = ["rfqc1-email-v1", requiredUuid(identity.rfqId),
    requiredUuid(identity.dispatchId), requiredUuid(identity.supplierId)].join("\n");
  return createHmac("sha256", secret).update(material, "utf8").digest("base64url").slice(0, 24);
}

export function buildRfqc1InboundAlias(
  identity: Rfqc1InboundDispatch, domain: string, secret: string,
): string {
  return "reply+" + requiredUuid(identity.dispatchId) + "." +
    aliasMac(identity, secret) + "@" + canonicalDomain(domain);
}

function matchesReplyAlias(
  receivedAddress: string, identity: Rfqc1InboundDispatch,
  domain: string, secret: string,
): boolean {
  const normalized = normalizeAliasMailbox(receivedAddress);
  if (!normalized) return false;
  const match = normalized.match(ALIAS);
  if (!match || match[1] !== requiredUuid(identity.dispatchId) ||
      match[3] !== canonicalDomain(domain)) return false;
  const expected = aliasMac(identity, secret);
  const actual = match[2];
  // same-length constant-time signature comparison, no direct string compare.
  return actual.length === expected.length &&
    timingSafeEqual(Uint8Array.from(Buffer.from(actual, "ascii")), Uint8Array.from(Buffer.from(expected, "ascii")));
}

/** Removes quoted original messages, forwarded header blocks, and signatures.
 * Never converts HTML into commands or prices. Text is shown escaped by React.
 */
export function cleanRfqc1InboundPlainText(rawText: string): string | null {
  if (typeof rawText !== "string" || Buffer.byteLength(rawText, "utf8") > MAX_EMAIL_BYTES) return null;
  const text = rawText.replace(/\r\n?/g, "\n").replace(/\0/g, "");
  const kept: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (/^\s*>/.test(line)) break;
    if (/^\s*(?:On .+ wrote:|Il giorno .+ ha scritto:|-----Original Message-----|-----Messaggio originale-----)$/i.test(line)) break;
    if (/^\s*(?:Da:|From:)\s+\S+/.test(line)) break;
    if (/^--\s*$/.test(line)) break;
    kept.push(line);
  }
  const clean = kept.join("\n").trim().slice(0, MAX_MESSAGE_CHARS);
  return clean.length > 0 ? clean : null;
}

/**
 * PREPARE a candidate email for a future server-controlled receive ledger.
 * This does NOT establish authenticity, authorize a reply, or perform a write.
 * Repeated providerEmailId maps to the same key; only a UNIQUE DB constraint
 * and an atomic transaction can guarantee that it is actually processed once.
 */
export function evaluateRfqc1InboundReply(input: {
  identity: Rfqc1InboundDispatch;
  reply: Rfqc1InboundReply;
  receivingDomain: string;
  signingSecret: string;
}): Rfqc1InboundDecision {
  const { reply, identity } = input;
  if (typeof reply.providerEmailId !== "string" ||
      reply.providerEmailId.length < 1 ||
      reply.providerEmailId.length > MAX_PROVIDER_ID ||
      /[\r\n]/.test(reply.providerEmailId)) return { kind: "rejected", reason: "invalid" };
  if (reply.envelopeTo.length !== 1 ||
      !matchesReplyAlias(reply.envelopeTo[0], identity, input.receivingDomain, input.signingSecret)) {
    return { kind: "rejected", reason: "recipient" };
  }
  const sender = normalizeMailbox(reply.from);
  const expected = normalizeMailbox(identity.supplierEmail);
  if (!sender || !expected || sender !== expected) return { kind: "rejected", reason: "sender" };
  if (!reply.senderAuthenticationPassed) return { kind: "quarantine", reason: "sender_unverified" };
  if (reply.plainText === null) return { kind: "rejected", reason: "body" };
  if (Buffer.byteLength(reply.plainText, "utf8") > MAX_EMAIL_BYTES)
    return { kind: "rejected", reason: "oversize" };
  const body = cleanRfqc1InboundPlainText(reply.plainText);
  if (!body) return { kind: "rejected", reason: "body" };
  const providerIdentity = [requiredUuid(identity.dispatchId), reply.providerEmailId].join(":");
  return {
    kind: "eligible",
    correlationId: requiredUuid(identity.dispatchId),
    idempotencyKey: createHash("sha256").update("rfqc1-inbound:v1:" + providerIdentity).digest("hex"),
    body,
  };
}


// RFQC1.EMAIL1.B — outbound header selection only, never a webhook or ingest.
export type Rfqc1InboundReplyToFlags = {
  enabled: boolean;
  receiverReady: boolean;
  receivingDomain?: string | null;
  signingSecret?: string | null;
};

/**
 * The existing buyer address is the fallback until the fully validated
 * receiver is explicitly activated; incomplete receiving config fails closed.
 */
export function selectRfqc1ReplyTo(input: {
  identity: Rfqc1InboundDispatch;
  buyerReplyTo: string | null;
  flags: Rfqc1InboundReplyToFlags;
}): string | null {
  if (!input.flags.enabled || !input.flags.receiverReady) return input.buyerReplyTo;
  if (!input.flags.receivingDomain || !input.flags.signingSecret)
    throw new Error("RFQC1 inbound receiving is not fully configured");
  return buildRfqc1InboundAlias(input.identity, input.flags.receivingDomain, input.flags.signingSecret);
}

/** Server-only env selection. Never send keys or flags to client components. */
export function selectRfqc1ReplyToFromServer(input: {
  identity: Rfqc1InboundDispatch;
  buyerReplyTo: string | null;
}): string | null {
  return selectRfqc1ReplyTo({
    ...input,
    flags: {
      // A dedicated atomic receipt ledger is a separate founder-authorised gate.
      // Even if earlier two flags are mistakenly enabled, never create
      // incoming Reply-To aliases before the ledger exists.
      // Proof must be a real trusted transport attestation, not mail headers.
      // Currently false until the separate security integration is completed.
      enabled: process.env.RFQC1_INBOUND_EMAIL_ENABLED === "true" &&
        process.env.RFQC1_INBOUND_ATOMIC_LEDGER_READY === "true" &&
        process.env.RFQC1_INBOUND_TRUSTED_SENDER_PROOF_READY === "true" &&
        isRfqc1TrustedSenderVerifierAvailable(),
      receiverReady: process.env.RFQC1_INBOUND_RECEIVER_READY === "true",
      receivingDomain: process.env.RFQC1_INBOUND_DOMAIN,
      signingSecret: process.env.RFQC1_INBOUND_SIGNING_SECRET,
    },
  });
}
