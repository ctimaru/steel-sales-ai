/**
 * RFQC1.EMAIL1.B — secure, opt-in outbound Reply-To selection.
 * The current buyer Reply-To remains the default. Changing the header alone
 * does NOT enable inbound processing: receiver/ledger/domain have separate gates.
 *
 * Never expose these server-only settings to React components or email bodies.
 */
import { buildRfqc1InboundAlias, type Rfqc1InboundDispatch } from "@/lib/rfqc1-inbound-email";

export type Rfqc1InboundReplyToFlags = {
  enabled: boolean;
  receiverReady: boolean;
  receivingDomain?: string | null;
  signingSecret?: string | null;
};

/**
 * Switch only when the founder-authorized, independently validated receiver
 * is ready. Incomplete configuration fails CLOSED rather than generating a
 * broken alias. No effect on dispatch idempotency, message body or recipients.
 */
export function selectRfqc1ReplyTo(input: {
  identity: Rfqc1InboundDispatch;
  buyerReplyTo: string | null;
  flags: Rfqc1InboundReplyToFlags;
}): string | null {
  if (!input.flags.enabled) return input.buyerReplyTo;
  if (!input.flags.receiverReady) return input.buyerReplyTo;
  if (!input.flags.receivingDomain || !input.flags.signingSecret) {
    throw new Error("RFQC1 inbound receiving is not fully configured");
  }
  return buildRfqc1InboundAlias(
    input.identity,
    input.flags.receivingDomain,
    input.flags.signingSecret,
  );
}

/** Runtime server-only wrapper. By default it returns the original buyer email. */
export function selectRfqc1ReplyToFromServer(input: {
  identity: Rfqc1InboundDispatch;
  buyerReplyTo: string | null;
}): string | null {
  return selectRfqc1ReplyTo({
    ...input,
    flags: {
      enabled: process.env.RFQC1_INBOUND_EMAIL_ENABLED === "true",
      receiverReady: process.env.RFQC1_INBOUND_RECEIVER_READY === "true",
      receivingDomain: process.env.RFQC1_INBOUND_DOMAIN,
      signingSecret: process.env.RFQC1_INBOUND_SIGNING_SECRET,
    },
  });
}
