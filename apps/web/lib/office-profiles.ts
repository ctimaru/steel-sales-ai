import { canAdministerCompany, canWriteWorkspace } from "@/lib/access-policy";

/**
 * Profili operativi dell'azienda, assegnati dalla Direzione Aziendale.
 *
 * - `direction`  : amministratore dell'azienda o Sales Director. Opera su entrambi gli uffici.
 * - `commercial` : Ufficio commerciale (business_role "salesperson").
 * - `purchasing` : Ufficio acquisti (business_role "purchasing").
 *
 * Regola di prodotto: ogni ufficio VEDE sempre anche l'altro. Il profilo
 * decide soltanto dove si può SCRIVERE. Solo un amministratore assegna i profili.
 * Chi non ha ancora un profilo (o è "operations") conserva i permessi di
 * scrittura di prima, così nessun accesso esistente si restringe senza una scelta
 * esplicita della Direzione.
 */
export const BUSINESS_ROLES = ["sales_director", "salesperson", "purchasing", "operations"] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export type OfficeArea = "commercial" | "purchasing";
export type OfficeProfile = "direction" | OfficeArea;

export function normalizeBusinessRole(value: string | null | undefined): BusinessRole | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return (BUSINESS_ROLES as readonly string[]).includes(normalized)
    ? (normalized as BusinessRole)
    : null;
}

export function officeProfileOf(
  role: string,
  businessRole: string | null | undefined,
): OfficeProfile | null {
  if (canAdministerCompany(role)) return "direction";
  const business = normalizeBusinessRole(businessRole);
  if (business === "sales_director") return "direction";
  if (business === "salesperson") return "commercial";
  if (business === "purchasing") return "purchasing";
  return null;
}

/** Tutti gli utenti dell'azienda consultano entrambi gli uffici. */
export function canReadOffice(_role: string, _area: OfficeArea): boolean {
  return true;
}

export function canWriteOffice(
  role: string,
  businessRole: string | null | undefined,
  area: OfficeArea,
): boolean {
  if (!canWriteWorkspace(role)) return false;
  const profile = officeProfileOf(role, businessRole);
  if (profile === null || profile === "direction") return true;
  return profile === area;
}

/** Solo la Direzione Aziendale concede e cambia i profili. */
export function canManageOfficeProfiles(role: string): boolean {
  return canAdministerCompany(role);
}

export const officeProfileLabels: Record<OfficeProfile, string> = {
  direction: "Direzione aziendale",
  commercial: "Ufficio commerciale",
  purchasing: "Ufficio acquisti",
};

export function businessRoleLabel(role: string | null | undefined): string {
  const business = normalizeBusinessRole(role);
  if (business === "sales_director") return "Direzione commerciale";
  if (business === "salesperson") return officeProfileLabels.commercial;
  if (business === "purchasing") return officeProfileLabels.purchasing;
  if (business === "operations") return "Operations";
  return "Non assegnato";
}

// ── TEAM-PROFILES2 (founder decisions, 26 nov 2026) ───────────────────────────
// Nella pagina «Team e profili» c'è un solo campo «Profilo»: Direzione aziendale
// (= amministratore), Ufficio commerciale, Ufficio acquisti. «Sola lettura» è
// un'opzione a parte. «Direzione commerciale» e «Operations» non si assegnano
// più: chi li ha già li vede come «vecchio profilo» finché la Direzione non
// sceglie un ufficio. Nessun accesso cambia senza una scelta esplicita.

export const TEAM_PROFILE_CHOICES = ["direction", "commercial", "purchasing"] as const;
export type TeamProfileChoice = (typeof TEAM_PROFILE_CHOICES)[number];
/** Profilo mostrato in «Team e profili»; «legacy» = vecchio profilo, null = da assegnare. */
export type TeamProfile = TeamProfileChoice | "legacy" | null;

export function normalizeTeamProfile(value: unknown): TeamProfileChoice | null {
  return typeof value === "string" && (TEAM_PROFILE_CHOICES as readonly string[]).includes(value)
    ? (value as TeamProfileChoice)
    : null;
}

export function teamProfileOf(role: string, businessRole: string | null | undefined): TeamProfile {
  if (canAdministerCompany(role)) return "direction";
  const business = normalizeBusinessRole(businessRole);
  if (business === "salesperson") return "commercial";
  if (business === "purchasing") return "purchasing";
  if (business === "sales_director" || business === "operations") return "legacy";
  return null;
}

/** Permesso e ruolo da salvare per il profilo scelto. La Direzione non è mai in sola lettura. */
export function teamAccessFor(profile: TeamProfileChoice, readOnly: boolean): { role: "admin" | "member" | "viewer"; businessRole: BusinessRole | null } {
  if (profile === "direction") return { role: "admin", businessRole: null };
  return { role: readOnly ? "viewer" : "member", businessRole: profile === "commercial" ? "salesperson" : "purchasing" };
}

export const teamProfileHints: Record<TeamProfileChoice, string> = {
  direction: "vede la Scrivania della Direzione, approva e assegna i profili",
  commercial: "modifica richieste d'offerta e clienti, consulta gli acquisti",
  purchasing: "modifica Centro RFQ e fornitori, consulta le vendite",
};
