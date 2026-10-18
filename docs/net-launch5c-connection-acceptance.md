# NET-LAUNCH5C — Authorized real B2B connection acceptance

## Preconditions
- Keep the provisional Network discovery visible but **not connectable**: discovery is not registration or authorization.
- Use two distinct, consenting, activated organizations that can legitimately represent their businesses, with the recipient's Network company ownership link active.
- Both actors must be entitled and authorized for the action. Avoid any service-role impersonation, synthetic prod inserts, or cross-tenant shortcuts.
- Confirm a deployment containing NET-LAUNCH5A/B is actually on the production domain; Vercel/ChatGPT integration may remain blocked by 403.

## Acceptance sequence
1. Capture baseline via read-only SQL: `select count(*) from public.network_connection_requests;` — currently zero at implementation.
2. Actor A searches the **published, reachable** recipient B under `/network`. Confirm the action appears only if authorized readiness reports `available`.
3. Open `/network/{id}/connect`. Select one explicit purpose: offer, request, collaboration.
4. Enter 30–2000 characters explaining a legitimate business purpose; submit once. Confirm pending outbound status and that no extra duplicate pending request can be sent.
5. Actor B signs into their own authorized workspace, sees the received request, and accepts or rejects. Actor A's sent status must reflect the decision.
6. Test withdraw while pending and prevent withdraw after acceptance. Verify both users' notification/read states are correct.
7. Verify cross-tenant isolation: unrelated company C cannot read the request/message. Test Free and Pro access boundaries, and missing/non-owned recipient.
8. Check DB baseline delta against genuine submissions and record screenshot, actor roles, timestamp and outcome (without including private message content).
9. Check provisional discovery profile has no connection button. The “Da confermare” classification is not a verified customer/supplier claim.

## Go/no-go
A passing code test or successful CI **does not** mean a real request was delivered. Mark NET-LAUNCH5C verified only after the authenticated sender and recipient journey succeeds on the production deployment. Do not manufacture usage metrics to pass the gate.
