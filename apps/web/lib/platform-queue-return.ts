/** Return-to-queue links are assembled exclusively from allowlisted query keys and statuses. */
export function platformQueueReturn(base: "/platform/registrations" | "/platform/knowledge", status?: string, search?: string) {
  const allowed = base === "/platform/registrations"
    ? ["pending_review", "needs_information", "approved", "activated", "rejected"]
    : ["draft", "in_review", "changes_requested", "approved"];
  const params = new URLSearchParams();
  if (status && allowed.includes(status)) params.set("status", status);
  if (base === "/platform/registrations" && search?.trim()) params.set("q", search.trim().slice(0, 120));
  return base + (params.size ? "?" + params.toString() : "");
}
