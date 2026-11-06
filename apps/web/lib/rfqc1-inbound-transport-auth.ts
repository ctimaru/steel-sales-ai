/**
 * RFQC1.EMAIL1.E - explicit fail-closed boundary for SMTP sender identity.
 *
 * A signed Resend webhook authenticates the event publisher, NOT the email
 * sender. Received Email API's From and Authentication-Results headers are
 * supplied as email data, potentially forgeable by SMTP originators.
 *
 * Before allowing RFQH6 writes, integrate a *trusted* receiving provider
 * verdict or verify DKIM/SPF/DMARC against an authenticated source whose
 * provenance is established independently. Never turn this flag on based on
 * arbitrary received.headers, SMTP From, Reply-To or svix signature.
 *
 * Current stage deliberately has no such source. No production or test mail
 * may pass this boundary until a separate evidence-backed implementation.
 */
export function isRfqc1TrustedSenderVerifierAvailable(): boolean {
  return false;
}

/** Does not trust any values in provider mail content or request headers. */
export function isRfqc1SenderAuthenticated(_received: unknown): boolean {
  return false;
}
