/**
 * DASH-UX2: presentation-only role contract.
 * Sector taxonomy is deliberately independent from organization membership permissions.
 * Missing or unverified sector falls back to a neutral view; never grants access.
 */
import { canWriteWorkspace, type OrganizationRole } from "@/lib/access-policy";

export type CompanySector = "produttore" | "commerciante" | "terzista" | "utilizzatore" | "unknown";
export type DashboardAudience = "supply" | "demand" | "neutral";

export function normalizeCompanySector(value: unknown): CompanySector {
  if (typeof value !== "string") return "unknown";
  const key = value.trim().toLowerCase();
  if (key === "produttore" || key === "produttori") return "produttore";
  if (key === "commerciante" || key === "commercianti") return "commerciante";
  if (key === "terzista" || key === "terzisti") return "terzista";
  if (key === "utilizzatore" || key === "utilizzatori") return "utilizzatore";
  return "unknown";
}

export function dashboardAudience(sector: CompanySector): DashboardAudience {
  if (sector === "produttore" || sector === "commerciante" || sector === "terzista") return "supply";
  if (sector === "utilizzatore") return "demand";
  return "neutral";
}

export function dashboardPresentation(role: OrganizationRole, sector: CompanySector) {
  const audience = dashboardAudience(sector);
  return {
    audience,
    canWrite: canWriteWorkspace(role),
    primaryIntent: audience === "supply" ? "review_inquiries"
      : audience === "demand" ? "create_rfq" : "open_workspace",
    // Capabilities remain authoritative in the server-side access policy.
  } as const;
}
