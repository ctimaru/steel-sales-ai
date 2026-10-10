/** PLR4.3 shared visual contract, deliberately independent of business workflows. */
export const GOVERNANCE_ROW_CLASS =
  "rounded-2xl border border-[#dce2df] bg-white p-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]";

export const GOVERNANCE_ROW_LINK_CLASS =
  GOVERNANCE_ROW_CLASS + " block hover:border-[#b8d2c8] hover:shadow-sm";

export function governanceStatusTone(status: string): string {
  if (["approved", "activated", "published", "verified", "accepted"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["rejected", "revoked"].includes(status))
    return "border-rose-200 bg-rose-50 text-rose-800";
  if (["needs_information", "changes_requested", "duplicate_existing", "pending_review"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-[#d7dfdb] bg-[#f1f4f8] text-[#43524c]";
}
